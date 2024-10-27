from finance.db import FinanceDB

db = FinanceDB('data/finance-stag.db')

def get_recurring_transactions():
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

    result = db.run_query_pandas(query)
    print(result)
    
def get_count_of_each_merchant():
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

    result = db.run_query_pandas(query)
    print(result)

if __name__ == "__main__":
    get_count_of_each_merchant()


