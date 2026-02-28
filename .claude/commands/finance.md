# /finance - Personal Finance Exploration Skill

Explore and analyze personal finances using the Up Bank integration.

## Overview

This skill allows Claude to agentically explore your finances, helping you understand spending patterns, track savings growth, and make informed financial decisions.

## Your Financial Setup

- **Income**: Paid into CommBank, $2,500 stays for rent
- **Transfer to Up**: ~$7,000 monthly
- **2Up shared account**: ~$5,000/month spending with wife
- **Shared savers**: Wife saves ~$4,000/month + your ~$2,000 when possible
- **Goal**: Save money to start a family

## Available Commands

### Summary
Get a high-level financial overview:
```bash
curl -s http://localhost:3001/up/summary | python -m json.tool
```

### Savings
Check savings accounts and growth:
```bash
# Current savings total
curl -s http://localhost:3001/up/savings/total | python -m json.tool

# Savings history (for trends)
curl -s "http://localhost:3001/up/savings/history?start_date=2024-01-01" | python -m json.tool
```

### Spending Breakdown
Analyze where money is going:
```bash
# All spending by category (last month)
curl -s "http://localhost:3001/up/spending/breakdown?start_date=$(date -v-1m +%Y-%m-%d)" | python -m json.tool

# 2Up account spending only (get account_id from /up/accounts first)
curl -s "http://localhost:3001/up/spending/breakdown?account_id=ACCOUNT_ID&start_date=$(date -v-1m +%Y-%m-%d)" | python -m json.tool
```

### Transactions
Search and explore transactions:
```bash
# Recent transactions
curl -s "http://localhost:3001/up/transactions?limit=50" | python -m json.tool

# Transactions for specific account
curl -s "http://localhost:3001/up/accounts/ACCOUNT_ID/transactions?limit=50" | python -m json.tool

# Transactions in date range
curl -s "http://localhost:3001/up/transactions?start_date=2024-01-01&end_date=2024-01-31" | python -m json.tool
```

### Accounts
List all Up Bank accounts:
```bash
curl -s http://localhost:3001/up/accounts | python -m json.tool
```

### Sync
Trigger a fresh sync from Up Bank:
```bash
curl -s -X POST http://localhost:3001/up/sync | python -m json.tool

# Check sync status
curl -s http://localhost:3001/up/sync/status | python -m json.tool
```

### Categories
Get Up Bank's spending categories:
```bash
curl -s http://localhost:3001/up/categories | python -m json.tool
```

## API Base URL

All endpoints are at: `http://localhost:3001`

Make sure the finance API server is running:
```bash
cd /Users/alec/me/finance && make api
```

## Example Queries

**"How much have we saved this year?"**
- Fetch savings history from Jan 1st
- Compare first and latest balance
- Calculate growth rate

**"What's our biggest spending category this month?"**
- Get spending breakdown for current month
- Sort by total_amount descending
- Identify top 3 categories

**"Show me all Uber transactions"**
- Fetch transactions with description search
- Filter for "Uber" in results

**"Are we on track for our savings goal?"**
- Get current total savings
- Calculate monthly savings rate from history
- Project future savings based on rate

## Tips for Analysis

1. The 2Up account (ownership_type: JOINT) is where shared spending happens
2. SAVER accounts are where savings accumulate
3. Negative amounts are expenses, positive are income/transfers
4. Up categories are hierarchical (parent_category_id links to parent)
5. Use date filters to focus analysis on specific periods
