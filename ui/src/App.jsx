import React, { useState } from 'react';
import RecurringTransactions from './components/RecurringTransactions';
import MonthlySpending from './components/MonthlySpending';
import SubscriptionTracker from './components/SubscriptionTracker';
import SpendingTimeline from './components/SpendingTimeline';

function App() {
  const [activeTab, setActiveTab] = useState('subscriptions');

  return (
    <div className="container">
      <h1 style={{ 
        color: 'var(--primary)', 
        textAlign: 'center', 
        marginBottom: '2rem' 
      }}>
        Finance Dashboard
      </h1>
      
      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'subscriptions' ? 'active' : ''}`}
          onClick={() => setActiveTab('subscriptions')}
        >
          Subscription Tracker
        </button>
        <button 
          className={`tab-button ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          Spending Timeline
        </button>
        <button 
          className={`tab-button ${activeTab === 'recurring' ? 'active' : ''}`}
          onClick={() => setActiveTab('recurring')}
        >
          Recurring Transactions
        </button>
        <button 
          className={`tab-button ${activeTab === 'monthly' ? 'active' : ''}`}
          onClick={() => setActiveTab('monthly')}
        >
          Monthly Overview
        </button>
      </div>
      
      <div className="card">
        {activeTab === 'subscriptions' && <SubscriptionTracker />}
        {activeTab === 'timeline' && <SpendingTimeline />}
        {activeTab === 'recurring' && <RecurringTransactions />}
        {activeTab === 'monthly' && <MonthlySpending />}
      </div>
    </div>
  );
}

export default App; 