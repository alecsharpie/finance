import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { fetchDailySpendingAdjusted, fetchUpAccounts, fetchDailyTransactions } from '../services/api';
import { formatCurrency } from '../utils/formatters';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Title,
  Tooltip,
  Legend
);

const MONTHLY_BUDGET = 5000;
const DAYS_IN_MONTH = 30.5;
const DAILY_BUDGET = Math.round(MONTHLY_BUDGET / DAYS_IN_MONTH);
const DAILY_BUDGET_PER_PERSON = Math.round(DAILY_BUDGET / 2);
const PAY_DAY = 15;
const DEFAULT_MONTHLY_SUBSCRIPTIONS = 132.49;

const getLocalDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTodayString = () => getLocalDateString(new Date());

const getPayCycle = (offset = 0) => {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  let baseMonth, baseYear;

  if (currentDay >= PAY_DAY) {
    baseMonth = currentMonth;
    baseYear = currentYear;
  } else {
    baseMonth = currentMonth - 1;
    baseYear = currentYear;
  }

  baseMonth += offset;

  while (baseMonth < 0) { baseMonth += 12; baseYear -= 1; }
  while (baseMonth > 11) { baseMonth -= 12; baseYear += 1; }

  const start = new Date(baseYear, baseMonth, PAY_DAY);
  const end = new Date(baseYear, baseMonth + 1, PAY_DAY - 1);
  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

  return {
    cycleStart: getLocalDateString(start),
    cycleEnd: getLocalDateString(end),
    cycleDays: days,
    label: start.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })
  };
};

