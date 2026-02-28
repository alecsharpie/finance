"""Up Bank API client with pagination and rate limiting support."""

import os
import time
import logging
from datetime import datetime
from typing import Generator, Optional, List

import requests
from dotenv import load_dotenv

from .up_models import (
    UpAccount, UpTransaction, UpCategory, Money,
    AccountType, OwnershipType, TransactionStatus
)

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class UpBankAPIError(Exception):
    """Exception raised for Up Bank API errors."""
    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(f"Up Bank API Error ({status_code}): {message}")


class UpBankClient:
    """Client for Up Bank API with rate limiting and pagination support."""

    BASE_URL = "https://api.up.com.au/api/v1"

    def __init__(self, api_token: Optional[str] = None):
        """
        Initialize the Up Bank client.

        Args:
            api_token: Up Bank personal access token. If not provided,
                      will look for UP_BANK_TOKEN environment variable.
        """
        self.api_token = api_token or os.getenv("UP_BANK_TOKEN")
        if not self.api_token:
            raise ValueError(
                "Up Bank API token required. Set UP_BANK_TOKEN env var or pass api_token."
            )

        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {self.api_token}",
            "Content-Type": "application/json"
        })
        self._rate_limit_remaining = None

    def _request(self, method: str, endpoint: str, params: dict = None) -> dict:
        """Make an API request with rate limiting."""
        url = f"{self.BASE_URL}{endpoint}"

        response = self.session.request(method, url, params=params)

        # Track rate limit
        self._rate_limit_remaining = response.headers.get("X-RateLimit-Remaining")
        if self._rate_limit_remaining and int(self._rate_limit_remaining) < 10:
            logger.warning(f"Rate limit low: {self._rate_limit_remaining} requests remaining")
            time.sleep(1)  # Back off slightly

        if response.status_code == 429:
            # Rate limited - wait and retry
            retry_after = int(response.headers.get("Retry-After", 60))
            logger.warning(f"Rate limited. Waiting {retry_after} seconds...")
            time.sleep(retry_after)
            return self._request(method, endpoint, params)

        if not response.ok:
            error_msg = response.json().get("errors", [{}])[0].get("detail", response.text)
            raise UpBankAPIError(response.status_code, error_msg)

        return response.json()

    def ping(self) -> bool:
        """Test API connectivity and authentication."""
        try:
            self._request("GET", "/util/ping")
            logger.info("Up Bank API connection successful")
            return True
        except UpBankAPIError as e:
            logger.error(f"Up Bank API ping failed: {e}")
            return False

    def get_accounts(self) -> List[UpAccount]:
        """Fetch all Up Bank accounts."""
        accounts = []
        next_url = "/accounts"

        while next_url:
            # Handle full URL for pagination
            if next_url.startswith("http"):
                response = self.session.get(next_url).json()
            else:
                response = self._request("GET", next_url)

            for item in response.get("data", []):
                account = self._parse_account(item)
                accounts.append(account)

            next_url = response.get("links", {}).get("next")

        logger.info(f"Fetched {len(accounts)} accounts")
        return accounts

    def get_account(self, account_id: str) -> UpAccount:
        """Fetch a single account by ID."""
        response = self._request("GET", f"/accounts/{account_id}")
        return self._parse_account(response["data"])

    def get_transactions(
        self,
        account_id: Optional[str] = None,
        since: Optional[datetime] = None,
        until: Optional[datetime] = None,
        category: Optional[str] = None,
        status: Optional[TransactionStatus] = None,
        page_size: int = 100
    ) -> Generator[UpTransaction, None, None]:
        """
        Generator yielding transactions with automatic pagination.

        Args:
            account_id: Filter to specific account
            since: Only transactions after this datetime
            until: Only transactions before this datetime
            category: Filter by Up category ID
            status: Filter by HELD or SETTLED
            page_size: Number of transactions per page (max 100)
        """
        if account_id:
            endpoint = f"/accounts/{account_id}/transactions"
        else:
            endpoint = "/transactions"

        params = {"page[size]": min(page_size, 100)}

        if since:
            params["filter[since]"] = since.isoformat()
        if until:
            params["filter[until]"] = until.isoformat()
        if category:
            params["filter[category]"] = category
        if status:
            params["filter[status]"] = status.value

        next_url = endpoint
        total_count = 0

        while next_url:
            if next_url.startswith("http"):
                response = self.session.get(next_url).json()
            else:
                response = self._request("GET", next_url, params if next_url == endpoint else None)

            for item in response.get("data", []):
                transaction = self._parse_transaction(item)
                yield transaction
                total_count += 1

            next_url = response.get("links", {}).get("next")

        logger.info(f"Fetched {total_count} transactions")

    def get_categories(self) -> List[UpCategory]:
        """Fetch Up's built-in category tree."""
        response = self._request("GET", "/categories")
        categories = []

        for item in response.get("data", []):
            parent_data = item.get("relationships", {}).get("parent", {}).get("data")
            parent_id = parent_data.get("id") if parent_data else None

            category = UpCategory(
                id=item["id"],
                name=item["attributes"]["name"],
                parent_id=parent_id
            )
            categories.append(category)

        logger.info(f"Fetched {len(categories)} categories")
        return categories

    def _parse_account(self, data: dict) -> UpAccount:
        """Parse API response into UpAccount model."""
        attrs = data["attributes"]
        balance_data = attrs["balance"]

        return UpAccount(
            id=data["id"],
            display_name=attrs["displayName"],
            account_type=AccountType(attrs["accountType"]),
            ownership_type=OwnershipType(attrs["ownershipType"]),
            balance=Money(
                currencyCode=balance_data["currencyCode"],
                value=balance_data["value"],
                valueInBaseUnits=balance_data["valueInBaseUnits"]
            ),
            created_at=datetime.fromisoformat(attrs["createdAt"].replace("Z", "+00:00"))
        )

    def _parse_transaction(self, data: dict) -> UpTransaction:
        """Parse API response into UpTransaction model."""
        attrs = data["attributes"]
        relationships = data.get("relationships", {})

        # Parse amount
        amount_data = attrs["amount"]
        amount = Money(
            currencyCode=amount_data["currencyCode"],
            value=amount_data["value"],
            valueInBaseUnits=amount_data["valueInBaseUnits"]
        )

        # Parse foreign amount if present
        foreign_amount = None
        if attrs.get("foreignAmount"):
            fa = attrs["foreignAmount"]
            foreign_amount = Money(
                currencyCode=fa["currencyCode"],
                value=fa["value"],
                valueInBaseUnits=fa["valueInBaseUnits"]
            )

        # Parse category
        category_data = relationships.get("category", {}).get("data")
        category_id = category_data.get("id") if category_data else None

        parent_category_data = relationships.get("parentCategory", {}).get("data")
        parent_category_id = parent_category_data.get("id") if parent_category_data else None

        # Parse tags
        tags_data = relationships.get("tags", {}).get("data", [])
        tags = [t["id"] for t in tags_data]

        # Get account ID
        account_data = relationships.get("account", {}).get("data", {})
        account_id = account_data.get("id", "")

        # Parse dates
        settled_at = None
        if attrs.get("settledAt"):
            settled_at = datetime.fromisoformat(attrs["settledAt"].replace("Z", "+00:00"))

        created_at = datetime.fromisoformat(attrs["createdAt"].replace("Z", "+00:00"))

        return UpTransaction(
            id=data["id"],
            status=TransactionStatus(attrs["status"]),
            raw_text=attrs.get("rawText"),
            description=attrs["description"],
            message=attrs.get("message"),
            amount=amount,
            foreign_amount=foreign_amount,
            settled_at=settled_at,
            created_at=created_at,
            category_id=category_id,
            parent_category_id=parent_category_id,
            tags=tags,
            account_id=account_id
        )
