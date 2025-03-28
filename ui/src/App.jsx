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
        marginBottom: '2rem',
        fontWeight: '600',
        fontSize: '2.25rem'
      }}>
        Finance Dashboard
      </h1>
      
      <div className="tab-navigation" style={{
        display: 'flex',
        justifyContent: 'center',
        marginBottom: '2rem'
      }}>
        <button 
          className={`tab-button ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setActiveTab('calendar')}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '24px',
            margin: '0 0.5rem',
            border: 'none',
            background: activeTab === 'calendar' ? 'var(--primary)' : 'white',
            color: activeTab === 'calendar' ? 'white' : 'var(--text-light)',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            fontWeight: '500',
            transition: 'all 0.2s ease'
          }}
        >
          Financial Calendar
        </button>
        <button 
          className={`tab-button ${activeTab === 'subscriptions' ? 'active' : ''}`}
          onClick={() => setActiveTab('subscriptions')}
          style={{
            padding: '0.75rem 1.5rem',
            borderRadius: '24px',
            margin: '0 0.5rem',
            border: 'none',
            background: activeTab === 'subscriptions' ? 'var(--primary)' : 'white',
            color: activeTab === 'subscriptions' ? 'white' : 'var(--text-light)',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            fontWeight: '500',
            transition: 'all 0.2s ease'
          }}
        >
          Subscription Tracker
        </button>
      </div>
      
      <div className="card" style={{
        borderRadius: '16px',
        boxShadow: 'var(--card-shadow)',
        border: 'none',
        padding: '0',
        overflow: 'hidden'
      }}>
        {activeTab === 'calendar' && <FinancialCalendar />}
        {activeTab === 'subscriptions' && <SubscriptionTracker />}
      </div>
    </div>
  );
}

export default App; 