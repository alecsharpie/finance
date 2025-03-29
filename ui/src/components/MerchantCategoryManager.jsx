import React, { useState, useEffect } from 'react';
import { 
  fetchAllMerchants, 
  fetchCategories, 
  createCategory,
  deleteCategory,
  fetchMerchantCategories,
  addMerchantCategory,
  removeMerchantCategory,
  fetchMerchantCategoriesBatch,
  getMerchantCategoryFromCacheOrBatch
} from '../services/api';
import { formatCurrency } from '../utils/formatters';

const MerchantCategoryManager = () => {
  const [merchants, setMerchants] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddCategoryForm, setShowAddCategoryForm] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', color: '#7D6B91', icon: '📊' });
  const [currentPage, setCurrentPage] = useState(1);
  const [merchantsPerPage] = useState(50);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [merchantCategories, setMerchantCategories] = useState({});
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadedMerchants, setLoadedMerchants] = useState(new Set());
  
  // Load merchants and categories on component mount or refresh
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // First try to fetch merchants
        let merchantsData;
        try {
          merchantsData = await fetchAllMerchants();
          // Sort merchants by total_spent in descending order
          merchantsData.sort((a, b) => b.total_spent - a.total_spent);
          setMerchants(merchantsData || []);
        } catch (err) {
          console.error("Error fetching merchants:", err);
          setError('Failed to load merchants');
        }
        
        // Then try to fetch categories
        try {
          const categoriesData = await fetchCategories();
          setCategories(categoriesData || []);
        } catch (err) {
          console.error("Error fetching categories:", err);
          // Don't set error if we at least have merchants
          if (!merchantsData) {
            setError('Failed to load data');
          }
        }
      } catch (err) {
        setError('Failed to load data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [refreshTrigger]);
  
  // Filter merchants based on search term and category filter
  const filteredMerchants = merchants.filter(merchant => {
    // Text search filter
    const matchesSearch = merchant.merchant_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Category filter
    let matchesCategory = true;
    if (categoryFilter !== 'all') {
      if (categoryFilter === 'uncategorized') {
        matchesCategory = !merchantCategories[merchant.merchant_name];
      } else {
        matchesCategory = merchantCategories[merchant.merchant_name] === parseInt(categoryFilter);
      }
    }
    
    return matchesSearch && matchesCategory;
  });
  
  // Pagination
  const indexOfLastMerchant = currentPage * merchantsPerPage;
  const indexOfFirstMerchant = indexOfLastMerchant - merchantsPerPage;
  const currentMerchants = filteredMerchants.slice(indexOfFirstMerchant, indexOfLastMerchant);
  const totalPages = Math.ceil(filteredMerchants.length / merchantsPerPage);
  
  // Load all merchant categories with a more controlled approach
  useEffect(() => {
    const loadAllMerchantCategories = async () => {
      if (!merchants.length) return;
      
      setCategoryLoading(true);
      setLoadingProgress(0);
      
      try {
        // First, focus on visible merchants
        const visibleMerchants = filteredMerchants.slice(indexOfFirstMerchant, indexOfLastMerchant);
        const visibleMerchantNames = visibleMerchants.map(m => m.merchant_name);
        
        // Fetch categories for visible merchants in one batch request
        setLoadingProgress(10);
        const visibleBatchResults = await fetchMerchantCategoriesBatch(visibleMerchantNames);
        setLoadingProgress(50);
        
        // Process the results
        const merchantCategoriesMap = {...merchantCategories};
        
        // Mark all visible merchants as loaded
        const newLoadedMerchants = new Set([...loadedMerchants]);
        visibleMerchantNames.forEach(name => newLoadedMerchants.add(name));
        
        // Update the categories map with results
        visibleMerchantNames.forEach(merchantName => {
          const categories = getMerchantCategoryFromCacheOrBatch(merchantName, visibleBatchResults);
          if (categories.length > 0) {
            merchantCategoriesMap[merchantName] = categories[0].id;
          }
        });
        
        // Update state with what we have so far
        setLoadedMerchants(newLoadedMerchants);
        setMerchantCategories(merchantCategoriesMap);
        setLoadingProgress(75);
        
        // Optionally, load more merchants in the background
        // This could be the next page or two of merchants
        const nextPageMerchants = filteredMerchants
          .slice(indexOfLastMerchant, indexOfLastMerchant + merchantsPerPage * 2)
          .map(m => m.merchant_name);
          
        if (nextPageMerchants.length > 0) {
          // No need to await this - let it happen in the background
          fetchMerchantCategoriesBatch(nextPageMerchants)
            .then(() => {
              // Just mark these as loaded in the cache, we don't need to update state
              // They'll be retrieved from cache when the user navigates to those pages
            })
            .catch(err => {
              console.error("Error prefetching next page categories:", err);
            });
        }
        
        setLoadingProgress(100);
      } catch (error) {
        console.error("Error loading merchant categories:", error);
      } finally {
        setCategoryLoading(false);
      }
    };
    
    loadAllMerchantCategories();
  }, [merchants, refreshTrigger, currentPage, merchantsPerPage, searchTerm, categoryFilter]);
  
  // Handle category change for a merchant
  const handleCategoryChange = async (merchantName, categoryId) => {
    try {
      // If categoryId is "none", remove all categories
      if (categoryId === "none") {
        // If the merchant has a category, remove it
        if (merchantCategories[merchantName]) {
          await removeMerchantCategory(merchantName, merchantCategories[merchantName]);
          
          // Update local state
          setMerchantCategories(prev => {
            const updated = {...prev};
            delete updated[merchantName];
            return updated;
          });
          
          // Clear the cache for this merchant
          const cacheKey = `merchant_category_${merchantName}`;
          sessionStorage.removeItem(cacheKey);
          sessionStorage.removeItem(`${cacheKey}_timestamp`);
        }
      } else {
        // If merchant already has a different category, remove it first
        if (merchantCategories[merchantName] && merchantCategories[merchantName] !== parseInt(categoryId)) {
          await removeMerchantCategory(merchantName, merchantCategories[merchantName]);
        }
        
        // Add the new category
        await addMerchantCategory(merchantName, categoryId);
        
        // Update local state immediately
        setMerchantCategories(prev => ({
          ...prev,
          [merchantName]: parseInt(categoryId)
        }));
        
        // Clear the cache for this merchant
        const cacheKey = `merchant_category_${merchantName}`;
        sessionStorage.removeItem(cacheKey);
        sessionStorage.removeItem(`${cacheKey}_timestamp`);
      }
    } catch (err) {
      console.error('Error updating merchant category:', err);
      alert('Failed to update category');
    }
  };
  
  // Handle creating a new category
  const handleCreateCategory = async (e) => {
    e.preventDefault();
    
    try {
      const response = await createCategory(newCategory);
      
      // Add the new category to the list
      setCategories([...categories, response]);
      
      // Reset the form
      setNewCategory({ name: '', color: '#7D6B91', icon: '📊' });
      setShowAddCategoryForm(false);
      
      // Refresh the data
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error('Error creating category:', err);
      alert('Failed to create category');
    }
  };
  
  // Handle deleting a category
  const handleDeleteCategory = async (categoryId) => {
    if (!window.confirm('Are you sure you want to delete this category? This will remove it from all merchants.')) {
      return;
    }
    
    try {
      await deleteCategory(categoryId);
      
      // Remove the category from the list
      setCategories(categories.filter(cat => cat.id !== categoryId));
      
      // Remove the category from all merchants
      setMerchantCategories(prev => {
        const updated = {...prev};
        Object.keys(updated).forEach(merchantName => {
          if (updated[merchantName] === categoryId) {
            delete updated[merchantName];
          }
        });
        return updated;
      });
      
      // Refresh the data
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error('Error deleting category:', err);
      alert('Failed to delete category');
    }
  };
  
  // Get a category by ID
  const getCategoryById = (id) => {
    return categories.find(cat => cat.id === parseInt(id));
  };
  
  // Render pagination controls
  const renderPagination = () => {
    if (totalPages <= 1) return null;
    
    return (
      <div className="pagination">
        <button 
          className="pagination-btn"
          onClick={() => setCurrentPage(1)}
          disabled={currentPage === 1}
        >
          &laquo;
        </button>
        <button 
          className="pagination-btn"
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
        >
          &lsaquo;
        </button>
        
        <span className="pagination-info">
          Page {currentPage} of {totalPages} ({filteredMerchants.length} merchants)
        </span>
        
        <button 
          className="pagination-btn"
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
        >
          &rsaquo;
        </button>
        <button 
          className="pagination-btn"
          onClick={() => setCurrentPage(totalPages)}
          disabled={currentPage === totalPages}
        >
          &raquo;
        </button>
      </div>
    );
  };
  
  if (loading) {
    return <div className="loading">Loading merchant and category data...</div>;
  }
  
  if (error) {
    return <div className="error-message">{error}</div>;
  }
  
  return (
    <div className="category-management">
      <div className="category-header">
        <h2>Merchant Category Management</h2>
        <button 
          className="btn btn-primary"
          onClick={() => setShowAddCategoryForm(!showAddCategoryForm)}
        >
          {showAddCategoryForm ? 'Cancel' : 'Add New Category'}
        </button>
      </div>
      
      {categoryLoading && (
        <div className="category-loading-indicator">
          <div className="loading-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>
            <div className="progress-text">
              Loading merchant categories... {loadingProgress}%
            </div>
          </div>
        </div>
      )}
      
      {showAddCategoryForm && (
        <div className="add-category-form">
          <h3>Create New Category</h3>
          <form onSubmit={handleCreateCategory}>
            <div className="form-group">
              <label htmlFor="category-name">Category Name</label>
              <input 
                id="category-name"
                type="text" 
                value={newCategory.name}
                onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                placeholder="Enter category name"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="category-color">Color</label>
              <input 
                id="category-color"
                type="color" 
                value={newCategory.color}
                onChange={(e) => setNewCategory({...newCategory, color: e.target.value})}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="category-icon">Icon (emoji)</label>
              <input 
                id="category-icon"
                type="text" 
                value={newCategory.icon}
                onChange={(e) => setNewCategory({...newCategory, icon: e.target.value})}
                placeholder="Enter an emoji"
              />
            </div>
            
            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                Create Category
              </button>
            </div>
          </form>
        </div>
      )}
      
      <div className="categories-list">
        <h3>Available Categories</h3>
        <div className="categories-grid">
          {categories.map(category => (
            <div key={category.id} className="category-item">
              <div className="category-info">
                <span className="category-icon" style={{backgroundColor: category.color}}>
                  {category.icon}
                </span>
                <span className="category-name">{category.name}</span>
              </div>
              <button 
                className="btn-icon delete"
                onClick={() => handleDeleteCategory(category.id)}
                title="Delete category"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
      
      <div className="filter-controls">
        <div className="search-bar">
          <input 
            type="text"
            placeholder="Search merchants..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // Reset to first page on search
            }}
          />
          <button onClick={() => setSearchTerm('')}>Clear</button>
        </div>
        
        <div className="category-filter">
          <label htmlFor="category-filter">Filter by category:</label>
          <select 
            id="category-filter"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1); // Reset to first page on filter change
            }}
            className="category-select"
          >
            <option value="all">All Categories</option>
            <option value="uncategorized">Uncategorized</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="merchants-table">
        <table>
          <thead>
            <tr>
              <th>Merchant</th>
              <th>Transaction Count</th>
              <th>Total Spent</th>
              <th>Last Transaction</th>
              <th>Category</th>
            </tr>
          </thead>
          <tbody>
            {currentMerchants.map(merchant => {
              const categoryId = merchantCategories[merchant.merchant_name];
              const category = categoryId ? getCategoryById(categoryId) : null;
              const isLoaded = loadedMerchants.has(merchant.merchant_name);
              
              return (
                <tr key={merchant.merchant_name}>
                  <td>{merchant.merchant_name}</td>
                  <td>{merchant.transaction_count}</td>
                  <td>{formatCurrency(merchant.total_spent)}</td>
                  <td>{new Date(merchant.last_transaction).toLocaleDateString()}</td>
                  <td>
                    <div className="category-select-container">
                      {isLoaded ? (
                        <select
                          value={categoryId || "none"}
                          onChange={(e) => handleCategoryChange(merchant.merchant_name, e.target.value)}
                          className={`category-select-tag ${categoryId ? 'has-category' : 'no-category'}`}
                          style={category ? {
                            backgroundColor: category.color,
                            color: '#fff'
                          } : {}}
                        >
                          <option value="none">None</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>
                              {cat.icon} {cat.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="category-loading">
                          <span className="loading-placeholder">Loading...</span>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {renderPagination()}
      </div>
    </div>
  );
};

export default MerchantCategoryManager; 