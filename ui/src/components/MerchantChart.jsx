import React, { useState, useEffect } from 'react';
import { fetchMerchantCounts } from '../services/api';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const MerchantChart = () => {
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchMerchantCounts();
        setMerchants(data);
      } catch (err) {
        setError('Failed to load merchant data for chart');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) return <p>Loading merchant chart...</p>;
  if (error) return <p className="error">{error}</p>;
  if (merchants.length === 0) return <p>No merchant data found for chart</p>;

  // Prepare chart data
  const chartData = {
    labels: merchants.map(merchant => merchant.merchant_name),
    datasets: [
      {
        label: 'Transaction Count',
        data: merchants.map(merchant => merchant.transaction_count),
        backgroundColor: 'rgba(107, 70, 193, 0.8)',
        borderColor: 'rgba(107, 70, 193, 1)',
        borderWidth: 1
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Top 10 Merchants by Transaction Count',
        font: {
          size: 18
        }
      },
      legend: {
        display: false
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Merchant'
        },
        ticks: {
          maxRotation: 45,
          minRotation: 45
        }
      },
      y: {
        title: {
          display: true,
          text: 'Transaction Count'
        },
        beginAtZero: true
      }
    }
  };

  return (
    <div>
      <h2>Merchant Transaction Counts</h2>
      <div style={{ height: '400px' }}>
        <Bar data={chartData} options={chartOptions} />
      </div>
    </div>
  );
};

export default MerchantChart; 