# formatters.py
import pandas as pd
from typing import Union, List
import numpy as np

class FinanceFormatter:
    @staticmethod
    def title_case(text: str) -> str:
        """Convert snake_case or any case to Title Case."""
        # Replace underscores and hyphens with spaces
        text = text.replace('_', ' ').replace('-', ' ')
        # Handle special cases for financial terms
        special_cases = {
            'Usd': 'USD',
            'Aud': 'AUD',
            'Nzd': 'NZD',
            'Id': 'ID',
            'Abc': 'ABC',  # Add any other special cases here
        }
        # Title case the text
        titled = text.title()
        # Apply special cases
        for case, replacement in special_cases.items():
            titled = titled.replace(case, replacement)
        return titled

    @staticmethod
    def format_currency(value: Union[float, int]) -> str:
        """Format number as currency."""
        if pd.isna(value):
            return '$0.00'
        return f'${abs(value):,.2f}'

    @staticmethod
    def format_percentage(value: float) -> str:
        """Format number as percentage."""
        if pd.isna(value):
            return '0.0%'
        return f'{value:.1f}%'

    @staticmethod
    def format_date(date_str: str) -> str:
        """Format date strings consistently."""
        try:
            date = pd.to_datetime(date_str)
            return date.strftime('%d %b %Y')  # e.g., '1 Jan 2024'
        except:
            return date_str

    @staticmethod
    def format_dataframe(
        df: pd.DataFrame,
        currency_columns: List[str] = None,
        percentage_columns: List[str] = None,
        date_columns: List[str] = None,
        exclude_columns: List[str] = None
    ) -> pd.DataFrame:
        """Format an entire DataFrame with consistent styling."""
        # Make a copy to avoid modifying the original
        df = df.copy()
        
        # Default lists if None
        currency_columns = currency_columns or []
        percentage_columns = percentage_columns or []
        date_columns = date_columns or []
        exclude_columns = exclude_columns or []
        
        # Format column names
        df.columns = [FinanceFormatter.title_case(col) for col in df.columns]
        
        # Apply formatting to specified columns
        for col in df.columns:
            if col in exclude_columns:
                continue
                
            if col.lower() in [c.lower() for c in currency_columns] or any(term in col.lower() for term in ['amount', 'balance', 'budget', 'spent', 'remaining']):
                df[col] = df[col].apply(FinanceFormatter.format_currency)
                
            elif col.lower() in [c.lower() for c in percentage_columns] or any(term in col.lower() for term in ['percentage', 'ratio', 'rate']):
                df[col] = df[col].apply(FinanceFormatter.format_percentage)
                
            elif col.lower() in [c.lower() for c in date_columns] or any(term in col.lower() for term in ['date', 'month']):
                df[col] = df[col].apply(FinanceFormatter.format_date)
        
        return df

def format_plotly_chart(fig):
    """Apply consistent styling to Plotly charts."""
    fig.update_layout(
        font_family="Arial, sans-serif",
        title_font_size=20,
        title_x=0.5,  # Center the title
        legend_title_font_size=14,
        legend_font_size=12,
        xaxis_title_font_size=14,
        yaxis_title_font_size=14,
        plot_bgcolor='white',
        paper_bgcolor='white',
        xaxis=dict(
            gridcolor='#f0f0f0',
            showline=True,
            linewidth=1,
            linecolor='#e0e0e0',
        ),
        yaxis=dict(
            gridcolor='#f0f0f0',
            showline=True,
            linewidth=1,
            linecolor='#e0e0e0',
        )
    )
    return fig