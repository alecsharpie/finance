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

def calculate_row_hash(date: str, description: str, amount: str) -> str:
    """Calculate hash from transaction data for deduplication."""
    return hashlib.sha256(f"{date}|{description}|{amount}".encode()).hexdigest()

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
    def __init__(self, db_path: str = 'data/finance-prod.db'):
        self.db_path = db_path
        self._ensure_db_exists()
        self._initialize_db()
        self._initialize_up_tables()
        self._create_indexes()
    
    @contextmanager
    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        try:
            yield conn
        finally:
            conn.close()
    
    def _ensure_db_exists(self):
        """Ensure the database file exists, create it if it doesn't."""
        if not os.path.exists(self.db_path):
            with sqlite3.connect(self.db_path) as conn:
                logger.info(f"Database created at {self.db_path}")
        else:
            logger.info(f"Database already exists at {self.db_path}")
    
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

    def _initialize_up_tables(self):
        """Create Up Bank specific tables."""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            # Up accounts table
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS up_accounts (
                id TEXT PRIMARY KEY,
                display_name TEXT NOT NULL,
                account_type TEXT NOT NULL,
                ownership_type TEXT NOT NULL,
                current_balance REAL NOT NULL,
                currency_code TEXT DEFAULT 'AUD',
                created_at TIMESTAMP NOT NULL,
                last_synced_at TIMESTAMP,
                is_active BOOLEAN DEFAULT TRUE
            )
            ''')

            # Up transactions table
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS up_transactions (
                id TEXT PRIMARY KEY,
                account_id TEXT NOT NULL,
                status TEXT NOT NULL,
                raw_text TEXT,
                description TEXT NOT NULL,
                message TEXT,
                amount REAL NOT NULL,
                currency_code TEXT DEFAULT 'AUD',
                foreign_amount REAL,
                foreign_currency TEXT,
                category_id TEXT,
                parent_category_id TEXT,
                settled_at TIMESTAMP,
                created_at TIMESTAMP NOT NULL,
                synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (account_id) REFERENCES up_accounts(id)
            )
            ''')

            # Up categories table
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS up_categories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                parent_id TEXT,
                last_synced_at TIMESTAMP,
                FOREIGN KEY (parent_id) REFERENCES up_categories(id)
            )
            ''')

            # Balance snapshots for savings tracking
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS balance_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id TEXT NOT NULL,
                balance REAL NOT NULL,
                snapshot_date DATE NOT NULL,
                snapshot_type TEXT DEFAULT 'daily',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (account_id) REFERENCES up_accounts(id),
                UNIQUE(account_id, snapshot_date, snapshot_type)
            )
            ''')

            # Sync metadata for tracking sync state
            cursor.execute('''
            CREATE TABLE IF NOT EXISTS sync_metadata (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sync_type TEXT NOT NULL,
                account_id TEXT,
                started_at TIMESTAMP NOT NULL,
                completed_at TIMESTAMP,
                status TEXT DEFAULT 'running',
                items_synced INTEGER DEFAULT 0,
                error_message TEXT
            )
            ''')

            conn.commit()
            logger.info("Up Bank tables initialized")
    
    def _create_indexes(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            # Transaction indexes
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_merchant_name ON transactions (merchant_name);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_date ON transactions (date);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_amount ON transactions (amount);")
            # Up transaction indexes
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_up_tx_account ON up_transactions (account_id);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_up_tx_date ON up_transactions (created_at);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_up_tx_category ON up_transactions (category_id);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_up_tx_settled ON up_transactions (settled_at);")
            # Balance snapshot indexes
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_snapshot_account ON balance_snapshots (account_id);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_snapshot_date ON balance_snapshots (snapshot_date);")
            conn.commit()
    
    def insert_transaction(self, transaction_data: Dict[str, Any], hash_value: str):
        """Insert a transaction into the database with better error handling."""
        try:
            if not self.transaction_exists(hash_value):
                with self._get_connection() as conn:
                    cursor = conn.cursor()
                    
                    # Create a query with named parameters for all fields
                    query = '''
                    INSERT INTO transactions (
                        date, amount, balance, original_description, 
                        merchant_name, transaction_type, location, 
                        currency, last_4_card_number, hash, source
                    ) VALUES (
                        :date, :amount, :balance, :original_description,
                        :merchant_name, :transaction_type, :location,
                        :currency, :last_4_card_number, :hash, :source
                    )
                    '''
                    
                    # Execute the query with proper error handling
                    try:
                        cursor.execute(query, transaction_data)
                        conn.commit()
                        return True
                    except sqlite3.Error as e:
                        conn.rollback()
                        logger.error(f"SQLite error: {e}")
                        logger.error(f"Failed transaction data: {transaction_data}")
                        return False
            else:
                logger.info(f"Transaction already exists in the database (hash: {hash_value}).")
                return False
        except Exception as e:
            logger.error(f"Error in insert_transaction: {str(e)}")
            import traceback
            logger.error(traceback.format_exc())
            return False
    
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
        
    def run_query_pandas(self, query, params=None):
        """Run a query and return the results as a pandas DataFrame."""
        try:
            with self._get_connection() as conn:
                if params:
                    return pd.read_sql_query(query, conn, params=params)
                else:
                    return pd.read_sql_query(query, conn)
        except Exception as e:
            print(f"ERROR in run_query_pandas: {str(e)}")
            print(f"Query: {query}")
            print(f"Params: {params}")
            import traceback
            traceback.print_exc()
            raise
    
    def get_schema(self):
        with self._get_connection() as conn:
            cursor = conn.cursor()
            query = "PRAGMA table_info(transactions)"
            result = pd.read_sql_query(query, conn)
            return result

    def get_merchant_categories(self, merchant_name):
        """Get categories for a specific merchant."""
        try:
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

            with self._get_connection() as conn:
                df = pd.read_sql_query(query, conn, params=(merchant_name,))

            if df.empty:
                return []

            return df.to_dict(orient="records")
        except Exception as e:
            print(f"Error getting categories for merchant {merchant_name}: {e}")
            return []

    # =========================================================================
    # Up Bank Methods
    # =========================================================================

    def upsert_up_account(self, account_data: Dict[str, Any]) -> bool:
        """Insert or update an Up Bank account."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                INSERT INTO up_accounts (
                    id, display_name, account_type, ownership_type,
                    current_balance, currency_code, created_at, last_synced_at
                ) VALUES (
                    :id, :display_name, :account_type, :ownership_type,
                    :current_balance, :currency_code, :created_at, :last_synced_at
                )
                ON CONFLICT(id) DO UPDATE SET
                    display_name = excluded.display_name,
                    current_balance = excluded.current_balance,
                    last_synced_at = excluded.last_synced_at
                ''', account_data)
                conn.commit()
                return True
        except sqlite3.Error as e:
            logger.error(f"Error upserting Up account: {e}")
            return False

    def insert_up_transaction(self, tx_data: Dict[str, Any]) -> bool:
        """Insert an Up Bank transaction (skip if exists)."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                INSERT OR IGNORE INTO up_transactions (
                    id, account_id, status, raw_text, description, message,
                    amount, currency_code, foreign_amount, foreign_currency,
                    category_id, parent_category_id, settled_at, created_at
                ) VALUES (
                    :id, :account_id, :status, :raw_text, :description, :message,
                    :amount, :currency_code, :foreign_amount, :foreign_currency,
                    :category_id, :parent_category_id, :settled_at, :created_at
                )
                ''', tx_data)
                conn.commit()
                return cursor.rowcount > 0
        except sqlite3.Error as e:
            logger.error(f"Error inserting Up transaction: {e}")
            return False

    def up_transaction_exists(self, tx_id: str) -> bool:
        """Check if an Up transaction already exists."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT 1 FROM up_transactions WHERE id = ?', (tx_id,))
            return cursor.fetchone() is not None

    def upsert_up_category(self, category_data: Dict[str, Any]) -> bool:
        """Insert or update an Up Bank category."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                INSERT INTO up_categories (id, name, parent_id, last_synced_at)
                VALUES (:id, :name, :parent_id, :last_synced_at)
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    parent_id = excluded.parent_id,
                    last_synced_at = excluded.last_synced_at
                ''', category_data)
                conn.commit()
                return True
        except sqlite3.Error as e:
            logger.error(f"Error upserting Up category: {e}")
            return False

    def insert_balance_snapshot(
        self, account_id: str, balance: float, snapshot_date: str,
        snapshot_type: str = 'daily'
    ) -> bool:
        """Record a balance snapshot for an account."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                INSERT OR REPLACE INTO balance_snapshots
                    (account_id, balance, snapshot_date, snapshot_type)
                VALUES (?, ?, ?, ?)
                ''', (account_id, balance, snapshot_date, snapshot_type))
                conn.commit()
                return True
        except sqlite3.Error as e:
            logger.error(f"Error inserting balance snapshot: {e}")
            return False

    def get_up_accounts(self) -> pd.DataFrame:
        """Get all Up Bank accounts."""
        query = """
        SELECT * FROM up_accounts
        WHERE is_active = TRUE
        ORDER BY account_type, display_name
        """
        return self.run_query_pandas(query)

    def get_up_account(self, account_id: str) -> pd.DataFrame:
        """Get a single Up Bank account."""
        query = "SELECT * FROM up_accounts WHERE id = ?"
        return self.run_query_pandas(query, params=(account_id,))

    def get_up_transactions(
        self, account_id: str = None, start_date: str = None,
        end_date: str = None, category_id: str = None,
        limit: int = 100, offset: int = 0
    ) -> pd.DataFrame:
        """Get Up Bank transactions with filters."""
        conditions = []
        params = []

        if account_id:
            conditions.append("account_id = ?")
            params.append(account_id)
        if start_date:
            conditions.append("DATE(COALESCE(settled_at, created_at)) >= ?")
            params.append(start_date)
        if end_date:
            conditions.append("DATE(COALESCE(settled_at, created_at)) <= ?")
            params.append(end_date)
        if category_id:
            conditions.append("(category_id = ? OR parent_category_id = ?)")
            params.extend([category_id, category_id])

        where_clause = " AND ".join(conditions) if conditions else "1=1"
        params.extend([limit, offset])

        query = f"""
        SELECT * FROM up_transactions
        WHERE {where_clause}
        ORDER BY COALESCE(settled_at, created_at) DESC
        LIMIT ? OFFSET ?
        """
        return self.run_query_pandas(query, params=params)

    def get_savings_history(
        self, start_date: str = None, end_date: str = None
    ) -> pd.DataFrame:
        """
        Get savings balance history for charting.

        Calculates running balances from COMPLETE transaction history to ensure
        accuracy, then filters to the requested date range. Each account's
        history starts from its first transaction (balance $0 before that).
        """
        from datetime import date as date_type

        # Get all saver accounts (including closed ones for historical view)
        accounts_query = """
        SELECT id, display_name, current_balance, account_type, ownership_type, is_active
        FROM up_accounts
        WHERE account_type = 'SAVER'
        """
        accounts_df = self.run_query_pandas(accounts_query)

        if accounts_df.empty:
            return pd.DataFrame()

        today = date_type.today().isoformat()

        # Get ALL daily transaction totals per account (not filtered by date range)
        # This ensures accurate balance calculation
        tx_query = f"""
        SELECT
            account_id,
            DATE(COALESCE(settled_at, created_at)) as tx_date,
            SUM(amount) as daily_total
        FROM up_transactions
        WHERE account_id IN ({','.join(['?' for _ in accounts_df['id']])})
        GROUP BY account_id, tx_date
        ORDER BY tx_date
        """
        tx_df = self.run_query_pandas(tx_query, params=list(accounts_df['id']))

        results = []

        for _, account in accounts_df.iterrows():
            account_id = account['id']
            current_balance = account['current_balance']
            account_info = {
                'account_id': account_id,
                'display_name': account['display_name'],
                'account_type': account['account_type'],
                'ownership_type': account['ownership_type'],
            }

            is_active = account.get('is_active', True)

            # Get ALL transactions for this account
            account_tx = tx_df[tx_df['account_id'] == account_id].copy() if not tx_df.empty else pd.DataFrame()

            if account_tx.empty:
                # No transactions ever - only show for active accounts
                if is_active and (not start_date or today >= start_date) and (not end_date or today <= end_date):
                    results.append({
                        **account_info,
                        'snapshot_date': today,
                        'balance': current_balance
                    })
                continue

            account_tx = account_tx.sort_values('tx_date')
            all_dates = list(account_tx['tx_date'].unique())

            # Calculate starting balance by working backwards from current using ALL transactions
            total_all_tx = account_tx['daily_total'].sum()
            start_balance = current_balance - total_all_tx

            # Build running balance through each transaction date
            running_balance = start_balance
            for tx_date in all_dates:
                daily_amount = account_tx[account_tx['tx_date'] == tx_date]['daily_total'].sum()
                running_balance += daily_amount

                # Only include if within requested date range
                in_range = True
                if start_date and tx_date < start_date:
                    in_range = False
                if end_date and tx_date > end_date:
                    in_range = False

                if in_range:
                    results.append({
                        **account_info,
                        'snapshot_date': tx_date,
                        'balance': running_balance
                    })

            # For active accounts, add today's date with current balance if not already included
            # Closed accounts stop at their last transaction
            if is_active and all_dates[-1] != today:
                in_range = True
                if start_date and today < start_date:
                    in_range = False
                if end_date and today > end_date:
                    in_range = False
                if in_range:
                    results.append({
                        **account_info,
                        'snapshot_date': today,
                        'balance': current_balance
                    })

        if not results:
            return pd.DataFrame()

        return pd.DataFrame(results)

    def get_total_savings(self) -> float:
        """Get current total savings across all saver accounts."""
        query = """
        SELECT COALESCE(SUM(current_balance), 0) as total
        FROM up_accounts
        WHERE account_type = 'SAVER' AND is_active = TRUE
        """
        result = self.run_query_pandas(query)
        return float(result['total'].iloc[0]) if not result.empty else 0.0

    def get_spending_by_category(
        self, account_id: str = None, start_date: str = None, end_date: str = None
    ) -> pd.DataFrame:
        """Get spending breakdown by Up category (grouped by parent category).
        Excludes internal transfers between Up accounts."""
        conditions = [
            "amount < 0",  # Only expenses
            # Exclude internal transfers
            "ut.description NOT LIKE 'Transfer to %'",
            "ut.description NOT LIKE 'Transfer from %'",
            "ut.description NOT LIKE 'Forward to %'",
            "ut.description NOT LIKE 'Forward from %'",
        ]
        params = []

        if account_id:
            conditions.append("ut.account_id = ?")
            params.append(account_id)
        if start_date:
            conditions.append("DATE(COALESCE(ut.settled_at, ut.created_at)) >= ?")
            params.append(start_date)
        if end_date:
            conditions.append("DATE(COALESCE(ut.settled_at, ut.created_at)) <= ?")
            params.append(end_date)

        where_clause = " AND ".join(conditions)

        # Use parent category if available, otherwise use the category itself
        query = f"""
        SELECT
            COALESCE(parent_cat.name, child_cat.name, 'Uncategorized') as category_name,
            COALESCE(ut.parent_category_id, ut.category_id, 'uncategorized') as category_id,
            COUNT(*) as transaction_count,
            ABS(SUM(ut.amount)) as total_amount,
            AVG(ABS(ut.amount)) as avg_amount
        FROM up_transactions ut
        LEFT JOIN up_categories parent_cat ON ut.parent_category_id = parent_cat.id
        LEFT JOIN up_categories child_cat ON ut.category_id = child_cat.id
            AND ut.parent_category_id IS NULL
        WHERE {where_clause}
        GROUP BY COALESCE(ut.parent_category_id, ut.category_id, 'uncategorized')
        ORDER BY total_amount DESC
        """
        return self.run_query_pandas(query, params=params if params else None)

    def get_monthly_spending(
        self, account_id: str = None, months: int = 12
    ) -> pd.DataFrame:
        """Get monthly spending totals. Excludes internal transfers."""
        conditions = [
            "amount < 0",
            # Exclude internal transfers
            "description NOT LIKE 'Transfer to %'",
            "description NOT LIKE 'Transfer from %'",
            "description NOT LIKE 'Forward to %'",
            "description NOT LIKE 'Forward from %'",
        ]
        params = []

        if account_id:
            conditions.append("account_id = ?")
            params.append(account_id)

        where_clause = " AND ".join(conditions)

        query = f"""
        SELECT
            strftime('%Y-%m', COALESCE(settled_at, created_at)) as month,
            COUNT(*) as transaction_count,
            ABS(SUM(amount)) as total_spending
        FROM up_transactions
        WHERE {where_clause}
            AND COALESCE(settled_at, created_at) >= date('now', '-{months} months')
        GROUP BY month
        ORDER BY month DESC
        """
        return self.run_query_pandas(query, params=params if params else None)

    def get_last_up_sync(self, account_id: str = None) -> pd.DataFrame:
        """Get the last successful sync time."""
        if account_id:
            query = """
            SELECT MAX(completed_at) as last_sync
            FROM sync_metadata
            WHERE account_id = ? AND status = 'completed'
            """
            return self.run_query_pandas(query, params=(account_id,))
        else:
            query = """
            SELECT MAX(completed_at) as last_sync
            FROM sync_metadata
            WHERE status = 'completed'
            """
            return self.run_query_pandas(query)

    def record_sync_start(self, sync_type: str, account_id: str = None) -> int:
        """Record the start of a sync operation, return sync_id."""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                INSERT INTO sync_metadata (sync_type, account_id, started_at, status)
                VALUES (?, ?, CURRENT_TIMESTAMP, 'running')
                ''', (sync_type, account_id))
                conn.commit()
                return cursor.lastrowid
        except sqlite3.Error as e:
            logger.error(f"Error recording sync start: {e}")
            return -1

    def record_sync_complete(
        self, sync_id: int, items_synced: int, error_message: str = None
    ):
        """Record sync completion."""
        try:
            status = 'failed' if error_message else 'completed'
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('''
                UPDATE sync_metadata
                SET completed_at = CURRENT_TIMESTAMP,
                    status = ?,
                    items_synced = ?,
                    error_message = ?
                WHERE id = ?
                ''', (status, items_synced, error_message, sync_id))
                conn.commit()
        except sqlite3.Error as e:
            logger.error(f"Error recording sync completion: {e}")