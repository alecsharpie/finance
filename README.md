## Parsing Data
### Commonwealth Bank Usage
you will need ollama which you can get here [ollama](https://github.com/ollama/ollama)

Make sure ollama is running
```bash
curl -v http://localhost:11434/
```

Put your csv in the raw_data folder

Run the python script with the input file
```bash
python commbank.py -i "raw_data/transactions.csv"
```

