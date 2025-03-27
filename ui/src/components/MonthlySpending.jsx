import React, { useState, useEffect } from 'react';
import { fetchMonthlySpending } from '../services/api';
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

const MonthlySpending = () => {
  const [spendingData, setSpendingData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchMonthlySpending();
        setSpendingData(data);
      } catch (err) {
        setError('Failed to load monthly spending data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) return <p>Loading monthly spending data...</p>;
  if (error) return <p className="error">{error}</p>;
  if (spendingData.length === 0) return <p>No monthly spending data found</p>;

  // Prepare chart data
  const chartData = {
    labels: spendingData.map(item => item.month),
    datasets: [
      {
        label: 'Merchant',
        data: spendingData.map(item => parseFloat(item.Merchant)),
        backgroundColor: 'rgba(107, 70, 193, 0.8)',
        stack: 'Stack 0',
      },
      {
        label: 'Transfer',
        data: spendingData.map(item => parseFloat(item.Transfer)),
        backgroundColor: 'rgba(13, 148, 136, 0.8)',
        stack: 'Stack 0',
      },
      {
        label: 'Fee',
        data: spendingData.map(item => parseFloat(item.Fee)),
        backgroundColor: 'rgba(247, 107, 138, 0.8)',
        stack: 'Stack 0',
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Monthly Spending by Category',
        font: {
          size: 18
        }
      },
      legend: {
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD'
              }).format(context.parsed.y);
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Month'
        }
      },
      y: {
        title: {
          display: true,
          text: 'Amount ($)'
        },
        beginAtZero: true
      }
    }
  };

  return (
    <div>
      <h2>Monthly Spending Analysis</h2>
      <div style={{ height: '400px' }}>
        <Bar data={chartData} options={chartOptions} />
      </div>
    </div>
  );
};

export default MonthlySpending; 