import React, { useState, useEffect } from 'react';
import RecentTransaction from './components/RecentTransaction';
import RecurringTransactions from './components/RecurringTransactions';
import MonthlySpending from './components/MonthlySpending';
import MerchantCounts from './components/MerchantCounts';
import MerchantChart from './components/MerchantChart';

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
        <RecentTransaction />
      </div>
      
      <div className="card">
        <RecurringTransactions />
      </div>
      
      <div className="card">
        <MonthlySpending />
      </div>
      
      <div className="card-grid">
        <div className="card">
          <MerchantCounts />
        </div>
        
        <div className="card">
          <MerchantChart />
        </div>
      </div>
    </div>
  );
}

export default App; 