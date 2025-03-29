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
      
      // Set the current year for the monthly view
      setCurrentYear(year);
    } else if (viewMode === 'monthly') {
      // Drill down from month to days - show all days in the selected month
      newViewMode = 'daily';
      const [year, month] = period.split('-');
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0); // Last day of the month
      newStartDate = startDate.toISOString().split('T')[0];
      newEndDate = endDate.toISOString().split('T')[0];
      
      // Set the current year and month for the daily view
      setCurrentYear(parseInt(year));
      setCurrentMonth(parseInt(month));
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
    // Create a combined categories object that includes uncategorized transactions
    const combinedCategories = { ...categories };
    
    // If there are no categories at all, still show the no data message
    if (!categories || (Object.keys(categories).length === 0 && !combinedCategories['Uncategorized'])) {
      return <div className="no-data">No category data</div>;
    }

    // Calculate the total amount for proper proportions
    const totalAmount = Object.values(combinedCategories).reduce((sum, cat) => sum + cat.total, 0);
    
    // Sort categories by amount (descending) for consistent display
    const sortedCategories = Object.entries(combinedCategories).sort((a, b) => b[1].total - a[1].total);
    
    return (
      <div className="category-bars">
        {sortedCategories.map(([name, data]) => {
          // Calculate percentage width
          const percentWidth = totalAmount > 0 ? (data.total / totalAmount) * 100 : 0;
          
          return (
            <div key={name} className="category-bar-container">
              <div className="category-bar-label">
                <span className="category-icon" style={{ backgroundColor: data.color || '#CCCCCC' }}>
                  {data.icon || '📊'}
                </span>
                <span>{name}</span>
                <span className="category-amount">{formatCurrency(data.total)}</span>
              </div>
              <div className="category-bar-wrapper">
                <div 
                  className="category-bar" 
                  style={{ 
                    width: `${percentWidth}%`,
                    backgroundColor: data.color || '#CCCCCC'
                  }}
                />
                {data.average && (
                  <div 
                    className="average-indicator" 
                    style={{ 
                      left: `${Math.min((data.average / totalAmount) * 100, 98)}%`,
                      backgroundColor: data.color || '#CCCCCC'
                    }}
                    title={`Average: ${formatCurrency(data.average)}`}
                  />
                )}
              </div>
            </div>
          );
        })}
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
      
      // Get all transactions from the new data structure
      const allTransactions = dayData.transactions || [];
      
      // Filter to only include spending (negative amounts)
      const spendingTransactions = allTransactions.filter(tx => parseFloat(tx.amount) < 0);
      
      console.log("Spending transactions:", spendingTransactions); // Debug log
      
      if (spendingTransactions.length === 0) {
        return (
          <div className="no-data-message">
            <p>No spending transactions available for {new Date(drillDownPeriod).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.</p>
            <p>The day has summary data but no individual spending transactions.</p>
          </div>
        );
      }
      
      // Sort transactions by time (if available) or just group by hour
      spendingTransactions.sort((a, b) => {
        const timeA = a.time ? new Date(`${drillDownPeriod}T${a.time}`) : new Date(drillDownPeriod);
        const timeB = b.time ? new Date(`${drillDownPeriod}T${b.time}`) : new Date(drillDownPeriod);
        return timeA - timeB;
      });
      
      // Group transactions by hour
      const transactionsByHour = {};
      spendingTransactions.forEach(tx => {
        // Default to midnight if no time is provided
        const hour = tx.time ? parseInt(tx.time.split(':')[0]) : 0;
        const hourKey = hour.toString();
        
        if (!transactionsByHour[hourKey]) {
          transactionsByHour[hourKey] = [];
        }
        transactionsByHour[hourKey].push(tx);
      });
      
      // Get all categories for color coding
      const allCategories = dayData.categories || {};
      
      // Fix the time formatting for hourly view
      const formatHourlyTime = (timeString) => {
        if (!timeString) return '';
        
        // Check if timeString is already a full ISO date string
        if (timeString.includes('T')) {
          return new Date(timeString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        // If it's just a time string (HH:MM:SS), create a valid date by combining with drillDownPeriod
        try {
          const fullDateTimeString = `${drillDownPeriod}T${timeString}`;
          return new Date(fullDateTimeString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
          console.error("Error formatting time:", e);
          return timeString; // Return the original string if parsing fails
        }
      }
      
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
                      // Find the category for this merchant
                      let categoryName = null;
                      let categoryData = null;
                      
                      // Look up the category in allCategories
                      for (const [name, data] of Object.entries(allCategories)) {
                        if (data.merchants && data.merchants.includes(tx.merchant_name)) {
                          categoryName = name;
                          categoryData = data;
                          break;
                        }
                      }
                      
                      const categoryColor = categoryData?.color || '#CCCCCC';
                      
                      return (
                        <div 
                          key={index} 
                          className="transaction-row"
                          style={{ borderLeft: `4px solid ${categoryColor}` }}
                        >
                          <div className="transaction-time">
                            {tx.time ? formatHourlyTime(tx.time) : ''}
                          </div>
                          <div className="transaction-merchant">
                            {tx.merchant_name || 'Unknown'}
                          </div>
                          <div className="transaction-description">
                            {tx.description || '-'}
                          </div>
                          <div className="transaction-category">
                            {categoryName ? (
                              <span className="category-tag" style={{
                                backgroundColor: categoryColor,
                                color: '#fff'
                              }}>
                                {categoryData?.icon || '📊'} {categoryName}
                              </span>
                            ) : (
                              <span className="uncategorized">Uncategorized</span>
                            )}
                          </div>
                          <div className="transaction-amount">
                            {formatCurrency(Math.abs(tx.amount))}
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

  // Fix the calculation functions inside the component
  const calculateCategoryAverage = (categoryName, viewMode, currentPeriod) => {
    // Skip calculation if we don't have enough data
    if (!timelineData || Object.keys(timelineData).length <= 1) {
      return null;
    }
    
    let totalSpend = 0;
    let periodCount = 0;
    
    // Collect data from all periods except the current one
    Object.entries(timelineData).forEach(([period, data]) => {
      // Skip the current period for the average calculation
      if (period !== currentPeriod && data.categories && data.categories[categoryName]) {
        // Only include negative amounts (spending)
        const amount = data.categories[categoryName].amount || 0;
        if (amount < 0) {
          totalSpend += Math.abs(amount);
          periodCount++;
        }
      }
    });
    
    // Return the average if we have data, otherwise null
    return periodCount > 0 ? totalSpend / periodCount : null;
  };
  
  const calculateUncategorizedAverage = (viewMode, currentPeriod) => {
    if (!timelineData || Object.keys(timelineData).length <= 1) {
      return null;
    }
    
    let totalUncategorized = 0;
    let periodCount = 0;
    
    Object.entries(timelineData).forEach(([period, data]) => {
      if (period !== currentPeriod) {
        // Only include negative amounts (spending)
        const totalAmount = data.total < 0 ? Math.abs(data.total || 0) : 0;
        
        // Calculate categorized total (only negative amounts)
        const categorizedTotal = Object.values(data.categories || {}).reduce(
          (sum, cat) => {
            const catAmount = cat.amount || 0;
            return sum + (catAmount < 0 ? Math.abs(catAmount) : 0);
          }, 0
        );
        
        const uncategorizedAmount = Math.max(0, totalAmount - categorizedTotal);
        if (uncategorizedAmount > 0) {
          totalUncategorized += uncategorizedAmount;
          periodCount++;
        }
      }
    });
    
    return periodCount > 0 ? totalUncategorized / periodCount : null;
  };

  if (loading) {
    return <div className="loading">Loading financial calendar...</div>;
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  const periods = Object.keys(timelineData).sort();
  const selectedData = selectedPeriod ? timelineData[selectedPeriod] : null;

  const calculateGlobalMaxAmount = () => {
    if (!periods.length) return 1;
    
    return Math.max(
      ...periods.flatMap(period => {
        const data = timelineData[period];
        const allCats = data.categories || {};
        
        // Get amounts from all categories
        const amounts = Object.values(allCats).map(cat => Math.abs(cat.amount || 0));
        
        // Calculate uncategorized amount
        const totalAmount = Math.abs(data.total || 0);
        const categorizedTotal = Object.values(allCats).reduce(
          (sum, cat) => sum + Math.abs(cat.amount || 0), 0
        );
        const uncategorizedAmount = Math.max(0, totalAmount - categorizedTotal);
        
        // Add uncategorized to our list of amounts
        if (uncategorizedAmount > 0) {
          amounts.push(uncategorizedAmount);
        }
        
        return amounts;
      }),
      1 // Ensure we don't divide by zero
    );
  };

  // Call this function once to get our global max
  const globalMaxAmount = calculateGlobalMaxAmount();

  return (
    <div className="financial-calendar">
      <div className="calendar-header">
        <h2>
          {drillDownPeriod ? (
            <>
              {previousViewMode === 'yearly' ? drillDownPeriod : formatPeriodLabel(drillDownPeriod)}
            </>
          ) : (
            'Calendar'
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
            {(() => {
              // Calculate global maximum amount once for consistent scaling
              const globalMaxAmount = Math.max(
                ...periods.flatMap(period => {
                  const data = timelineData[period];
                  const allCats = data.categories || {};
                  // Get amounts from all categories including uncategorized
                  const amounts = Object.values(allCats).map(cat => Math.abs(cat.amount || 0));
                  
                  // Calculate uncategorized amount
                  const totalAmount = Math.abs(data.total || 0);
                  const categorizedTotal = Object.values(allCats).reduce((sum, cat) => sum + Math.abs(cat.amount || 0), 0);
                  const uncategorizedAmount = Math.max(0, totalAmount - categorizedTotal);
                  
                  // Add uncategorized to our list of amounts
                  if (uncategorizedAmount > 0) {
                    amounts.push(uncategorizedAmount);
                  }
                  
                  return amounts;
                }),
                1 // Ensure we don't divide by zero
              );
              
              // Now we can map periods with our global max value
              return periods.map(period => {
                const data = timelineData[period];
                
                // Combine all transactions regardless of recurring status
                const allTransactions = [...(data.transactions || [])];
                
                // Filter to only include spending (negative amounts)
                const spendingTransactions = allTransactions.filter(tx => 
                  parseFloat(tx.amount) < 0
                );
                
                // Calculate total spending (negative amounts only)
                const totalSpending = Math.abs(spendingTransactions.reduce(
                  (sum, tx) => sum + parseFloat(tx.amount), 0
                ));
                
                // Process all categories together
                const allCategories = {};
                
                // First, add existing categories
                Object.entries(data.categories || {}).forEach(([name, categoryData]) => {
                  // Only include categories with negative amounts (spending)
                  const catAmount = categoryData.amount || 0;
                  if (catAmount < 0) {
                    if (!allCategories[name]) {
                      allCategories[name] = { 
                        ...categoryData, 
                        total: Math.abs(catAmount),
                        // Calculate average based on view mode
                        average: calculateCategoryAverage(name, viewMode, period)
                      };
                    }
                  }
                });
                
                // Calculate total amount in categorized spending transactions
                const categorizedTotal = Object.values(allCategories).reduce((sum, cat) => sum + cat.total, 0);
                
                // If there's a difference between total spending and categorized total, add an Uncategorized category
                const uncategorizedAmount = Math.max(0, totalSpending - categorizedTotal);
                if (uncategorizedAmount > 0) {
                  allCategories['Uncategorized'] = {
                    total: uncategorizedAmount,
                    count: spendingTransactions.length - Object.values(allCategories).reduce((sum, cat) => sum + (cat.count || 0), 0),
                    color: '#CCCCCC',
                    icon: '❓',
                    // Calculate average for uncategorized as well
                    average: calculateUncategorizedAverage(viewMode, period)
                  };
                }
                
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
                      {Object.entries(allCategories).length > 0 ? (
                        Object.entries(allCategories).map(([name, categoryData]) => {
                          // Use our global max for consistent scaling
                          const percentWidth = Math.min((categoryData.total / globalMaxAmount) * 100, 100);
                          
                          return (
                            <div key={name} className="bar-container-with-label">
                              <div className="bar-header">
                                <span className="bar-label" style={{ color: categoryData.color || '#CCCCCC' }}>
                                  {categoryData.icon || '📊'} {name}
                                </span>
                                <span className="bar-amount" style={{ color: categoryData.color || '#CCCCCC' }}>
                                  {formatCurrency(categoryData.total)}
                                </span>
                              </div>
                              <div className="bar-container">
                                <div 
                                  className="spending-bar" 
                                  style={{ 
                                    width: `${percentWidth}%`,
                                    backgroundColor: categoryData.color || '#CCCCCC'
                                  }} 
                                />
                                {categoryData.average && (
                                  <div 
                                    className="avg-indicator"
                                    style={{ 
                                      left: `${Math.min((categoryData.average / globalMaxAmount) * 100, 98)}%`,
                                      backgroundColor: categoryData.color || '#CCCCCC'
                                    }}
                                    title={`Average: ${formatCurrency(categoryData.average)}`}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })
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
              });
            })()}
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