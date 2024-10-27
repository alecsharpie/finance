## Parsing Data
### Commonwealth Bank Usage
you will need ollama which you can get here [ollama](https://github.com/ollama/ollama)

Make sure ollama is running
```bash
curl -v http://localhost:11434/
```

download a model, i used Gemma2 9B
```bash
ollama pull gemma2:9b
```

Check the model is available
```bash
ollama list
```

Put your csv in the raw_data folder

Run the python script with the input file
```bash
python commbank.py -i "raw_data/transactions.csv"
```

