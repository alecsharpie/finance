from fastapi import FastAPI, Query, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import sys
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
import json
import pandas as pd
import tempfile

from finance.db import FinanceDB
from finance.dataloader_commbank import process_commbank_transactions_file

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
def get_transaction_timeline(
    start_date: str = Query(..., description="Start date in YYYY-MM-DD format"),
    end_date: str = Query(..., description="End date in YYYY-MM-DD format"),
    view_mode: str = Query("monthly", description="View mode: yearly, monthly, daily, or hourly")
):
    """Get transaction timeline data for financial calendar."""
    try:
        # Base query to get all transactions in the date range
        query = """
        SELECT 
            id,
            date,
            amount,
            merchant_name,
            transaction_type
        FROM 
            transactions
        WHERE 
            date BETWEEN ? AND ?
        ORDER BY 
            date
        """
        
        df = db.run_query_pandas(query, (start_date, end_date))
        
        if df.empty:
            return {}
            
        # Convert amounts to float and ensure negative values for expenses
        df['amount'] = df['amount'].apply(lambda x: float(str(x).replace('+', '').replace('-', '-')))
        
        # Group by period based on view_mode
        if view_mode == 'yearly':
            period_format = '%Y'
        elif view_mode == 'monthly':
            period_format = '%Y-%m'
        elif view_mode == 'daily':
            period_format = '%Y-%m-%d'
        else:  # hourly - we'll use daily for now since we don't have hour data
            period_format = '%Y-%m-%d'
            
        # Add period column
        df['period'] = df['date'].apply(lambda x: datetime.strptime(x, '%Y-%m-%d').strftime(period_format))
        
        # Identify recurring transactions (simplified approach)
        # Group by merchant and amount, count occurrences
        merchant_counts = df.groupby(['merchant_name', 'amount']).size().reset_index(name='count')
        recurring_merchants = set(merchant_counts[merchant_counts['count'] > 1]['merchant_name'])
        
        # Mark transactions as recurring or one-time
        df['is_recurring'] = df['merchant_name'].apply(lambda x: x in recurring_merchants)
        
        # Group by period and transaction type (recurring vs one-time)
        result = {}
        for period in df['period'].unique():
            period_df = df[df['period'] == period]
            
            recurring_df = period_df[period_df['is_recurring']]
            onetime_df = period_df[~period_df['is_recurring']]
            
            # Calculate totals (use absolute values for display)
            recurring_total = abs(recurring_df['amount'].sum()) if not recurring_df.empty else 0
            onetime_total = abs(onetime_df['amount'].sum()) if not onetime_df.empty else 0
            
            # Get top transactions for each category
            recurring_transactions = []
            for _, row in recurring_df.iterrows():
                recurring_transactions.append({
                    'merchant': row['merchant_name'],
                    'amount': abs(float(row['amount'])),
                    'type': row['transaction_type'],
                    'count': int(merchant_counts[(merchant_counts['merchant_name'] == row['merchant_name']) & 
                                              (merchant_counts['amount'] == row['amount'])]['count'].values[0])
                })
            
            onetime_transactions = []
            for _, row in onetime_df.iterrows():
                onetime_transactions.append({
                    'merchant': row['merchant_name'],
                    'amount': abs(float(row['amount'])),
                    'type': row['transaction_type']
                })
            
            result[period] = {
                'recurring': {
                    'total': recurring_total,
                    'transactions': sorted(recurring_transactions, key=lambda x: x['amount'], reverse=True)
                },
                'one-time': {
                    'total': onetime_total,
                    'transactions': sorted(onetime_transactions, key=lambda x: x['amount'], reverse=True)
                }
            }
            
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch transaction timeline: {str(e)}")

@app.get("/merchants/all")
def get_all_merchants():
    """Get all unique merchants from the database."""
    try:
        query = """
        SELECT DISTINCT
            merchant_name,
            COUNT(*) as transaction_count,
            SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_spent,
            MAX(date) as last_transaction
        FROM 
            transactions
        WHERE
            merchant_name IS NOT NULL
            AND merchant_name != ''
        GROUP BY
            merchant_name
        ORDER BY
            transaction_count DESC;
        """
        
        df = db.run_query_pandas(query)
        return df.to_dict(orient="records")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch merchants: {str(e)}")

