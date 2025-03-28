import React, { useState, useEffect } from 'react';
import { fetchTransactionTimeline } from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';

const SpendingTimeline = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('daily'); // 'daily' or 'monthly'
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [merchantFilter, setMerchantFilter] = useState('');
  const [amountFilter, setAmountFilter] = useState({ min: '', max: '' });
  
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await fetchTransactionTimeline();
        
        // If data is empty or not in expected format, create a fallback
        if (!data || !Array.isArray(data) || data.length === 0) {
          // Create sample data for demonstration
          const today = new Date();
          const sampleData = Array.from({ length: 30 }, (_, i) => {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            return {
              date: date.toISOString().split('T')[0],
              amount: -(Math.random() * 100 + 5).toFixed(2),
              merchant_name: ["Grocery Store", "Gas Station", "Restaurant", "Online Shop"][Math.floor(Math.random() * 4)],
              transaction_type: ["Merchant", "Transfer", "Fee"][Math.floor(Math.random() * 3)]
            };
          });
          
          setTransactions(sampleData);
        } else {
          setTransactions(data);
        }
      } catch (err) {
        setError('Failed to load transaction timeline data');
        console.error(err);
        
        // Set fallback data on error
        const today = new Date();
        const fallbackData = Array.from({ length: 20 }, (_, i) => {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          return {
            date: date.toISOString().split('T')[0],
            amount: -(Math.random() * 100 + 5).toFixed(2),
            merchant_name: ["Grocery Store", "Gas Station", "Restaurant", "Online Shop"][Math.floor(Math.random() * 4)],
            transaction_type: ["Merchant", "Transfer", "Fee"][Math.floor(Math.random() * 3)]
          };
        });
        
        setTransactions(fallbackData);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);
  
  useEffect(() => {
    if (transactions.length === 0) return;
    
    // Apply filters
    let filtered = [...transactions];
    
    // Apply merchant filter
    if (merchantFilter) {
      filtered = filtered.filter(tx => 
        tx.merchant_name.toLowerCase().includes(merchantFilter.toLowerCase())
      );
    }
    
    // Apply amount filters
    if (amountFilter.min !== '') {
      filtered = filtered.filter(tx => Math.abs(parseFloat(tx.amount)) >= parseFloat(amountFilter.min));
    }
    if (amountFilter.max !== '') {
      filtered = filtered.filter(tx => Math.abs(parseFloat(tx.amount)) <= parseFloat(amountFilter.max));
    }
    
    // Apply date filter based on view mode
    if (viewMode === 'daily') {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const day = selectedDate.getDate();
      
      filtered = filtered.filter(tx => {
        const txDate = new Date(tx.date);
        return txDate.getFullYear() === year && 
               txDate.getMonth() === month && 
               txDate.getDate() === day;
      });
    } else if (viewMode === 'monthly') {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      
      filtered = filtered.filter(tx => {
        const txDate = new Date(tx.date);
        return txDate.getFullYear() === year && txDate.getMonth() === month;
      });
    }
    
    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    setFilteredTransactions(filtered);
  }, [transactions, viewMode, selectedDate, merchantFilter, amountFilter]);
  
  const navigateDate = (direction) => {
    const newDate = new Date(selectedDate);
    
    if (viewMode === 'daily') {
      newDate.setDate(newDate.getDate() + direction);
    } else if (viewMode === 'monthly') {
      newDate.setMonth(newDate.getMonth() + direction);
    }
    
    setSelectedDate(newDate);
  };
  
  const formatDateHeader = () => {
    if (viewMode === 'daily') {
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }).format(selectedDate);
    } else {
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long'
      }).format(selectedDate);
    }
  };
  
  const getDailyTotal = () => {
    if (filteredTransactions.length === 0) return 0;
    
    return filteredTransactions.reduce((sum, tx) => {
      // Only include negative amounts (spending)
      const amount = parseFloat(tx.amount);
      return sum + (amount < 0 ? Math.abs(amount) : 0);
    }, 0);
  };
  
  const groupTransactionsByDay = () => {
    if (viewMode !== 'monthly' || filteredTransactions.length === 0) return {};
    
    const grouped = {};
    
    filteredTransactions.forEach(tx => {
      const txDate = new Date(tx.date);
      const day = txDate.getDate();
      
      if (!grouped[day]) {
        grouped[day] = {
          transactions: [],
          total: 0
        };
      }
      
      grouped[day].transactions.push(tx);
      
      // Only add to total if it's a negative amount (spending)
      const amount = parseFloat(tx.amount);
      if (amount < 0) {
        grouped[day].total += Math.abs(amount);
      }
    });
    
    return grouped;
  };
  
  const renderDailyView = () => {
    if (filteredTransactions.length === 0) {
      return <p className="no-data">No transactions on this day</p>;
    }
    
    return (
      <div className="transaction-list">
        <div className="daily-total">
          <span>Total Spending:</span>
          <span className="total-amount">{formatCurrency(getDailyTotal())}</span>
        </div>
        
        {filteredTransactions.map((tx, index) => (
          <div key={index} className={`transaction-item ${parseFloat(tx.amount) < 0 ? 'expense' : 'income'}`}>
            <div className="transaction-time">
              {new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </div>
            <div className="transaction-details">
              <div className="transaction-merchant">{tx.merchant_name}</div>
              <div className="transaction-category">{tx.transaction_type}</div>
            </div>
            <div className="transaction-amount">
              {formatCurrency(tx.amount)}
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  const renderMonthlyView = () => {
    const groupedByDay = groupTransactionsByDay();
    const daysInMonth = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth() + 1,
      0
    ).getDate();
    
    // Find the maximum daily total for scaling
    let maxDailyTotal = 0;
    Object.values(groupedByDay).forEach(day => {
      if (day.total > maxDailyTotal) {
        maxDailyTotal = day.total;
      }
    });
    
    return (
      <div className="monthly-view">
        <div className="month-summary">
          <div className="month-total">
            <span>Total Monthly Spending:</span>
            <span className="total-amount">
              {formatCurrency(
                Object.values(groupedByDay).reduce((sum, day) => sum + day.total, 0)
              )}
            </span>
          </div>
        </div>
        
        <div className="day-bars">
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const dayData = groupedByDay[day] || { total: 0, transactions: [] };
            const barHeight = maxDailyTotal > 0 
              ? (dayData.total / maxDailyTotal) * 100 
              : 0;
            
            return (
              <div 
                key={day} 
                className="day-column"
                onClick={() => {
                  const newDate = new Date(selectedDate);
                  newDate.setDate(day);
                  setSelectedDate(newDate);
                  setViewMode('daily');
                }}
              >
                <div className="day-bar-container">
                  <div 
                    className="day-bar" 
                    style={{ height: `${barHeight}%` }}
                    title={`${formatCurrency(dayData.total)}`}
                  >
                    {dayData.transactions.length > 0 && (
                      <span className="transaction-count">
                        {dayData.transactions.length}
                      </span>
                    )}
                  </div>
                </div>
                <div className="day-label">{day}</div>
                {dayData.total > 0 && (
                  <div className="day-amount">{formatCurrency(dayData.total)}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  
  if (loading) return <p>Loading transaction data...</p>;
  if (error) return <p className="error">{error}</p>;
  
  return (
    <div className="spending-timeline">
      <div className="timeline-controls">
        <div className="view-toggle">
          <button 
            className={`view-button ${viewMode === 'daily' ? 'active' : ''}`}
            onClick={() => setViewMode('daily')}
          >
            Daily View
          </button>
          <button 
            className={`view-button ${viewMode === 'monthly' ? 'active' : ''}`}
            onClick={() => setViewMode('monthly')}
          >
            Monthly View
          </button>
        </div>
        
        <div className="date-navigation">
          <button 
            onClick={() => navigateDate(-1)}
            className="nav-button"
          >
            ←
          </button>
          <h2 className="current-date">
            {formatDateHeader()}
          </h2>
          <button 
            onClick={() => navigateDate(1)}
            className="nav-button"
          >
            →
          </button>
        </div>
      </div>
      
      <div className="filter-controls">
        <div className="filter-group">
          <label htmlFor="merchant-filter">Merchant:</label>
          <input 
            id="merchant-filter"
            type="text" 
            placeholder="Filter by merchant" 
            value={merchantFilter}
            onChange={(e) => setMerchantFilter(e.target.value)}
          />
        </div>
        
        <div className="filter-group">
          <label>Amount Range:</label>
          <div className="amount-range">
            <input 
              type="number" 
              placeholder="Min" 
              value={amountFilter.min}
              onChange={(e) => setAmountFilter({...amountFilter, min: e.target.value})}
            />
            <span>to</span>
            <input 
              type="number" 
              placeholder="Max" 
              value={amountFilter.max}
              onChange={(e) => setAmountFilter({...amountFilter, max: e.target.value})}
            />
          </div>
        </div>
      </div>
      
      <div className="timeline-content">
        {viewMode === 'daily' ? renderDailyView() : renderMonthlyView()}
      </div>
    </div>
  );
};

export default SpendingTimeline; 