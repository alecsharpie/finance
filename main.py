from fasthtml.common import *
from finance.db import FinanceDB
import plotly.express as px

# Initialize database
db = FinanceDB('data/finance-stag.db')

# Create FastHTML app
app, rt = fast_app()

def dataframe_to_table(df):
    # Convert DataFrame to HTML table with styling
    table_html = df.to_html(
        classes=['table'], 
        index=False,
        border=0,
        justify='left'
    )
    return NotStr(table_html)

# Recurring Transactions

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
    return db.run_query_pandas(query)

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
    return db.run_query_pandas(query)

def create_merchant_bar_chart():
    df = get_count_of_each_merchant()
    # Take top 10 merchants for better visualization
    df = df.head(10)
    
    fig = px.bar(
        df,
        x='merchant_name',
        y='transaction_count',
        title='Top 10 Merchants by Transaction Count'
    )
    return fig.to_html(full_html=False)

@rt('/')
def get():
    # Get data
    recurring_df = get_recurring_transactions()
    merchants_df = get_count_of_each_merchant()
    
    # Create components
    return Titled(
        "Finance Dashboard",
        Container(
            # Merchant Count Chart Section
            Card(
                H2("Merchant Transaction Counts"),
                Div(NotStr(create_merchant_bar_chart()))
            ),
            
            # Recurring Transactions Table
            Card(
                H2("Recurring Transactions"),
                Div(dataframe_to_table(recurring_df.head(10)),
                    style="overflow-x: auto;")
            ),
            
            # All Merchants Table
            Card(
                H2("All Merchant Counts"),
                Div(dataframe_to_table(merchants_df.head(10)),
                    style="overflow-x: auto;")
            ),
            
            # Add some basic styling
            Style("""
                .table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
                .table th, .table td { padding: 0.5rem; text-align: left; }
                .table th { background: #f4f4f4; }
                .table tr:nth-child(even) { background: #f8f8f8; }
            """)
        )
    )

# Run the app
if __name__ == "__main__":
    serve()