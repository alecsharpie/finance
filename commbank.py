import csv
from datetime import datetime
import json
from typing import Dict, List
import argparse
import requests

def create_prompt(transaction: List[str], example_rows: List[str] = None) -> str:
    """Create a prompt for the LLM with examples and the current transaction."""
    prompt = """Please parse the following bank transaction and extract key information in JSON format.
Include these fields: merchant_name, location (if present), currency, card_number (if present), value_date (if present).

Here are some examples of how to parse similar transactions:

Input: "UBER* TRIP", amount: -7.73
{
    "merchant_name": "UBER",
    "location": null,
    "currency": null,
    "card_number": null,
    "value_date": null
}

Input: "EZI*TPC Fitzroy MELBOURNE AU AUS Card xx7268 Value Date: 24/10/2024", amount: -16.70
{
    "merchant_name": "EZI*TPC",
    "location": "Fitzroy MELBOURNE AU",
    "currency": "AUS",
    "card_number": "xxxx-xxxx-xxxx-7268",
    "value_date": "24/10/2024"
}

Input: "SP BENCHCLEARERS NEWARK DE USA Card xx2736 USD 55.98 Value Date: 21/10/2024", amount: -83.68
{
    "merchant_name": "SP BENCHCLEARERS",
    "location": "NEWARK DE USA",
    "currency": "USD",
    "card_number": "xxxx-xxxx-xxxx-2736",
    "value_date": "21/10/2024"
}

Now parse this transaction:
Input: "{}", amount: {}

Return only the JSON object, no additional text."""

    return prompt.format(transaction[2], transaction[1])

def query_ollama(prompt: str, model: str = "gemma:7b") -> Dict:
    """Send a query to Ollama and return the parsed response."""
    url = "http://localhost:11434/api/generate"
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False
    }
    
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        result = response.json()
        # Parse the response as JSON
        return json.loads(result['response'])
    except Exception as e:
        print(f"Error querying Ollama: {str(e)}")
        return {}

def process_transactions_file(input_file: str, output_file: str, model: str = "gemma:7b"):
    """Process the entire transactions file using Ollama and write to new CSV."""
    with open(input_file, 'r', newline='') as infile, \
         open(output_file, 'w', newline='') as outfile:
        
        reader = csv.reader(infile)
        writer = csv.writer(outfile)
        
        # Write header
        headers = [
            'date', 'amount', 'balance', 'merchant_name', 'location',
            'currency', 'card_number', 'value_date', 'original_description'
        ]
        writer.writerow(headers)
        
        # Process each transaction
        for row in reader:
            try:
                # Query Ollama for parsing
                prompt = create_prompt(row)
                parsed_data = query_ollama(prompt, model)
                
                # Combine original data with parsed data
                output_row = [
                    row[0],  # date
                    row[1],  # amount
                    row[3],  # balance
                    parsed_data.get('merchant_name', ''),
                    parsed_data.get('location', ''),
                    parsed_data.get('currency', ''),
                    parsed_data.get('card_number', ''),
                    parsed_data.get('value_date', ''),
                    row[2]   # original_description
                ]
                writer.writerow(output_row)
                
            except Exception as e:
                print(f"Error processing row: {row}")
                print(f"Error details: {str(e)}")

if __name__ == "__main__":
    argparse = argparse.ArgumentParser()
    argparse.add_argument("--input-file", "-i", help="Input file path", type=str)
    input_file = argparse.parse_args().input_file
    output_file = f"{input_file.split('.')[0]}_parsed.csv"
    process_transactions_file(input_file, output_file)

    
