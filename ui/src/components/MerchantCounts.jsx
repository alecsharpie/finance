import React, { useState, useEffect } from 'react';
import { fetchMerchantCounts } from '../services/api';

const MerchantCounts = () => {
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchMerchantCounts();
        setMerchants(data);
      } catch (err) {
        setError('Failed to load merchant counts');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) return <p>Loading merchant counts...</p>;
  if (error) return <p className="error">{error}</p>;
  if (merchants.length === 0) return <p>No merchant data found</p>;

  return (
    <div>
      <h2>All Merchant Counts</h2>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Merchant</th>
              <th>Transaction Count</th>
            </tr>
          </thead>
          <tbody>
            {merchants.map((merchant, index) => (
              <tr key={index}>
                <td>{merchant.merchant_name}</td>
                <td className="currency-value">{merchant.transaction_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MerchantCounts; 