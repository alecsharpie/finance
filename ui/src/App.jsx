import React, { useState, useEffect, useCallback } from 'react';
import SubscriptionTracker from './components/SubscriptionTracker';
import FinancialCalendar from './components/FinancialCalendar';
import MerchantCategoryManager from './components/MerchantCategoryManager';
import RawTransactions from './components/RawTransactions';
import AccountOverview from './components/AccountOverview';
import SavingsChart from './components/SavingsChart';
import SpendingBreakdown from './components/SpendingBreakdown';
import DailySpendingChart from './components/DailySpendingChart';
import ETFAnalysis from './components/ETFAnalysis';
import {
  fetchUpHealth,
  fetchUpSummary,
  triggerUpSync,
  fetchUpSyncStatus
} from './services/api';
import { formatCurrency } from './utils/formatters';
import './styles/RawTransactions.css';

const mainPages = [
  { id: 'savings', label: 'Savings', icon: '💰' },
  { id: 'spending', label: 'Spending', icon: '📊' },
  { id: 'budget', label: 'Budget', icon: '📅' },
  { id: 'subscriptions', label: 'Subscriptions', icon: '🔄' },
  { id: 'etf', label: 'ETF Analysis', icon: '📈' },
];

const toolPages = [
  { id: 'overview', label: 'Account Overview', icon: '🏦' },
  { id: 'calendar', label: 'Spending Calendar', icon: '🗓️' },
  { id: 'categories', label: 'Category Manager', icon: '🏷️' },
  { id: 'raw', label: 'Raw Transactions', icon: '📋' },
];

