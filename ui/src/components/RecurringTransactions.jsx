import React, { useState, useEffect } from 'react';
import { fetchRecurringTransactions } from '../services/api';
import { formatCurrency } from '../utils/formatters';

const RecurringTransactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchRecurringTransactions();
        setTransactions(data);
      } catch (err) {
        setError('Failed to load recurring transactions');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) return <p>Loading recurring transactions...</p>;
  if (error) return <p className="error">{error}</p>;
  if (transactions.length === 0) return <p>No recurring transactions found</p>;

  return (
    <div>
      <h2>Recurring Transactions</h2>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Merchant</th>
              <th>Amount</th>
              <th>Occurrences</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((transaction, index) => (
              <tr key={index}>
                <td>{transaction.merchant_name}</td>
                <td className="currency-value">{formatCurrency(transaction.amount)}</td>
                <td className="currency-value">{transaction.occurrence_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecurringTransactions; 