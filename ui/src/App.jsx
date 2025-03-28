import React, { useState } from 'react';
import SubscriptionTracker from './components/SubscriptionTracker';
import FinancialCalendar from './components/FinancialCalendar';

function App() {
  const [activeTab, setActiveTab] = useState('calendar');

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
      </div>
      
      <div className="card">
        {activeTab === 'calendar' && <FinancialCalendar />}
        {activeTab === 'subscriptions' && <SubscriptionTracker />}
      </div>
    </div>
  );
}

export default App; 