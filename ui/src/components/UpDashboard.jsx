import React, { useState, useEffect, useCallback } from 'react';
import AccountOverview from './AccountOverview';
import SavingsChart from './SavingsChart';
import SpendingBreakdown from './SpendingBreakdown';
import {
  fetchUpHealth,
  fetchUpSummary,
  triggerUpSync,
  fetchUpSyncStatus
} from '../services/api';
import { formatCurrency } from '../utils/formatters';

const UpDashboard = () => {
  const [health, setHealth] = useState(null);
  const [summary, setSummary] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [healthData, summaryData, statusData] = await Promise.all([
        fetchUpHealth(),
        fetchUpSummary(),
        fetchUpSyncStatus()
      ]);
      setHealth(healthData);
      setSummary(summaryData);
      setSyncStatus(statusData);
    } catch (err) {
      console.error('Error loading Up data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await triggerUpSync();
      // Poll for completion
      const pollInterval = setInterval(async () => {
        const status = await fetchUpSyncStatus();
        setSyncStatus(status);
        const latestSync = status.recent_syncs?.[0];
        if (latestSync && latestSync.status !== 'running') {
          clearInterval(pollInterval);
          setSyncing(false);
          loadData();
        }
      }, 2000);

      setTimeout(() => {
        clearInterval(pollInterval);
        setSyncing(false);
      }, 120000);
    } catch (err) {
      console.error('Error syncing:', err);
      setSyncing(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    return date.toLocaleString('en-AU', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  // Not configured state
  if (health?.status === 'not_configured') {
    return (
      <div className="up-not-configured" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        textAlign: 'center',
        gap: '20px',
        background: 'var(--welcoming-cream)',
        borderRadius: '12px',
        margin: '20px'
      }}>
        <span style={{ fontSize: '64px' }}>🏦</span>
        <h2 style={{ margin: 0, color: 'var(--primary)' }}>Connect Your Up Bank Account</h2>
        <p style={{ color: 'var(--text-light)', maxWidth: '500px', lineHeight: '1.6' }}>
          To see your Up Bank accounts, savings, and spending, you need to add your
          Up Bank API token.
        </p>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '24px',
          maxWidth: '500px',
          textAlign: 'left',
          boxShadow: 'var(--card-shadow)'
        }}>
          <h4 style={{ margin: '0 0 16px 0', color: 'var(--text)' }}>Setup Steps:</h4>
          <ol style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-light)', lineHeight: '2' }}>
            <li>Open the Up app on your phone</li>
            <li>Go to <strong>Profile → Data sharing</strong></li>
            <li>Tap <strong>Personal Access Token</strong></li>
            <li>Generate a new token</li>
            <li>Create a <code style={{ background: 'var(--welcoming-cream)', padding: '2px 6px', borderRadius: '4px' }}>.env</code> file in the finance project root</li>
            <li>Add: <code style={{ background: 'var(--welcoming-cream)', padding: '2px 6px', borderRadius: '4px' }}>UP_BANK_TOKEN=up:yeah:your_token</code></li>
            <li>Restart the API server</li>
          </ol>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        color: 'var(--text-light)'
      }}>
        Loading Up Bank data...
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'savings', label: 'Savings', icon: '🐷' },
    { id: 'spending', label: 'Spending', icon: '💸' },
  ];

  return (
    <div className="up-dashboard" style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      padding: '24px',
      background: 'var(--welcoming-cream)',
      borderRadius: '12px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h2 style={{
            margin: '0 0 4px 0',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '1.75rem',
            fontWeight: '700'
          }}>
            <span style={{ fontSize: '32px' }}>🏦</span>
            Up Bank
          </h2>
          <div style={{ fontSize: '13px', color: 'var(--text-light)' }}>
            Last synced: {formatDate(syncStatus?.last_successful_sync)}
          </div>
        </div>

        <button
          onClick={handleSync}
          disabled={syncing}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            background: syncing ? 'var(--text-light)' : 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: '24px',
            cursor: syncing ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.3s ease',
            boxShadow: syncing ? 'none' : '0 4px 12px rgba(231, 111, 81, 0.3)',
          }}
        >
          {syncing ? (
            <>
              <span className="spin-icon">⟳</span>
              Syncing...
            </>
          ) : (
            <>
              <span>↻</span>
              Sync Now
            </>
          )}
        </button>
      </div>

      {/* Quick Stats */}
      {summary && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--welcoming-green), #7a9f85)',
            borderRadius: '16px',
            padding: '20px',
            color: 'white',
            boxShadow: '0 4px 12px rgba(148, 180, 159, 0.3)'
          }}>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>Total Savings</div>
            <div style={{ fontSize: '28px', fontWeight: '700', marginTop: '4px' }}>
              {formatCurrency(summary.total_savings)}
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, var(--primary), #6a5a7d)',
            borderRadius: '16px',
            padding: '20px',
            color: 'white',
            boxShadow: '0 4px 12px rgba(125, 107, 145, 0.3)'
          }}>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>2Up Balance</div>
            <div style={{ fontSize: '28px', fontWeight: '700', marginTop: '4px' }}>
              {formatCurrency(summary.two_up_balance)}
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, var(--accent), #c75d42)',
            borderRadius: '16px',
            padding: '20px',
            color: 'white',
            boxShadow: '0 4px 12px rgba(231, 111, 81, 0.3)'
          }}>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>This Month</div>
            <div style={{ fontSize: '28px', fontWeight: '700', marginTop: '4px' }}>
              {formatCurrency(summary.this_month_spending)}
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, var(--welcoming-blue), #7eafc7)',
            borderRadius: '16px',
            padding: '20px',
            color: 'white',
            boxShadow: '0 4px 12px rgba(152, 193, 217, 0.3)'
          }}>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>Total Balance</div>
            <div style={{ fontSize: '28px', fontWeight: '700', marginTop: '4px' }}>
              {formatCurrency(summary.total_balance)}
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '8px',
        background: 'white',
        padding: '8px',
        borderRadius: '28px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        width: 'fit-content'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '20px',
              background: activeTab === tab.id ? 'var(--primary)' : 'transparent',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === tab.id ? '600' : '500',
              color: activeTab === tab.id ? 'white' : 'var(--text-light)',
              transition: 'all 0.3s ease',
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
      }}>
        {activeTab === 'overview' && summary?.accounts && (
          <AccountOverview accounts={summary.accounts} onRefresh={loadData} />
        )}
        {activeTab === 'savings' && <SavingsChart />}
        {activeTab === 'spending' && <SpendingBreakdown />}
      </div>

      <style>{`
        .spin-icon {
          display: inline-block;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default UpDashboard;
