
## Finance Tool

## TODO
- db indexes
- up bank
- move db to data folder
- create UI for queries
- prod/staging
- parse date
- source

This tool loads data from a csv file and parses it into an SQLlite database. The data is then used to generate a report on the users spending habits.

## Database

## Parsing Data
## Commonwealth Bank
The data is parsed from a csv file.

### Example Input
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

Run the python script with the input file
```bash
python finance/dataloader_commbank.py --i "raw_data/transactions.csv"
```

