import React, { useState, useEffect } from 'react';
import { fetchTransactionTimeline } from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';
import '../styles/FinancialCalendar.css';

const FinancialCalendar = () => {
  const [viewMode, setViewMode] = useState('monthly');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [timelineData, setTimelineData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [navigationHistory, setNavigationHistory] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);

  useEffect(() => {
    loadTimelineData();
  }, [viewMode, selectedDate]);

  const loadTimelineData = async () => {
    try {
      setLoading(true);
      // Calculate date range based on view mode
      const range = getDateRange();
      const data = await fetchTransactionTimeline({
        start_date: range.start,
        end_date: range.end,
        view_mode: viewMode
      });
      
      // If data is empty, show a message
      if (!data || Object.keys(data).length === 0) {
        setTimelineData({});
        setError('No transaction data found for the selected period');
      } else {
        setTimelineData(data);
        setError(null);
      }
    } catch (err) {
      setError('Failed to load timeline data');
      console.error(err);
      setTimelineData({});
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = () => {
    const start = new Date(selectedDate);
    const end = new Date(selectedDate);
    
    switch (viewMode) {
      case 'yearly':
        // Show multiple years (5-year range)
        start.setFullYear(start.getFullYear() - 2);
        start.setMonth(0, 1);
        end.setFullYear(end.getFullYear() + 2);
        end.setMonth(11, 31);
        break;
      case 'monthly':
        // If we're in monthly view, show the entire year
        start.setMonth(0, 1);
        end.setMonth(11, 31);
        break;
      case 'daily':
        // If we're in daily view, show the entire month
        start.setDate(1);
        end.setMonth(end.getMonth() + 1, 0);
        break;
      case 'hourly':
        // If we're in hourly view, show the entire day
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
    }
    
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  };

  const navigateTime = (direction) => {
    const newDate = new Date(selectedDate);
    switch (viewMode) {
      case 'yearly':
        newDate.setFullYear(newDate.getFullYear() + direction * 5);
        break;
      case 'monthly':
        newDate.setFullYear(newDate.getFullYear() + direction);
        break;
      case 'daily':
        newDate.setMonth(newDate.getMonth() + direction);
        break;
      case 'hourly':
        newDate.setDate(newDate.getDate() + direction);
        break;
    }
    setSelectedDate(newDate);
    setSelectedPeriod(null); // Clear selected period when navigating
  };

  const navigateToToday = () => {
    setSelectedDate(new Date());
    setSelectedPeriod(null);
  };

  const renderTimeBlock = (period, data) => {
    const totalSpending = data.recurring.total + data['one-time'].total;
    
    // Find the maximum spending across all periods for scaling
    const maxSpending = Object.values(timelineData).reduce((max, periodData) => {
      const periodTotal = periodData.recurring.total + periodData['one-time'].total;
      return periodTotal > max ? periodTotal : max;
    }, 0);
    
    // Calculate the height of the bar as a percentage of the maximum spending
    const barHeight = maxSpending > 0 ? (totalSpending / maxSpending) * 100 : 0;
    
    // Calculate proportions for recurring and one-time spending
    const recurringHeight = totalSpending > 0 ? (data.recurring.total / totalSpending) * barHeight : 0;
    const oneTimeHeight = totalSpending > 0 ? (data['one-time'].total / totalSpending) * barHeight : 0;
    
    // Check if this period is the currently selected one
    const isSelected = period === selectedPeriod;
    
    // Check if this period is today
    const isToday = isCurrentPeriod(period);
    
    return (
      <div 
        key={period}
        className={`time-block ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
        onClick={() => handleTimeBlockClick(period)}
      >
        <div className="time-block-header">
          <span className="period-label">{formatPeriodLabel(period)}</span>
          <span className="total-amount">{formatCurrency(totalSpending)}</span>
        </div>
        
        <div className="spending-bar-container">
          <div 
            className="spending-bar"
            style={{ height: `${barHeight}%` }}
            title={`Total: ${formatCurrency(totalSpending)}`}
          >
            <div 
              className="recurring-portion"
              style={{ height: `${recurringHeight / barHeight * 100}%` }}
              title={`Recurring: ${formatCurrency(data.recurring.total)}`}
            />
            <div 
              className="one-time-portion"
              style={{ height: `${oneTimeHeight / barHeight * 100}%` }}
              title={`One-time: ${formatCurrency(data['one-time'].total)}`}
            />
          </div>
        </div>
        
        <div className="merchant-tags">
          {[...data.recurring.transactions, ...data['one-time'].transactions]
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 3)
            .map((tx, i) => (
              <span 
                key={`${period}-merchant-${i}`}
                className={`merchant-tag ${tx.type.toLowerCase()}`}
                title={`${tx.merchant}: ${formatCurrency(tx.amount)}`}
              >
                {tx.merchant ? tx.merchant.split(' ')[0] : 'Unknown'}
              </span>
            ))}
        </div>
      </div>
    );
  };

  const isCurrentPeriod = (period) => {
    const today = new Date();
    
    switch (viewMode) {
      case 'yearly':
        return period === today.getFullYear().toString();
      case 'monthly':
        const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        return period === yearMonth;
      case 'daily':
        const yearMonthDay = today.toISOString().split('T')[0];
        return period === yearMonthDay;
      case 'hourly':
        // For hourly, we'd need to check the hour, but our data doesn't have that granularity
        return false;
      default:
        return false;
    }
  };

  const formatPeriodLabel = (period) => {
    switch (viewMode) {
      case 'yearly':
        return period;
      case 'monthly': {
        const date = new Date(period + '-01');
        return date.toLocaleDateString('en-US', { month: 'short' });
      }
      case 'daily': {
        const date = new Date(period);
        return date.getDate().toString();
      }
      case 'hourly':
        return new Date(period).toLocaleTimeString('en-US', { hour: 'numeric' });
      default:
        return period;
    }
  };

  const handleTimeBlockClick = (period) => {
    // If already selected, drill down
    if (period === selectedPeriod) {
      drillDown(period);
    } else {
      // Otherwise, just select it
      setSelectedPeriod(period);
    }
  };

  const drillDown = (period) => {
    // Determine the next view mode based on current view mode
    const nextMode = {
      'yearly': 'monthly',
      'monthly': 'daily',
      'daily': 'hourly'
    }[viewMode];
    
    if (!nextMode) return; // If we're already at the most detailed level
    
    // Save current state to navigation history
    setNavigationHistory([
      ...navigationHistory,
      { viewMode, selectedDate, period, selectedPeriod }
    ]);
    
    // Update the view mode
    setViewMode(nextMode);
    
    // Set the selected date based on the period
    let newDate;
    switch (viewMode) {
      case 'yearly':
        // If clicking on a year, set date to January 1st of that year
        newDate = new Date(`${period}-01-01`);
        break;
      case 'monthly':
        // If clicking on a month, set date to the 1st of that month
        newDate = new Date(`${period}-01`);
        break;
      case 'daily':
        // If clicking on a day, set date to that day
        newDate = new Date(period);
        break;
    }
    
    setSelectedDate(newDate);
    setSelectedPeriod(null); // Clear selection in the new view
  };

  const handleNavigateBack = () => {
    if (navigationHistory.length === 0) return;
    
    // Get the last navigation state
    const lastNavigation = navigationHistory[navigationHistory.length - 1];
    
    // Restore the previous state
    setViewMode(lastNavigation.viewMode);
    setSelectedDate(new Date(lastNavigation.selectedDate));
    setSelectedPeriod(lastNavigation.selectedPeriod);
    
    // Remove the last entry from navigation history
    setNavigationHistory(navigationHistory.slice(0, -1));
  };

  const getViewTitle = () => {
    switch (viewMode) {
      case 'yearly':
        const startYear = selectedDate.getFullYear() - 2;
        const endYear = selectedDate.getFullYear() + 2;
        return `${startYear} - ${endYear}`;
      case 'monthly':
        return selectedDate.getFullYear().toString();
      case 'daily':
        return new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      case 'hourly':
        return new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      default:
        return formatDate(selectedDate, viewMode);
    }
  };

  const renderDetailPanel = () => {
    if (!selectedPeriod || !timelineData[selectedPeriod]) return null;
    
    const data = timelineData[selectedPeriod];
    const totalSpending = data.recurring.total + data['one-time'].total;
    
    return (
      <div className="detail-panel">
        <div className="detail-header">
          <h3>{formatDetailTitle(selectedPeriod)}</h3>
          <div className="detail-actions">
            <button 
              className="drill-down-button" 
              onClick={() => drillDown(selectedPeriod)}
              disabled={viewMode === 'hourly'}
            >
              Zoom In
            </button>
            <button className="close-button" onClick={() => setSelectedPeriod(null)}>×</button>
          </div>
        </div>
        
        <div className="detail-summary">
          <div className="total-spending">
            <span className="label">Total Spending</span>
            <span className="value">{formatCurrency(totalSpending)}</span>
          </div>
          
          <div className="spending-breakdown">
            <div className="recurring-spending">
              <span className="label">Recurring</span>
              <span className="value">{formatCurrency(data.recurring.total)}</span>
              <span className="percentage">
                {totalSpending > 0 ? `(${Math.round((data.recurring.total / totalSpending) * 100)}%)` : '(0%)'}
              </span>
            </div>
            
            <div className="onetime-spending">
              <span className="label">One-time</span>
              <span className="value">{formatCurrency(data['one-time'].total)}</span>
              <span className="percentage">
                {totalSpending > 0 ? `(${Math.round((data['one-time'].total / totalSpending) * 100)}%)` : '(0%)'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="transactions-container">
          <div className="transactions-section">
            <h4>Recurring Transactions</h4>
            {data.recurring.transactions.length > 0 ? (
              <div className="transaction-list">
                {data.recurring.transactions.map((tx, i) => (
                  <div key={i} className="transaction-item">
                    <span className="merchant">{tx.merchant || 'Unknown'}</span>
                    <span className="amount">{formatCurrency(tx.amount)}</span>
                    {tx.count && <span className="frequency">({tx.count}x)</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-data">No recurring transactions</div>
            )}
          </div>
          
          <div className="transactions-section">
            <h4>One-time Transactions</h4>
            {data['one-time'].transactions.length > 0 ? (
              <div className="transaction-list">
                {data['one-time'].transactions.map((tx, i) => (
                  <div key={i} className="transaction-item">
                    <span className="merchant">{tx.merchant || 'Unknown'}</span>
                    <span className="amount">{formatCurrency(tx.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-data">No one-time transactions</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const formatDetailTitle = (period) => {
    switch (viewMode) {
      case 'yearly':
        return `Year ${period}`;
      case 'monthly': {
        const date = new Date(period + '-01');
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      }
      case 'daily': {
        const date = new Date(period);
        return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      }
      case 'hourly': {
        const date = new Date(period);
        return date.toLocaleString('en-US', { 
          weekday: 'long', 
          month: 'long', 
          day: 'numeric', 
          year: 'numeric',
          hour: 'numeric',
          minute: 'numeric'
        });
      }
      default:
        return period;
    }
  };

  const renderCalendarHeader = () => {
    // Generate day names for daily view
    if (viewMode === 'daily') {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return (
        <div className="calendar-header-row">
          {dayNames.map(day => (
            <div key={day} className="header-cell">{day}</div>
          ))}
        </div>
      );
    }
    
    return null;
  };

  const getGridTemplateColumns = () => {
    switch (viewMode) {
      case 'yearly':
        return 'repeat(auto-fill, minmax(150px, 1fr))';
      case 'monthly':
        return 'repeat(4, 1fr)';
      case 'daily':
        return 'repeat(7, 1fr)';
      case 'hourly':
        return 'repeat(auto-fill, minmax(120px, 1fr))';
      default:
        return 'repeat(auto-fill, minmax(150px, 1fr))';
    }
  };

  if (loading) return <div className="loading">Loading financial data...</div>;

  return (
    <div className="financial-calendar">
      <div className="calendar-toolbar">
        <div className="toolbar-left">
          <button 
            className="today-button"
            onClick={navigateToToday}
          >
            Today
          </button>
          
          <div className="navigation-buttons">
            <button 
              className="nav-button"
              onClick={() => navigateTime(-1)} 
              title="Previous period"
            >
              ←
            </button>
            <button 
              className="nav-button"
              onClick={() => navigateTime(1)} 
              title="Next period"
            >
              →
            </button>
          </div>
          
          <h2 className="period-title">{getViewTitle()}</h2>
        </div>
        
        <div className="toolbar-right">
          {navigationHistory.length > 0 && (
            <button 
              className="back-button" 
              onClick={handleNavigateBack}
              title="Go back to previous view"
            >
              ↩ Back
            </button>
          )}
          
          <div className="view-selector">
            <button 
              className={viewMode === 'yearly' ? 'active' : ''}
              onClick={() => {
                setNavigationHistory([]);
                setViewMode('yearly');
                setSelectedDate(new Date());
                setSelectedPeriod(null);
              }}
            >
              Year
            </button>
            <button 
              className={viewMode === 'monthly' ? 'active' : ''}
              onClick={() => {
                setNavigationHistory([]);
                setViewMode('monthly');
                setSelectedDate(new Date());
                setSelectedPeriod(null);
              }}
            >
              Month
            </button>
            <button 
              className={viewMode === 'daily' ? 'active' : ''}
              onClick={() => {
                setNavigationHistory([]);
                setViewMode('daily');
                setSelectedDate(new Date());
                setSelectedPeriod(null);
              }}
            >
              Day
            </button>
            <button 
              className={viewMode === 'hourly' ? 'active' : ''}
              onClick={() => {
                setNavigationHistory([]);
                setViewMode('hourly');
                setSelectedDate(new Date());
                setSelectedPeriod(null);
              }}
            >
              Hour
            </button>
          </div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="calendar-container">
        {renderCalendarHeader()}
        
        <div 
          className="calendar-grid"
          style={{ gridTemplateColumns: getGridTemplateColumns() }}
        >
          {Object.entries(timelineData).map(([period, data]) => (
            renderTimeBlock(period, data)
          ))}
          
          {Object.keys(timelineData).length === 0 && !loading && (
            <div className="no-data-message">No transaction data available for this period</div>
          )}
        </div>
        
        {selectedPeriod && renderDetailPanel()}
      </div>
    </div>
  );
};

export default FinancialCalendar; 