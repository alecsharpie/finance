import React, { useState, useEffect, useCallback } from 'react';
import AccountOverview from './AccountOverview';
import SavingsChart from './SavingsChart';
import SpendingBreakdown from './SpendingBreakdown';
import DailySpendingChart from './DailySpendingChart';
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
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 20px',
        textAlign: 'center',
        gap: '24px',
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '20px',
          background: 'var(--accent-glow)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '40px',
        }}>
          🏦
        </div>
        <h2 style={{ margin: 0, color: 'var(--text)', fontSize: '1.5rem' }}>
          Connect Your Up Bank Account
        </h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', lineHeight: '1.6' }}>
          To see your accounts, savings, and spending, add your Up Bank API token.
        </p>
        <div style={{
          background: 'var(--bg-card)',
          backdropFilter: 'var(--glass-blur)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '28px',
          maxWidth: '500px',
          textAlign: 'left',
        }}>
          <h4 style={{ margin: '0 0 16px 0', color: 'var(--text)' }}>Setup Steps:</h4>
          <ol style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-secondary)', lineHeight: '2.2' }}>
            <li>Open the Up app on your phone</li>
            <li>Go to <strong style={{ color: 'var(--text)' }}>Profile → Data sharing</strong></li>
            <li>Tap <strong style={{ color: 'var(--text)' }}>Personal Access Token</strong></li>
            <li>Generate a new token</li>
            <li>Create a <code style={{ background: 'var(--bg-surface)', padding: '2px 8px', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '0.85em' }}>.env</code> file in the project root</li>
            <li>Add: <code style={{ background: 'var(--bg-surface)', padding: '2px 8px', borderRadius: '4px', fontFamily: 'var(--font-mono)', fontSize: '0.85em' }}>UP_BANK_TOKEN=up:yeah:your_token</code></li>
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
        padding: '80px 20px',
        color: 'var(--text-secondary)',
        gap: '12px',
      }}>
        <span className="spin-icon" style={{ fontSize: '20px' }}>⟳</span>
        Loading Up Bank data...
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'savings', label: 'Savings' },
    { id: 'spending', label: 'Spending' },
    { id: 'budget', label: 'Budget' },
  ];

  const statCards = summary ? [
    {
      label: 'Total Savings',
      value: formatCurrency(summary.total_savings),
      accent: 'var(--positive)',
      glow: 'rgba(45, 142, 111, 0.06)',
    },
    {
      label: '2Up Balance',
      value: formatCurrency(summary.two_up_balance),
      accent: 'var(--accent)',
      glow: 'var(--accent-soft)',
    },
    {
      label: 'This Month',
      value: formatCurrency(summary.this_month_spending),
      accent: '#B8860B',
      glow: 'rgba(184, 134, 11, 0.06)',
    },
    {
      label: 'Total Balance',
      value: formatCurrency(summary.total_balance),
      accent: '#3B7DD8',
      glow: 'rgba(59, 125, 216, 0.06)',
    },
  ] : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        paddingRight: '52px',
      }}>
        <div>
          <h2 style={{
            margin: '0 0 4px 0',
            color: 'var(--text)',
            fontSize: '1.75rem',
            fontWeight: '700',
            letterSpacing: '-0.02em',
            paddingBottom: 0,
          }}>
            <span style={{ marginRight: '10px' }}>Up Bank</span>
            <span style={{
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: health?.status === 'ok' ? 'var(--positive)' : 'var(--negative)',
              boxShadow: health?.status === 'ok'
                ? '0 0 8px rgba(45, 142, 111, 0.4)'
                : '0 0 8px rgba(196, 77, 77, 0.4)',
              verticalAlign: 'middle',
            }} />
          </h2>
          <div style={{
            fontSize: '13px',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
          }}>
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
            padding: '10px 20px',
            background: syncing ? 'var(--bg-surface)' : 'transparent',
            color: syncing ? 'var(--text-muted)' : 'var(--accent)',
            border: `1px solid ${syncing ? 'var(--border)' : 'var(--border-accent)'}`,
            borderRadius: '10px',
            cursor: syncing ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontWeight: '600',
            fontFamily: 'var(--font-sans)',
            transition: 'all 0.2s ease',
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
              Sync
            </>
          )}
        </button>
      </div>

      {/* Stat Cards */}
      {summary && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
        }}>
          {statCards.map((card, i) => (
            <div
              key={card.label}
              className={`stagger-${i + 1}`}
              style={{
                background: 'var(--bg-card)',
                borderRadius: '14px',
                padding: '20px',
                border: '1px solid var(--border)',
                borderLeft: `3px solid ${card.accent}`,
                transition: 'all 0.25s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = card.glow;
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-card)';
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
              }}
            >
              <div style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontWeight: '600',
                marginBottom: '8px',
              }}>
                {card.label}
              </div>
              <div style={{
                fontSize: '26px',
                fontWeight: '700',
                color: 'var(--text)',
                fontFamily: 'var(--font-mono)',
                letterSpacing: '-0.02em',
              }}>
                {card.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab Navigation — underline style */}
      <div style={{
        display: 'flex',
        gap: '0',
        borderBottom: '1px solid var(--border)',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 24px',
              border: 'none',
              borderBottom: activeTab === tab.id
                ? '2px solid var(--accent)'
                : '2px solid transparent',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === tab.id ? '600' : '500',
              color: activeTab === tab.id ? 'var(--text)' : 'var(--text-muted)',
              fontFamily: 'var(--font-sans)',
              transition: 'all 0.2s ease',
              marginBottom: '-1px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ animation: 'fadeInUp 0.3s ease' }}>
        {activeTab === 'overview' && summary?.accounts && (
          <AccountOverview accounts={summary.accounts} onRefresh={loadData} />
        )}
        {activeTab === 'savings' && <SavingsChart />}
        {activeTab === 'spending' && <SpendingBreakdown />}
        {activeTab === 'budget' && <DailySpendingChart />}
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
