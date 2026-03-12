"""
ETF Analysis Module

Provides linear regression analysis and CAGR calculations for ETF price data.
Uses Yahoo Finance for historical price data.
"""

import json
import logging
from datetime import date, timedelta
from pathlib import Path
from typing import Optional

import pandas as pd
import yfinance as yf
from sklearn.linear_model import LinearRegression

logger = logging.getLogger(__name__)


def load_etf_config(config_path: Optional[str] = None) -> dict:
    """Load ETF configuration from JSON file."""
    if config_path is None:
        config_path = Path(__file__).parent.parent / "etf_config.json"

    with open(config_path, "r") as f:
        data = json.load(f)

    return {etf["ticker"]: etf for etf in data["etfs"]}


def get_past_date(days_ago: int) -> str:
    """Get ISO format date string for a date in the past."""
    return (date.today() - timedelta(days=days_ago)).isoformat()


def fit_model(
    data: pd.DataFrame, start_date: str
) -> tuple[Optional[LinearRegression], Optional[pd.DataFrame]]:
    """
    Fit a linear regression model to ETF price data from a given start date.

    Args:
        data: DataFrame with 'Date', 'DateNumeric', and 'Close' columns
        start_date: ISO format date string to filter data from

    Returns:
        Tuple of (fitted model, filtered data) or (None, None) if insufficient data
    """
    data_copy = data.copy()
    data_copy["Date"] = pd.to_datetime(data_copy["Date"].dt.tz_localize(None))

    start_ts = pd.to_datetime(start_date).to_datetime64()
    filtered_data = data_copy[data_copy["Date"] >= start_ts]

    if filtered_data.empty or len(filtered_data) < 10:
        return None, None

    X = filtered_data[["DateNumeric"]]
    y = filtered_data["Close"]

    model = LinearRegression()
    model.fit(X, y)

    return model, filtered_data


def calculate_cagr(start_price: float, end_price: float, years: float) -> float:
    """
    Calculate Compound Annual Growth Rate.

    Args:
        start_price: Initial price
        end_price: Final price
        years: Number of years between prices

    Returns:
        CAGR as a decimal (e.g., 0.10 for 10%)
    """
    if years <= 0 or start_price <= 0:
        return 0.0
    return (end_price / start_price) ** (1 / years) - 1


def analyze_period(
    etf_data: pd.DataFrame, start_date: str, period_name: str
) -> dict:
    """
    Analyze ETF data for a specific time period.

    Returns a dict with regression results, CAGR, and prediction info.
    """
    model, filtered_data = fit_model(etf_data, start_date)

    if model is None or filtered_data is None:
        return {
            "period": period_name,
            "has_data": False,
            "cagr": None,
            "years": None,
            "delta_percent": None,
            "direction": None,
            "current_price": None,
            "predicted_price": None,
            "data_points": [],
            "trend_line": [],
        }

    # Calculate CAGR
    start_price = filtered_data["Close"].iloc[0]
    end_price = filtered_data["Close"].iloc[-1]
    years = (filtered_data["Date"].iloc[-1] - filtered_data["Date"].iloc[0]).days / 365.25
    cagr = calculate_cagr(start_price, end_price, years)

    # Calculate price vs prediction
    latest_date_numeric = etf_data["DateNumeric"].iloc[-1]
    latest_price = etf_data["Close"].iloc[-1]
    predicted_price = model.predict([[latest_date_numeric]])[0]
    delta_percent = ((latest_price - predicted_price) / predicted_price) * 100

    # Prepare chart data (sampled for performance)
    sample_size = min(len(filtered_data), 500)
    step = max(1, len(filtered_data) // sample_size)
    sampled_data = filtered_data.iloc[::step]

    data_points = [
        {
            "date": row["Date"].strftime("%Y-%m-%d"),
            "price": round(row["Close"], 2),
        }
        for _, row in sampled_data.iterrows()
    ]

    # Predict all trend points at once for efficiency
    trend_predictions = model.predict(sampled_data[["DateNumeric"]].values)
    trend_line = [
        {
            "date": row["Date"].strftime("%Y-%m-%d"),
            "price": round(float(trend_predictions[i]), 2),
        }
        for i, (_, row) in enumerate(sampled_data.iterrows())
    ]

    return {
        "period": period_name,
        "has_data": True,
        "cagr": round(cagr * 100, 2),
        "years": round(years, 2),
        "delta_percent": round(delta_percent, 2),
        "direction": "above" if delta_percent > 0 else "below",
        "current_price": round(latest_price, 2),
        "predicted_price": round(predicted_price, 2),
        "data_points": data_points,
        "trend_line": trend_line,
    }


def process_ticker(ticker: str, etf_info: dict, suffix: str = ".AX") -> Optional[dict]:
    """
    Process a single ETF ticker and return analysis data.

    Args:
        ticker: The ETF ticker symbol (e.g., "VAS")
        etf_info: Metadata dict for the ETF
        suffix: Exchange suffix (default ".AX" for Australian)

    Returns:
        Dict with ticker info and analysis for all periods, or None on error
    """
    logger.info(f"Processing {ticker}")

    try:
        etf = yf.Ticker(f"{ticker}{suffix}")
        etf_data = etf.history(start="2000-01-01")

        if etf_data.empty:
            logger.error(f"No data found for {ticker}")
            return None

        logger.info(f"Downloaded {len(etf_data)} data points for {ticker}")

        etf_data["Date"] = etf_data.index
        etf_data["DateNumeric"] = etf_data["Date"].apply(lambda d: d.toordinal())

        # Calculate max years of data
        total_years = (etf_data.index[-1] - etf_data.index[0]).days / 365.25
        max_years = min(20, total_years)

        # Analyze different time periods
        periods = [
            (f"Max ({max_years:.1f} Years)", etf_data.index[0].strftime("%Y-%m-%d")),
            ("3 Years", get_past_date(3 * 365)),
            ("1 Year", get_past_date(365)),
        ]

        analyses = []
        for period_name, start_date in periods:
            analysis = analyze_period(etf_data, start_date, period_name)
            analyses.append(analysis)

        return {
            "ticker": ticker,
            "title": etf_info.get("title", ticker),
            "name": etf_info.get("name", ""),
            "description": etf_info.get("description", ""),
            "etf_type": etf_info.get("etfType", ""),
            "analyses": analyses,
        }

    except Exception as e:
        logger.error(f"Error processing {ticker}: {str(e)}")
        return None


def get_all_etf_analysis(config_path: Optional[str] = None) -> list[dict]:
    """
    Process all ETFs from config and return analysis data.

    Args:
        config_path: Optional path to ETF config JSON file

    Returns:
        List of analysis results for each ETF
    """
    etf_info = load_etf_config(config_path)

    results = []
    for ticker, info in etf_info.items():
        result = process_ticker(ticker, info)
        if result:
            results.append(result)

    # Sort alphabetically by title
    results.sort(key=lambda x: x["title"])

    return results
