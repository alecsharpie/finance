import React, { useState, useEffect } from 'react';
import { fetchRawTransactions, fetchCategories, fetchMerchantCategories } from '../services/api';
import { formatCurrency, formatDate } from '../utils/formatters';

const RawTransactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, limit: 1000, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [merchantCategories, setMerchantCategories] = useState({});
  
  // New state for filters and sorting
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: '',
    type: '',
    source: '',
    category: ''
  });
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [showFilters, setShowFilters] = useState(false);
  
  // Get unique values for filter dropdowns
  const [uniqueTypes, setUniqueTypes] = useState([]);
  const [uniqueSources, setUniqueSources] = useState([]);

  useEffect(() => {
    const loadTransactions = async () => {
      try {
        setLoading(true);
        const data = await fetchRawTransactions(pagination.limit, pagination.offset);
        setTransactions(data.transactions);
        
        // Extract unique values for filters
        const types = [...new Set(data.transactions.map(tx => tx.transaction_type).filter(Boolean))];
        const sources = [...new Set(data.transactions.map(tx => tx.source).filter(Boolean))];
        
        setUniqueTypes(types);
        setUniqueSources(sources);
        
        setPagination(data.pagination);
      } catch (err) {
        setError('Failed to load transactions');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, [pagination.limit, pagination.offset]);

  // Load categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categoriesData = await fetchCategories();
        setCategories(categoriesData || []);
      } catch (err) {
        console.error("Error fetching categories:", err);
      }
    };
    
    loadCategories();
  }, []);

  // Load merchant categories for transactions
  useEffect(() => {
    const loadMerchantCategories = async () => {
      if (!transactions.length) return;
      
      const merchantCategoriesMap = {};
      
      // Process merchants in batches to avoid too many concurrent requests
      const uniqueMerchants = [...new Set(transactions
        .filter(tx => tx.merchant_name)
        .map(tx => tx.merchant_name))];
      
      const batchSize = 10;
      for (let i = 0; i < uniqueMerchants.length; i += batchSize) {
        const batch = uniqueMerchants.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (merchantName) => {
          try {
            const categoriesData = await fetchMerchantCategories(merchantName);
            if (categoriesData && categoriesData.length > 0) {
              merchantCategoriesMap[merchantName] = categoriesData[0].id;
            }
          } catch (err) {
            // Just log the error but continue processing
            console.error(`Error loading categories for ${merchantName}:`, err);
          }
        }));
      }
      
      setMerchantCategories(merchantCategoriesMap);
    };
    
    loadMerchantCategories();
  }, [transactions]);

  // Apply search, filters, and sorting
  useEffect(() => {
    let filtered = [...transactions];
    
    // Apply search term
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(tx => 
        (tx.merchant_name && tx.merchant_name.toLowerCase().includes(term)) ||
        (tx.original_description && tx.original_description.toLowerCase().includes(term)) ||
        (tx.transaction_type && tx.transaction_type.toLowerCase().includes(term)) ||
        (tx.date && tx.date.includes(term))
      );
    }
    
    // Apply filters
    if (filters.dateFrom) {
      filtered = filtered.filter(tx => tx.date >= filters.dateFrom);
    }
    
    if (filters.dateTo) {
      filtered = filtered.filter(tx => tx.date <= filters.dateTo);
    }
    
    if (filters.amountMin) {
      const min = parseFloat(filters.amountMin);
      filtered = filtered.filter(tx => parseFloat(tx.amount) >= min);
    }
    
    if (filters.amountMax) {
      const max = parseFloat(filters.amountMax);
      filtered = filtered.filter(tx => parseFloat(tx.amount) <= max);
    }
    
    if (filters.type) {
      filtered = filtered.filter(tx => tx.transaction_type === filters.type);
    }
    
    if (filters.source) {
      filtered = filtered.filter(tx => tx.source === filters.source);
    }
    
    // Filter by category
    if (filters.category) {
      filtered = filtered.filter(tx => 
        tx.merchant_name && merchantCategories[tx.merchant_name] === parseInt(filters.category)
      );
    }
    
    // Apply sorting
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        // Handle different data types
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        
        // Handle numeric values
        if (sortConfig.key === 'amount' || sortConfig.key === 'balance') {
          aValue = parseFloat(aValue) || 0;
          bValue = parseFloat(bValue) || 0;
        }
        
        // Handle null/undefined values
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        
        // Compare values
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    
    setFilteredTransactions(filtered);
  }, [searchTerm, transactions, filters, sortConfig, merchantCategories]);

  const handleNextPage = () => {
    if (pagination.offset + pagination.limit < pagination.total) {
      setPagination({
        ...pagination,
        offset: pagination.offset + pagination.limit
      });
    }
  };

  const handlePrevPage = () => {
    if (pagination.offset > 0) {
      setPagination({
        ...pagination,
        offset: Math.max(0, pagination.offset - pagination.limit)
      });
    }
  };
  
  const handleSort = (key) => {
    // If clicking the same column, toggle direction
    const direction = 
      sortConfig.key === key && sortConfig.direction === 'asc' 
        ? 'desc' 
        : 'asc';
    
    setSortConfig({ key, direction });
  };
  
  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };
  
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      amountMin: '',
      amountMax: '',
      type: '',
      source: '',
      category: ''
    });
    setSearchTerm('');
  };

  const exportToCSV = () => {
    // Create CSV content
    const headers = [
      'ID', 'Date', 'Amount', 'Balance', 'Description', 
      'Merchant', 'Type', 'Location', 'Currency', 'Card', 'Source'
    ];
    
    const csvRows = [
      headers.join(','),
      ...filteredTransactions.map(tx => [
        tx.id,
        tx.date,
        tx.amount,
        tx.balance,
        `"${(tx.original_description || '').replace(/"/g, '""')}"`,
        `"${(tx.merchant_name || '').replace(/"/g, '""')}"`,
        `"${(tx.transaction_type || '').replace(/"/g, '""')}"`,
        `"${(tx.location || '').replace(/"/g, '""')}"`,
        tx.currency,
        tx.last_4_card_number,
        tx.source
      ].join(','))
    ];
    
    const csvContent = csvRows.join('\n');
    
    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="loading-container">
        <div className="loading">Loading transactions...</div>
      </div>
    );
  }

  if (error) {
    return <div className="error-message">{error}</div>;
  }

  return (
    <div className="raw-transactions">
      <div className="transactions-header">
        <h2>Raw Transactions</h2>
        <div className="actions-bar">
          <div className="search-container">
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <button 
            className="filter-toggle-button"
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
          <button 
            className="export-button"
            onClick={exportToCSV}
          >
            Export to CSV
          </button>
        </div>
      </div>
      
      {showFilters && (
        <div className="filters-panel">
          <div className="filters-grid">
            <div className="filter-group">
              <label>Date Range</label>
              <div className="date-range">
                <input
                  type="date"
                  name="dateFrom"
                  value={filters.dateFrom}
                  onChange={handleFilterChange}
                  placeholder="From"
                />
                <span>to</span>
                <input
                  type="date"
                  name="dateTo"
                  value={filters.dateTo}
                  onChange={handleFilterChange}
                  placeholder="To"
                />
              </div>
            </div>
            
            <div className="filter-group">
              <label>Amount Range</label>
              <div className="amount-range">
                <input
                  type="number"
                  name="amountMin"
                  value={filters.amountMin}
                  onChange={handleFilterChange}
                  placeholder="Min"
                />
                <span>to</span>
                <input
                  type="number"
                  name="amountMax"
                  value={filters.amountMax}
                  onChange={handleFilterChange}
                  placeholder="Max"
                />
              </div>
            </div>
            
            <div className="filter-group">
              <label>Transaction Type</label>
              <select
                name="type"
                value={filters.type}
                onChange={handleFilterChange}
              >
                <option value="">All Types</option>
                {uniqueTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label>Source</label>
              <select
                name="source"
                value={filters.source}
                onChange={handleFilterChange}
              >
                <option value="">All Sources</option>
                {uniqueSources.map(source => (
                  <option key={source} value={source}>{source}</option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label>Category</label>
              <select
                name="category"
                value={filters.category}
                onChange={handleFilterChange}
              >
                <option value="">All Categories</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="filter-actions">
            <button 
              className="clear-filters-button"
              onClick={clearFilters}
            >
              Clear Filters
            </button>
            <div className="filter-stats">
              Showing {filteredTransactions.length} of {transactions.length} transactions
            </div>
          </div>
        </div>
      )}
      
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th onClick={() => handleSort('date')} className="sortable-header">
                Date {getSortIndicator('date')}
              </th>
              <th onClick={() => handleSort('amount')} className="sortable-header">
                Amount {getSortIndicator('amount')}
              </th>
              <th onClick={() => handleSort('merchant_name')} className="sortable-header">
                Merchant {getSortIndicator('merchant_name')}
              </th>
              <th onClick={() => handleSort('original_description')} className="sortable-header">
                Description {getSortIndicator('original_description')}
              </th>
              <th onClick={() => handleSort('transaction_type')} className="sortable-header">
                Type {getSortIndicator('transaction_type')}
              </th>
              <th onClick={() => handleSort('source')} className="sortable-header">
                Source {getSortIndicator('source')}
              </th>
              <th>Category</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map(tx => {
                const categoryId = tx.merchant_name ? merchantCategories[tx.merchant_name] : null;
                const category = categoryId ? categories.find(c => c.id === categoryId) : null;
                
                return (
                  <tr key={tx.id}>
                    <td>{tx.date}</td>
                    <td className={`amount ${parseFloat(tx.amount) < 0 ? 'negative' : 'positive'}`}>
                      {formatCurrency(tx.amount)}
                    </td>
                    <td>{tx.merchant_name || '-'}</td>
                    <td className="description">{tx.original_description}</td>
                    <td>{tx.transaction_type || '-'}</td>
                    <td>{tx.source}</td>
                    <td>
                      {category && (
                        <span 
                          className="category-tag" 
                          style={{backgroundColor: category.color, color: '#fff'}}
                        >
                          {category.icon} {category.name}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="7" className="no-results">
                  No transactions match your filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {transactions.length > 0 && (
        <div className="pagination">
          <div className="pagination-info">
            Showing {pagination.offset + 1} - {Math.min(pagination.offset + filteredTransactions.length, pagination.total)} of {pagination.total} transactions
          </div>
          <div className="pagination-controls">
            <button 
              onClick={handlePrevPage} 
              disabled={pagination.offset === 0}
              className="pagination-button"
            >
              Previous
            </button>
            <button 
              onClick={handleNextPage} 
              disabled={pagination.offset + pagination.limit >= pagination.total}
              className="pagination-button"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RawTransactions; 