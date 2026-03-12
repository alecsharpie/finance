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
      case '1w': start.setDate(start.getDate() - 7); break;
      case '1m': start.setMonth(start.getMonth() - 1); break;
      case '3m': start.setMonth(start.getMonth() - 3); break;
      case '6m': start.setMonth(start.getMonth() - 6); break;
      default: start.setMonth(start.getMonth() - 1);
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  };

  // Rich, warm colors for light backgrounds
  const categoryColors = [
    '#C2533A',  // Terracotta (accent)
    '#2D8E6F',  // Sage
    '#8B5CC4',  // Plum
    '#3B7DD8',  // Ocean
    '#B8860B',  // Gold
    '#BE4B87',  // Rose
    '#10A37F',  // Emerald
    '#D4764E',  // Warm orange
    '#0E8DAC',  // Teal
    '#7C5CBF',  // Violet
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
      legend: { display: false },
      tooltip: {
        backgroundColor: '#FFFFFF',
        titleColor: '#2A2A28',
        bodyColor: '#636360',
        borderColor: 'rgba(0,0,0,0.08)',
        borderWidth: 1,
        padding: 12,
        bodyFont: { family: "'IBM Plex Mono', monospace" },
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
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              fontSize: '13px',
              background: 'var(--bg-surface)',
              cursor: 'pointer',
              color: 'var(--text)',
              fontWeight: '500',
              fontFamily: 'var(--font-sans)',
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

          <div style={{
            display: 'flex',
            gap: '4px',
            background: 'var(--bg-surface)',
            padding: '4px',
            borderRadius: '10px',
            border: '1px solid var(--border)',
          }}>
            {rangeButtons.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setDateRange(value)}
                style={{
                  padding: '6px 14px',
                  border: 'none',
                  borderRadius: '7px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '500',
                  fontFamily: 'var(--font-mono)',
                  background: dateRange === value ? 'var(--accent)' : 'transparent',
                  color: dateRange === value ? 'white' : 'var(--text-muted)',
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
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        padding: '24px',
      }}>
        {loading ? (
          <div style={{
            gridColumn: '1 / -1',
            height: '300px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
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
            color: 'var(--negative)',
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
            color: 'var(--text-muted)',
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
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</div>
                <div style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  color: 'var(--text)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {formatCurrency(totalSpending)}
                </div>
              </div>
            </div>

            {/* Category List */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              maxHeight: '280px',
              overflowY: 'auto',
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
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-card-hover)';
                    e.currentTarget.style.transform = 'translateX(3px)';
                    e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--bg-surface)';
                    e.currentTarget.style.transform = 'translateX(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '3px',
                      background: getColor(index),
                      boxShadow: `0 0 6px ${getColor(index)}44`,
                    }} />
                    <div>
                      <div style={{ fontWeight: '500', color: 'var(--text)', fontSize: '14px' }}>
                        {cat.category_name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {cat.transaction_count} txn{cat.transaction_count !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontWeight: '600',
                      color: 'var(--text)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '14px',
                    }}>
                      {formatCurrency(cat.total_amount)}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
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