const DailySpendingChart = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('variance');
  const [spendingData, setSpendingData] = useState(null);
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [budgetInfo, setBudgetInfo] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [jointAccountId, setJointAccountId] = useState(null);
  const [jointAccountName, setJointAccountName] = useState(null);
  const [cycleOffset, setCycleOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTransactions, setSelectedTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [showSubscriptions, setShowSubscriptions] = useState(true);
  const chartRef = useRef(null);

  const effectiveDailyBudget = budgetInfo?.daily_discretionary || (MONTHLY_BUDGET - DEFAULT_MONTHLY_SUBSCRIPTIONS) / DAYS_IN_MONTH;

  const { cycleStart, cycleEnd, cycleDays, label: cycleLabel } = useMemo(() => {
    return getPayCycle(cycleOffset);
  }, [cycleOffset]);

  const isCurrentCycle = cycleOffset === 0;

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const accountsData = await fetchUpAccounts();
        setAccounts(accountsData);
        const jointAccount = accountsData.find(
          acc => acc.ownership_type === 'JOINT' && acc.account_type === 'TRANSACTIONAL'
        );
        if (jointAccount) {
          setJointAccountId(jointAccount.id);
          setJointAccountName(jointAccount.display_name);
        }
      } catch (err) {
        console.error('Failed to load accounts:', err);
      }
    };
    loadAccounts();
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (!jointAccountId) return;
      setLoading(true);
      setError(null);

      try {
        const data = await fetchDailySpendingAdjusted(jointAccountId, cycleStart, cycleEnd);
        setSpendingData({
          dates: data.discretionary?.dates || [],
          spending: data.discretionary?.spending || [],
          transaction_counts: data.discretionary?.transaction_counts || []
        });
        setSubscriptionData(data.subscriptions);
        setBudgetInfo(data.budget_info);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [jointAccountId, cycleStart, cycleEnd]);

  const allDatesInCycle = useMemo(() => {
    const dates = [];
    const current = new Date(cycleStart + 'T00:00:00');
    const end = new Date(cycleEnd + 'T00:00:00');
    while (current <= end) {
      dates.push(getLocalDateString(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }, [cycleStart, cycleEnd]);

  const stats = useMemo(() => {
    if (!spendingData) return null;

    const todayStr = getTodayString();
    const effectiveEndDate = isCurrentCycle
      ? (todayStr < cycleEnd ? todayStr : cycleEnd)
      : cycleEnd;

    const cycleStartDate = new Date(cycleStart + 'T00:00:00');
    const effectiveEndDateObj = new Date(effectiveEndDate + 'T00:00:00');
    const daysPassed = Math.ceil((effectiveEndDateObj - cycleStartDate) / (1000 * 60 * 60 * 24)) + 1;
    const daysRemaining = isCurrentCycle ? Math.max(0, cycleDays - daysPassed) : 0;

    const spendingMap = {};
    spendingData.dates.forEach((date, i) => { spendingMap[date] = spendingData.spending[i]; });

    const subscriptionMap = {};
    if (subscriptionData?.dates) {
      subscriptionData.dates.forEach((date, i) => { subscriptionMap[date] = subscriptionData.spending[i]; });
    }

    let discretionarySpentToDate = 0;
    allDatesInCycle.forEach(date => {
      if (date <= effectiveEndDate) {
        discretionarySpentToDate += (spendingMap[date] || 0);
      }
    });

    const subscriptionSpentToDate = subscriptionData?.total || 0;
    const dailyDiscretionaryBudget = budgetInfo?.daily_discretionary || effectiveDailyBudget;
    const discretionaryBudgetToDate = daysPassed * dailyDiscretionaryBudget;
    const discretionaryBalance = discretionaryBudgetToDate - discretionarySpentToDate;

    const totalSpentToDate = discretionarySpentToDate + subscriptionSpentToDate;
    const totalBudgetToDate = daysPassed * DAILY_BUDGET;
    const totalBalance = totalBudgetToDate - totalSpentToDate;

    const avgDailySpending = daysPassed > 0 ? discretionarySpentToDate / daysPassed : 0;

    return {
      daysPassed, daysRemaining,
      discretionarySpentToDate, discretionaryBudgetToDate, discretionaryBalance, dailyDiscretionaryBudget,
      subscriptionSpentToDate,
      totalSpentToDate, totalBudgetToDate, totalBalance,
      spentToDate: discretionarySpentToDate,
      budgetToDate: discretionaryBudgetToDate,
      balance: discretionaryBalance,
      avgDailySpending,
      onTrack: discretionaryBalance >= 0,
      spendingMap, subscriptionMap, effectiveEndDate
    };
  }, [spendingData, subscriptionData, budgetInfo, cycleStart, cycleEnd, cycleDays, allDatesInCycle, isCurrentCycle, effectiveDailyBudget]);

  // Light tooltip style shared across all chart options
  const tooltipStyle = {
    backgroundColor: '#FFFFFF',
    titleColor: '#2A2A28',
    bodyColor: '#636360',
    borderColor: 'rgba(0,0,0,0.08)',
    borderWidth: 1,
    padding: 12,
    titleFont: { family: "'Outfit', sans-serif" },
    bodyFont: { family: "'IBM Plex Mono', monospace", size: 12 },
  };

  const gridColor = 'rgba(0, 0, 0, 0.05)';
  const tickColor = '#9A9A94';
  const tickFont = { family: "'IBM Plex Mono', monospace", size: 11 };
  const labelFont = { family: "'Outfit', sans-serif", size: 11 };

  const cumulativeChartData = useMemo(() => {
    if (!stats) return null;
    const balances = [];
    const budgetLine = [];
    let runningBalance = 0;
    const dailyBudget = stats.dailyDiscretionaryBudget || effectiveDailyBudget;

    allDatesInCycle.forEach((date) => {
      runningBalance += dailyBudget;
      runningBalance -= (stats.spendingMap[date] || 0);
      balances.push(date <= stats.effectiveEndDate ? runningBalance : null);
      budgetLine.push(0);
    });

    const labels = allDatesInCycle.map(d => {
      const date = new Date(d + 'T00:00:00');
      return date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
    });

    const lastBalance = balances.filter(b => b !== null).pop() || 0;

    return {
      labels,
      datasets: [
        {
          label: 'Budget Balance',
          data: balances,
          fill: {
            target: 'origin',
            above: 'rgba(45, 142, 111, 0.1)',
            below: 'rgba(196, 77, 77, 0.1)',
          },
          borderColor: lastBalance >= 0 ? '#2D8E6F' : '#C44D4D',
          borderWidth: 2.5,
          tension: 0.3,
          pointRadius: allDatesInCycle.length < 20 ? 3 : 0,
          pointHoverRadius: 6,
          pointBackgroundColor: lastBalance >= 0 ? '#2D8E6F' : '#C44D4D',
        },
        {
          label: 'On Budget Line',
          data: budgetLine,
          borderColor: 'rgba(194, 83, 58, 0.3)',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
        },
      ],
    };
  }, [stats, allDatesInCycle, effectiveDailyBudget]);

  const varianceChartData = useMemo(() => {
    if (!stats) return null;
    const variances = [];
    const barColors = [];
    const dailyBudget = stats.dailyDiscretionaryBudget || effectiveDailyBudget;

    allDatesInCycle.forEach(date => {
      if (date > stats.effectiveEndDate) {
        variances.push(null);
        barColors.push('rgba(0, 0, 0, 0.03)');
      } else {
        const spent = stats.spendingMap[date] || 0;
        const variance = dailyBudget - spent;
        variances.push(variance);
        barColors.push(
          variance >= 0
            ? 'rgba(45, 142, 111, 0.6)'
            : 'rgba(196, 77, 77, 0.6)'
        );
      }
    });

    const labels = allDatesInCycle.map(d => {
      const date = new Date(d + 'T00:00:00');
      return date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
    });

    return {
      labels,
      datasets: [{
        label: 'Daily Variance',
        data: variances,
        backgroundColor: barColors,
        borderColor: barColors.map(c => c.replace('0.7', '1')),
        borderWidth: 1,
        borderRadius: 4,
      }],
    };
  }, [stats, allDatesInCycle, effectiveDailyBudget]);

  const dailyChartData = useMemo(() => {
    if (!stats) return null;
    const dailySpending = [];
    const subscriptionSpending = [];
    const barColors = [];
    const dailyBudget = stats.dailyDiscretionaryBudget || effectiveDailyBudget;

    allDatesInCycle.forEach(date => {
      if (date > stats.effectiveEndDate) {
        dailySpending.push(null);
        subscriptionSpending.push(null);
        barColors.push('rgba(0, 0, 0, 0.03)');
      } else {
        const spent = stats.spendingMap[date] || 0;
        const subSpent = stats.subscriptionMap?.[date] || 0;
        dailySpending.push(spent);
        subscriptionSpending.push(subSpent);
        barColors.push(
          spent > dailyBudget
            ? 'rgba(196, 77, 77, 0.55)'
            : 'rgba(45, 142, 111, 0.55)'
        );
      }
    });

    const labels = allDatesInCycle.map(d => {
      const date = new Date(d + 'T00:00:00');
      return date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
    });

    const datasets = [
      {
        label: 'Discretionary Spending',
        data: dailySpending,
        backgroundColor: barColors,
        borderColor: barColors.map(c => c.replace('0.6', '0.9')),
        borderWidth: 1,
        borderRadius: 4,
        stack: 'spending',
      },
    ];

    if (showSubscriptions) {
      datasets.push({
        label: 'Subscriptions',
        data: subscriptionSpending,
        backgroundColor: 'rgba(139, 92, 196, 0.4)',
        borderColor: 'rgba(139, 92, 196, 0.7)',
        borderWidth: 1,
        borderRadius: 4,
        stack: 'spending',
      });
    }

    return { labels, datasets };
  }, [stats, allDatesInCycle, effectiveDailyBudget, showSubscriptions]);

  const dailyDiscBudget = stats?.dailyDiscretionaryBudget || effectiveDailyBudget;

  const cumulativeOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    onHover: (event, elements) => { event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default'; },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltipStyle,
        callbacks: {
          label: (context) => {
            if (context.raw === null) return '';
            const label = context.dataset.label;
            const value = context.raw;
            if (label === 'On Budget Line') return 'On Budget: $0';
            const status = value >= 0 ? 'ahead' : 'behind';
            return `${status === 'ahead' ? 'Ahead' : 'Behind'}: ${formatCurrency(Math.abs(value))}`;
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: labelFont, color: tickColor, maxRotation: 45, autoSkip: true, maxTicksLimit: 15 } },
      y: { ticks: { callback: (v) => formatCurrency(v), font: tickFont, color: tickColor }, grid: { color: gridColor } },
    },
  };

  const varianceOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onHover: (event, elements) => { event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default'; },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltipStyle,
        callbacks: {
          label: (context) => {
            const value = context.raw;
            if (value === null) return 'No data yet';
            const spent = dailyDiscBudget - value;
            if (value >= 0) {
              return [`Saved: ${formatCurrency(value)}`, `Spent: ${formatCurrency(spent)} of $${Math.round(dailyDiscBudget)} discretionary`];
            } else {
              return [`Over by: ${formatCurrency(Math.abs(value))}`, `Spent: ${formatCurrency(spent)} of $${Math.round(dailyDiscBudget)} discretionary`];
            }
          },
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: labelFont, color: tickColor, maxRotation: 45, autoSkip: true, maxTicksLimit: 15 } },
      y: {
        ticks: {
          callback: (v) => { if (v === 0) return '$0'; return (v > 0 ? '+' : '') + formatCurrency(v); },
          font: tickFont, color: tickColor,
        },
        grid: {
          color: (ctx) => ctx.tick.value === 0 ? 'rgba(194, 83, 58, 0.25)' : gridColor,
          lineWidth: (ctx) => ctx.tick.value === 0 ? 2 : 1,
        },
      },
    },
  };

  const dailyOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onHover: (event, elements) => { event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default'; },
    plugins: {
      legend: {
        display: showSubscriptions,
        labels: { color: '#636360', font: { family: "'Outfit', sans-serif", size: 12 }, usePointStyle: true, boxWidth: 8, boxHeight: 8 },
      },
      tooltip: {
        ...tooltipStyle,
        callbacks: {
          label: (context) => {
            const value = context.raw;
            if (value === null) return 'No data yet';
            if (context.dataset.label === 'Subscriptions') {
              return value > 0 ? `Subscriptions: ${formatCurrency(value)}` : null;
            }
            const diff = dailyDiscBudget - value;
            const status = diff >= 0 ? `Under by ${formatCurrency(diff)}` : `Over by ${formatCurrency(-diff)}`;
            return [`Discretionary: ${formatCurrency(value)}`, status];
          },
        },
      },
    },
    scales: {
      x: { stacked: true, grid: { display: false }, ticks: { font: labelFont, color: tickColor, maxRotation: 45, autoSkip: true, maxTicksLimit: 15 } },
      y: {
        stacked: true, beginAtZero: true, suggestedMax: dailyDiscBudget * 2.5,
        ticks: { callback: (v) => formatCurrency(v), font: tickFont, color: tickColor },
        grid: { color: gridColor },
      },
    },
  };

  const formatDateShort = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
  };

  const StatCard = ({ label, value, color, subtext }) => (
    <div style={{
      background: 'var(--bg-glass)',
      backdropFilter: 'var(--glass-blur)',
      WebkitBackdropFilter: 'var(--glass-blur)',
      borderRadius: '10px',
      padding: '14px 16px',
      textAlign: 'center',
      border: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>
        {label}
      </div>
      <div style={{ fontSize: '20px', fontWeight: '700', color: color || 'var(--text)', fontFamily: 'var(--font-mono)' }}>
        {value}
      </div>
      {subtext && (
        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
          {subtext}
        </div>
      )}
    </div>
  );

  const handlePrevCycle = () => setCycleOffset(prev => prev - 1);
  const handleNextCycle = () => setCycleOffset(prev => Math.min(0, prev + 1));
  const handleCurrentCycle = () => setCycleOffset(0);

  const handleDayClick = async (dateStr) => {
    if (!jointAccountId || !dateStr) return;
    if (selectedDate === dateStr) {
      setSelectedDate(null);
      setSelectedTransactions([]);
      return;
    }
    setSelectedDate(dateStr);
    setLoadingTransactions(true);
    try {
      const transactions = await fetchDailyTransactions(dateStr, jointAccountId);
      setSelectedTransactions(transactions);
    } catch (err) {
      console.error('Failed to load transactions:', err);
      setSelectedTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleChartClick = (event) => {
    if (!chartRef.current) return;
    const chart = chartRef.current;
    const elements = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, false);
    if (elements.length > 0) {
      const index = elements[0].index;
      const dateStr = allDatesInCycle[index];
      if (dateStr && dateStr <= (stats?.effectiveEndDate || '')) {
        handleDayClick(dateStr);
      }
    }
  };

  if (!jointAccountId && !loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <span style={{ fontSize: '48px' }}>🔗</span>
        <p style={{ marginTop: '16px', fontWeight: '500' }}>No 2Up account found</p>
        <p style={{ fontSize: '13px' }}>Link your 2Up account to track shared spending.</p>
      </div>
    );
  }

  const renderChart = () => {
    if (loading) {
      return (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Loading spending data...
        </div>
      );
    }
    if (error) {
      return (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--negative)' }}>
          Error: {error}
        </div>
      );
    }
    if (!stats) {
      return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '12px' }}>
          <span style={{ fontSize: '48px' }}>📊</span>
          <span style={{ fontWeight: '500' }}>No spending data for this period</span>
        </div>
      );
    }

    switch (viewMode) {
      case 'cumulative':
        return <Line ref={chartRef} data={cumulativeChartData} options={cumulativeOptions} onClick={handleChartClick} />;
      case 'variance':
        return <Bar ref={chartRef} data={varianceChartData} options={varianceOptions} onClick={handleChartClick} />;
      case 'daily':
        return <Bar ref={chartRef} data={dailyChartData} options={dailyOptions} onClick={handleChartClick} />;
      default:
        return null;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header with navigation */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '18px', fontWeight: '600' }}>
            Daily Budget Tracker
            {jointAccountName && (
              <span style={{
                fontSize: '13px',
                fontWeight: '400',
                color: 'var(--text-muted)',
                marginLeft: '8px',
                fontFamily: 'var(--font-mono)',
              }}>
                ({jointAccountName})
              </span>
            )}
          </h3>

          {/* Pay cycle navigation */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '8px'
          }}>
            <button
              onClick={handlePrevCycle}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                color: 'var(--text-secondary)',
                transition: 'all 0.15s',
              }}
              title="Previous cycle"
            >
              ←
            </button>

            <div style={{
              fontSize: '13px',
              color: 'var(--text)',
              fontWeight: '500',
              minWidth: '180px',
              textAlign: 'center',
              fontFamily: 'var(--font-mono)',
            }}>
              {formatDateShort(cycleStart)} – {formatDateShort(cycleEnd)}
              {!isCurrentCycle && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                  (past)
                </span>
              )}
            </div>

            <button
              onClick={handleNextCycle}
              disabled={isCurrentCycle}
              style={{
                background: isCurrentCycle ? 'transparent' : 'var(--bg-surface)',
                border: isCurrentCycle ? 'none' : '1px solid var(--border)',
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                cursor: isCurrentCycle ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                color: 'var(--text-secondary)',
                opacity: isCurrentCycle ? 0.3 : 1,
              }}
              title="Next cycle"
            >
              →
            </button>

            {!isCurrentCycle && (
              <button
                onClick={handleCurrentCycle}
                style={{
                  background: 'var(--accent)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: '600',
                  color: 'white',
                  marginLeft: '8px',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                Current
              </button>
            )}
          </div>
        </div>

        {/* View mode toggle */}
        <div style={{
          display: 'flex',
          gap: '4px',
          background: 'var(--bg-surface)',
          padding: '4px',
          borderRadius: '10px',
          border: '1px solid var(--border)',
        }}>
          {[
            { value: 'variance', label: '+/- Budget' },
            { value: 'cumulative', label: 'Running' },
            { value: 'daily', label: 'Spending' },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setViewMode(value)}
              style={{
                padding: '6px 12px',
                border: 'none',
                borderRadius: '7px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                fontFamily: 'var(--font-sans)',
                background: viewMode === value ? 'var(--accent)' : 'transparent',
                color: viewMode === value ? 'white' : 'var(--text-muted)',
                transition: 'all 0.2s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          gap: '12px'
        }}>
          <StatCard
            label="Discretionary"
            value={formatCurrency(stats.discretionarySpentToDate)}
            subtext={`of $${Math.round(stats.discretionaryBudgetToDate)} budget`}
          />
          <StatCard
            label="Subscriptions"
            value={formatCurrency(stats.subscriptionSpentToDate)}
            subtext={`~$${Math.round(budgetInfo?.daily_subscriptions || 4.34)}/day spread`}
            color="var(--text-secondary)"
          />
          <StatCard
            label={isCurrentCycle ? "Balance" : "Final Balance"}
            value={(stats.discretionaryBalance >= 0 ? '+' : '') + formatCurrency(stats.discretionaryBalance)}
            color={stats.onTrack ? 'var(--positive)' : 'var(--negative)'}
            subtext={stats.onTrack ? 'under budget' : 'over budget'}
          />
          {isCurrentCycle ? (
            <StatCard
              label="Days Left"
              value={stats.daysRemaining}
              subtext={`of ${cycleDays} days`}
            />
          ) : (
            <StatCard
              label="Avg/Day"
              value={formatCurrency(stats.avgDailySpending)}
              subtext={`vs $${Math.round(dailyDiscBudget)}/day`}
            />
          )}
        </div>
      )}

      {/* Chart container */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        padding: '24px',
        height: '400px',
      }}>
        {renderChart()}
      </div>

      {/* Selected day transactions */}
      {selectedDate && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '14px',
          padding: '16px',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
          }}>
            <h4 style={{ margin: 0, fontSize: '15px', color: 'var(--text)' }}>
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-AU', {
                weekday: 'long',
                day: 'numeric',
                month: 'long'
              })}
            </h4>
            <button
              onClick={() => { setSelectedDate(null); setSelectedTransactions([]); }}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                cursor: 'pointer',
                fontSize: '14px',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ×
            </button>
          </div>

          {loadingTransactions ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading transactions...
            </div>
          ) : selectedTransactions.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No spending on this day
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {selectedTransactions.map((tx, idx) => (
                <div
                  key={tx.id || idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    background: 'var(--bg-surface)',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                  }}
                >
                  <span style={{
                    fontSize: '14px',
                    color: 'var(--text)',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginRight: '12px',
                  }}>
                    {tx.description}
                  </span>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    fontFamily: 'var(--font-mono)',
                    color: tx.amount > DAILY_BUDGET_PER_PERSON ? 'var(--negative)' : 'var(--text)',
                  }}>
                    {formatCurrency(tx.amount)}
                  </span>
                </div>
              ))}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderTop: '1px solid var(--border)',
                marginTop: '4px',
              }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)' }}>
                  Total ({selectedTransactions.length} transactions)
                </span>
                <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>
                  {formatCurrency(selectedTransactions.reduce((sum, tx) => sum + tx.amount, 0))}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Legend for variance view */}
      {viewMode === 'variance' && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '24px',
          fontSize: '12px',
          color: 'var(--text-muted)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(45, 142, 111, 0.6)' }} />
            <span>Under budget (saved)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(196, 77, 77, 0.6)' }} />
            <span>Over budget</span>
          </div>
        </div>
      )}

      {/* Legend for daily view */}
      {viewMode === 'daily' && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '24px',
          fontSize: '12px',
          color: 'var(--text-muted)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(45, 142, 111, 0.55)' }} />
            <span>Discretionary</span>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showSubscriptions}
              onChange={(e) => setShowSubscriptions(e.target.checked)}
              style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
            />
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(139, 92, 196, 0.4)' }} />
            <span>Show subscriptions</span>
          </label>
        </div>
      )}

      {/* Budget info footer */}
      <div style={{
        fontSize: '12px',
        color: 'var(--text-muted)',
        textAlign: 'center',
        padding: '4px',
        fontFamily: 'var(--font-mono)',
      }}>
        ${MONTHLY_BUDGET.toLocaleString()}/mo total = ~${Math.round(budgetInfo?.monthly_subscriptions || DEFAULT_MONTHLY_SUBSCRIPTIONS)}/mo subscriptions + ~${Math.round(budgetInfo?.monthly_discretionary || (MONTHLY_BUDGET - DEFAULT_MONTHLY_SUBSCRIPTIONS))}/mo discretionary (~${Math.round(dailyDiscBudget)}/day)
      </div>
    </div>
  );
};

export default DailySpendingChart;
