"""Pydantic models for Up Bank API data structures."""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from enum import Enum


class AccountType(str, Enum):
    TRANSACTIONAL = "TRANSACTIONAL"
    SAVER = "SAVER"
    HOME_LOAN = "HOME_LOAN"


class OwnershipType(str, Enum):
    INDIVIDUAL = "INDIVIDUAL"
    JOINT = "JOINT"


class TransactionStatus(str, Enum):
    HELD = "HELD"
    SETTLED = "SETTLED"


class Money(BaseModel):
    """Represents a monetary amount with currency."""
    currency_code: str = Field(alias="currencyCode")
    value: str
    value_in_base_units: int = Field(alias="valueInBaseUnits")

    class Config:
        populate_by_name = True


class UpAccount(BaseModel):
    """Up Bank account model."""
    id: str
    display_name: str
    account_type: AccountType
    ownership_type: OwnershipType
    balance: Money
    created_at: datetime

    @property
    def is_saver(self) -> bool:
        return self.account_type == AccountType.SAVER

    @property
    def is_2up(self) -> bool:
        return self.ownership_type == OwnershipType.JOINT

    @property
    def balance_dollars(self) -> float:
        return float(self.balance.value)


class UpTransaction(BaseModel):
    """Up Bank transaction model."""
    id: str
    status: TransactionStatus
    raw_text: Optional[str] = None
    description: str
    message: Optional[str] = None
    amount: Money
    foreign_amount: Optional[Money] = None
    settled_at: Optional[datetime] = None
    created_at: datetime
    category_id: Optional[str] = None
    parent_category_id: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    account_id: str

    @property
    def amount_dollars(self) -> float:
        return float(self.amount.value)

    @property
    def is_expense(self) -> bool:
        return self.amount_dollars < 0

    @property
    def is_income(self) -> bool:
        return self.amount_dollars > 0


class UpCategory(BaseModel):
    """Up Bank category model."""
    id: str
    name: str
    parent_id: Optional[str] = None


class SyncResult(BaseModel):
    """Result of a sync operation."""
    sync_type: str
    items_synced: int
    started_at: datetime
    completed_at: Optional[datetime] = None
    status: str = "completed"
    error_message: Optional[str] = None
