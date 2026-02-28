import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { fetchSpendingBreakdown, fetchUpAccounts } from '../services/api';
import { formatCurrency } from '../utils/formatters';

ChartJS.register(ArcElement, Tooltip, Legend);

const SpendingBreakdown = () => {
  const [breakdown, setBreakdown] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [dateRange, setDateRange] = useState('1m');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const getDateRange = (range) => {
    const end = new Date();
    const start = new Date();

    switch (range) {
      case '1w':
        start.setDate(start.getDate() - 7);
        break;
      case '1m':
        start.setMonth(start.getMonth() - 1);
        break;
      case '3m':
        start.setMonth(start.getMonth() - 3);
        break;
      case '6m':
        start.setMonth(start.getMonth() - 6);
        break;
      default:
        start.setMonth(start.getMonth() - 1);
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  };

  // Using the app's color palette (hex values for Chart.js Canvas compatibility)
  const categoryColors = [
    '#E76F51',  // Terracotta (accent)
    '#94B49F',  // Forest green (welcoming-green)
    '#7D6B91',  // Lavender (primary)
    '#98C1D9',  // Sky blue (welcoming-blue)
    '#9C6644',  // Earthy brown (welcoming-brown)
    '#A5C9CA',  // Muted teal (secondary)
    '#F4A261',  // Sandy orange
    '#E9C46A',  // Mustard
    '#264653',  // Dark teal
    '#2A9D8F',  // Teal
  ];

  const getColor = (index) => {
    return categoryColors[index % categoryColors.length];
  };

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const data = await fetchUpAccounts();
        setAccounts(data);
      } catch (err) {
        console.error('Error loading accounts:', err);
      }
    };
    loadAccounts();
  }, []);

  useEffect(() => {
    const loadBreakdown = async () => {
      setLoading(true);
      setError(null);

      try {
        const { start, end } = getDateRange(dateRange);
        const accountId = selectedAccount === 'all' ? null : selectedAccount;
        const data = await fetchSpendingBreakdown(accountId, start, end);
        setBreakdown(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadBreakdown();
  }, [selectedAccount, dateRange]);

  const totalSpending = breakdown.reduce((sum, cat) => sum + cat.total_amount, 0);

  const chartData = {
    labels: breakdown.map(cat => cat.category_name),
    datasets: [{
      data: breakdown.map(cat => cat.total_amount),
      backgroundColor: breakdown.map((_, i) => getColor(i)),
      borderWidth: 0,
      hoverOffset: 8,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'white',
        titleColor: '#2D3033',
        bodyColor: '#2D3033',
        borderColor: '#F2E9E4',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (context) => {
            const value = context.raw;
            const percentage = ((value / totalSpending) * 100).toFixed(1);
            return `${formatCurrency(value)} (${percentage}%)`;
          },
        },
      },
    },
  };

  const rangeButtons = [
    { value: '1w', label: '1W' },
    { value: '1m', label: '1M' },
    { value: '3m', label: '3M' },
    { value: '6m', label: '6M' },
  ];

  // Find 2Up account for quick filter
  const twoUpAccount = accounts.find(a => a.ownership_type === 'JOINT');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '18px', fontWeight: '600' }}>
          Spending Breakdown
        </h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {/* Account Filter */}
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: '1px solid var(--welcoming-cream)',
              fontSize: '13px',
              background: 'white',
              cursor: 'pointer',
              color: 'var(--text)',
              fontWeight: '500',
            }}
          >
            <option value="all">All Accounts</option>
            {twoUpAccount && (
              <option value={twoUpAccount.id}>2Up (Shared)</option>
            )}
            {accounts.filter(a => a.account_type === 'TRANSACTIONAL').map(account => (
              <option key={account.id} value={account.id}>
                {account.display_name}
              </option>
            ))}
          </select>

          {/* Date Range */}
          <div style={{
            display: 'flex',
            gap: '4px',
            background: 'var(--welcoming-cream)',
            padding: '4px',
            borderRadius: '20px'
          }}>
            {rangeButtons.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setDateRange(value)}
                style={{
                  padding: '6px 14px',
                  border: 'none',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  background: dateRange === value ? 'var(--primary)' : 'transparent',
                  color: dateRange === value ? 'white' : 'var(--text-light)',
                  transition: 'all 0.2s',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(200px, 280px) 1fr',
        gap: '24px',
        background: 'var(--welcoming-cream)',
        borderRadius: '12px',
        padding: '24px',
      }}>
        {loading ? (
          <div style={{
            gridColumn: '1 / -1',
            height: '300px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-light)',
          }}>
            Loading spending data...
          </div>
        ) : error ? (
          <div style={{
            gridColumn: '1 / -1',
            height: '300px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent)',
          }}>
            Error: {error}
          </div>
        ) : breakdown.length === 0 ? (
          <div style={{
            gridColumn: '1 / -1',
            height: '300px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-light)',
            gap: '12px',
          }}>
            <span style={{ fontSize: '48px' }}>🛒</span>
            <span style={{ fontWeight: '500' }}>No spending data for this period</span>
            <span style={{ fontSize: '13px' }}>Try selecting a different date range or account</span>
          </div>
        ) : (
          <>
            {/* Donut Chart */}
            <div style={{ position: 'relative', height: '280px' }}>
              <Doughnut data={chartData} options={chartOptions} />
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>Total</div>
                <div style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  color: 'var(--text)',
                  fontFamily: "'Roboto Mono', monospace"
                }}>
                  {formatCurrency(totalSpending)}
                </div>
              </div>
            </div>

            {/* Category List */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              maxHeight: '280px',
              overflowY: 'auto'
            }}>
              {breakdown.map((cat, index) => (
                <div
                  key={cat.category_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'white',
                    transition: 'transform 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateX(4px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '3px',
                      background: getColor(index),
                    }} />
                    <div>
                      <div style={{ fontWeight: '500', color: 'var(--text)', fontSize: '14px' }}>
                        {cat.category_name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                        {cat.transaction_count} transaction{cat.transaction_count !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontWeight: '600',
                      color: 'var(--text)',
                      fontFamily: "'Roboto Mono', monospace"
                    }}>
                      {formatCurrency(cat.total_amount)}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                      {((cat.total_amount / totalSpending) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SpendingBreakdown;
