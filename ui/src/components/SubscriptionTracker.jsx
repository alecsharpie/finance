import React, { useState, useEffect } from 'react';
import { fetchSubscriptions } from '../services/api';

const SubscriptionTracker = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [allSubscriptions, setAllSubscriptions] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedSubscription, setSelectedSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);
  
  const monthNames = ["January", "February", "March", "April", "May", "June", 
                       "July", "August", "September", "October", "November", "December"];

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchSubscriptions();
        
        // Store all subscriptions
        setAllSubscriptions(data);
        
        // Filter for likely subscriptions
        const likelySubscriptions = data.filter(sub => 
          sub.frequency === 'monthly' || 
          sub.frequency === 'quarterly' || 
          sub.months >= 3 ||
          (sub.count >= 3 && sub.frequency !== 'irregular') // Added this condition
        );
        
        setSubscriptions(likelySubscriptions);
      } catch (err) {
        setError('Failed to load subscription data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const navigateMonth = (direction) => {
    let newMonth = selectedMonth + direction;
    let newYear = selectedYear;
    
    if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    } else if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    }
    
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  };

  const renderCalendarView = () => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const firstDayOfMonth = new Date(selectedYear, selectedMonth, 1).getDay();
    const calendarDays = [];
    
    // Add empty cells for days before the first of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      calendarDays.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }
    
    // Get all subscription transactions for this month/year
    const monthlySubscriptions = {};
    const subscriptionsToUse = showAll ? allSubscriptions : subscriptions;
    
    subscriptionsToUse.forEach(sub => {
      sub.transactions.forEach(tx => {
        const txDate = new Date(tx.date);
        if (txDate.getMonth() === selectedMonth && txDate.getFullYear() === selectedYear) {
          const day = txDate.getDate();
          if (!monthlySubscriptions[day]) monthlySubscriptions[day] = [];
          monthlySubscriptions[day].push({...tx, merchant: sub.merchant});
        }
      });
    });
    
    // Create calendar days
    for (let day = 1; day <= daysInMonth; day++) {
      const hasSubscriptions = monthlySubscriptions[day] && monthlySubscriptions[day].length > 0;
      const subscriptionAmount = hasSubscriptions ? 
        monthlySubscriptions[day].reduce((sum, tx) => sum + Math.abs(tx.amount), 0) : 0;
      
      calendarDays.push(
        <div 
          key={`day-${day}`} 
          className={`calendar-day ${hasSubscriptions ? 'has-subscriptions' : ''}`}
          onClick={() => {
            if (hasSubscriptions) {
              setSelectedSubscription({
                day,
                transactions: monthlySubscriptions[day]
              });
            }
          }}
        >
          <div className="day-header">
            <span className="day-number">{day}</span>
            {hasSubscriptions && (
              <span className="day-amount">${subscriptionAmount.toFixed(2)}</span>
            )}
          </div>
          {hasSubscriptions && (
            <div className="day-subscriptions">
              {monthlySubscriptions[day].map((tx, idx) => (
                <div key={idx} className="day-subscription-item">{tx.merchant}</div>
              ))}
            </div>
          )}
        </div>
      );
    }
    
    return (
      <div className="calendar-grid">
        <div className="calendar-header">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="calendar-weekday">{day}</div>
          ))}
        </div>
        <div className="calendar-days">
          {calendarDays}
        </div>
      </div>
    );
  };

  const renderSubscriptionList = () => {
    const subscriptionsToUse = showAll ? allSubscriptions : subscriptions;
    
    return (
      <div className="subscription-list">
        <div className="subscription-header-controls">
          <h3>Detected Subscriptions</h3>
          <label className="show-all-toggle">
            <input 
              type="checkbox" 
              checked={showAll} 
              onChange={() => setShowAll(!showAll)} 
            />
            <span className="toggle-label">Show all recurring transactions</span>
          </label>
        </div>
        
        {subscriptionsToUse.length === 0 ? (
          <p>No subscription patterns detected. Try enabling "Show all recurring transactions".</p>
        ) : (
          <div className="subscription-items">
            {subscriptionsToUse.map((sub, idx) => (
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
                    <div className="amount-value">${sub.avgAmount.toFixed(2)}</div>
                    <div className="amount-yearly">
                      {sub.frequency === 'monthly' ? `~$${(sub.avgAmount * 12).toFixed(2)}/year` : 
                       sub.frequency === 'quarterly' ? `~$${(sub.avgAmount * 4).toFixed(2)}/year` : 
                       ''}
                    </div>
                  </div>
                </div>
                
                <div className="subscription-transactions">
                  <div className="transactions-header">Recent transactions:</div>
                  <div className="transactions-list">
                    {sub.transactions.slice(0, 3).map((tx, i) => (
                      <div key={i} className="transaction-item">
                        <span>{tx.date}</span>
                        <span>${Math.abs(parseFloat(tx.amount)).toFixed(2)}</span>
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

  const renderDetailView = () => {
    if (!selectedSubscription) return null;
    
    return (
      <div className="subscription-detail-overlay" onClick={() => setSelectedSubscription(null)}>
        <div className="subscription-detail-modal" onClick={e => e.stopPropagation()}>
          <div className="detail-header">
            <h3>
              Subscriptions on {monthNames[selectedMonth]} {selectedSubscription.day}, {selectedYear}
            </h3>
            <button onClick={() => setSelectedSubscription(null)} className="close-button">×</button>
          </div>
          
          <div className="detail-transactions">
            {selectedSubscription.transactions.map((tx, idx) => (
              <div key={idx} className="detail-transaction-item">
                <div className="transaction-header">
                  <h4>{tx.merchant}</h4>
                  <span className="transaction-amount">${Math.abs(parseFloat(tx.amount)).toFixed(2)}</span>
                </div>
                <div className="transaction-description">
                  {tx.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <p>Loading subscription data...</p>;
  if (error) return <p className="error">{error}</p>;

  return (
    <div className="subscription-tracker">
      <div className="month-navigation">
        <button 
          onClick={() => navigateMonth(-1)}
          className="nav-button"
        >
          ←
        </button>
        <h2 className="current-month">
          {monthNames[selectedMonth]} {selectedYear}
        </h2>
        <button 
          onClick={() => navigateMonth(1)}
          className="nav-button"
        >
          →
        </button>
      </div>
      
      {renderCalendarView()}
      {renderSubscriptionList()}
      {renderDetailView()}
    </div>
  );
};

export default SubscriptionTracker; 