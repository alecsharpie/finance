import React, { useState } from 'react';
import SubscriptionTracker from './components/SubscriptionTracker';
import FinancialCalendar from './components/FinancialCalendar';
import MerchantCategoryManager from './components/MerchantCategoryManager';
import RawTransactions from './components/RawTransactions';
import './styles/RawTransactions.css';

function App() {
  const [activeTab, setActiveTab] = useState('calendar');

  return (
    <div className="container welcoming-theme">
      <h1 className="app-title">
        abcdefghijklmnopqrstuvwxyz
      </h1>
      
      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setActiveTab('calendar')}
        >
          Financial Calendar
        </button>
        <button 
          className={`tab-button ${activeTab === 'subscriptions' ? 'active' : ''}`}
          onClick={() => setActiveTab('subscriptions')}
        >
          Subscription Tracker
        </button>
        <button 
          className={`tab-button ${activeTab === 'categories' ? 'active' : ''}`}
          onClick={() => setActiveTab('categories')}
        >
          Category Manager
        </button>
        <button 
          className={`tab-button ${activeTab === 'raw' ? 'active' : ''}`}
          onClick={() => setActiveTab('raw')}
        >
          Raw Transactions
        </button>
      </div>
      
      <div className="card">
        {activeTab === 'calendar' && <FinancialCalendar />}
        {activeTab === 'subscriptions' && <SubscriptionTracker />}
        {activeTab === 'categories' && <MerchantCategoryManager />}
        {activeTab === 'raw' && <RawTransactions />}
      </div>
    </div>
  );
}

export default App; 