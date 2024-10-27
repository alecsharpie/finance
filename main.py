from finance.db import FinanceDB

# query the db
db = FinanceDB('finance.db')
query = "SELECT * FROM transactions"
result = db.run_query_pandas(query)
print(result)
