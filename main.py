from fasthtml.common import *
from finance.db import FinanceDB
from finance.formatter import FinanceFormatter, format_plotly_chart
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
    """Get recurring transactions from the database.
    normalise the amount to be monthly so the comparison is fair i.e $120 every 12 months would be $10 every month"""
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
    df = db.run_query_pandas(query)
    return FinanceFormatter.format_dataframe(
        df,
        currency_columns=['Amount'],
        exclude_columns=['occurrence_count']
    )


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
    df = db.run_query_pandas(query)
    return FinanceFormatter.format_dataframe(
        df,
        exclude_columns=['transaction_count']
    )

def create_merchant_bar_chart():
    df = get_count_of_each_merchant()
    df = df.head(10)
    
    fig = px.bar(
        df,
        x='Merchant Name',
        y='Transaction Count',
        title='Top 10 Merchants by Transaction Count'
    )
    
    # Adjust layout to prevent plot from getting cut off
    fig.update_layout(
        margin=dict(l=50, r=50, t=50, b=100),  # Adjust margins as needed
        xaxis_tickangle=-45  # Rotate x-axis labels if necessary
    )
    
    return format_plotly_chart(fig).to_html(full_html=False)

def get_monthly_spending_by_type(months_limit=6):
    """Get monthly spending aggregated by transaction type."""
    query = """
    WITH monthly_spending AS (
        SELECT 
            strftime('%Y-%m', date) as month,
            transaction_type,
            SUM(CAST(REPLACE(REPLACE(amount, '+', ''), '-', '') AS FLOAT)) as total_amount
        FROM transactions
        WHERE date >= date('now', ? || ' months')
        GROUP BY strftime('%Y-%m', date), transaction_type
        ORDER BY month DESC
    )
    SELECT 
        month,
        MAX(CASE WHEN transaction_type = 'Merchant' THEN total_amount ELSE 0 END) as Merchant,
        MAX(CASE WHEN transaction_type = 'Transfer' THEN total_amount ELSE 0 END) as Transfer,
        MAX(CASE WHEN transaction_type = 'Fee' THEN total_amount ELSE 0 END) as Fee
    FROM monthly_spending
    GROUP BY month
    ORDER BY month ASC
    """
    df = db.run_query_pandas(query, (-months_limit,))
    return df

def create_monthly_spending_chart():
    """Create a stacked bar chart showing monthly spending by type."""
    df = get_monthly_spending_by_type()
    
    fig = px.bar(
        df,
        x='month',
        y=['Merchant', 'Transfer', 'Fee'],
        title='Monthly Spending by Category',
        barmode='stack',
        labels={
            'month': 'Month',
            'value': 'Amount ($)',
            'variable': 'Transaction Type'
        }
    )
    
    return format_plotly_chart(fig).to_html(full_html=False)

def get_most_recent_transaction():
    query = """
    SELECT 
        date,
        amount,
        merchant_name,
        transaction_type,
        source
    FROM 
        transactions
    ORDER BY 
        date DESC
    LIMIT 1;
    """
    df = db.run_query_pandas(query)
    return FinanceFormatter.format_dataframe(
        df,
        currency_columns=['Amount'],
        date_columns=['Date']
    )

@rt('/')
def get():
    # Get data
    recurring_df = get_recurring_transactions()
    merchants_df = get_count_of_each_merchant()
    recent_transaction = get_most_recent_transaction()
    
    # Create components
    return Titled(
        "Finance Dashboard",
        Container(
            
            # Most Recent Transaction
            Card(
                H2("Most Recent Transaction"),
                Div(dataframe_to_table(recent_transaction),
                    style="overflow-x: auto;")
            ),
            
            # Recurring Transactions Table
            Card(
                H2("Recurring Transactions"),
                Div(dataframe_to_table(recurring_df.head(10)),
                    style="overflow-x: auto;")
            ),
            
            # Monthly Spending Analysis
            Card(
                H2("Monthly Spending Analysis"),
                Div(NotStr(create_monthly_spending_chart()))
            ),
            
            # All Merchants Table
            Card(
                H2("All Merchant Counts"),
                Div(dataframe_to_table(merchants_df.head(10)),
                    style="overflow-x: auto;")
            ),
            # Merchant Count Chart
            Card(
                H2("Merchant Transaction Counts"),
                Div(NotStr(create_merchant_bar_chart()))
            ),
            
            # Add some modern and striking styling
            Style("""
                /* Modern color palette */
                :root {
                    --primary: #6B46C1;      /* Deep purple */
                    --secondary: #0D9488;    /* Rich teal */
                    --accent: #F76B8A;       /* Coral pink */
                    --background: #F8FAFC;   /* Light grey background */
                    --text: #1A1A1A;         /* Almost black */
                    --text-light: #4A5568;   /* Medium grey */
                }

                .table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin: 1.5rem 0;
                    font-family: 'Inter', -apple-system, sans-serif;
                    box-shadow: 0 1px 3px rgba(107, 70, 193, 0.1);
                }

                .table th, .table td { 
                    padding: 1rem 1.5rem; 
                    text-align: left; 
                    border-bottom: 2px solid var(--background);
                }

                .table th { 
                    background: var(--primary);
                    font-weight: 600;
                    color: white;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    font-size: 0.9rem;
                }

                .table tr { 
                    background: white;
                }

                .table tr:nth-child(even) { 
                    background: #FAFAFA;
                }

                /* Format currency and number columns to align right */
                .table td:has(div), 
                .table td:nth-child(n+2) {
                    text-align: right;
                    font-family: 'Roboto Mono', monospace;
                    font-weight: 500;
                }

                /* Add some flair to currency values */
                .table td:has(div)::before {
                    color: var(--secondary);
                    font-weight: 600;
                }

                h2 {
                    font-family: 'Inter', -apple-system, sans-serif;
                    color: var(--primary);
                    font-size: 2rem;
                    font-weight: 700;
                    margin-bottom: 1.5rem;
                    position: relative;
                    padding-bottom: 0.5rem;
                }

                h2::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    width: 60px;
                    height: 4px;
                    background: var(--accent);
                }

                h3 {
                    font-family: 'Inter', -apple-system, sans-serif;
                    color: var(--text);
                    font-size: 1.5rem;
                    font-weight: 600;
                    margin: 1.5rem 0 1rem;
                }

                .card {
                    background: white;
                    box-shadow: 0 1px 3px rgba(107, 70, 193, 0.1);
                    padding: 2rem;
                    margin-bottom: 2rem;
                    border: 1px solid rgba(107, 70, 193, 0.1);
                }

                /* Progress bars styling */
                .progress-bar {
                    background: #E9D8FD;
                    height: 8px;
                    overflow: hidden;
                }

                .progress-bar-fill {
                    height: 100%;
                    background: linear-gradient(90deg, var(--secondary) 0%, var(--accent) 100%);
                }

                /* Alert styling */
                .alert {
                    background: #E9D8FD;
                    border-left: 4px solid var(--accent);
                    padding: 1rem 1.5rem;
                    margin-bottom: 1rem;
                }

                /* Container max-width and centering */
                .container {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 2rem;
                }

                /* Fix graph overflow */
                .plotly-graph-div {
                    width: 100% !important;
                }

                /* Ensure all content stays within bounds */
                * {
                    max-width: 100%;
                    box-sizing: border-box;
                }
            """)
        )
    )

# Run the app
if __name__ == "__main__":
    serve()