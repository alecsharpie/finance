import csv
from typing import List
import argparse
from tqdm import tqdm

from db import FinanceDB, calculate_row_hash
from llm import query_ollama, parse_json_response, is_valid_json

def create_commbank_prompt(transaction: List[str]) -> str:
    """Create a prompt for the LLM with examples and the current transaction."""
    prompt = f"""
    Here are some example transactions:
    Input: "26/10/2024,'-7.73','UBER* TRIP','+232.41'"
    Output: {{
        "transaction_type": "Ride Sharing",
        "merchant_name": "Uber",
        "location": "San Francisco, CA",
        "currency": "USD",
        "last_4_card_number": "1234",
        "date": "26/10/2024"
    }}
    Input: "27/10/2024,'-15.00','STARBUCKS','+217.41'"
    Output: {{
        "transaction_type": "Coffee Shop",
        "merchant_name": "Starbucks",
        "location": "New York, NY",
        "currency": "USD",
        "last_4_card_number": "5678",
        "date": "27/10/2024"
    }}
    Now parse this transaction:
    Input: "{transaction[2]}"
    Output:
    """
    return prompt

def process_commbank_transactions_file(input_file: str, db_path: str, model: str = "gemma2:9b"):
    """Process the entire transactions file using Ollama and write to an sqllite db.
    Expects a csv with columns: date, amount, original_description, balance.
    E.g. 26/10/2024,'-7.73','UBER* TRIP','+232.41'"""
    db = FinanceDB(db_path)
    with open(input_file, 'r', newline='') as infile:
        reader = csv.reader(infile)
        for row in tqdm(reader):
            try:
                row_hash = calculate_row_hash(','.join(row))
                if db.transaction_exists(row_hash):
                    continue
                prompt = create_commbank_prompt(row)
                response = query_ollama(prompt, model)
                parsed_data = parse_json_response(response)
                
                transaction_data = {
                    'date': row[0],
                    'amount': row[1],
                    'balance': row[3],
                    'original_description': row[2],
                    'merchant_name': parsed_data.get('merchant_name', ''),
                    'transaction_type': parsed_data.get('transaction_type', ''),
                    'location': parsed_data.get('location', ''),
                    'currency': parsed_data.get('currency', ''),
                    'last_4_card_number': parsed_data.get('last_4_card_number', ''),
                    'hash': row_hash
                }
                db.insert_transaction(transaction_data, row_hash)
            except Exception as e:
                print(f"Error processing row: {row}")
                print(f"Error details: {str(e)}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-file", "-i", help="Input file path", type=str, required=True)
    parser.add_argument("--db-path", "-d", help="Database path", type=str, default="finance.db")
    args = parser.parse_args()
    process_commbank_transactions_file(args.input_file, args.db_path, model="gemma2:2b")