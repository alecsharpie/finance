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

# Run with: uvicorn main:app --reload --port 3001
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3001) 