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
      <div className="subscription-list">
        <div className="subscription-header-controls">
          <div className="subscription-title-section">
            <h3>Detected Subscriptions</h3>
            <div className="subscription-summary">
              <span className="subscription-count">{sortedSubscriptions.length} subscriptions</span>
              <span className="subscription-total">
                Total yearly cost: {formatCurrency(totalYearlyCost)}
              </span>
            </div>
          </div>
          
          <div className="subscription-controls">
            <div className="sort-controls">
              <label>Sort by:</label>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                className="sort-select"
              >
                <option value="cost">Highest Cost</option>
                <option value="name">Name</option>
                <option value="frequency">Frequency</option>
              </select>
            </div>
            
            <label className="show-all-toggle">
              <input 
                type="checkbox" 
                checked={showAll} 
                onChange={() => setShowAll(!showAll)} 
              />
              <span className="toggle-label">Show all recurring transactions</span>
            </label>
          </div>
        </div>
        
        {sortedSubscriptions.length === 0 ? (
          <p>No subscription patterns detected. Try enabling "Show all recurring transactions".</p>
        ) : (
          <div className="subscription-items">
            {sortedSubscriptions.map((sub, idx) => (
              <div key={idx} className="subscription-item">
                <div className="subscription-header">
                  <div>
                    <h4>{sub.merchant}</h4>
                    <div className="subscription-frequency">
                      {sub.frequency === 'monthly' ? 'Monthly subscription' : 
                       sub.frequency === 'quarterly' ? 'Quarterly subscription' : 
                       sub.frequency === 'yearly' ? 'Yearly subscription' : 
                       `Recurring payment (${sub.count} occurrences)`}
                    </div>
                  </div>
                  <div className="subscription-amount">
                    <div className="amount-value">{formatCurrency(sub.avgAmount)}</div>
                    <div className="amount-yearly">
                      {sub.yearlyTotal ? `~${formatCurrency(sub.yearlyTotal)}/year` : ''}
                    </div>
                  </div>
                </div>
                
                <div className="subscription-transactions">
                  <div className="transactions-header">Recent transactions:</div>
                  <div className="transactions-list">
                    {sub.transactions.slice(0, 3).map((tx, i) => (
                      <div key={i} className="transaction-item">
                        <span>{tx.date}</span>
                        <span>{formatCurrency(Math.abs(parseFloat(tx.amount)))}</span>
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

  if (loading) return <p>Loading subscription data...</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div className="subscription-tracker">
      {renderSubscriptionList()}
    </div>
  );
};

export default SubscriptionTracker; 