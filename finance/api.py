from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import sys
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
import json

from finance.db import FinanceDB

# Add parent directory to path to import database module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


# Initialize FastAPI app
app = FastAPI(title="Finance Dashboard API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database connection
data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
if not os.path.exists(data_dir):
    os.makedirs(data_dir)
    
db_path = os.path.join(data_dir, "finance-prod.db")
db = FinanceDB(db_path)

@app.get("/")
def read_root():
    return {"message": "Finance Dashboard API is running"}

@app.get("/transactions/recurring")
def get_recurring_transactions():
    """Get recurring transactions from the database."""
    try:
        query = """
        SELECT
            merchant_name,
            amount,
            COUNT(*) as occurrence_count
        FROM
            transactions
        GROUP BY
            merchant_name,
            amount
        HAVING
            COUNT(*) > 1
        ORDER BY
            occurrence_count DESC
        LIMIT 10;
        """
        
        df = db.run_query_pandas(query)
        # Convert DataFrame to list of dictionaries for JSON response
        return df.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch recurring transactions: {str(e)}")

@app.get("/merchants/count")
def get_merchant_counts():
    """Get count of transactions by merchant."""
    try:
        query = """
        SELECT 
            merchant_name, 
            COUNT(*) as transaction_count
        FROM 
            transactions
        GROUP BY
            merchant_name
        ORDER BY
            transaction_count DESC
        LIMIT 10;
        """
        
        df = db.run_query_pandas(query)
        return df.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch merchant counts: {str(e)}")

@app.get("/spending/monthly")
def get_monthly_spending(months: int = Query(6, description="Number of months to include")):
    """Get monthly spending aggregated by transaction type."""
    try:
        query = """
        WITH monthly_spending AS (
            SELECT 
                strftime('%Y-%m', date) as month,
                transaction_type,
                SUM(CAST(REPLACE(REPLACE(amount, '+', ''), '-', '') AS FLOAT)) as total_amount
            FROM transactions
            WHERE date >= date('now', ? || ' months')
            GROUP BY strftime('%Y-%m', date), transaction_type
            ORDER BY month DESC
        )
        SELECT 
            month,
            MAX(CASE WHEN transaction_type = 'Merchant' THEN total_amount ELSE 0 END) as Merchant,
            MAX(CASE WHEN transaction_type = 'Transfer' THEN total_amount ELSE 0 END) as Transfer,
            MAX(CASE WHEN transaction_type = 'Fee' THEN total_amount ELSE 0 END) as Fee
        FROM monthly_spending
        GROUP BY month
        ORDER BY month ASC
        """
        
        df = db.run_query_pandas(query, (-months,))
        return df.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch monthly spending: {str(e)}")

@app.get("/transactions/recent")
def get_recent_transaction():
    """Get most recent transaction."""
    try:
        query = """
        SELECT 
            date,
            amount,
            merchant_name,
            transaction_type,
            source
        FROM 
            transactions
        ORDER BY 
            date DESC
        LIMIT 1;
        """
        
        df = db.run_query_pandas(query)
        if df.empty:
            return {}
        return df.iloc[0].to_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch recent transaction: {str(e)}")

@app.get("/transactions/subscriptions")
def get_subscriptions():
    """Identify potential subscription payments from transaction patterns."""
    try:
        query = """
        WITH monthly_transactions AS (
          SELECT 
            merchant_name,
            CAST(strftime('%Y', date) AS INTEGER) AS year,
            CAST(strftime('%m', date) AS INTEGER) AS month,
            amount,
            date,
            id,
            original_description
          FROM transactions
          WHERE amount < 0 -- Focus on payments (negative amounts)
          AND merchant_name IS NOT NULL
          ORDER BY merchant_name, date
        ),
        merchant_stats AS (
          SELECT 
            merchant_name,
            COUNT(*) AS transaction_count,
            COUNT(DISTINCT year || '-' || month) AS distinct_months,
            ROUND(AVG(ABS(amount)), 2) AS avg_amount,
            MAX(date) AS last_date
          FROM monthly_transactions
          GROUP BY merchant_name
          HAVING 
            transaction_count >= 2 -- At least two transactions
            -- Relaxed criteria: only require 2 months instead of more
            AND distinct_months >= 2 -- Across different months
            -- Relaxed criteria: allow more price variations
            AND (
              -- For each merchant, allow more price variations
              SELECT COUNT(DISTINCT ROUND(ABS(amount), 0)) 
              FROM monthly_transactions mt 
              WHERE mt.merchant_name = merchant_name
            ) <= 5 -- Allow more price variations (was 3)
        )
        SELECT 
          ms.merchant_name,
          ms.transaction_count,
          ms.distinct_months,
          ms.avg_amount,
          ms.last_date,
          (
            SELECT GROUP_CONCAT(mt.date || '|' || mt.amount || '|' || mt.id || '|' || COALESCE(mt.original_description, ''), ';')
            FROM monthly_transactions mt
            WHERE mt.merchant_name = ms.merchant_name
            ORDER BY mt.date DESC
            LIMIT 12
          ) AS recent_transactions
        FROM merchant_stats ms
        WHERE ms.avg_amount > 1 -- Minimum amount threshold
        ORDER BY ms.avg_amount DESC, ms.transaction_count DESC
        """
        
        df = db.run_query_pandas(query)
        
        if df.empty:
            return []
            
        # Process the results to format them properly
        result = []
        for _, row in df.iterrows():
            transactions = []
            if row['recent_transactions']:
                for tx_data in row['recent_transactions'].split(';'):
                    if not tx_data:
                        continue
                    parts = tx_data.split('|')
                    if len(parts) >= 3:
                        date, amount, id = parts[0], parts[1], parts[2]
                        desc = parts[3] if len(parts) > 3 else ""
                        transactions.append({
                            "date": date,
                            "amount": float(amount),
                            "id": id,
                            "desc": desc
                        })
            
            # Analyze frequency pattern
            frequency = "unknown"
            if len(transactions) >= 2:
                # Sort by date
                sorted_txns = sorted(transactions, key=lambda x: x["date"])
                
                # Calculate differences between consecutive dates in days
                days_diff = []
                for i in range(1, len(sorted_txns)):
                    date1 = datetime.strptime(sorted_txns[i-1]["date"], "%Y-%m-%d")
                    date2 = datetime.strptime(sorted_txns[i]["date"], "%Y-%m-%d")
                    diff = (date2 - date1).days
                    days_diff.append(diff)
                
                # Average difference
                if days_diff:
                    avg_diff = sum(days_diff) / len(days_diff)
                    
                    # Determine frequency pattern - more lenient ranges
                    if 20 <= avg_diff <= 40:  # Wider range for monthly (was 25-35)
                        frequency = "monthly"
                    elif 80 <= avg_diff <= 100:  # Wider range for quarterly (was 85-95)
                        frequency = "quarterly"
                    elif 350 <= avg_diff <= 380:  # Wider range for yearly (was 355-375)
                        frequency = "yearly"
                    else:
                        frequency = "irregular"
            
            result.append({
                "merchant": row["merchant_name"],
                "count": int(row["transaction_count"]),
                "months": int(row["distinct_months"]),
                "avgAmount": float(row["avg_amount"]),
                "lastDate": row["last_date"],
                "transactions": transactions,
                "frequency": frequency,
                # Add debug info
                "debug": {
                    "days_between": days_diff if 'days_diff' in locals() else [],
                    "avg_days": avg_diff if 'avg_diff' in locals() else None
                }
            })
        
        # More lenient filtering - include all recurring transactions
        # Instead of filtering, just return all and let the UI decide what to show
        # likely_subscriptions = [sub for sub in result if 
        #                       sub["frequency"] in ["monthly", "quarterly"] or 
        #                       sub["months"] >= 3]
        
        return result  # Return all potential subscriptions
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze subscriptions: {str(e)}")

@app.get("/transactions/timeline")
def get_transaction_timeline():
    """Get transactions for timeline view."""
    try:
        query = """
        SELECT 
            id,
            date,
            amount,
            merchant_name,
            transaction_type,
            original_description
        FROM 
            transactions
        WHERE 
            date >= date('now', '-3 months')
        ORDER BY 
            date DESC
        """
        
        df = db.run_query_pandas(query)
        return df.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch transaction timeline: {str(e)}")

# Run with: uvicorn main:app --reload --port 3001
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3001) 