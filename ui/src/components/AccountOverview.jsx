import React from 'react';
import { formatCurrency } from '../utils/formatters';

const AccountOverview = ({ accounts, onRefresh }) => {
  const getAccountAccent = (type) => {
    switch (type) {
      case 'SAVER': return 'var(--positive)';
      case 'TRANSACTIONAL': return '#3B7DD8';
      case 'HOME_LOAN': return 'var(--accent)';
      default: return 'var(--text-muted)';
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

  const savers = accounts.filter(a => a.account_type === 'SAVER');
  const transactional = accounts.filter(a => a.account_type === 'TRANSACTIONAL');
  const other = accounts.filter(a => !['SAVER', 'TRANSACTIONAL'].includes(a.account_type));

  const totalSavings = savers.reduce((sum, a) => sum + a.current_balance, 0);
  const totalTransactional = transactional.reduce((sum, a) => sum + a.current_balance, 0);

  const renderAccountCard = (account) => (
    <div
      key={account.id}
      style={{
        background: 'var(--bg-card)',
        borderRadius: '12px',
        padding: '16px',
        borderLeft: `3px solid ${getAccountAccent(account.account_type)}`,
        border: '1px solid var(--border)',
        borderLeftWidth: '3px',
        borderLeftColor: getAccountAccent(account.account_type),
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        transition: 'all 0.2s ease',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-card-hover)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
        e.currentTarget.style.borderLeftColor = getAccountAccent(account.account_type);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--bg-card)';
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
        e.currentTarget.style.borderLeftColor = getAccountAccent(account.account_type);
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '24px' }}>
            {getAccountIcon(account.account_type, account.ownership_type)}
          </span>
          <div>
            <div style={{ fontWeight: '600', color: 'var(--text)', fontSize: '14px' }}>
              {account.display_name}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {account.account_type}
              {account.ownership_type === 'JOINT' && ' \u00b7 Shared'}
            </div>
          </div>
        </div>
      </div>
      <div style={{
        fontSize: '22px',
        fontWeight: '700',
        color: account.current_balance >= 0 ? 'var(--positive)' : 'var(--negative)',
        fontFamily: 'var(--font-mono)',
        letterSpacing: '-0.02em',
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
      marginBottom: '12px',
    }}>
      <h3 style={{
        margin: 0,
        color: 'var(--text)',
        fontSize: '15px',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}>
        {title}
      </h3>
      <div style={{
        fontSize: '13px',
        color: 'var(--text-muted)',
        display: 'flex',
        gap: '12px',
        fontFamily: 'var(--font-mono)',
      }}>
        <span>{count} acct{count !== 1 ? 's' : ''}</span>
        <span style={{ fontWeight: '600', color: 'var(--positive)' }}>
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {savers.length > 0 && (
        <div>
          <SectionHeader title="Saver Accounts" total={totalSavings} count={savers.length} />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '12px',
          }}>
            {savers.map(renderAccountCard)}
          </div>
        </div>
      )}

      {transactional.length > 0 && (
        <div>
          <SectionHeader title="Spending Accounts" total={totalTransactional} count={transactional.length} />
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '12px',
          }}>
            {transactional.map(renderAccountCard)}
          </div>
        </div>
      )}

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
            gap: '12px',
          }}>
            {other.map(renderAccountCard)}
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountOverview;
