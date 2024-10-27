import csv
from typing import List
import argparse
from tqdm import tqdm

from db import FinanceDB, calculate_row_hash
from llm import query_ollama, parse_json_response

db = FinanceDB('finance.db')

def create_commbank_prompt(transaction: List[str]) -> str:
    """Create a prompt for the LLM with examples and the current transaction."""
    if len(transaction) != 4:
        raise ValueError("Transaction list must contain at least three elements.")
    
    prompt = f"""Please parse the following bank transaction and extract key information in JSON format.
Include these fields: merchant_name, location (if present), currency, card_number (if present), value_date (if present).

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

def process_commbank_transactions_file(input_file: str, model: str = "gemma2:9b"):
    """Process the entire transactions file using Ollama and write to an sqllite db.
    Expects a csv with columns: date, amount, original_description, balance.
    E.g. 26/10/2024,'-7.73','UBER* TRIP','+232.41'"""
    with open(input_file, 'r', newline='') as infile:
        
        reader = csv.reader(infile)
        
        for row in tqdm(reader):
            try:
                row_hash = calculate_row_hash(','.join(row))
                if db.row_exists(row_hash):
                    continue
                
                prompt = create_commbank_prompt(row)
                response = query_ollama(prompt, model)
                parsed_data = parse_json_response(response)
                
                parsed_data = [
                    row[0],  # date
                    row[1],  # amount
                    row[3],  # balance
                    row[2],   # original_description
                    parsed_data.get('transaction_type', ''),
                    parsed_data.get('merchant_name', ''),
                    parsed_data.get('location', ''),
                    parsed_data.get('currency', ''),
                    parsed_data.get('last_4_card_number', ''),
                    parsed_data.get('date', '')
                ]
                if parsed_data:
                    db.insert_transaction(parsed_data, row_hash)
                    
            except Exception as e:
                print(f"Error processing row: {row}")
                print(f"Error details: {str(e)}")
                
if __name__ == "__main__":
    argparse = argparse.ArgumentParser()
    argparse.add_argument("--input-file", "-i", help="Input file path", type=str)
    process_commbank_transactions_file(argparse.parse_args().input_file, model="gemma2:2b")