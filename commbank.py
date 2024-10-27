import csv
from datetime import datetime
import json
from typing import Dict, List
import argparse
import requests
from tqdm import tqdm

def create_prompt(transaction: List[str]) -> str:
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
    "value_date": null
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
    "value_date": "24/10/2024"
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
    "value_date": "21/10/2024"
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
    "value_date": null
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
    "value_date": "20/10/2024"
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
    "value_date": null
}}

Now parse this transaction:
Input: "{transaction[2]}"
Output:
"""

    return prompt

def query_ollama(prompt: str, model: str = "gemma2:9b") -> Dict:
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
        llm_reseponse = result['response']
        json_result = json.loads(llm_reseponse.replace('```json\n', '').replace('\n```', ''))
        return json_result
    
    except Exception as e:
        print(f"Error querying Ollama: {str(e)}")
        return {}

def process_transactions_file(input_file: str, output_file: str, model: str = "gemma2:9b"):
    """Process the entire transactions file using Ollama and write to new CSV."""
    with open(input_file, 'r', newline='') as infile, \
         open(output_file, 'w', newline='') as outfile:
        
        reader = csv.reader(infile)
        writer = csv.writer(outfile)
        
        # Write header
        headers = [
            'date', 'amount', 'balance', 'original_description', 'merchant_name', 'transaction_type', 'location',
            'currency', 'last_4_card_number', 'value_date'
        ]
        writer.writerow(headers)
        
        # Process each transaction
        for row in tqdm(reader):
            try:
                # Query Ollama for parsing
                prompt = create_prompt(row)
                # print(prompt)
                parsed_data = query_ollama(prompt, model)
                
                # Combine original data with parsed data
                output_row = [
                    row[0],  # date
                    row[1],  # amount
                    row[3],  # balance
                    row[2],   # original_description
                    parsed_data.get('transaction_type', ''),
                    parsed_data.get('merchant_name', ''),
                    parsed_data.get('location', ''),
                    parsed_data.get('currency', ''),
                    parsed_data.get('last_4_card_number', ''),
                    parsed_data.get('value_date', '')
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
    process_transactions_file(input_file, output_file, model="gemma2:2b")

    
