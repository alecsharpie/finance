import csv
from typing import List
import argparse
from tqdm import tqdm
import os
import tempfile
import sys
import re
import time
import logging

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from finance.db import FinanceDB, calculate_row_hash, parse_date
from finance.llm import query_ollama, parse_json_response, is_valid_json

# Configure logging with more detailed format
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("commbank_loader.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def is_simple_amount(description):
    """Check if the description is just an amount."""
    return bool(re.match(r'^[+\-]?\d+(\.\d+)?$', description.strip()))

def create_commbank_prompt(transaction: str) -> str:
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
    "merchant_name": "John Doe PT 155982777",
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
    "date": null
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
```

Input: "-1000.00"
Output:
```json
{{
    "merchant_name": "Unknown",
    "transaction_type": "Withdrawal",
    "location": null,
    "currency": null,
    "last_4_card_number": null,
    "date": null
}}
```

Input: "+1000.00"
Output:
```json
{{
    "merchant_name": "Unknown",
    "transaction_type": "Deposit",
    "location": null,
    "currency": null,
    "last_4_card_number": null,
    "date": null
}}
```

Now parse this transaction:
Input: "{transaction}"
Output:
"""
    return prompt

def query_ollama_with_retry(prompt, model="gemma3", max_retries=3, retry_delay=2):
    """Query Ollama with retry logic."""
    for attempt in range(max_retries):
        try:
            logger.debug(f"Querying Ollama (attempt {attempt+1}/{max_retries})")
            return query_ollama(prompt, model=model)
        except Exception as e:
            if attempt < max_retries - 1:
                logger.warning(f"Ollama query failed (attempt {attempt+1}/{max_retries}): {e}")
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
            else:
                logger.error(f"Ollama query failed after {max_retries} attempts: {e}")
                raise

def handle_simple_amount(description):
    """Handle descriptions that are just amounts."""
    is_positive = not description.startswith('-')
    
    if is_positive:
        return {
            "merchant_name": "Unknown",
            "transaction_type": "Deposit",
            "location": None,
            "currency": None,
            "last_4_card_number": None,
            "date": None
        }
    else:
        return {
            "merchant_name": "Unknown",
            "transaction_type": "Withdrawal",
            "location": None,
            "currency": None,
            "last_4_card_number": None,
            "date": None
        }

def process_commbank_transactions_file(file_path, db_path, model="gemma3"):
    """Process a Commonwealth Bank transactions CSV file and insert into database."""
    logger.info(f"Starting CommBank transaction processing")
    logger.info(f"Processing file: {file_path}")
    logger.info(f"Using database: {db_path}")
    logger.info(f"Using model: {model}")
    
    # Initialize database
    db = FinanceDB(db_path)
    
    # Read and process the CSV file
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            reader = csv.reader(file)
            rows = list(reader)
            logger.info(f"Successfully read CSV file with {len(rows)} rows")
    except Exception as e:
        logger.error(f"Failed to read CSV file: {e}")
        return False
    
    successful_inserts = 0
    skipped_rows = 0
    failed_inserts = 0
    
    # CommBank CSV files often don't have headers, so we'll define our own
    expected_headers = ["Date", "Amount", "Description", "Balance"]
    
    # Check if the first row looks like a header (contains "Date" or similar)
    first_row_is_header = False
    if rows and len(rows) > 0:
        first_row = rows[0]
        if len(first_row) >= 4 and any(cell.lower() == "date" for cell in first_row):
            first_row_is_header = True
            logger.info(f"Detected header row: {first_row}")
        else:
            logger.info(f"No header row detected. Using expected headers: {expected_headers}")
            logger.info(f"First data row: {rows[0] if rows else 'No data'}")
    
    # Process transactions
    start_index = 1 if first_row_is_header else 0
    
    for row_index, row in enumerate(tqdm(rows[start_index:], desc="Processing transactions")):
        actual_row_index = row_index + start_index
        if len(row) >= 4:  # Ensure row has enough columns
            try:
                date = row[0]
                amount = row[1]
                description = row[2]
                balance = row[3]
                
                # Skip rows without proper data
                if not date or not amount:
                    logger.debug(f"Skipping row {actual_row_index+1}: Incomplete data")
                    skipped_rows += 1
                    continue
                
                logger.debug(f"Processing row {actual_row_index+1}: Date={date}, Description={description}, Amount={amount}, Balance={balance}")
                
                # Format the date properly if it's in DD/MM/YYYY format
                original_date = date
                if '/' in date:
                    try:
                        date_parts = date.split('/')
                        if len(date_parts) == 3:
                            # Convert from DD/MM/YYYY to YYYY-MM-DD
                            date = f"{date_parts[2]}-{date_parts[1]}-{date_parts[0]}"
                            logger.debug(f"Converted date from {original_date} to {date}")
                    except Exception as e:
                        logger.warning(f"Failed to parse date {date}: {e}")
                
                # Ensure amount is properly formatted
                original_amount = amount
                # CommBank CSV typically has amounts with + or - prefix
                # Make sure the amount is stored as a numeric string with the sign
                if amount and not amount.startswith('+') and not amount.startswith('-'):
                    # If no sign, assume it's negative (expense)
                    amount = f"-{amount}"
                    logger.debug(f"Added negative sign to amount: {original_amount} -> {amount}")
                
                # Calculate hash for deduplication
                row_hash = calculate_row_hash(date, description, amount)
                logger.debug(f"Generated hash: {row_hash}")
                
                # Check if transaction already exists
                if db.transaction_exists(row_hash):
                    logger.info(f"Transaction already exists (hash: {row_hash}): {date} | {description} | {amount}")
                    skipped_rows += 1
                    continue
                
                # Check if this is a simple amount description
                if is_simple_amount(description):
                    logger.debug(f"Simple amount description detected: {description}")
                    parsed_data = handle_simple_amount(description)
                    logger.debug(f"Parsed simple amount: {parsed_data}")
                else:
                    # Create prompt for LLM
                    logger.debug(f"Creating LLM prompt for description: {description}")
                    prompt = create_commbank_prompt(description)
                    
                    # Query LLM with retry
                    try:
                        logger.debug(f"Querying LLM for description: {description}")
                        response = query_ollama_with_retry(prompt, model=model)
                        logger.debug(f"LLM response received: {response[:100]}...")
                        
                        # Parse response
                        if is_valid_json(response):
                            parsed_data = parse_json_response(response)
                            logger.debug(f"Successfully parsed JSON response: {parsed_data}")
                        else:
                            logger.warning(f"Failed to parse JSON response for transaction: {description}")
                            logger.warning(f"Raw response: {response}")
                            # Use a default parsing for failed responses
                            parsed_data = {
                                "merchant_name": description[:50] if description else "Unknown",
                                "transaction_type": "Unknown",
                                "location": None,
                                "currency": None,
                                "last_4_card_number": None,
                                "date": None
                            }
                            logger.debug(f"Using default parsing: {parsed_data}")
                    except Exception as e:
                        logger.error(f"Error querying LLM for '{description}': {e}")
                        # Use a default parsing for exceptions
                        parsed_data = {
                            "merchant_name": description[:50] if description else "Unknown",
                            "transaction_type": "Unknown",
                            "location": None,
                            "currency": None,
                            "last_4_card_number": None,
                            "date": None
                        }
                        logger.debug(f"Using default parsing due to error: {parsed_data}")
                
                # Always use the date from the CSV file, not from the description
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
                
                logger.debug(f"Transaction data prepared: {transaction_data}")
                
                # Insert into database
                try:
                    success = db.insert_transaction(transaction_data, row_hash)
                    if success:
                        logger.debug(f"Successfully inserted transaction: {date} | {parsed_data.get('merchant_name')} | {amount}")
                        successful_inserts += 1
                    else:
                        # Check if it's a duplicate transaction
                        if db.transaction_exists(row_hash):
                            logger.info(f"Transaction already exists (hash: {row_hash}): {date} | {description} | {amount}")
                            skipped_rows += 1
                        else:
                            logger.warning(f"Failed to insert transaction: {date} | {parsed_data.get('merchant_name')} | {amount}")
                            failed_inserts += 1
                except Exception as e:
                    logger.error(f"Database error inserting transaction: {e}")
                    logger.error(f"Transaction data: {transaction_data}")
                    import traceback
                    logger.error(traceback.format_exc())
                    failed_inserts += 1
                    
            except Exception as e:
                logger.error(f"Error processing row {actual_row_index+1}: {e}")
                logger.error(f"Row data: {row}")
                import traceback
                logger.error(traceback.format_exc())
                failed_inserts += 1
        else:
            logger.warning(f"Row {actual_row_index+1} has insufficient columns: {row}")
            skipped_rows += 1
    
    logger.info(f"Processing complete. Transactions added to database: {successful_inserts}")
    logger.info(f"Skipped rows: {skipped_rows}")
    logger.info(f"Failed inserts: {failed_inserts}")
    
    return successful_inserts > 0

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-file", "-i", help="Input file path", type=str, required=True)
    parser.add_argument("--db-path", "-d", help="Database path", type=str, default="data/finance-stag.db")
    parser.add_argument("--model", "-m", help="LLM model to use", type=str, default="gemma3")
    parser.add_argument("--verbose", "-v", help="Enable verbose logging", action="store_true")
    args = parser.parse_args()
    
    # Set debug level if verbose flag is provided
    if args.verbose:
        logger.setLevel(logging.DEBUG)
        logger.debug("Debug logging enabled")
    
    process_commbank_transactions_file(args.input_file, args.db_path, model=args.model)