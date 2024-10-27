
## Finance Tool

## TODO
- up bank
- create UI for queries

# Overview

This tool:
- Parses bank transactions into structed & consistet data
- Stores the data in a SQL Lite database
- Provides a simple interface to query the data

I use uv to manage the python environment, you can get uv here [uv](https://docs.astral.sh/uv/getting-started/installation/)

#### Tree
.
├── README.md
├── data
│   ├── finance-prod.db
│   └── finance-stag.db
├── finance
│   ├── dataloader_commbank.py
│   ├── db.py
│   └── llm.py
├── main.py
├── pyproject.toml
├── raw_data
│   ├── commbank_transactions.csv
│   ├── upbank_transactions.csv
└── uv.lock

## Database

We have a single table in the database called transactions. This table has the following columns:
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

## Usage - Parsing Data - Commonwealth Bank
The data is parsed from a csv file exported from the [commonwealth bank website](https://www.commbank.com.au/). 

The data comes in a janky format (and slowly and tediously) so we need to parse it into a structured format. We do this using a locally run, LLM: Gemma 2.

For example:
````csv
Input: 
`"SP BENCHCLEARERS NEWARK DE USA Card xx1234 USD 55.98 Value Date: 21/10/2024"`
Output:
```json
{
    "merchant_name": "SP BENCHCLEARERS",
    "transaction_type": "Merchant",
    "location": "NEWARK DE USA",
    "currency": "USD",
    "last_4_card_number": "xx1234",
    "date": "21/10/2024"
}
```
````

### Commonwealth Bank Usage
you will need ollama which you can get here [ollama](https://github.com/ollama/ollama)

Make sure ollama is running
```bash
curl -v http://localhost:11434/
```

download a model, i used Gemma2 2B
```bash
ollama pull gemma2:2b
```

Check the model is available
```bash
ollama list
```

Export your trasactions from commonwealth bank as a csv, and put this csv in the raw_data folder

setup the python environment
```bash
uv sync
```

Run the python script with the input file
```bash
python finance/dataloader_commbank.py --i "raw_data/transactions.csv"
```

