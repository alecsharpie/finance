import csv
from typing import List
import argparse
from tqdm import tqdm
import os
import tempfile
import sys

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from finance.db import FinanceDB, calculate_row_hash, parse_date
from finance.llm import query_ollama, parse_json_response, is_valid_json

def create_commbank_prompt(transaction: List[str]) -> str:
    """Create a prompt for the LLM with examples and the current transaction."""
    prompt = f"""Please parse the following bank transaction and extract key information in JSON format.
Include these fields: merchant_name, transaction_type, location (if present), currency (if present), last_4_card_number (if present), date (if present).

Return only the JSON object, no additional text. If a field is not present, use null.

Here are some examples of how to parse similar transactions:

Input: "UBER* TRIP"
Output:
```json
{{
    "merchant_name": "UBER* TRIP",
    "transaction_type": "Merchant",
    "location": null,
    "currency": null,
    "last_4_card_number": null,
    "date": null
}}
```

Input: "EZI*TPC Fitzroy MELBOURNE AU AUS Card xx4321 Value Date: 24/10/2024"
Output:
```json
{{
    "merchant_name": "EZI*TPC",
    "transaction_type": "Merchant",
    "location": "Fitzroy MELBOURNE AU AUS",
    "currency": "AUS",
    "last_4_card_number": "xx4321",
    "date": "24/10/2024"
}}
```

Input: "SP BENCHCLEARERS NEWARK DE USA Card xx1234 USD 55.98 Value Date: 21/10/2024"
Output:
```json
{{
    "merchant_name": "SP BENCHCLEARERS",
    "transaction_type": "Merchant",
    "location": "NEWARK DE USA",
    "currency": "USD",
    "last_4_card_number": "xx1234",
    "date": "21/10/2024"
}}
```

Input: "Direct Debit 376681 John Doe PT 155982777"
Output:
```json
{{
    "merchant_name": "Joe Blog PT 155982777",
    "transaction_type": "Direct Debit",
    "location": null,
    "currency": null,
    "last_4_card_number": null,
    "date": null
}}
```

Input: "International Transaction Fee Value Date: 20/10/2024"
Output:
```json
{{
    "merchant_name": "International Transaction Fee",
    "transaction_type": "Fee",
    "location": null,
    "currency": null,
    "last_4_card_number": null,
    "date": "20/10/2024"
}}
```

Input: "Transfer To J R Blog PayID Phone from CommBank App Octoberfest"
Output:
```json
{{
    "merchant_name": "J R Blog PayID Phone",
    "transaction_type": "Transfer",
    "location": null,
    "currency": null,
    "last_4_card_number": null,
    "date": null
}}

Now parse this transaction:
Input: "{transaction[2]}"
Output:
"""
    return prompt

def process_commbank_transactions_file(file_path, db_path, model="gemma2:2b"):
    """Process a Commonwealth Bank transactions CSV file and insert into database."""
    print(f"Processing file: {file_path}")
    print(f"Using database: {db_path}")
    print(f"Using model: {model}")
    
    # Initialize database
    db = FinanceDB(db_path)
    
    # Read and process the CSV file
    with open(file_path, 'r', encoding='utf-8') as file:
        reader = csv.reader(file)
        rows = list(reader)
    
    # Process transactions
    for row in tqdm(rows, desc="Processing transactions"):
        if len(row) >= 4:  # Ensure row has enough columns
            date = row[0]
            description = row[1]
            amount = row[2]
            balance = row[3]
            
            # Skip header row or rows without proper data
            if date == "Date" or not date or not amount:
                continue
                
            # Create prompt for LLM
            prompt = create_commbank_prompt(description)
            
            # Query LLM
            response = query_ollama(prompt, model=model)
            
            # Parse response
            if is_valid_json(response):
                parsed_data = parse_json_response(response)
                
                # Calculate hash for deduplication
                row_hash = calculate_row_hash(date, description, amount)
                
                # Format date if present in parsed data
                transaction_date = parsed_data.get('date')
                if transaction_date:
                    parsed_date = parse_date(transaction_date)
                    if parsed_date:
                        date = parsed_date
                
                # Create transaction data dictionary
                transaction_data = {
                    "date": date,
                    "amount": amount,
                    "balance": balance,
                    "original_description": description,
                    "merchant_name": parsed_data.get('merchant_name'),
                    "transaction_type": parsed_data.get('transaction_type'),
                    "location": parsed_data.get('location'),
                    "currency": parsed_data.get('currency'),
                    "last_4_card_number": parsed_data.get('last_4_card_number'),
                    "hash": row_hash,
                    "source": "commbank"
                }
                
                # Insert into database
                db.insert_transaction(transaction_data, row_hash)
    
    print(f"Processing complete. Transactions added to database.")
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-file", "-i", help="Input file path", type=str, required=True)
    parser.add_argument("--db-path", "-d", help="Database path", type=str, default="data/finance-stag.db")
    parser.add_argument("--model", "-m", help="LLM model to use", type=str, default="gemma2:2b")
    args = parser.parse_args()
    
    print(f"Processing file: {args.input_file}")
    print(f"Using database: {args.db_path}")
    print(f"Using model: {args.model}")
    
    process_commbank_transactions_file(args.input_file, args.db_path, model=args.model)