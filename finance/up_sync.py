"""Up Bank synchronization logic for incremental data sync."""

import logging
from datetime import datetime, date, timedelta
from typing import Optional, List

from .up_client import UpBankClient
from .up_models import UpAccount, UpTransaction, UpCategory, SyncResult
from .db import FinanceDB

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class UpBankSync:
    """Handles syncing Up Bank data to local SQLite database."""

    def __init__(self, db: FinanceDB = None, client: UpBankClient = None):
        """
        Initialize sync handler.

        Args:
            db: FinanceDB instance (creates default if not provided)
            client: UpBankClient instance (creates default if not provided)
        """
        self.db = db or FinanceDB()
        self.client = client or UpBankClient()

    def sync_all(self) -> dict:
        """Run full sync: accounts, categories, transactions, and snapshot."""
        results = {}

        # Sync categories first (used for transaction categorization)
        results['categories'] = self.sync_categories()

        # Sync accounts (gets current balances)
        results['accounts'] = self.sync_accounts()

        # Sync transactions for all accounts
        results['transactions'] = self.sync_all_transactions()

        # Record balance snapshot
        self.record_balance_snapshots()

        return results

    def sync_accounts(self) -> SyncResult:
        """Sync all Up Bank accounts."""
        sync_id = self.db.record_sync_start('accounts')
        started_at = datetime.now()
        items_synced = 0
        error_message = None

        try:
            accounts = self.client.get_accounts()

            for account in accounts:
                account_data = {
                    'id': account.id,
                    'display_name': account.display_name,
                    'account_type': account.account_type.value,
                    'ownership_type': account.ownership_type.value,
                    'current_balance': account.balance_dollars,
                    'currency_code': account.balance.currency_code,
                    'created_at': account.created_at.isoformat(),
                    'last_synced_at': datetime.now().isoformat()
                }

                if self.db.upsert_up_account(account_data):
                    items_synced += 1

            logger.info(f"Synced {items_synced} accounts")

        except Exception as e:
            error_message = str(e)
            logger.error(f"Error syncing accounts: {e}")

        self.db.record_sync_complete(sync_id, items_synced, error_message)

        return SyncResult(
            sync_type='accounts',
            items_synced=items_synced,
            started_at=started_at,
            completed_at=datetime.now(),
            status='failed' if error_message else 'completed',
            error_message=error_message
        )

    def sync_categories(self) -> SyncResult:
        """Sync Up Bank categories."""
        sync_id = self.db.record_sync_start('categories')
        started_at = datetime.now()
        items_synced = 0
        error_message = None

        try:
            categories = self.client.get_categories()

            for category in categories:
                category_data = {
                    'id': category.id,
                    'name': category.name,
                    'parent_id': category.parent_id,
                    'last_synced_at': datetime.now().isoformat()
                }

                if self.db.upsert_up_category(category_data):
                    items_synced += 1

            logger.info(f"Synced {items_synced} categories")

        except Exception as e:
            error_message = str(e)
            logger.error(f"Error syncing categories: {e}")

        self.db.record_sync_complete(sync_id, items_synced, error_message)

        return SyncResult(
            sync_type='categories',
            items_synced=items_synced,
            started_at=started_at,
            completed_at=datetime.now(),
            status='failed' if error_message else 'completed',
            error_message=error_message
        )

    def sync_transactions(
        self,
        account_id: Optional[str] = None,
        since: Optional[datetime] = None,
        full_sync: bool = False
    ) -> SyncResult:
        """
        Sync transactions for a specific account.

        Args:
            account_id: Account ID to sync (required)
            since: Only sync transactions after this datetime
            full_sync: If True, sync all transactions regardless of last sync
        """
        if not account_id:
            raise ValueError("account_id is required for transaction sync")

        sync_id = self.db.record_sync_start('transactions', account_id)
        started_at = datetime.now()
        items_synced = 0
        error_message = None

        try:
            # Determine start date for incremental sync
            if not full_sync and not since:
                last_sync = self.db.get_last_up_sync(account_id)
                if not last_sync.empty and last_sync['last_sync'].iloc[0]:
                    since = datetime.fromisoformat(last_sync['last_sync'].iloc[0])

            # Fetch and store transactions
            for tx in self.client.get_transactions(account_id=account_id, since=since):
                tx_data = self._transaction_to_dict(tx)

                if self.db.insert_up_transaction(tx_data):
                    items_synced += 1

            logger.info(f"Synced {items_synced} transactions for account {account_id}")

        except Exception as e:
            error_message = str(e)
            logger.error(f"Error syncing transactions: {e}")

        self.db.record_sync_complete(sync_id, items_synced, error_message)

        return SyncResult(
            sync_type='transactions',
            items_synced=items_synced,
            started_at=started_at,
            completed_at=datetime.now(),
            status='failed' if error_message else 'completed',
            error_message=error_message
        )

    def sync_all_transactions(self, full_sync: bool = False) -> List[SyncResult]:
        """Sync transactions for all accounts."""
        results = []
        accounts = self.db.get_up_accounts()

        if accounts.empty:
            # No accounts synced yet, sync accounts first
            self.sync_accounts()
            accounts = self.db.get_up_accounts()

        for _, account in accounts.iterrows():
            result = self.sync_transactions(
                account_id=account['id'],
                full_sync=full_sync
            )
            results.append(result)

        return results

    def record_balance_snapshots(self, snapshot_type: str = 'daily') -> int:
        """Record current balance for all saver accounts."""
        accounts = self.db.get_up_accounts()
        today = date.today().isoformat()
        snapshots_recorded = 0

        for _, account in accounts.iterrows():
            if account['account_type'] == 'SAVER':
                if self.db.insert_balance_snapshot(
                    account_id=account['id'],
                    balance=account['current_balance'],
                    snapshot_date=today,
                    snapshot_type=snapshot_type
                ):
                    snapshots_recorded += 1

        logger.info(f"Recorded {snapshots_recorded} balance snapshots")
        return snapshots_recorded

    def _transaction_to_dict(self, tx: UpTransaction) -> dict:
        """Convert UpTransaction model to dict for database storage."""
        # Convert foreign_amount string to float if present
        foreign_amount = None
        if tx.foreign_amount:
            try:
                foreign_amount = float(tx.foreign_amount.value)
            except (ValueError, TypeError):
                foreign_amount = None

        return {
            'id': tx.id,
            'account_id': tx.account_id,
            'status': tx.status.value,
            'raw_text': tx.raw_text,
            'description': tx.description,
            'message': tx.message,
            'amount': tx.amount_dollars,
            'currency_code': tx.amount.currency_code,
            'foreign_amount': foreign_amount,
            'foreign_currency': tx.foreign_amount.currency_code if tx.foreign_amount else None,
            'category_id': tx.category_id,
            'parent_category_id': tx.parent_category_id,
            'settled_at': tx.settled_at.isoformat() if tx.settled_at else None,
            'created_at': tx.created_at.isoformat()
        }


def run_sync():
    """CLI entry point for running sync."""
    sync = UpBankSync()

    # Test connection first
    if not sync.client.ping():
        logger.error("Failed to connect to Up Bank API. Check your token.")
        return

    # Run full sync
    results = sync.sync_all()

    print("\n=== Sync Results ===")
    print(f"Categories: {results['categories'].items_synced} synced")
    print(f"Accounts: {results['accounts'].items_synced} synced")

    total_tx = sum(r.items_synced for r in results['transactions'])
    print(f"Transactions: {total_tx} synced across {len(results['transactions'])} accounts")


if __name__ == "__main__":
    run_sync()
