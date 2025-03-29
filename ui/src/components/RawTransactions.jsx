import React, { useState, useEffect } from 'react';
import { fetchRawTransactions, fetchCategories, fetchMerchantCategories, uploadCommbankTransactions, fetchMerchantCategoriesBatch, getMerchantCategoryFromCacheOrBatch, uploadWestpacTransactions, fetchUpBankTransactions } from '../services/api';
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

  // Add these state variables to your component
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Add these state variables for progress tracking
  const [uploadProgress, setUploadProgress] = useState(0);
  const [progressInterval, setProgressInterval] = useState(null);

  // Add new state for the enhanced upload modal
  const [showUploadOptions, setShowUploadOptions] = useState(false);
  const [selectedUploadType, setSelectedUploadType] = useState(null);
  const [upBankApiKey, setUpBankApiKey] = useState('');
  const [upBankStatus, setUpBankStatus] = useState(null);

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
      
      // Get unique merchants from visible transactions
      const uniqueMerchants = [...new Set(transactions
        .filter(tx => tx.merchant_name)
        .map(tx => tx.merchant_name))];
      
      // Fetch all categories in a single batch request
      try {
        const batchResults = await fetchMerchantCategoriesBatch(uniqueMerchants);
        
        // Process the results
        const merchantCategoriesMap = {...merchantCategories};
        
        uniqueMerchants.forEach(merchantName => {
          const categories = getMerchantCategoryFromCacheOrBatch(merchantName, batchResults);
          if (categories.length > 0) {
            merchantCategoriesMap[merchantName] = categories[0].id;
          }
        });
        
        setMerchantCategories(merchantCategoriesMap);
      } catch (err) {
        console.error("Error loading merchant categories:", err);
      }
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

  // Modified function to handle file upload based on bank type
  const handleFileUpload = async (event, bankType) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      setIsUploading(true);
      setUploadStatus({ type: 'info', message: `Uploading ${bankType} file...` });
      setUploadProgress(0);
      
      // Start simulated progress
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          // Slowly increase progress up to 90%
          if (prev < 90) {
            return prev + (Math.random() * 2);
          }
          return prev;
        });
      }, 500);
      
      setProgressInterval(interval);
      
      // Call the appropriate API endpoint based on bank type
      let result;
      if (bankType === 'commbank') {
        result = await uploadCommbankTransactions(file);
      } else if (bankType === 'westpac') {
        result = await uploadWestpacTransactions(file);
      }
      
      // Complete the progress
      clearInterval(interval);
      setUploadProgress(100);
      
      setUploadStatus({ 
        type: 'success', 
        message: `${bankType.toUpperCase()} file uploaded successfully! Processing has started in the background. Refresh the page in a few minutes to see new transactions.` 
      });
      
      // Reset the file input
      event.target.value = null;
      
      // Reset progress after a delay
      setTimeout(() => {
        setUploadProgress(0);
      }, 3000);
      
    } catch (err) {
      // Clear the interval if there's an error
      if (progressInterval) {
        clearInterval(progressInterval);
        setProgressInterval(null);
      }
      
      setUploadProgress(0);
      console.error('Upload failed:', err);
      setUploadStatus({ 
        type: 'error', 
        message: `Upload failed: ${err.response?.data?.detail || err.message}` 
      });
    } finally {
      setIsUploading(false);
    }
  };

  // New function to handle Up Bank API connection
  const handleUpBankConnect = async () => {
    if (!upBankApiKey.trim()) {
      setUpBankStatus({
        type: 'error',
        message: 'Please enter an API key'
      });
      return;
    }
    
    try {
      setIsUploading(true);
      setUpBankStatus({ type: 'info', message: 'Connecting to Up Bank API...' });
      setUploadProgress(10);
      
      // Simulate API connection progress
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev < 90) {
            return prev + (Math.random() * 5);
          }
          return prev;
        });
      }, 300);
      
      setProgressInterval(interval);
      
      // Call the Up Bank API endpoint
      const result = await fetchUpBankTransactions(upBankApiKey);
      
      // Complete the progress
      clearInterval(interval);
      setUploadProgress(100);
      
      setUpBankStatus({ 
        type: 'success', 
        message: 'Successfully connected to Up Bank! Transactions are being imported in the background. Refresh the page in a few minutes to see new transactions.' 
      });
      
      // Reset progress after a delay
      setTimeout(() => {
        setUploadProgress(0);
      }, 3000);
      
    } catch (err) {
      if (progressInterval) {
        clearInterval(progressInterval);
        setProgressInterval(null);
      }
      
      setUploadProgress(0);
      console.error('Up Bank connection failed:', err);
      setUpBankStatus({ 
        type: 'error', 
        message: `Connection failed: ${err.response?.data?.detail || err.message}` 
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Close all upload modals
  const closeUploadModals = () => {
    if (progressInterval) {
      clearInterval(progressInterval);
      setProgressInterval(null);
    }
    setUploadProgress(0);
    setShowUploadModal(false);
    setShowUploadOptions(false);
    setSelectedUploadType(null);
    setUpBankStatus(null);
    setUploadStatus(null);
  };

  // Update the UploadModal component to include all options
  const UploadOptionsModal = () => {
    if (!showUploadOptions) return null;
    
    return (
      <div className="upload-modal-overlay">
        <div className="upload-modal">
          <div className="upload-modal-header">
            <h3>Import Transactions</h3>
            <button className="close-button" onClick={closeUploadModals}>×</button>
          </div>
          
          <div className="upload-modal-content">
            <p>
              Choose your bank to import transactions into your database.
            </p>
            
            <div className="bank-options">
              <div 
                className={`bank-option ${selectedUploadType === 'commbank' ? 'selected' : ''}`}
                onClick={() => setSelectedUploadType('commbank')}
              >
                <div className="bank-logo commbank-logo">
                  <span className="bank-icon">🏦</span>
                </div>
                <div className="bank-name">Commonwealth Bank</div>
                <div className="bank-description">Upload CSV export</div>
              </div>
              
              <div 
                className={`bank-option ${selectedUploadType === 'westpac' ? 'selected' : ''}`}
                onClick={() => setSelectedUploadType('westpac')}
              >
                <div className="bank-logo westpac-logo">
                  <span className="bank-icon">🏦</span>
                </div>
                <div className="bank-name">Westpac</div>
                <div className="bank-description">Upload CSV export</div>
              </div>
              
              <div 
                className={`bank-option ${selectedUploadType === 'upbank' ? 'selected' : ''}`}
                onClick={() => setSelectedUploadType('upbank')}
              >
                <div className="bank-logo upbank-logo">
                  <span className="bank-icon">🏦</span>
                </div>
                <div className="bank-name">Up Bank</div>
                <div className="bank-description">Connect via API</div>
              </div>
            </div>
            
            {selectedUploadType && (
              <div className="upload-details">
                <button 
                  className="back-button"
                  onClick={() => setSelectedUploadType(null)}
                >
                  ← Back to options
                </button>
                
                {selectedUploadType === 'commbank' && (
                  <div className="bank-upload-section">
                    <h4>Upload Commonwealth Bank Transactions</h4>
                    <div className="upload-instructions">
                      <ol>
                        <li>Log in to your Commonwealth Bank account</li>
                        <li>Navigate to your account transactions</li>
                        <li>Select the date range you want to export</li>
                        <li>Click "Export" and choose CSV format</li>
                        <li>Upload the downloaded file below</li>
                      </ol>
                    </div>
                    
                    {uploadProgress > 0 && (
                      <div className="progress-container">
                        <div className="progress-bar">
                          <div 
                            className="progress-fill" 
                            style={{ width: `${uploadProgress}%` }}
                          ></div>
                        </div>
                        <div className="progress-text">
                          {uploadProgress < 100 ? (
                            <>Processing transactions... {Math.round(uploadProgress)}%</>
                          ) : (
                            <>Processing complete! ✓</>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {uploadStatus && (
                      <div className={`upload-status ${uploadStatus.type}`}>
                        {uploadStatus.message}
                      </div>
                    )}
                    
                    <div className="upload-controls">
                      <input
                        type="file"
                        id="commbank-file"
                        accept=".csv"
                        onChange={(e) => handleFileUpload(e, 'commbank')}
                        disabled={isUploading}
                        className="file-input"
                      />
                      <label htmlFor="commbank-file" className={`file-input-label ${isUploading ? 'disabled' : ''}`}>
                        {isUploading ? 'Processing...' : 'Select CommBank CSV File'}
                      </label>
                    </div>
                  </div>
                )}
                
                {selectedUploadType === 'westpac' && (
                  <div className="bank-upload-section">
                    <h4>Upload Westpac Transactions</h4>
                    <div className="upload-instructions">
                      <ol>
                        <li>Log in to your Westpac online banking</li>
                        <li>Go to your account details page</li>
                        <li>Select "Export transactions" option</li>
                        <li>Choose CSV format and your date range</li>
                        <li>Upload the downloaded file below</li>
                      </ol>
                    </div>
                    
                    {uploadProgress > 0 && (
                      <div className="progress-container">
                        <div className="progress-bar">
                          <div 
                            className="progress-fill" 
                            style={{ width: `${uploadProgress}%` }}
                          ></div>
                        </div>
                        <div className="progress-text">
                          {uploadProgress < 100 ? (
                            <>Processing transactions... {Math.round(uploadProgress)}%</>
                          ) : (
                            <>Processing complete! ✓</>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {uploadStatus && (
                      <div className={`upload-status ${uploadStatus.type}`}>
                        {uploadStatus.message}
                      </div>
                    )}
                    
                    <div className="upload-controls">
                      <input
                        type="file"
                        id="westpac-file"
                        accept=".csv"
                        onChange={(e) => handleFileUpload(e, 'westpac')}
                        disabled={isUploading}
                        className="file-input"
                      />
                      <label htmlFor="westpac-file" className={`file-input-label ${isUploading ? 'disabled' : ''}`}>
                        {isUploading ? 'Processing...' : 'Select Westpac CSV File'}
                      </label>
                    </div>
                  </div>
                )}
                
                {selectedUploadType === 'upbank' && (
                  <div className="bank-upload-section">
                    <h4>Connect to Up Bank</h4>
                    <div className="upload-instructions">
                      <ol>
                        <li>Log in to your Up Bank account</li>
                        <li>Go to "Developer Tools" in your profile settings</li>
                        <li>Create a new personal access token</li>
                        <li>Copy the token and paste it below</li>
                        <li>Click "Connect" to import your transactions</li>
                      </ol>
                    </div>
                    
                    {uploadProgress > 0 && (
                      <div className="progress-container">
                        <div className="progress-bar">
                          <div 
                            className="progress-fill" 
                            style={{ width: `${uploadProgress}%` }}
                          ></div>
                        </div>
                        <div className="progress-text">
                          {uploadProgress < 100 ? (
                            <>Connecting to Up Bank... {Math.round(uploadProgress)}%</>
                          ) : (
                            <>Connection complete! ✓</>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {upBankStatus && (
                      <div className={`upload-status ${upBankStatus.type}`}>
                        {upBankStatus.message}
                      </div>
                    )}
                    
                    <div className="api-key-input">
                      <label htmlFor="up-bank-api-key">Up Bank Personal Access Token</label>
                      <input
                        type="password"
                        id="up-bank-api-key"
                        value={upBankApiKey}
                        onChange={(e) => setUpBankApiKey(e.target.value)}
                        placeholder="up:yeah:your-personal-access-token"
                        disabled={isUploading}
                      />
                    </div>
                    
                    <div className="upload-controls">
                      <button
                        className={`connect-button ${isUploading ? 'disabled' : ''}`}
                        onClick={handleUpBankConnect}
                        disabled={isUploading}
                      >
                        {isUploading ? 'Connecting...' : 'Connect to Up Bank'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
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
            className="upload-button"
            onClick={() => setShowUploadOptions(true)}
          >
            Import Transactions
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

      <UploadOptionsModal />
    </div>
  );
};

export default RawTransactions; 