@app.get("/categories")
def get_categories():
    """Get all categories from the database."""
    try:
        # Check if categories table exists
        check_query = """
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='categories';
        """
        print(f"Checking if categories table exists...")
        check_df = db.run_query_pandas(check_query)
        
        if check_df.empty:
            print(f"Categories table does not exist, creating it...")
            # Create categories table if it doesn't exist
            create_table_query = """
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                color TEXT,
                icon TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """
            db.run_query(create_table_query)
            print(f"Categories table created successfully")
            
            # Create merchant_categories table for the many-to-many relationship
            print(f"Creating merchant_categories table...")
            create_mapping_table_query = """
            CREATE TABLE IF NOT EXISTS merchant_categories (
                id INTEGER PRIMARY KEY,
                merchant_name TEXT NOT NULL,
                category_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES categories (id),
                UNIQUE(merchant_name, category_id)
            );
            """
            db.run_query(create_mapping_table_query)
            print(f"merchant_categories table created successfully")
            
            # Add some default categories
            print(f"Adding default categories...")
            default_categories = [
                ("Food & Dining", "#FF5733", "🍔"),
                ("Shopping", "#33FF57", "🛍️"),
                ("Transportation", "#3357FF", "🚗"),
                ("Entertainment", "#F033FF", "🎬"),
                ("Utilities", "#FF33A8", "💡"),
                ("Housing", "#33FFF5", "🏠"),
                ("Travel", "#F5FF33", "✈️"),
                ("Health", "#FF3333", "🏥"),
                ("Education", "#33FFBD", "📚"),
                ("Personal", "#BD33FF", "👤")
            ]
            
            insert_query = """
            INSERT INTO categories (name, color, icon)
            VALUES (?, ?, ?);
            """
            
            with db._get_connection() as conn:
                cursor = conn.cursor()
                for category in default_categories:
                    try:
                        cursor.execute(insert_query, category)
                        print(f"Added category: {category[0]}")
                    except Exception as e:
                        print(f"Error inserting category {category}: {e}")
                conn.commit()
            print(f"Default categories added successfully")
        else:
            print(f"Categories table already exists")
        
        # Get all categories
        print(f"Fetching all categories...")
        query = """
        SELECT 
            c.id, 
            c.name, 
            c.color, 
            c.icon,
            COUNT(mc.merchant_name) as merchant_count
        FROM 
            categories c
        LEFT JOIN 
            merchant_categories mc ON c.id = mc.category_id
        GROUP BY 
            c.id
        ORDER BY 
            c.name;
        """
        
        df = db.run_query_pandas(query)
        print(f"Found {len(df)} categories")
        return df.to_dict(orient="records")
    except Exception as e:
        print(f"ERROR in get_categories: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch categories: {str(e)}")

@app.post("/categories")
def create_category(category: dict):
    """Create a new category."""
    try:
        query = """
        INSERT INTO categories (name, color, icon)
        VALUES (:name, :color, :icon)
        RETURNING id;
        """
        
        with db._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, category)
            category_id = cursor.fetchone()[0]
            conn.commit()
            
        return {"id": category_id, **category}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create category: {str(e)}")

@app.get("/merchants/{merchant_name}/categories")
def get_merchant_categories(merchant_name: str):
    """Get all categories for a merchant."""
    try:
        print(f"Fetching categories for merchant: {merchant_name}")
        
        query = """
        SELECT 
            c.id, 
            c.name, 
            c.color, 
            c.icon
        FROM 
            categories c
        JOIN 
            merchant_categories mc ON c.id = mc.category_id
        WHERE 
            mc.merchant_name = ?;
        """
        
        df = db.run_query_pandas(query, (merchant_name,))
        
        if df.empty:
            raise HTTPException(status_code=404, detail=f"No categories found for merchant: {merchant_name}")
            
        return df.to_dict(orient="records")
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        print(f"ERROR in get_merchant_categories: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch merchant categories: {str(e)}")

@app.post("/merchants/{merchant_name}/categories/{category_id}")
def add_merchant_category(merchant_name: str, category_id: int):
    """Add a category to a merchant."""
    try:
        query = """
        INSERT INTO merchant_categories (merchant_name, category_id)
        VALUES (?, ?)
        ON CONFLICT (merchant_name, category_id) DO NOTHING;
        """
        
        with db._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, (merchant_name, category_id))
            conn.commit()
            
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add category to merchant: {str(e)}")

@app.delete("/merchants/{merchant_name}/categories/{category_id}")
def remove_merchant_category(merchant_name: str, category_id: int):
    """Remove a category from a merchant."""
    try:
        query = """
        DELETE FROM merchant_categories
        WHERE merchant_name = ? AND category_id = ?;
        """
        
        with db._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, (merchant_name, category_id))
            conn.commit()
            
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to remove category from merchant: {str(e)}")

