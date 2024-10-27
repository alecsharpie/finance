from finance.db import FinanceDB

def get_schema():
    db = FinanceDB('data/finance-stag.db')
    # query = "SELECT * FROM transactions"
    query = "PRAGMA table_info(transactions)"
    result = db.run_query_pandas(query)
    print(result)

def get_recurring_transactions():
    db = FinanceDB('data/finance-stag.db')
    # SQL query to find recurring transactions
    query = """
    SELECT 
        merchant_name, 
        amount, 
        COUNT(*) as occurrence_count
    FROM 
        transactions
    GROUP BY 
        merchant_name, 
        amount
    HAVING 
        COUNT(*) > 1
    ORDER BY 
        occurrence_count DESC;
    """

    # Execute the query and fetch the results
    result = db.run_query_pandas(query)

    # Print the results
    print(result)
    
def get_count_of_each_merchant():
    db = FinanceDB('data/finance-stag.db')
    # SQL query to find the count of each merchant
    query = """
    SELECT 
        merchant_name, 
        COUNT(*) as transaction_count
    FROM 
        transactions
    GROUP BY 
        merchant_name
    ORDER BY 
        transaction_count DESC;
    """

    # Execute the query and fetch the results
    result = db.run_query_pandas(query)

    # Print the results
    print(result)

if __name__ == "__main__":
    get_count_of_each_merchant()


