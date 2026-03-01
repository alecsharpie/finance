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
import { fetchDailySpending, fetchUpAccounts, fetchDailyTransactions } from '../services/api';
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

// Constants
const MONTHLY_BUDGET = 5000; // Total monthly budget for shared spending
const DAYS_IN_MONTH = 30.5; // Average days per month
const DAILY_BUDGET = Math.round(MONTHLY_BUDGET / DAYS_IN_MONTH); // ~$164/day for both people combined
const DAILY_BUDGET_PER_PERSON = Math.round(DAILY_BUDGET / 2); // ~$82/day per person
const PAY_DAY = 15;

// Helper to get local date string (YYYY-MM-DD) without timezone issues
const getLocalDateString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to get today's date string in local timezone
const getTodayString = () => getLocalDateString(new Date());

// Calculate pay cycle for a given offset (0 = current, -1 = previous, etc.)
const getPayCycle = (offset = 0) => {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  let baseMonth, baseYear;

  if (currentDay >= PAY_DAY) {
    // We're in the current pay cycle (15th of this month to 14th of next month)
    baseMonth = currentMonth;
    baseYear = currentYear;
  } else {
    // We're in last month's pay cycle (15th of last month to 14th of this month)
    baseMonth = currentMonth - 1;
    baseYear = currentYear;
  }

  // Apply offset
  baseMonth += offset;

  // Normalize month/year
  while (baseMonth < 0) {
    baseMonth += 12;
    baseYear -= 1;
  }
  while (baseMonth > 11) {
    baseMonth -= 12;
    baseYear += 1;
  }

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
  const [viewMode, setViewMode] = useState('variance'); // 'cumulative' | 'daily' | 'variance'
  const [spendingData, setSpendingData] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [jointAccountId, setJointAccountId] = useState(null);
  const [jointAccountName, setJointAccountName] = useState(null);
  const [cycleOffset, setCycleOffset] = useState(0); // 0 = current, -1 = previous, etc.
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTransactions, setSelectedTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const chartRef = useRef(null);

  // Calculate current pay cycle based on offset
  const { cycleStart, cycleEnd, cycleDays, label: cycleLabel } = useMemo(() => {
    return getPayCycle(cycleOffset);
  }, [cycleOffset]);

  // Check if viewing current cycle
  const isCurrentCycle = cycleOffset === 0;

  // Load accounts and find the 2Up (JOINT) account
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const accountsData = await fetchUpAccounts();
        setAccounts(accountsData);

        // Find the JOINT (2Up) transactional account
        const jointAccount = accountsData.find(
          acc => acc.ownership_type === 'JOINT' && acc.account_type === 'TRANSACTIONAL'
        );
        if (jointAccount) {
          setJointAccountId(jointAccount.id);
          setJointAccountName(jointAccount.display_name);
        }

        // Debug: log all accounts so user can verify
        console.log('Available accounts:', accountsData.map(a => ({
          name: a.display_name,
          type: a.account_type,
          ownership: a.ownership_type,
          id: a.id
        })));
        console.log('Selected 2Up account:', jointAccount?.display_name || 'None found');
      } catch (err) {
        console.error('Failed to load accounts:', err);
      }
    };
    loadAccounts();
  }, []);

  // Load spending data when we have the account ID and cycle dates
  useEffect(() => {
    const loadData = async () => {
      if (!jointAccountId) return;

      setLoading(true);
      setError(null);

      try {
        const data = await fetchDailySpending(jointAccountId, cycleStart, cycleEnd);

        // Debug: log what the API returned
        console.log('=== Daily Spending Debug ===');
        console.log('Account ID:', jointAccountId);
        console.log('Date range:', cycleStart, 'to', cycleEnd);
        console.log('API returned dates:', data.dates);
        console.log('API returned spending:', data.spending);
        console.log('Total transactions:', data.dates?.length || 0);

        setSpendingData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [jointAccountId, cycleStart, cycleEnd]);

  // Build all dates in the pay cycle
  const allDatesInCycle = useMemo(() => {
    const dates = [];
    const current = new Date(cycleStart + 'T00:00:00'); // Force local timezone
    const end = new Date(cycleEnd + 'T00:00:00');

    while (current <= end) {
      dates.push(getLocalDateString(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }, [cycleStart, cycleEnd]);

  // Calculate statistics and effective end date
  const stats = useMemo(() => {
    if (!spendingData) return null;

    const todayStr = getTodayString();

    // For past cycles, use the full cycle. For current cycle, use up to today.
    const effectiveEndDate = isCurrentCycle
      ? (todayStr < cycleEnd ? todayStr : cycleEnd)
      : cycleEnd;

    const cycleStartDate = new Date(cycleStart + 'T00:00:00');
    const effectiveEndDateObj = new Date(effectiveEndDate + 'T00:00:00');
    const daysPassed = Math.ceil((effectiveEndDateObj - cycleStartDate) / (1000 * 60 * 60 * 24)) + 1;
    const daysRemaining = isCurrentCycle ? Math.max(0, cycleDays - daysPassed) : 0;

    // Create spending lookup
    const spendingMap = {};
    spendingData.dates.forEach((date, i) => {
      spendingMap[date] = spendingData.spending[i];
    });

    // Calculate spent to date (only for days that have passed)
    let spentToDate = 0;
    allDatesInCycle.forEach(date => {
      if (date <= effectiveEndDate) {
        spentToDate += (spendingMap[date] || 0);
      }
    });

    const budgetToDate = daysPassed * DAILY_BUDGET;
    const balance = budgetToDate - spentToDate;
    const avgDailySpending = daysPassed > 0 ? spentToDate / daysPassed : 0;

    return {
      daysPassed,
      daysRemaining,
      spentToDate,
      budgetToDate,
      balance,
      avgDailySpending,
      onTrack: balance >= 0,
      spendingMap,
      effectiveEndDate
    };
  }, [spendingData, cycleStart, cycleEnd, cycleDays, allDatesInCycle, isCurrentCycle]);

  // Process cumulative balance data
  const cumulativeChartData = useMemo(() => {
    if (!stats) return null;

    const balances = [];
    const budgetLine = [];
    let runningBalance = 0;

    allDatesInCycle.forEach((date) => {
      runningBalance += DAILY_BUDGET;
      runningBalance -= (stats.spendingMap[date] || 0);

      if (date <= stats.effectiveEndDate) {
        balances.push(runningBalance);
      } else {
        balances.push(null);
      }

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
            above: 'rgba(148, 180, 159, 0.3)',
            below: 'rgba(231, 111, 81, 0.3)',
          },
          borderColor: lastBalance >= 0 ? '#94B49F' : '#E76F51',
          borderWidth: 2.5,
          tension: 0.3,
          pointRadius: allDatesInCycle.length < 20 ? 3 : 0,
          pointHoverRadius: 6,
          pointBackgroundColor: lastBalance >= 0 ? '#94B49F' : '#E76F51',
        },
        {
          label: 'On Budget Line',
          data: budgetLine,
          borderColor: 'rgba(125, 107, 145, 0.6)',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
        },
      ],
    };
  }, [stats, allDatesInCycle]);

  // Process variance data (new view - shows +/- from daily budget)
  const varianceChartData = useMemo(() => {
    if (!stats) return null;

    const variances = [];
    const barColors = [];

    allDatesInCycle.forEach(date => {
      if (date > stats.effectiveEndDate) {
        variances.push(null);
        barColors.push('rgba(200, 200, 200, 0.3)');
      } else {
        const spent = stats.spendingMap[date] || 0;
        // Positive = under budget (good), Negative = over budget (bad)
        const variance = DAILY_BUDGET - spent;
        variances.push(variance);
        barColors.push(
          variance >= 0
            ? 'rgba(148, 180, 159, 0.8)'  // Under budget - green
            : 'rgba(231, 111, 81, 0.8)'   // Over budget - red
        );
      }
    });

    const labels = allDatesInCycle.map(d => {
      const date = new Date(d + 'T00:00:00');
      return date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
    });

    return {
      labels,
      datasets: [
        {
          label: 'Daily Variance',
          data: variances,
          backgroundColor: barColors,
          borderColor: barColors.map(c => c.replace('0.8', '1')),
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    };
  }, [stats, allDatesInCycle]);

  // Process daily spending data
  const dailyChartData = useMemo(() => {
    if (!stats) return null;

    const dailySpending = [];
    const barColors = [];

    allDatesInCycle.forEach(date => {
      if (date > stats.effectiveEndDate) {
        dailySpending.push(null);
        barColors.push('rgba(200, 200, 200, 0.3)');
      } else {
        const spent = stats.spendingMap[date] || 0;
        dailySpending.push(spent);
        barColors.push(
          spent > DAILY_BUDGET
            ? 'rgba(231, 111, 81, 0.7)'
            : 'rgba(148, 180, 159, 0.7)'
        );
      }
    });

    const labels = allDatesInCycle.map(d => {
      const date = new Date(d + 'T00:00:00');
      return date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
    });

    return {
      labels,
      datasets: [
        {
          label: 'Daily Spending',
          data: dailySpending,
          backgroundColor: barColors,
          borderColor: barColors.map(c => c.replace('0.7', '1')),
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    };
  }, [stats, allDatesInCycle]);

  const cumulativeOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    onHover: (event, elements) => {
      event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'white',
        titleColor: '#2D3033',
        bodyColor: '#2D3033',
        borderColor: '#F2E9E4',
        borderWidth: 1,
        padding: 12,
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
      x: {
        grid: { display: false },
        ticks: {
          font: { family: "'Inter', sans-serif", size: 11 },
          maxRotation: 45,
          autoSkip: true,
          maxTicksLimit: 15,
        },
      },
      y: {
        ticks: {
          callback: (value) => formatCurrency(value),
          font: { family: "'Inter', sans-serif", size: 11 },
        },
        grid: { color: 'rgba(0, 0, 0, 0.05)' },
      },
    },
  };

  const varianceOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onHover: (event, elements) => {
      event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'white',
        titleColor: '#2D3033',
        bodyColor: '#2D3033',
        borderColor: '#F2E9E4',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (context) => {
            const value = context.raw;
            if (value === null) return 'No data yet';
            const spent = DAILY_BUDGET - value;
            if (value >= 0) {
              return [`Saved: ${formatCurrency(value)}`, `Spent: ${formatCurrency(spent)} of $${DAILY_BUDGET} budget`];
            } else {
              return [`Over by: ${formatCurrency(Math.abs(value))}`, `Spent: ${formatCurrency(spent)} of $${DAILY_BUDGET} budget`];
            }
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { family: "'Inter', sans-serif", size: 11 },
          maxRotation: 45,
          autoSkip: true,
          maxTicksLimit: 15,
        },
      },
      y: {
        ticks: {
          callback: (value) => {
            if (value === 0) return '$0';
            return (value > 0 ? '+' : '') + formatCurrency(value);
          },
          font: { family: "'Inter', sans-serif", size: 11 },
        },
        grid: {
          color: (context) => {
            if (context.tick.value === 0) {
              return 'rgba(125, 107, 145, 0.5)';
            }
            return 'rgba(0, 0, 0, 0.05)';
          },
          lineWidth: (context) => {
            if (context.tick.value === 0) {
              return 2;
            }
            return 1;
          },
        },
      },
    },
  };

  const dailyOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onHover: (event, elements) => {
      event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'white',
        titleColor: '#2D3033',
        bodyColor: '#2D3033',
        borderColor: '#F2E9E4',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (context) => {
            const value = context.raw;
            if (value === null) return 'No data yet';
            const diff = DAILY_BUDGET - value;
            const status = diff >= 0
              ? `Under by ${formatCurrency(diff)}`
              : `Over by ${formatCurrency(-diff)}`;
            return [`Spent: ${formatCurrency(value)}`, status];
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { family: "'Inter', sans-serif", size: 11 },
          maxRotation: 45,
          autoSkip: true,
          maxTicksLimit: 15,
        },
      },
      y: {
        beginAtZero: true,
        suggestedMax: DAILY_BUDGET * 2.5,
        ticks: {
          callback: (value) => formatCurrency(value),
          font: { family: "'Inter', sans-serif", size: 11 },
        },
        grid: { color: 'rgba(0, 0, 0, 0.05)' },
      },
    },
  };

  const formatDateShort = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
  };

  const StatCard = ({ label, value, color, subtext }) => (
    <div style={{
      background: 'white',
      borderRadius: '8px',
      padding: '12px 16px',
      textAlign: 'center',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{ fontSize: '12px', color: 'var(--text-light)', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '20px', fontWeight: '700', color: color || 'var(--text)' }}>
        {value}
      </div>
      {subtext && (
        <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '2px' }}>
          {subtext}
        </div>
      )}
    </div>
  );

  const handlePrevCycle = () => setCycleOffset(prev => prev - 1);
  const handleNextCycle = () => setCycleOffset(prev => Math.min(0, prev + 1));
  const handleCurrentCycle = () => setCycleOffset(0);

  // Handle clicking on a day in the chart
  const handleDayClick = async (dateStr) => {
    if (!jointAccountId || !dateStr) return;

    // If clicking the same date, toggle off
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

  // Chart onClick handler
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
      <div style={{
        padding: '40px',
        textAlign: 'center',
        color: 'var(--text-light)',
      }}>
        <span style={{ fontSize: '48px' }}>🔗</span>
        <p style={{ marginTop: '16px', fontWeight: '500' }}>No 2Up account found</p>
        <p style={{ fontSize: '13px' }}>Link your 2Up account to track shared spending.</p>
      </div>
    );
  }

  const renderChart = () => {
    if (loading) {
      return (
        <div style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-light)',
        }}>
          Loading spending data...
        </div>
      );
    }

    if (error) {
      return (
        <div style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent)',
        }}>
          Error: {error}
        </div>
      );
    }

    if (!stats) {
      return (
        <div style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-light)',
          gap: '12px',
        }}>
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
                color: 'var(--text-light)',
                marginLeft: '8px'
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
                background: 'var(--welcoming-cream)',
                border: 'none',
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                color: 'var(--text-light)',
              }}
              title="Previous cycle"
            >
              ←
            </button>

            <div style={{
              fontSize: '14px',
              color: 'var(--text)',
              fontWeight: '500',
              minWidth: '180px',
              textAlign: 'center'
            }}>
              {formatDateShort(cycleStart)} - {formatDateShort(cycleEnd)}
              {!isCurrentCycle && (
                <span style={{
                  fontSize: '11px',
                  color: 'var(--text-light)',
                  marginLeft: '8px'
                }}>
                  (past)
                </span>
              )}
            </div>

            <button
              onClick={handleNextCycle}
              disabled={isCurrentCycle}
              style={{
                background: isCurrentCycle ? 'transparent' : 'var(--welcoming-cream)',
                border: 'none',
                borderRadius: '50%',
                width: '28px',
                height: '28px',
                cursor: isCurrentCycle ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                color: 'var(--text-light)',
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
                  background: 'var(--welcoming-green)',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: '500',
                  color: 'white',
                  marginLeft: '8px',
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
          background: 'var(--welcoming-cream)',
          padding: '4px',
          borderRadius: '20px'
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
                borderRadius: '16px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                background: viewMode === value ? 'var(--welcoming-green)' : 'transparent',
                color: viewMode === value ? 'white' : 'var(--text-light)',
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
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '12px'
        }}>
          <StatCard
            label={isCurrentCycle ? "Budget to Date" : "Total Budget"}
            value={formatCurrency(stats.budgetToDate)}
            subtext={`${stats.daysPassed} days @ $${DAILY_BUDGET}/day`}
          />
          <StatCard
            label={isCurrentCycle ? "Spent to Date" : "Total Spent"}
            value={formatCurrency(stats.spentToDate)}
          />
          <StatCard
            label={isCurrentCycle ? "Balance" : "Final Balance"}
            value={(stats.balance >= 0 ? '+' : '') + formatCurrency(stats.balance)}
            color={stats.onTrack ? 'var(--welcoming-green)' : 'var(--accent)'}
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
              subtext={`vs $${DAILY_BUDGET}/day budget`}
            />
          )}
        </div>
      )}

      {/* Chart container */}
      <div style={{
        background: 'var(--welcoming-cream)',
        borderRadius: '12px',
        padding: '24px',
        height: '400px',
      }}>
        {renderChart()}
      </div>

      {/* Selected day transactions */}
      {selectedDate && (
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
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
                background: 'var(--welcoming-cream)',
                border: 'none',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                cursor: 'pointer',
                fontSize: '14px',
                color: 'var(--text-light)',
              }}
            >
              ×
            </button>
          </div>

          {loadingTransactions ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-light)' }}>
              Loading transactions...
            </div>
          ) : selectedTransactions.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-light)' }}>
              No spending on this day
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedTransactions.map((tx, idx) => (
                <div
                  key={tx.id || idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    background: 'var(--welcoming-cream)',
                    borderRadius: '8px',
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
                    color: tx.amount > DAILY_BUDGET_PER_PERSON
                      ? 'var(--accent)'
                      : 'var(--text)',
                  }}>
                    {formatCurrency(tx.amount)}
                  </span>
                </div>
              ))}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderTop: '1px solid var(--welcoming-cream)',
                marginTop: '4px',
              }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-light)' }}>
                  Total ({selectedTransactions.length} transactions)
                </span>
                <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)' }}>
                  {formatCurrency(selectedTransactions.reduce((sum, tx) => sum + tx.amount, 0))}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Legend/explanation for variance view */}
      {viewMode === 'variance' && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '24px',
          fontSize: '12px',
          color: 'var(--text-light)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '2px',
              background: 'rgba(148, 180, 159, 0.8)',
            }} />
            <span>Under budget (saved)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '2px',
              background: 'rgba(231, 111, 81, 0.8)',
            }} />
            <span>Over budget</span>
          </div>
        </div>
      )}

      {/* Budget info footer */}
      <div style={{
        fontSize: '12px',
        color: 'var(--text-light)',
        textAlign: 'center',
        padding: '4px',
      }}>
        Shared budget: ${DAILY_BUDGET}/day (${MONTHLY_BUDGET.toLocaleString()}/month = ${DAILY_BUDGET_PER_PERSON}/day each)
      </div>
    </div>
  );
};

export default DailySpendingChart;