@app.get("/transactions/timeline/categories")
def get_transaction_timeline_with_categories(
    start_date: str = Query(..., description="Start date in YYYY-MM-DD format"),
    end_date: str = Query(..., description="End date in YYYY-MM-DD format"),
    view_mode: str = Query("monthly", description="View mode: yearly, monthly, daily, or hourly")
):
    """Get transaction timeline data with category breakdown."""
    try:
        # Base query to get all transactions in the date range with their categories
        query = """
        SELECT 
            t.id,
            t.date,
            t.amount,
            t.merchant_name,
            t.transaction_type,
            c.id as category_id,
            c.name as category_name,
            c.color as category_color,
            c.icon as category_icon
        FROM 
            transactions t
        LEFT JOIN 
            merchant_categories mc ON t.merchant_name = mc.merchant_name
        LEFT JOIN 
            categories c ON mc.category_id = c.id
        WHERE 
            t.date BETWEEN ? AND ?
        ORDER BY 
            t.date
        """
        
        df = db.run_query_pandas(query, (start_date, end_date))
        
        if df.empty:
            return {}
            
        # Convert amounts to float and ensure negative values for expenses
        df['amount'] = df['amount'].apply(lambda x: float(str(x).replace('+', '').replace('-', '-')))
        
        # Group by period based on view_mode
        if view_mode == 'yearly':
            period_format = '%Y'
        elif view_mode == 'monthly':
            period_format = '%Y-%m'
        elif view_mode == 'daily':
            period_format = '%Y-%m-%d'
        else:  # hourly - we'll use daily for now since we don't have hour data
            period_format = '%Y-%m-%d'
            
        # Add period column
        df['period'] = df['date'].apply(lambda x: datetime.strptime(x, '%Y-%m-%d').strftime(period_format))
        
        # Group by period and category
        result = {}
        for period in df['period'].unique():
            period_df = df[df['period'] == period]
            
            # Initialize period data
            result[period] = {
                'total': float(period_df['amount'].sum()),
                'transactions': [],
                'categories': {}
            }
            
            # Process transactions and organize by category
            for _, tx in period_df.iterrows():
                tx_dict = tx.to_dict()
                
                # Add to transactions list
                result[period]['transactions'].append({
                    'date': tx_dict['date'],
                    'amount': float(tx_dict['amount']),
                    'merchant_name': tx_dict['merchant_name'],
                    'description': tx_dict.get('original_description', '')
                })
                
                # Add to category breakdown
                if pd.notna(tx_dict['category_name']):
                    category_name = tx_dict['category_name']
                    
                    if category_name not in result[period]['categories']:
                        result[period]['categories'][category_name] = {
                            'amount': 0,
                            'count': 0,
                            'color': tx_dict['category_color'],
                            'icon': tx_dict['category_icon']
                        }
                    
                    result[period]['categories'][category_name]['amount'] += float(tx_dict['amount'])
                    result[period]['categories'][category_name]['count'] += 1
        
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch transaction timeline with categories: {str(e)}")

@app.delete("/categories/{category_id}")
def delete_category(category_id: int):
    """Delete a category and remove all its associations with merchants."""
    try:
        # First delete all merchant associations
        delete_associations_query = """
        DELETE FROM merchant_categories
        WHERE category_id = ?;
        """
        
        # Then delete the category
        delete_category_query = """
        DELETE FROM categories
        WHERE id = ?;
        """
        
        with db._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(delete_associations_query, (category_id,))
            cursor.execute(delete_category_query, (category_id,))
            conn.commit()
            
        return {"status": "success", "message": "Category deleted successfully"}
    except Exception as e:
        print(f"ERROR in delete_category: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to delete category: {str(e)}")

@app.get("/transactions/raw")
def get_raw_transactions(
    limit: int = Query(1000, description="Maximum number of transactions to return"),
    offset: int = Query(0, description="Offset for pagination")
):
    """Get raw transaction data for display and export."""
    try:
        query = """
        SELECT 
            id,
            date,
            amount,
            balance,
            original_description,
            merchant_name,
            transaction_type,
            location,
            currency,
            last_4_card_number,
            source
        FROM 
            transactions
        ORDER BY 
            date DESC
        LIMIT ? OFFSET ?
        """
        
        df = db.run_query_pandas(query, (limit, offset))
        
        # Get total count for pagination
        count_query = "SELECT COUNT(*) as total FROM transactions"
        count_df = db.run_query_pandas(count_query)
        total_count = int(count_df.iloc[0]['total'])
        
        return {
            "transactions": df.to_dict(orient="records"),
            "pagination": {
                "total": total_count,
                "limit": limit,
                "offset": offset
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch raw transactions: {str(e)}")

@app.post("/transactions/upload/commbank")
async def upload_commbank_transactions(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db_path: str = Query("data/finance-stag.db", description="Database path")
):
    """Upload and process Commonwealth Bank transactions CSV file."""
    try:
        # Create a temporary file to store the uploaded content
        with tempfile.NamedTemporaryFile(delete=False, suffix='.csv') as temp_file:
            # Write the uploaded file content to the temp file
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        # Get an estimate of the number of rows to process
        with open(temp_file_path, 'r', encoding='utf-8') as f:
            row_count = sum(1 for _ in f) - 1  # Subtract 1 for header
        
        # Process the file in the background to avoid timeout
        background_tasks.add_task(
            process_commbank_transactions_file,
            temp_file_path,
            db_path,
            model="gemma2:2b"
        )
        
        # Return success response with estimated processing time
        estimated_time = max(1, row_count // 10)  # Rough estimate: 10 rows per minute
        
        return {
            "status": "success",
            "message": f"File uploaded and processing started. Transactions will be added to the database.",
            "filename": file.filename,
            "estimated_rows": row_count,
            "estimated_time_minutes": estimated_time
        }
    except Exception as e:
        # Clean up temp file if it exists
        if 'temp_file_path' in locals():
            os.unlink(temp_file_path)
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")
    finally:
        # Close the file
        await file.close()

# Run with: uvicorn main:app --reload --port 3001
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3001) 