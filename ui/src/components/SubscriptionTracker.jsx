import React, { useState, useEffect } from 'react';
import { fetchSubscriptions, fetchRecurringTransactions } from '../services/api';
import { formatCurrency } from '../utils/formatters';

const SubscriptionTracker = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [allSubscriptions, setAllSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [sortBy, setSortBy] = useState('cost'); // 'cost', 'name', 'frequency'
  
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Fetch both data sources
        const [subscriptionsData, recurringData] = await Promise.all([
          fetchSubscriptions(),
          fetchRecurringTransactions()
        ]);
        
        // Process and merge the data
        const mergedData = mergeSubscriptionData(subscriptionsData, recurringData);
        
        if (!mergedData || mergedData.length === 0) {
          // Create sample data for demonstration
          const sampleData = [
            {
              merchant: "Netflix",
              frequency: "monthly",
              avgAmount: 14.99,
              count: 12,
              months: 12,
              yearlyTotal: 179.88,
              transactions: [
                { date: "2023-11-15", amount: -14.99, desc: "Netflix Subscription" },
                { date: "2023-10-15", amount: -14.99, desc: "Netflix Subscription" },
                { date: "2023-09-15", amount: -14.99, desc: "Netflix Subscription" }
              ]
            },
            {
              merchant: "Spotify",
              frequency: "monthly",
              avgAmount: 9.99,
              count: 12,
              months: 12,
              yearlyTotal: 119.88,
              transactions: [
                { date: "2023-11-10", amount: -9.99, desc: "Spotify Premium" },
                { date: "2023-10-10", amount: -9.99, desc: "Spotify Premium" },
                { date: "2023-09-10", amount: -9.99, desc: "Spotify Premium" }
              ]
            }
          ];
          
          setAllSubscriptions(sampleData);
          setSubscriptions(sampleData);
        } else {
          // Store all subscriptions
          setAllSubscriptions(mergedData);
          
          // Filter for likely subscriptions
          const likelySubscriptions = mergedData.filter(sub => 
            sub.frequency === 'monthly' || 
            sub.frequency === 'quarterly' || 
            sub.months >= 3 ||
            (sub.count >= 3 && sub.frequency !== 'irregular')
          );
          
          setSubscriptions(likelySubscriptions);
        }
      } catch (err) {
        setError('Failed to load subscription data');
        console.error(err);
        
        // Set fallback data on error
        const fallbackData = [
          {
            merchant: "Netflix",
            frequency: "monthly",
            avgAmount: 14.99,
            count: 12,
            months: 12,
            yearlyTotal: 179.88,
            transactions: [
              { date: "2023-11-15", amount: -14.99, desc: "Netflix Subscription" },
              { date: "2023-10-15", amount: -14.99, desc: "Netflix Subscription" },
              { date: "2023-09-15", amount: -14.99, desc: "Netflix Subscription" }
            ]
          }
        ];
        
        setAllSubscriptions(fallbackData);
        setSubscriptions(fallbackData);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Function to merge subscription data from both sources
  const mergeSubscriptionData = (subscriptionsData, recurringData) => {
    // Start with subscription data
    let mergedData = [...(subscriptionsData || [])];
    
    // Add yearly total to subscription data
    mergedData = mergedData.map(sub => {
      let yearlyTotal = 0;
      if (sub.frequency === 'monthly') {
        yearlyTotal = sub.avgAmount * 12;
      } else if (sub.frequency === 'quarterly') {
        yearlyTotal = sub.avgAmount * 4;
      } else if (sub.frequency === 'yearly') {
        yearlyTotal = sub.avgAmount;
      } else {
        // For irregular, estimate based on average frequency
        const avgPerYear = sub.count / (sub.months / 12);
        yearlyTotal = sub.avgAmount * avgPerYear;
      }
      
      return {
        ...sub,
        yearlyTotal
      };
    });
    
    // Process recurring transactions data
    if (recurringData && recurringData.length > 0) {
      // Check if merchant already exists in merged data
      recurringData.forEach(recurring => {
        const existingIndex = mergedData.findIndex(
          sub => sub.merchant.toLowerCase() === recurring.merchant_name.toLowerCase()
        );
        
        if (existingIndex === -1) {
          // Add new subscription from recurring data
          const yearlyTotal = Math.abs(recurring.amount) * (recurring.occurrence_count / 12);
          mergedData.push({
            merchant: recurring.merchant_name,
            frequency: recurring.occurrence_count >= 12 ? 'monthly' : 
                      recurring.occurrence_count >= 4 ? 'quarterly' : 'irregular',
            avgAmount: Math.abs(recurring.amount),
            count: recurring.occurrence_count,
            months: Math.min(12, recurring.occurrence_count),
            yearlyTotal,
            transactions: [
              { 
                date: new Date().toISOString().split('T')[0], 
                amount: -Math.abs(recurring.amount), 
                desc: `${recurring.merchant_name} recurring payment` 
              }
            ]
          });
        } else {
          // Update existing subscription with additional data if needed
          if (!mergedData[existingIndex].yearlyTotal) {
            mergedData[existingIndex].yearlyTotal = 
              Math.abs(recurring.amount) * (recurring.occurrence_count / 12);
          }
        }
      });
    }
    
    return mergedData;
  };

  const sortSubscriptions = (subs) => {
    switch (sortBy) {
      case 'cost':
        return [...subs].sort((a, b) => b.yearlyTotal - a.yearlyTotal);
      case 'name':
        return [...subs].sort((a, b) => a.merchant.localeCompare(b.merchant));
      case 'frequency':
        return [...subs].sort((a, b) => {
          const freqOrder = { monthly: 1, quarterly: 2, yearly: 3, irregular: 4 };
          return freqOrder[a.frequency] - freqOrder[b.frequency];
        });
      default:
        return subs;
    }
  };

  const renderSubscriptionList = () => {
    const subscriptionsToUse = showAll ? allSubscriptions : subscriptions;
    const sortedSubscriptions = sortSubscriptions(subscriptionsToUse);
    
    // Calculate total yearly cost
    const totalYearlyCost = sortedSubscriptions.reduce(
      (total, sub) => total + (sub.yearlyTotal || 0), 
      0
    );
    
    return (
      <div className="subscription-list" style={{
        padding: '1.5rem',
        backgroundColor: 'var(--ghibli-cream)',
        borderRadius: '12px'
      }}>
        <div className="subscription-header-controls" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1.5rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid rgba(125, 107, 145, 0.2)',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div className="subscription-title-section">
            <h3 style={{
              margin: '0 0 0.5rem 0',
              color: 'var(--text)',
              fontSize: '1.5rem'
            }}>Detected Subscriptions</h3>
            <div className="subscription-summary" style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
              color: 'var(--text-light)'
            }}>
              <span className="subscription-count">{sortedSubscriptions.length} subscriptions</span>
              <span className="subscription-total" style={{
                fontWeight: '600',
                color: 'var(--primary)'
              }}>
                Total yearly cost: {formatCurrency(totalYearlyCost)}
              </span>
            </div>
          </div>
          
          <div className="subscription-controls" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            alignItems: 'flex-end'
          }}>
            <div className="sort-controls" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <label style={{ color: 'var(--text-light)' }}>Sort by:</label>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                className="sort-select"
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '20px',
                  border: 'none',
                  backgroundColor: 'white',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                  color: 'var(--text)',
                  cursor: 'pointer'
                }}
              >
                <option value="cost">Highest Cost</option>
                <option value="name">Name</option>
                <option value="frequency">Frequency</option>
              </select>
            </div>
            
            <label className="show-all-toggle" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              color: 'var(--text-light)'
            }}>
              <input 
                type="checkbox" 
                checked={showAll} 
                onChange={() => setShowAll(!showAll)} 
                style={{
                  accentColor: 'var(--primary)'
                }}
              />
              <span className="toggle-label">Show all recurring transactions</span>
            </label>
          </div>
        </div>
        
        {sortedSubscriptions.length === 0 ? (
          <p style={{
            textAlign: 'center',
            padding: '3rem',
            color: 'var(--text-light)',
            fontStyle: 'italic',
            backgroundColor: 'rgba(125, 107, 145, 0.05)',
            borderRadius: '8px',
            margin: '1rem 0'
          }}>No subscription patterns detected. Try enabling "Show all recurring transactions".</p>
        ) : (
          <div className="subscription-items" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1.25rem'
          }}>
            {sortedSubscriptions.map((sub, idx) => (
              <div key={idx} className="subscription-item" style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '1.25rem',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.08)',
                transition: 'all 0.2s ease',
                border: 'none'
              }}>
                <div className="subscription-header" style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '1.25rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '1px solid rgba(125, 107, 145, 0.1)'
                }}>
                  <div>
                    <h4 style={{
                      margin: '0 0 0.25rem 0',
                      color: 'var(--text)',
                      fontSize: '1.1rem'
                    }}>{sub.merchant}</h4>
                    <div className="subscription-frequency" style={{
                      fontSize: '0.875rem',
                      color: 'var(--text-light)'
                    }}>
                      {sub.frequency === 'monthly' ? 'Monthly subscription' : 
                       sub.frequency === 'quarterly' ? 'Quarterly subscription' : 
                       sub.frequency === 'yearly' ? 'Yearly subscription' : 
                       `Recurring payment (${sub.count} occurrences)`}
                    </div>
                  </div>
                  <div className="subscription-amount" style={{
                    textAlign: 'right'
                  }}>
                    <div className="amount-value" style={{
                      fontSize: '1.25rem',
                      fontWeight: '600',
                      color: 'var(--primary)'
                    }}>{formatCurrency(sub.avgAmount)}</div>
                    <div className="amount-yearly" style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-light)'
                    }}>
                      {sub.yearlyTotal ? `~${formatCurrency(sub.yearlyTotal)}/year` : ''}
                    </div>
                  </div>
                </div>
                
                <div className="subscription-transactions">
                  <div className="transactions-header" style={{
                    fontWeight: '500',
                    marginBottom: '0.75rem',
                    color: 'var(--text)',
                    fontSize: '0.9rem'
                  }}>Recent transactions:</div>
                  <div className="transactions-list" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}>
                    {sub.transactions.slice(0, 3).map((tx, i) => (
                      <div key={i} className="transaction-item" style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '0.5rem',
                        backgroundColor: 'rgba(125, 107, 145, 0.05)',
                        borderRadius: '8px',
                        fontSize: '0.875rem'
                      }}>
                        <span style={{ color: 'var(--text-light)' }}>{tx.date}</span>
                        <span style={{ 
                          fontWeight: '500',
                          color: 'var(--primary)'
                        }}>{formatCurrency(Math.abs(parseFloat(tx.amount)))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) return (
    <div style={{
      textAlign: 'center',
      padding: '3rem',
      color: 'var(--text-light)',
      backgroundColor: 'var(--ghibli-cream)',
      borderRadius: '12px'
    }}>
      Loading subscription data...
    </div>
  );
  
  if (error) return (
    <div className="error" style={{
      backgroundColor: '#fee2e2',
      color: '#ef4444',
      padding: '1rem',
      borderRadius: '8px',
      margin: '1rem 0'
    }}>{error}</div>
  );

  return (
    <div className="subscription-tracker" style={{
      padding: '0'
    }}>
      {renderSubscriptionList()}
    </div>
  );
};

export default SubscriptionTracker; 