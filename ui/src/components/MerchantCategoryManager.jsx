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
  getMerchantCategoryFromCacheOrBatch,
  updateCategory
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
  const [sortField, setSortField] = useState('total_spent');
  const [sortDirection, setSortDirection] = useState('desc');
  const [editingCategory, setEditingCategory] = useState(null);
  const [editedCategory, setEditedCategory] = useState({ name: '', color: '', icon: '' });
  
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
  
  // Sort merchants based on the selected field and direction
  const sortMerchants = (merchants) => {
    return [...merchants].sort((a, b) => {
      let valueA, valueB;
      
      if (sortField === 'merchant_name') {
        valueA = a.merchant_name.toLowerCase();
        valueB = b.merchant_name.toLowerCase();
      } else if (sortField === 'transaction_count') {
        valueA = a.transaction_count;
        valueB = b.transaction_count;
      } else if (sortField === 'total_spent') {
        valueA = a.total_spent;
        valueB = b.total_spent;
      } else if (sortField === 'last_transaction') {
        valueA = new Date(a.last_transaction);
        valueB = new Date(b.last_transaction);
      }
      
      if (sortDirection === 'asc') {
        return valueA > valueB ? 1 : -1;
      } else {
        return valueA < valueB ? 1 : -1;
      }
    });
  };
  
  // Apply sorting to the filtered merchants
  const sortedMerchants = sortMerchants(filteredMerchants);
  
  // Get current page of merchants after sorting
  const currentMerchantsAfterSorting = sortedMerchants.slice(indexOfFirstMerchant, indexOfLastMerchant);
  
  // Handle sort change
  const handleSortChange = (e) => {
    setSortField(e.target.value);
  };
  
  // Toggle sort direction
  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };
  
  // Handle editing a category
  const handleEditCategory = (category) => {
    setEditingCategory(category.id);
    setEditedCategory({
      name: category.name,
      color: category.color,
      icon: category.icon
    });
  };
  
  // Handle saving category edits
  const handleSaveEdit = async () => {
    try {
      // Call API to update the category
      await updateCategory(editingCategory, editedCategory);
      
      // Update local state
      setCategories(categories.map(cat => 
        cat.id === editingCategory 
          ? { ...cat, ...editedCategory } 
          : cat
      ));
      
      // Reset editing state
      setEditingCategory(null);
      setEditedCategory({ name: '', color: '', icon: '' });
      
      // Refresh data to ensure everything is up to date
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error("Error updating category:", err);
      alert("Failed to update category");
    }
  };
  
  // Handle canceling category edits
  const handleCancelEdit = () => {
    setEditingCategory(null);
    setEditedCategory({ name: '', color: '', icon: '' });
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
      
      <div className="categories-section">
        <div className="categories-header">
          <h3 className="section-title">Available Categories</h3>
          <button 
            className="btn-add-category"
            onClick={() => setShowAddCategoryForm(!showAddCategoryForm)}
          >
            {showAddCategoryForm ? 'Cancel' : '+ Add Category'}
          </button>
        </div>
        <div className="categories-grid">
          {categories.map(category => (
            <div key={category.id} className="category-item">
              {editingCategory === category.id ? (
                // Edit mode
                <div className="category-edit-form">
                  <div className="edit-inputs">
                    <input
                      type="color"
                      value={editedCategory.color}
                      onChange={(e) => setEditedCategory({...editedCategory, color: e.target.value})}
                      className="color-input"
                      title="Change category color"
                    />
                    <input
                      type="text"
                      value={editedCategory.icon}
                      onChange={(e) => setEditedCategory({...editedCategory, icon: e.target.value})}
                      className="icon-input"
                      placeholder="Emoji"
                      maxLength="2"
                    />
                    <input
                      type="text"
                      value={editedCategory.name}
                      onChange={(e) => setEditedCategory({...editedCategory, name: e.target.value})}
                      className="name-input"
                      placeholder="Category name"
                    />
                  </div>
                  <div className="edit-actions">
                    <button 
                      onClick={handleSaveEdit}
                      className="btn-icon save"
                      title="Save changes"
                    >
                      ✓
                    </button>
                    <button 
                      onClick={handleCancelEdit}
                      className="btn-icon cancel"
                      title="Cancel"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ) : (
                // View mode
                <>
                  <div className="category-info">
                    <span className="category-icon" style={{backgroundColor: category.color}}>
                      {category.icon}
                    </span>
                    <span className="category-name">{category.name}</span>
                  </div>
                  <div className="category-actions">
                    <button 
                      className="btn-icon edit"
                      onClick={() => handleEditCategory(category)}
                      title="Edit category"
                    >
                      ✎
                    </button>
                    <button 
                      className="btn-icon delete"
                      onClick={() => handleDeleteCategory(category.id)}
                      title="Delete category"
                    >
                      ×
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
      
      <div className="merchants-section">
        <h3 className="section-title">Merchant Management</h3>
        
        <div className="merchant-controls">
          <div className="merchant-filters">
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
              <label htmlFor="category-filter" className="filter-label">Category:</label>
              <select 
                id="category-filter"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1); // Reset to first page on filter change
                }}
                className="filter-select"
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
          
          <div className="merchant-sort">
            <span className="sort-label">Sort by:</span>
            <select 
              value={sortField}
              onChange={handleSortChange}
              className="sort-select"
            >
              <option value="merchant_name">Merchant Name</option>
              <option value="transaction_count">Transaction Count</option>
              <option value="total_spent">Total Spent</option>
              <option value="last_transaction">Last Transaction</option>
            </select>
            <button 
              onClick={toggleSortDirection}
              className="sort-direction-btn"
              title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
            >
              {sortDirection === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
        
        <div className="merchant-stats">
          Showing {filteredMerchants.length} merchants ({merchants.length} total)
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
              {currentMerchantsAfterSorting.map(merchant => {
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
    </div>
  );
};

export default MerchantCategoryManager; 