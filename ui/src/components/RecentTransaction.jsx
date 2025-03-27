import React, { useState, useEffect } from 'react';
import { fetchRecentTransaction } from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';

const RecentTransaction = () => {
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchRecentTransaction();
        setTransaction(data);
      } catch (err) {
        setError('Failed to load recent transaction');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) return <p>Loading recent transaction...</p>;
  if (error) return <p className="error">{error}</p>;
  if (!transaction) return <p>No recent transaction found</p>;

  return (
    <div>
      <h2>Most Recent Transaction</h2>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Merchant</th>
              <th>Type</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{formatDate(transaction.date)}</td>
              <td className="currency-value">{formatCurrency(transaction.amount)}</td>
              <td>{transaction.merchant_name}</td>
              <td>{transaction.transaction_type}</td>
              <td>{transaction.source}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentTransaction; 