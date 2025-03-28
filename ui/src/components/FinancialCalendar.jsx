import React, { useState, useEffect } from 'react';
import { fetchTransactionTimelineWithCategories } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import '../styles/FinancialCalendar.css';

const FinancialCalendar = () => {
  const [timelineData, setTimelineData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [viewMode, setViewMode] = useState('monthly');
  const [previousViewMode, setPreviousViewMode] = useState(null);
  const [drillDownPeriod, setDrillDownPeriod] = useState(null);
  const [dateRange, setDateRange] = useState({
    start_date: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  });
  const [displayDateRange, setDisplayDateRange] = useState(dateRange);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1); // 1-12 format

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Adjust date range based on view mode
        let startDate = dateRange.start_date;
        let endDate = dateRange.end_date;
        
        if (viewMode === 'yearly') {
          // For yearly view, show all years (5 years back)
          const thisYear = new Date().getFullYear();
          startDate = `${thisYear - 5}-01-01`;
          endDate = `${thisYear}-12-31`;
        } else if (viewMode === 'monthly') {
          // For monthly view, show the selected year
          startDate = `${currentYear}-01-01`;
          endDate = `${currentYear}-12-31`;
        } else if (viewMode === 'daily') {
          // For daily view, show the selected month
          const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
          startDate = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
          endDate = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${daysInMonth}`;
        }
        
        // Update the display date range
        setDisplayDateRange({
          start_date: startDate,
          end_date: endDate
        });
        
        const data = await fetchTransactionTimelineWithCategories(
          startDate,
          endDate,
          viewMode
        );
        setTimelineData(data);
        
        // Select the most recent period by default
        if (Object.keys(data).length > 0 && !selectedPeriod) {
          const periods = Object.keys(data).sort();
          setSelectedPeriod(periods[periods.length - 1]);
        }
      } catch (err) {
        setError('Failed to load timeline data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [dateRange, viewMode, drillDownPeriod, currentYear, currentMonth]);

  const handlePeriodSelect = (period) => {
    setSelectedPeriod(period);
  };

  const handleViewModeChange = (mode) => {
    // If we're changing view mode manually, reset drill-down state
    setDrillDownPeriod(null);
    setPreviousViewMode(null);
    setViewMode(mode);
    
    // Reset to current year/month when changing view modes
    if (mode === 'monthly') {
      setCurrentYear(new Date().getFullYear());
    } else if (mode === 'daily') {
      setCurrentYear(new Date().getFullYear());
      setCurrentMonth(new Date().getMonth() + 1);
    }
    
    setSelectedPeriod(null);
  };

  const handleDrillDown = (period) => {
    // Store current view mode and selected period for going back
    setPreviousViewMode(viewMode);
    setDrillDownPeriod(period);
    
    // Determine new view mode and date range
    let newViewMode;
    let newStartDate;
    let newEndDate;
    
    if (viewMode === 'yearly') {
      // Drill down from year to months - show all months in the selected year
      newViewMode = 'monthly';
      const year = parseInt(period);
      newStartDate = `${year}-01-01`;
      newEndDate = `${year}-12-31`;
    } else if (viewMode === 'monthly') {
      // Drill down from month to days - show all days in the selected month
      newViewMode = 'daily';
      const [year, month] = period.split('-');
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0); // Last day of the month
      newStartDate = startDate.toISOString().split('T')[0];
      newEndDate = endDate.toISOString().split('T')[0];
    } else if (viewMode === 'daily') {
      // Drill down from day to hours - show all transactions for the selected day
      newViewMode = 'hourly';
      newStartDate = period;
      newEndDate = period;
    } else {
      // Already at hourly view, no further drill-down
      return;
    }
    
    // Update state
    setViewMode(newViewMode);
    setDateRange({
      start_date: newStartDate,
      end_date: newEndDate
    });
    setSelectedPeriod(null); // Reset selected period
  };

  const handleDrillUp = () => {
    if (previousViewMode) {
      setViewMode(previousViewMode);
      setSelectedPeriod(drillDownPeriod);
      setPreviousViewMode(null);
      setDrillDownPeriod(null);
      
      // Reset date range based on previous view mode
      if (previousViewMode === 'yearly') {
        // When going back to yearly view, show last 5 years
        const currentYear = new Date().getFullYear();
        setDateRange({
          start_date: `${currentYear - 5}-01-01`,
          end_date: `${currentYear}-12-31`
        });
      } else if (previousViewMode === 'monthly') {
        // When going back to monthly view, show current year
        const currentYear = new Date().getFullYear();
        setDateRange({
          start_date: `${currentYear}-01-01`,
          end_date: `${currentYear}-12-31`
        });
      }
    }
  };

  const formatPeriodLabel = (period) => {
    if (viewMode === 'yearly') {
      return period;
    } else if (viewMode === 'monthly') {
      const [year, month] = period.split('-');
      const date = new Date(year, month - 1);
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } else if (viewMode === 'daily') {
      const date = new Date(period);
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }
    return period;
  };

  const renderCategoryBars = (categories) => {
    if (!categories || Object.keys(categories).length === 0) {
      return <div className="no-data">No category data</div>;
    }

    const totalAmount = Object.values(categories).reduce((sum, cat) => sum + cat.total, 0);
    
    return (
      <div className="category-bars">
        {Object.entries(categories).map(([name, data]) => (
          <div key={name} className="category-bar-container">
            <div className="category-bar-label">
              <span className="category-icon" style={{ backgroundColor: data.color }}>
                {data.icon || '📊'}
              </span>
              <span>{name}</span>
              <span className="category-amount">{formatCurrency(data.total)}</span>
            </div>
            <div className="category-bar-wrapper">
              <div 
                className="category-bar" 
                style={{ 
                  width: `${(data.total / totalAmount) * 100}%`,
                  backgroundColor: data.color || '#7D6B91'
                }}
              />
            </div>
          </div>
        ))}
      </div>
    );
  };

  const navigatePrevious = () => {
    if (viewMode === 'yearly') {
      // No navigation for yearly view as it shows all years
      return;
    } else if (viewMode === 'monthly') {
      // Navigate to previous year
      setCurrentYear(prev => prev - 1);
    } else if (viewMode === 'daily') {
      // Navigate to previous month
      if (currentMonth === 1) {
        setCurrentMonth(12);
        setCurrentYear(prev => prev - 1);
      } else {
        setCurrentMonth(prev => prev - 1);
      }
    }
    setSelectedPeriod(null);
  };

  const navigateNext = () => {
    if (viewMode === 'yearly') {
      // No navigation for yearly view as it shows all years
      return;
    } else if (viewMode === 'monthly') {
      // Navigate to next year
      setCurrentYear(prev => prev + 1);
    } else if (viewMode === 'daily') {
      // Navigate to next month
      if (currentMonth === 12) {
        setCurrentMonth(1);
        setCurrentYear(prev => prev + 1);
      } else {
        setCurrentMonth(prev => prev + 1);
      }
    }
    setSelectedPeriod(null);
  };

  const renderHourlyView = () => {
    if (drillDownPeriod) {
      // Get the data for the selected day
      const dayData = timelineData[drillDownPeriod];
      
      if (!dayData) {
        return (
          <div className="no-data-message">
            <p>No transaction data available for {new Date(drillDownPeriod).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.</p>
            <p>Try selecting a different day or check that transactions exist in your database for this date.</p>
          </div>
        );
      }
      
      console.log("Day data for hourly view:", dayData); // Debug log
      
      // Combine recurring and one-time transactions without distinguishing them
      const allTransactions = [];
      
      // Add all transactions without marking them as recurring or one-time
      if (dayData.recurring && dayData.recurring.transactions) {
        allTransactions.push(...dayData.recurring.transactions);
      }
      
      if (dayData['one-time'] && dayData['one-time'].transactions) {
        allTransactions.push(...dayData['one-time'].transactions);
      }
      
      console.log("All transactions:", allTransactions); // Debug log
      
      if (allTransactions.length === 0) {
        return (
          <div className="no-data-message">
            <p>No transaction details available for {new Date(drillDownPeriod).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.</p>
            <p>The day has summary data but no individual transactions.</p>
          </div>
        );
      }
      
      // Sort transactions by time (if available) or just group by hour
      allTransactions.sort((a, b) => {
        const timeA = a.time ? new Date(`${drillDownPeriod}T${a.time}`) : new Date(drillDownPeriod);
        const timeB = b.time ? new Date(`${drillDownPeriod}T${b.time}`) : new Date(drillDownPeriod);
        return timeA - timeB;
      });
      
      // Group transactions by hour
      const transactionsByHour = {};
      allTransactions.forEach(tx => {
        // Default to midnight if no time is provided
        const hour = tx.time ? parseInt(tx.time.split(':')[0]) : 0;
        const hourKey = hour.toString();
        
        if (!transactionsByHour[hourKey]) {
          transactionsByHour[hourKey] = [];
        }
        transactionsByHour[hourKey].push(tx);
      });
      
      // Get all categories for color coding
      const allCategories = {
        ...(dayData.recurring?.categories || {}),
        ...(dayData['one-time']?.categories || {})
      };
      
      return (
        <div className="hourly-view">
          <h3>Transactions for {new Date(drillDownPeriod).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</h3>
          
          {Object.keys(transactionsByHour).length > 0 ? (
            Object.entries(transactionsByHour)
              .sort(([hourA], [hourB]) => parseInt(hourA) - parseInt(hourB))
              .map(([hour, transactions]) => (
                <div key={hour} className="hour-group">
                  <div className="hour-header">
                    <span className="hour-label">
                      {hour.padStart(2, '0')}:00 - {hour.padStart(2, '0')}:59
                    </span>
                  </div>
                  
                  <div className="transactions-list">
                    {transactions.map((tx, index) => {
                      const categoryData = tx.category ? allCategories[tx.category] : null;
                      const categoryColor = categoryData?.color || '#CCCCCC';
                      
                      return (
                        <div 
                          key={index} 
                          className="transaction-row"
                          style={{ borderLeft: `4px solid ${categoryColor}` }}
                        >
                          <div className="transaction-time">
                            {tx.time || `${hour.padStart(2, '0')}:00`}
                          </div>
                          <div className="transaction-merchant">
                            {tx.merchant || 'Unknown'}
                          </div>
                          <div className="transaction-description">
                            {tx.description || tx.original_description || '-'}
                          </div>
                          <div className="transaction-category">
                            {tx.category ? (
                              <span className="category-tag" style={{
                                backgroundColor: categoryColor,
                                color: '#fff'
                              }}>
                                {categoryData?.icon || '📊'} {tx.category}
                              </span>
                            ) : (
                              <span className="uncategorized">Uncategorized</span>
                            )}
                          </div>
                          <div className="transaction-amount">
                            {formatCurrency(tx.amount)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
          ) : (
            <div className="no-data-message">
              <p>No transaction data available for this day.</p>
            </div>
          )}
        </div>
      );
    }
    
    return null;
  };

  if (loading) {
    return <div className="loading">Loading financial calendar...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  const periods = Object.keys(timelineData).sort();
  const selectedData = selectedPeriod ? timelineData[selectedPeriod] : null;

  return (
    <div className="financial-calendar">
      <div className="calendar-header">
        <h2>
          {drillDownPeriod ? (
            <>
              {previousViewMode === 'yearly' ? drillDownPeriod : formatPeriodLabel(drillDownPeriod)}
            </>
          ) : (
            'Financial Calendar'
          )}
        </h2>
        
        <div className="view-controls">
          {drillDownPeriod ? (
            <button className="back-button" onClick={handleDrillUp}>
              <span className="back-icon">←</span> Back to {
                previousViewMode === 'yearly' ? 'Years' : 
                previousViewMode === 'monthly' ? 'Months' : 
                'Days'
              }
            </button>
          ) : (
            <>
              <div className="zoom-controls">
                <button 
                  className={viewMode === 'yearly' ? 'active' : ''} 
                  onClick={() => handleViewModeChange('yearly')}
                >
                  Yearly
                </button>
                <button 
                  className={viewMode === 'monthly' ? 'active' : ''} 
                  onClick={() => handleViewModeChange('monthly')}
                >
                  Monthly
                </button>
                <button 
                  className={viewMode === 'daily' ? 'active' : ''} 
                  onClick={() => handleViewModeChange('daily')}
                >
                  Daily
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Period navigation */}
      {(viewMode === 'monthly' || viewMode === 'daily') && !drillDownPeriod && (
        <div className="period-navigation">
          <button className="nav-button" onClick={navigatePrevious}>
            <span className="nav-icon">←</span>
            {viewMode === 'monthly' ? 'Previous Year' : 'Previous Month'}
          </button>
          
          <div className="current-period">
            {viewMode === 'monthly' && (
              <h3>{currentYear}</h3>
            )}
            {viewMode === 'daily' && (
              <h3>{new Date(currentYear, currentMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h3>
            )}
          </div>
          
          <button className="nav-button" onClick={navigateNext}>
            {viewMode === 'monthly' ? 'Next Year' : 'Next Month'}
            <span className="nav-icon">→</span>
          </button>
        </div>
      )}
      
      <div className="date-range-info">
        {viewMode === 'yearly' && (
          <p>Showing data for years {new Date(displayDateRange.start_date).getFullYear()} to {new Date(displayDateRange.end_date).getFullYear()}</p>
        )}
        {viewMode === 'monthly' && (
          <p>Showing data for {new Date(displayDateRange.start_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} to {new Date(displayDateRange.end_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
        )}
        {viewMode === 'daily' && (
          <p>Showing data for {new Date(displayDateRange.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} to {new Date(displayDateRange.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        )}
        {viewMode === 'hourly' && (
          <p>Showing transactions for {new Date(displayDateRange.start_date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
        )}
      </div>
      
      {viewMode === 'hourly' ? (
        renderHourlyView()
      ) : (
        periods.length > 0 ? (
          <div className="calendar-grid">
            {periods.map(period => {
              const data = timelineData[period];
              
              // Combine categories from both recurring and one-time transactions
              const allCategories = {};
              
              // Process all categories together
              const processCategories = (categories, totals) => {
                Object.entries(categories).forEach(([name, categoryData]) => {
                  if (!allCategories[name]) {
                    allCategories[name] = { ...categoryData, total: 0 };
                  }
                  allCategories[name].total += categoryData.total;
                });
              };
              
              // Process recurring and one-time categories together
              processCategories(data.recurring.categories, data.recurring.total);
              processCategories(data['one-time'].categories, data['one-time'].total);
              
              // Calculate total spending (combined)
              const totalSpending = data.recurring.total + data['one-time'].total;
              
              // Get top categories (limit to 3 for display)
              const topCategories = Object.entries(allCategories)
                .sort((a, b) => b[1].total - a[1].total)
                .slice(0, 3);
              
              const isToday = viewMode === 'daily' && period === new Date().toISOString().split('T')[0];
              
              return (
                <div 
                  key={period} 
                  className={`time-block ${selectedPeriod === period ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                  onClick={() => handlePeriodSelect(period)}
                  onDoubleClick={() => handleDrillDown(period)}
                >
                  <div className="time-block-header">
                    <div className="period-label">{formatPeriodLabel(period)}</div>
                  </div>
                  
                  <div className="amount-display">
                    <div className="total-amount">{formatCurrency(totalSpending)}</div>
                  </div>
                  
                  <div className="spending-bars-container">
                    {topCategories.length > 0 ? (
                      topCategories.map(([name, categoryData], index) => (
                        <div key={name} className="bar-container-with-label">
                          <div className="bar-header">
                            <span className="bar-label" style={{ color: categoryData.color || '#7D6B91' }}>
                              {categoryData.icon || '📊'} {name}
                            </span>
                            <span className="bar-amount" style={{ color: categoryData.color || '#7D6B91' }}>
                              {formatCurrency(categoryData.total)}
                            </span>
                          </div>
                          <div className="bar-container">
                            <div 
                              className="spending-bar" 
                              style={{ 
                                width: `${(categoryData.total / totalSpending) * 100}%`,
                                backgroundColor: categoryData.color || '#7D6B91'
                              }} 
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="no-data">No category data</div>
                    )}
                  </div>
                  
                  {viewMode !== 'daily' && (
                    <div className="drill-down-hint">
                      Double-click to see details
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="no-data-message">
            <p>No financial data available for this time period.</p>
            <p>Try selecting a different view mode or check that transactions exist in your database for this period.</p>
          </div>
        )
      )}
    </div>
  );
};

export default FinancialCalendar; 