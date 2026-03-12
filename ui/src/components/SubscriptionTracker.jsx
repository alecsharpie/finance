import React, { useState, useEffect } from 'react';
import { fetchUpSubscriptions } from '../services/api';
import { formatCurrency } from '../utils/formatters';

const SubscriptionTracker = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [patterns, setPatterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedSubscription, setExpandedSubscription] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [monthsToAnalyze, setMonthsToAnalyze] = useState(12);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await fetchUpSubscriptions(monthsToAnalyze);
        setSubscriptions(data.subscriptions || []);
        setSummary(data.summary);
        setPatterns(data.patterns || []);
      } catch (err) {
        setError('Failed to load subscription data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [monthsToAnalyze]);

  const getFrequencyBadge = (frequency) => {
    const colors = {
      monthly: { bg: 'rgba(148, 180, 159, 0.2)', color: '#4a7c59' },
      quarterly: { bg: 'rgba(125, 107, 145, 0.2)', color: '#5a4a6a' },
      yearly: { bg: 'rgba(65, 105, 225, 0.2)', color: '#4169e1' },
      irregular: { bg: 'rgba(231, 111, 81, 0.2)', color: '#c44d34' },
      unknown: { bg: 'rgba(128, 128, 128, 0.2)', color: '#666' }
    };
    const style = colors[frequency] || colors.unknown;

    return (
      <span style={{
        padding: '4px 10px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: '600',
        textTransform: 'uppercase',
        backgroundColor: style.bg,
        color: style.color
      }}>
        {frequency}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatShortDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short'
    });
  };

  const toggleExpand = (pattern) => {
    if (expandedSubscription === pattern) {
      setExpandedSubscription(null);
      setSelectedTransaction(null);
    } else {
      setExpandedSubscription(pattern);
      setSelectedTransaction(null);
    }
  };

  if (loading) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '3rem',
        color: 'var(--text-light)',
        backgroundColor: 'var(--welcoming-cream)',
        borderRadius: '12px'
      }}>
        Loading subscription data...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        backgroundColor: '#fee2e2',
        color: '#ef4444',
        padding: '1rem',
        borderRadius: '8px',
        margin: '1rem 0'
      }}>{error}</div>
    );
  }

  return (
    <div style={{ padding: 0 }}>
      {/* Summary Section */}
      <div style={{
        backgroundColor: 'var(--welcoming-cream)',
        borderRadius: '12px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <h2 style={{ margin: '0 0 8px 0', color: 'var(--text)', fontSize: '1.5rem' }}>
              Up Bank Subscriptions
            </h2>
            <p style={{ margin: 0, color: 'var(--text-light)', fontSize: '14px' }}>
              These recurring costs are spread across your daily budget
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', color: 'var(--text-light)' }}>
              Analyze:
              <select
                value={monthsToAnalyze}
                onChange={(e) => setMonthsToAnalyze(Number(e.target.value))}
                style={{
                  marginLeft: '8px',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(125, 107, 145, 0.2)',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                <option value={3}>3 months</option>
                <option value={6}>6 months</option>
                <option value={12}>12 months</option>
                <option value={18}>18 months</option>
              </select>
            </label>
          </div>
        </div>

        {/* Summary Stats */}
        {summary && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '12px',
            marginTop: '20px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '10px',
              padding: '16px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text)' }}>
                {summary.patterns_with_data}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                Active Subscriptions
              </div>
            </div>

            <div style={{
              background: 'white',
              borderRadius: '10px',
              padding: '16px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--welcoming-green)' }}>
                {formatCurrency(summary.total_monthly_estimate)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                Monthly Total
              </div>
            </div>

            <div style={{
              background: 'white',
              borderRadius: '10px',
              padding: '16px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--primary)' }}>
                {formatCurrency(summary.total_yearly_estimate)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                Yearly Total
              </div>
            </div>

            <div style={{
              background: 'white',
              borderRadius: '10px',
              padding: '16px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-light)' }}>
                {formatCurrency(summary.daily_allocation)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                Daily Spread
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Subscription Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {subscriptions.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            backgroundColor: 'var(--welcoming-cream)',
            borderRadius: '12px',
            color: 'var(--text-light)'
          }}>
            No subscription transactions found in the last {monthsToAnalyze} months.
          </div>
        ) : (
          subscriptions.map((sub) => (
            <div
              key={sub.pattern}
              style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                border: expandedSubscription === sub.pattern
                  ? '2px solid var(--welcoming-green)'
                  : '2px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              {/* Subscription Header - Clickable */}
              <div
                onClick={() => toggleExpand(sub.pattern)}
                style={{
                  padding: '16px 20px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: expandedSubscription === sub.pattern
                    ? 'rgba(148, 180, 159, 0.1)'
                    : 'transparent',
                  transition: 'background 0.2s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: 'var(--text)',
                      marginBottom: '4px'
                    }}>
                      {sub.pattern}
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      fontSize: '13px',
                      color: 'var(--text-light)'
                    }}>
                      {getFrequencyBadge(sub.frequency)}
                      <span>{sub.transaction_count} transactions</span>
                      <span>|</span>
                      <span>Last: {formatShortDate(sub.last_date)}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: '18px',
                      fontWeight: '700',
                      color: 'var(--welcoming-green)'
                    }}>
                      {formatCurrency(sub.monthly_cost_estimate)}/mo
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                      ~{formatCurrency(sub.monthly_cost_estimate * 12)}/year
                    </div>
                  </div>

                  <div style={{
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-light)',
                    transform: expandedSubscription === sub.pattern ? 'rotate(180deg)' : 'rotate(0)',
                    transition: 'transform 0.2s'
                  }}>
                    ▼
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedSubscription === sub.pattern && (
                <div style={{
                  borderTop: '1px solid rgba(125, 107, 145, 0.1)',
                  padding: '20px'
                }}>
                  {/* Stats Row */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                    gap: '12px',
                    marginBottom: '20px'
                  }}>
                    <div style={{
                      backgroundColor: 'var(--welcoming-cream)',
                      borderRadius: '8px',
                      padding: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)' }}>
                        {formatCurrency(sub.avg_amount)}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>Avg Amount</div>
                    </div>
                    <div style={{
                      backgroundColor: 'var(--welcoming-cream)',
                      borderRadius: '8px',
                      padding: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)' }}>
                        {formatCurrency(sub.total_spent)}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>Total Spent</div>
                    </div>
                    <div style={{
                      backgroundColor: 'var(--welcoming-cream)',
                      borderRadius: '8px',
                      padding: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)' }}>
                        {sub.avg_days_between > 0 ? `${Math.round(sub.avg_days_between)} days` : '-'}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>Avg Interval</div>
                    </div>
                    <div style={{
                      backgroundColor: 'var(--welcoming-cream)',
                      borderRadius: '8px',
                      padding: '12px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)' }}>
                        {sub.distinct_months}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>Months Active</div>
                    </div>
                  </div>

                  {/* Merchant Names */}
                  {sub.merchant_names && sub.merchant_names.length > 1 && (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: 'var(--text-light)',
                        marginBottom: '8px',
                        textTransform: 'uppercase'
                      }}>
                        Matched Merchant Names
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {sub.merchant_names.map((name, idx) => (
                          <span
                            key={idx}
                            style={{
                              padding: '4px 10px',
                              backgroundColor: 'var(--welcoming-cream)',
                              borderRadius: '6px',
                              fontSize: '12px',
                              color: 'var(--text)'
                            }}
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Transaction List */}
                  <div>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: 'var(--text-light)',
                      marginBottom: '12px',
                      textTransform: 'uppercase',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <span>All Transactions ({sub.transactions.length})</span>
                      <span style={{ fontWeight: '400', textTransform: 'none' }}>
                        {formatDate(sub.first_date)} - {formatDate(sub.last_date)}
                      </span>
                    </div>

                    <div style={{
                      maxHeight: '300px',
                      overflowY: 'auto',
                      border: '1px solid rgba(125, 107, 145, 0.1)',
                      borderRadius: '8px'
                    }}>
                      <table style={{
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: '13px'
                      }}>
                        <thead>
                          <tr style={{
                            backgroundColor: 'var(--welcoming-cream)',
                            position: 'sticky',
                            top: 0
                          }}>
                            <th style={{
                              padding: '10px 12px',
                              textAlign: 'left',
                              fontWeight: '600',
                              color: 'var(--text-light)'
                            }}>Date</th>
                            <th style={{
                              padding: '10px 12px',
                              textAlign: 'left',
                              fontWeight: '600',
                              color: 'var(--text-light)'
                            }}>Description</th>
                            <th style={{
                              padding: '10px 12px',
                              textAlign: 'right',
                              fontWeight: '600',
                              color: 'var(--text-light)'
                            }}>Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sub.transactions.map((tx, idx) => (
                            <tr
                              key={tx.id || idx}
                              onClick={() => setSelectedTransaction(
                                selectedTransaction?.id === tx.id ? null : tx
                              )}
                              style={{
                                cursor: 'pointer',
                                backgroundColor: selectedTransaction?.id === tx.id
                                  ? 'rgba(148, 180, 159, 0.15)'
                                  : idx % 2 === 0 ? 'white' : 'rgba(0,0,0,0.02)',
                                transition: 'background 0.15s'
                              }}
                            >
                              <td style={{
                                padding: '10px 12px',
                                color: 'var(--text-light)',
                                whiteSpace: 'nowrap'
                              }}>
                                {formatDate(tx.date)}
                              </td>
                              <td style={{
                                padding: '10px 12px',
                                color: 'var(--text)',
                                maxWidth: '300px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {tx.description}
                              </td>
                              <td style={{
                                padding: '10px 12px',
                                textAlign: 'right',
                                fontWeight: '600',
                                color: 'var(--text)',
                                fontFamily: 'monospace'
                              }}>
                                {formatCurrency(tx.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Selected Transaction Detail */}
                    {selectedTransaction && (
                      <div style={{
                        marginTop: '12px',
                        padding: '16px',
                        backgroundColor: 'rgba(148, 180, 159, 0.1)',
                        borderRadius: '8px',
                        border: '1px solid rgba(148, 180, 159, 0.3)'
                      }}>
                        <div style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: 'var(--welcoming-green)',
                          marginBottom: '8px',
                          textTransform: 'uppercase'
                        }}>
                          Transaction Details
                        </div>
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'auto 1fr',
                          gap: '8px 16px',
                          fontSize: '13px'
                        }}>
                          <span style={{ color: 'var(--text-light)' }}>ID:</span>
                          <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                            {selectedTransaction.id}
                          </span>

                          <span style={{ color: 'var(--text-light)' }}>Date:</span>
                          <span>{formatDate(selectedTransaction.date)}</span>

                          <span style={{ color: 'var(--text-light)' }}>Description:</span>
                          <span>{selectedTransaction.description}</span>

                          <span style={{ color: 'var(--text-light)' }}>Amount:</span>
                          <span style={{ fontWeight: '600' }}>
                            {formatCurrency(selectedTransaction.amount)}
                          </span>

                          {selectedTransaction.category_id && (
                            <>
                              <span style={{ color: 'var(--text-light)' }}>Category:</span>
                              <span>{selectedTransaction.category_id}</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer Info */}
      <div style={{
        marginTop: '24px',
        padding: '16px',
        backgroundColor: 'rgba(125, 107, 145, 0.1)',
        borderRadius: '8px',
        fontSize: '13px',
        color: 'var(--text-light)'
      }}>
        <strong>Budget Integration:</strong> These subscriptions are excluded from your daily
        discretionary budget calculations. The {formatCurrency(summary?.daily_allocation || 0)}/day
        subscription allocation is spread evenly, so you won't see budget spikes when subscriptions
        charge.
        <div style={{ marginTop: '8px' }}>
          <strong>Tracked Patterns:</strong> {patterns.join(', ')}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionTracker;
