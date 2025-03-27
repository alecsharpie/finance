import React, { useState, useEffect } from 'react';
import RecurringTransactions from './components/RecurringTransactions';
import MonthlySpending from './components/MonthlySpending';
import SubscriptionTracker from './components/SubscriptionTracker';

function App() {
  return (
    <div className="container">
      <h1 style={{ 
        color: 'var(--primary)', 
        textAlign: 'center', 
        marginBottom: '2rem' 
      }}>
        Finance Dashboard
      </h1>
      
      <div className="card">
        <h2>Subscription Tracker</h2>
        <SubscriptionTracker />
      </div>
      
      <div className="card">
        <RecurringTransactions />
      </div>
      
      <div className="card">
        <MonthlySpending />
      </div>
    </div>
  );
}

export default App; 