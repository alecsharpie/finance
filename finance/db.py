import sqlite3
import hashlib
import logging
from datetime import datetime
from contextlib import contextmanager
from typing import Dict, Any
import pandas as pd
import os


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def calculate_row_hash(row_data: str) -> str:
    """Calculate hash from raw row data before processing."""
    return hashlib.sha256(f"{row_data}".encode()).hexdigest()

def parse_date(date_str: str) -> str:
    """Parse the date string and return it in YYYY-MM-DD format."""
    try:
        # Assuming the date format in the CSV is DD/MM/YYYY
        parsed_date = datetime.strptime(date_str, "%d/%m/%Y")
        return parsed_date.strftime("%Y-%m-%d")
    except ValueError as e:
        print(f"Error parsing date: {date_str}")
        print(f"Error details: {str(e)}")
        return None
 
class FinanceDB:
    def __init__(self, db_path: str = 'data/finance-stag.db'):
        self.db_path = db_path
        self._ensure_db_exists(self.db_path)
        self._initialize_db()
    
    @contextmanager
    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        try:
            yield conn
        finally:
            conn.close()
    
    def _ensure_db_exists(self, db_path: str):
        """Ensure the database file exists, create it if it doesn't."""
        if not os.path.exists(db_path):
            with sqlite3.connect(db_path) as conn:
                logger.info(f"Database created at {db_path}")
        else:
            logger.info(f"Database already exists at {db_path}")
    
    def _initialize_db(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY,
                date DATE NOT NULL,
                amount REAL NOT NULL,
                balance REAL,
                original_description TEXT NOT NULL,
                merchant_name TEXT,
                transaction_type TEXT,
                location TEXT,
                currency TEXT,
                last_4_card_number TEXT,
                hash TEXT NOT NULL UNIQUE,
                source TEXT NOT NULL
            )
            ''')
            conn.commit()
    
    def insert_transaction(self, transaction_data: Dict[str, Any], hash_value: str):
        if not self.transaction_exists(hash_value):
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                INSERT INTO transactions (date, amount, balance, original_description, merchant_name, transaction_type, location, currency, last_4_card_number, hash, source)
                VALUES (:date, :amount, :balance, :original_description, :merchant_name, :transaction_type, :location, :currency, :last_4_card_number, :hash, :source)
                ''', transaction_data)
                conn.commit()
        else:
            logger.info("Transaction already exists in the database.")
    
    def transaction_exists(self, hash_value: str) -> bool:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT 1 FROM transactions WHERE hash = ?', (hash_value,))
            return cursor.fetchone() is not None
        
    def run_query(self, query: str):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query)
            return cursor.fetchall()
        
    def run_query_pandas(self, query: str):
        with self._get_connection() as conn:
            return pd.read_sql_query(query, conn)