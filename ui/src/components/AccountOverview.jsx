import React from 'react';
import { formatCurrency } from '../utils/formatters';

const AccountOverview = ({ accounts, onRefresh }) => {
  const getAccountTypeColor = (type) => {
    switch (type) {
      case 'SAVER': return 'var(--welcoming-green)';
      case 'TRANSACTIONAL': return 'var(--welcoming-blue)';
      case 'HOME_LOAN': return 'var(--primary)';
      default: return 'var(--text-light)';
    }
  };

  const getAccountIcon = (type, ownership) => {
    if (ownership === 'JOINT') return '👫';
    switch (type) {
      case 'SAVER': return '🐷';
      case 'TRANSACTIONAL': return '💳';
      case 'HOME_LOAN': return '🏠';
      default: return '💰';
    }
  };

  // Group accounts by type
  const savers = accounts.filter(a => a.account_type === 'SAVER');
  const transactional = accounts.filter(a => a.account_type === 'TRANSACTIONAL');
  const other = accounts.filter(a => !['SAVER', 'TRANSACTIONAL'].includes(a.account_type));

  const totalSavings = savers.reduce((sum, a) => sum + a.current_balance, 0);
  const totalTransactional = transactional.reduce((sum, a) => sum + a.current_balance, 0);

  const renderAccountCard = (account) => (
    <div
      key={account.id}
      style={{
        background: 'var(--welcoming-cream)',
        borderRadius: '12px',
        padding: '16px',
        borderLeft: `4px solid ${getAccountTypeColor(account.account_type)}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '28px' }}>
            {getAccountIcon(account.account_type, account.ownership_type)}
          </span>
          <div>
            <div style={{ fontWeight: '600', color: 'var(--text)', fontSize: '15px' }}>
              {account.display_name}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>
              {account.account_type}
              {account.ownership_type === 'JOINT' && ' • Shared'}
            </div>
          </div>
        </div>
      </div>
      <div style={{
        fontSize: '24px',
        fontWeight: '700',
        color: account.current_balance >= 0 ? 'var(--welcoming-green)' : 'var(--accent)',
        fontFamily: "'Roboto Mono', monospace"
      }}>
        {formatCurrency(account.current_balance)}
      </div>
    </div>
  );

  const SectionHeader = ({ title, total, count }) => (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '12px'
    }}>
      <h3 style={{
        margin: 0,
        color: 'var(--text)',
        fontSize: '16px',
        fontWeight: '600'
      }}>
        {title}
      </h3>
      <div style={{
        fontSize: '14px',
        color: 'var(--text-light)',
        display: 'flex',
        gap: '12px'
      }}>
        <span>{count} account{count !== 1 ? 's' : ''}</span>
        <span style={{ fontWeight: '600', color: 'var(--welcoming-green)' }}>
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Saver Accounts */}
      {savers.length > 0 && (
        <div>
          <SectionHeader title="Saver Accounts" total={totalSavings} count={savers.length} />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '12px'
          }}>
            {savers.map(renderAccountCard)}
          </div>
        </div>
      )}

      {/* Transactional Accounts */}
      {transactional.length > 0 && (
        <div>
          <SectionHeader title="Spending Accounts" total={totalTransactional} count={transactional.length} />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '12px'
          }}>
            {transactional.map(renderAccountCard)}
          </div>
        </div>
      )}

      {/* Other Accounts */}
      {other.length > 0 && (
        <div>
          <SectionHeader
            title="Other Accounts"
            total={other.reduce((sum, a) => sum + a.current_balance, 0)}
            count={other.length}
          />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '12px'
          }}>
            {other.map(renderAccountCard)}
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountOverview;