function App() {
  const [currentPage, setCurrentPage] = useState('savings');
  const [menuOpen, setMenuOpen] = useState(false);

  // Up Bank shared state
  const [health, setHealth] = useState(null);
  const [summary, setSummary] = useState(null);
  const [syncStatus, setSyncStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

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
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
  };

  const navigateTo = (pageId) => {
    setCurrentPage(pageId);
    setMenuOpen(false);
  };

  const isToolPage = toolPages.some(t => t.id === currentPage);

  const renderPage = () => {
    switch (currentPage) {
      case 'savings': return <SavingsChart />;
      case 'spending': return <SpendingBreakdown />;
      case 'budget': return <DailySpendingChart />;
      case 'subscriptions': return <SubscriptionTracker />;
      case 'etf': return <ETFAnalysis />;
      case 'overview': return summary?.accounts ? <AccountOverview accounts={summary.accounts} onRefresh={loadData} /> : null;
      case 'calendar': return <FinancialCalendar />;
      case 'categories': return <MerchantCategoryManager />;
      case 'raw': return <RawTransactions />;
      default: return <SavingsChart />;
    }
  };

  const currentToolLabel = toolPages.find(t => t.id === currentPage)?.label;

  return (
    <div className="app-layout">
      {/* Top navigation bar */}
      <nav className="top-nav">
        <div className="nav-pages">
          {mainPages.map(page => (
            <button
              key={page.id}
              className={`nav-page-btn ${currentPage === page.id ? 'active' : ''}`}
              onClick={() => navigateTo(page.id)}
            >
              <span className="nav-icon">{page.icon}</span>
              <span className="nav-label">{page.label}</span>
            </button>
          ))}
        </div>

        <div className="nav-right">
          {/* Sync status */}
          <div className="sync-status">
            <span
              className="status-dot"
              style={{
                background: health?.status === 'ok' ? 'var(--positive)' : health?.status === 'not_configured' ? 'var(--text-muted)' : 'var(--negative)',
                boxShadow: health?.status === 'ok' ? '0 0 8px rgba(45, 142, 111, 0.4)' : 'none',
              }}
            />
            <span className="sync-label">
              {formatDate(syncStatus?.last_successful_sync)}
            </span>
            <button
              className="sync-btn"
              onClick={handleSync}
              disabled={syncing}
              title="Sync Up Bank"
            >
              {syncing ? <span className="spin-icon">⟳</span> : '↻'}
            </button>
          </div>

          {/* Tools menu toggle */}
          <div className="tools-menu-wrapper">
            <button
              className={`nav-tools-btn ${isToolPage ? 'active' : ''}`}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {isToolPage ? currentToolLabel : 'More'}
              <span style={{ marginLeft: '6px', fontSize: '12px' }}>▾</span>
            </button>

            {menuOpen && (
              <>
                <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
                <div className="tools-dropdown">
                  {toolPages.map(tool => (
                    <button
                      key={tool.id}
                      className={`dropdown-item ${currentPage === tool.id ? 'active' : ''}`}
                      onClick={() => navigateTo(tool.id)}
                    >
                      <span className="dropdown-icon">{tool.icon}</span>
                      {tool.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Stat cards bar — show on Up Bank pages */}
      {summary && !loading && currentPage !== 'etf' && (
        <div className="stat-bar">
          {[
            { label: 'Savings', value: formatCurrency(summary.total_savings), accent: 'var(--positive)' },
            { label: '2Up', value: formatCurrency(summary.two_up_balance), accent: 'var(--accent)' },
            { label: 'This Month', value: formatCurrency(summary.this_month_spending), accent: '#B8860B' },
            { label: 'Balance', value: formatCurrency(summary.total_balance), accent: '#3B7DD8' },
          ].map(card => (
            <div key={card.label} className="stat-chip" style={{ borderColor: card.accent }}>
              <span className="stat-chip-label">{card.label}</span>
              <span className="stat-chip-value">{card.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Main content */}
      <div className="main-content">
        {loading && currentPage !== 'etf' ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '80px 20px', color: 'var(--text-secondary)', gap: '12px',
          }}>
            <span className="spin-icon" style={{ fontSize: '20px' }}>⟳</span>
            Loading...
          </div>
        ) : (
          <div style={{ animation: 'fadeInUp 0.3s ease' }}>
            {renderPage()}
          </div>
        )}
      </div>

      <style>{`
        .top-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 20px;
          background: var(--bg-card);
          border-bottom: 1px solid var(--border);
          position: sticky;
          top: 0;
          z-index: 100;
          gap: 12px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
        }

        .nav-pages {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }

        .nav-page-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: var(--text-muted);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          font-family: var(--font-sans);
          white-space: nowrap;
        }

        .nav-page-btn:hover {
          background: var(--bg-surface);
          color: var(--text);
        }

        .nav-page-btn.active {
          background: var(--accent);
          color: white;
        }

        .nav-icon {
          font-size: 14px;
        }

        .nav-right {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        /* Sync status */
        .sync-status {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .sync-label {
          display: none;
        }

        @media (min-width: 900px) {
          .sync-label {
            display: inline;
          }
        }

        .sync-btn {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          transition: all 0.2s;
          font-family: var(--font-sans);
        }

        .sync-btn:hover:not(:disabled) {
          background: var(--bg-surface);
          color: var(--accent);
          border-color: var(--border-accent);
        }

        .sync-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Tools dropdown */
        .tools-menu-wrapper {
          position: relative;
        }

        .nav-tools-btn {
          display: flex;
          align-items: center;
          padding: 8px 14px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--bg-surface);
          color: var(--text-muted);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          font-family: var(--font-sans);
          white-space: nowrap;
        }

        .nav-tools-btn:hover {
          background: var(--bg-card);
          color: var(--text);
          border-color: rgba(0,0,0,0.15);
        }

        .nav-tools-btn.active {
          border-color: var(--accent);
          color: var(--accent);
        }

        .menu-backdrop {
          position: fixed;
          inset: 0;
          z-index: 150;
        }

        .tools-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 6px;
          min-width: 200px;
          z-index: 200;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          animation: fadeIn 0.15s ease;
        }

        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: var(--text-secondary);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
          width: 100%;
          text-align: left;
          font-family: var(--font-sans);
        }

        .dropdown-item:hover {
          background: var(--bg-surface);
          color: var(--text);
        }

        .dropdown-item.active {
          background: var(--accent-glow);
          color: var(--accent);
        }

        .dropdown-icon {
          font-size: 16px;
          width: 22px;
          text-align: center;
        }

        /* Stat bar */
        .stat-bar {
          display: flex;
          gap: 12px;
          padding: 10px 20px;
          overflow-x: auto;
          border-bottom: 1px solid var(--border);
          background: var(--bg-primary);
        }

        .stat-chip {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: 8px;
          background: var(--bg-card);
          border-left: 3px solid;
          white-space: nowrap;
          flex-shrink: 0;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
        }

        .stat-chip-label {
          font-size: 11px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          font-weight: 600;
        }

        .stat-chip-value {
          font-size: 14px;
          font-weight: 700;
          color: var(--text);
          font-family: var(--font-mono);
        }

        .main-content {
          padding: 24px;
          min-height: calc(100vh - 100px);
        }

        .spin-icon {
          display: inline-block;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .nav-label {
            display: none;
          }
          .nav-page-btn {
            padding: 8px 10px;
          }
          .top-nav {
            padding: 8px 12px;
          }
          .main-content {
            padding: 16px;
          }
          .stat-bar {
            padding: 8px 12px;
            gap: 8px;
          }
          .stat-chip {
            padding: 4px 10px;
          }
          .stat-chip-label {
            font-size: 10px;
          }
          .stat-chip-value {
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
}

export default App;
