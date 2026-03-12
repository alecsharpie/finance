import axios from 'axios';

const API_BASE_URL = '/api';

export const fetchRecurringTransactions = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/transactions/recurring`);
    return response.data;
  } catch (error) {
    console.error('Error fetching recurring transactions:', error);
    throw error;
  }
};

export const fetchMerchantCounts = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/merchants/count`);
    return response.data;
  } catch (error) {
    console.error('Error fetching merchant counts:', error);
    throw error;
  }
};

export const fetchMonthlySpending = async (months = 6) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/spending/monthly`, {
      params: { months }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching monthly spending:', error);
    throw error;
  }
};

export const fetchRecentTransaction = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/transactions/recent`);
    return response.data;
  } catch (error) {
    console.error('Error fetching recent transaction:', error);
    throw error;
  }
};

export const fetchSubscriptions = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/transactions/subscriptions`);
    return response.data;
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    throw error;
  }
};

export const fetchTransactionTimeline = async ({ start_date, end_date, view_mode }) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/transactions/timeline`, {
      params: { start_date, end_date, view_mode }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching transaction timeline:', error);
    throw error;
  }
};

export const fetchAllMerchants = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/merchants/all`);
    return response.data;
  } catch (error) {
    console.error('Error fetching all merchants:', error);
    throw error;
  }
};

export const fetchCategories = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/categories`);
    return response.data;
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
};

export const createCategory = async (categoryData) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/categories`, categoryData);
    return response.data;
  } catch (error) {
    console.error('Error creating category:', error);
    throw error;
  }
};

export const fetchMerchantCategories = async (merchantName, bypassCache = false) => {
  try {
    // Check if we've already tried to fetch this merchant's categories recently
    const cacheKey = `merchant_category_${merchantName}`;
    const cachedResult = sessionStorage.getItem(cacheKey);
    const cachedTimestamp = sessionStorage.getItem(`${cacheKey}_timestamp`);
    
    // Only use cache if it's less than 5 minutes old and bypassCache is false
    const cacheAge = cachedTimestamp ? Date.now() - parseInt(cachedTimestamp) : Infinity;
    const cacheValid = cacheAge < 300000 && !bypassCache; // 5 minutes
    
    if (cachedResult && cacheValid) {
      return JSON.parse(cachedResult);
    }
    
    const response = await axios.get(`${API_BASE_URL}/merchants/${encodeURIComponent(merchantName)}/categories`);
    const data = response.data;
    
    // Cache the result
    sessionStorage.setItem(cacheKey, JSON.stringify(data));
    sessionStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
    
    return data;
  } catch (error) {
    // Cache 404 responses to prevent repeated requests
    if (error.response && error.response.status === 404) {
      const cacheKey = `merchant_category_${merchantName}`;
      sessionStorage.setItem(cacheKey, JSON.stringify([]));
      sessionStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
      return [];
    }
    
    // For network errors, also cache to prevent overwhelming the server
    if (error.code === 'ERR_NETWORK' || error.code === 'ERR_INSUFFICIENT_RESOURCES') {
      const cacheKey = `merchant_category_${merchantName}`;
      sessionStorage.setItem(cacheKey, JSON.stringify([]));
      sessionStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
      console.warn(`Network error fetching categories for ${merchantName}, using empty cache`);
      return [];
    }
    
    console.error(`Error fetching categories for merchant ${merchantName}:`, error);
    return [];
  }
};

export const addMerchantCategory = async (merchantName, categoryId) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/merchants/${encodeURIComponent(merchantName)}/categories/${categoryId}`);
    return response.data;
  } catch (error) {
    console.error(`Error adding category to merchant ${merchantName}:`, error);
    throw error;
  }
};

export const removeMerchantCategory = async (merchantName, categoryId) => {
  try {
    const response = await axios.delete(`${API_BASE_URL}/merchants/${encodeURIComponent(merchantName)}/categories/${categoryId}`);
    return response.data;
  } catch (error) {
    console.error(`Error removing category from merchant ${merchantName}:`, error);
    throw error;
  }
};

export const fetchTransactionTimelineWithCategories = async (startDate, endDate, viewMode = 'monthly') => {
  try {
    const response = await axios.get(`${API_BASE_URL}/transactions/timeline/categories`, {
      params: { start_date: startDate, end_date: endDate, view_mode: viewMode }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching transaction timeline with categories:', error);
    throw error;
  }
};

export const deleteCategory = async (categoryId) => {
  try {
    const response = await axios.delete(`${API_BASE_URL}/categories/${categoryId}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting category ${categoryId}:`, error);
    throw error;
  }
};

export const fetchRawTransactions = async (limit = 1000, offset = 0) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/transactions/raw`, {
      params: { limit, offset }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching raw transactions:', error);
    throw error;
  }
};

export const uploadCommbankTransactions = async (file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await axios.post(`${API_BASE_URL}/transactions/upload/commbank`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  } catch (error) {
    console.error('Error uploading transactions:', error);
    throw error;
  }
};

export const uploadWestpacTransactions = async (file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await axios.post(`${API_BASE_URL}/transactions/upload/westpac`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  } catch (error) {
    console.error('Error uploading Westpac transactions:', error);
    throw error;
  }
};

export const fetchUpBankTransactions = async (apiKey) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/transactions/upbank/import`, 
      { api_key: apiKey },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Error fetching Up Bank transactions:', error);
    throw error;
  }
};

export const fetchMerchantCategoriesBatch = async (merchantNames) => {
  try {
    // Filter out any merchant names that are already cached
    const uncachedMerchants = merchantNames.filter(name => {
      const cacheKey = `merchant_category_${name}`;
      const cachedResult = sessionStorage.getItem(cacheKey);
      const cachedTimestamp = sessionStorage.getItem(`${cacheKey}_timestamp`);
      
      // Check if we have a valid cache
      const cacheAge = cachedTimestamp ? Date.now() - parseInt(cachedTimestamp) : Infinity;
      return !(cachedResult && cacheAge < 300000); // 5 minutes cache
    });
    
    // If all merchants are cached, return empty object (we'll get from cache later)
    if (uncachedMerchants.length === 0) {
      return {};
    }
    
    // Make the batch request
    const response = await axios.post(`${API_BASE_URL}/merchants/categories/batch`, uncachedMerchants);
    const data = response.data || {};
    
    // Cache each merchant's categories
    Object.entries(data).forEach(([merchantName, categories]) => {
      const cacheKey = `merchant_category_${merchantName}`;
      sessionStorage.setItem(cacheKey, JSON.stringify(categories));
      sessionStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
    });
    
    // For merchants that weren't in the response, cache empty arrays
    uncachedMerchants.forEach(merchantName => {
      if (!data[merchantName]) {
        const cacheKey = `merchant_category_${merchantName}`;
        sessionStorage.setItem(cacheKey, JSON.stringify([]));
        sessionStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
      }
    });
    
    return data;
  } catch (error) {
    console.error('Error fetching merchant categories batch:', error);
    
    // Cache empty results for all requested merchants to prevent repeated failures
    merchantNames.forEach(merchantName => {
      const cacheKey = `merchant_category_${merchantName}`;
      sessionStorage.setItem(cacheKey, JSON.stringify([]));
      sessionStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
    });
    
    return {};
  }
};

// Helper function to get categories from cache or use batch result
export const getMerchantCategoryFromCacheOrBatch = (merchantName, batchResults) => {
  const cacheKey = `merchant_category_${merchantName}`;
  const cachedResult = sessionStorage.getItem(cacheKey);
  
  if (cachedResult) {
    return JSON.parse(cachedResult);
  }
  
  return batchResults[merchantName] || [];
};

export const updateCategory = async (categoryId, categoryData) => {
  try {
    const response = await axios.put(`${API_BASE_URL}/categories/${categoryId}`, categoryData);
    return response.data;
  } catch (error) {
    console.error('Error updating category:', error);
    throw error;
  }
};

// =========================================================================
// Up Bank API Functions
// =========================================================================

export const fetchUpHealth = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/up/health`);
    return response.data;
  } catch (error) {
    console.error('Error checking Up Bank health:', error);
    return { status: 'error', message: error.message };
  }
};

export const fetchUpAccounts = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/up/accounts`);
    return response.data;
  } catch (error) {
    console.error('Error fetching Up accounts:', error);
    throw error;
  }
};

export const fetchUpSummary = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/up/summary`);
    return response.data;
  } catch (error) {
    console.error('Error fetching Up summary:', error);
    throw error;
  }
};

export const fetchUpTransactions = async (params = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/up/transactions`, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching Up transactions:', error);
    throw error;
  }
};

export const fetchUpAccountTransactions = async (accountId, params = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/up/accounts/${accountId}/transactions`, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching Up account transactions:', error);
    throw error;
  }
};

export const fetchUpCategories = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/up/categories`);
    return response.data;
  } catch (error) {
    console.error('Error fetching Up categories:', error);
    throw error;
  }
};

export const fetchSavingsHistory = async (startDate = null, endDate = null) => {
  try {
    const params = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await axios.get(`${API_BASE_URL}/up/savings/history`, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching savings history:', error);
    throw error;
  }
};

export const fetchTotalSavings = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/up/savings/total`);
    return response.data;
  } catch (error) {
    console.error('Error fetching total savings:', error);
    throw error;
  }
};

export const fetchSpendingBreakdown = async (accountId = null, startDate = null, endDate = null) => {
  try {
    const params = {};
    if (accountId) params.account_id = accountId;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await axios.get(`${API_BASE_URL}/up/spending/breakdown`, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching spending breakdown:', error);
    throw error;
  }
};

export const fetchUpMonthlySpending = async (accountId = null, months = 12) => {
  try {
    const params = { months };
    if (accountId) params.account_id = accountId;
    const response = await axios.get(`${API_BASE_URL}/up/spending/monthly`, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching Up monthly spending:', error);
    throw error;
  }
};

export const fetchDailySpending = async (accountId = null, startDate = null, endDate = null) => {
  try {
    const params = {};
    if (accountId) params.account_id = accountId;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await axios.get(`${API_BASE_URL}/up/spending/daily`, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching daily spending:', error);
    throw error;
  }
};

export const fetchDailySpendingAdjusted = async (accountId = null, startDate = null, endDate = null) => {
  try {
    const params = {};
    if (accountId) params.account_id = accountId;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await axios.get(`${API_BASE_URL}/up/spending/daily-adjusted`, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching adjusted daily spending:', error);
    throw error;
  }
};

export const fetchDailyTransactions = async (date, accountId = null) => {
  try {
    const params = {};
    if (accountId) params.account_id = accountId;
    const response = await axios.get(`${API_BASE_URL}/up/spending/daily/${date}`, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching daily transactions:', error);
    throw error;
  }
};

export const triggerUpSync = async () => {
  try {
    const response = await axios.post(`${API_BASE_URL}/up/sync`);
    return response.data;
  } catch (error) {
    console.error('Error triggering Up sync:', error);
    throw error;
  }
};

export const fetchUpSyncStatus = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/up/sync/status`);
    return response.data;
  } catch (error) {
    console.error('Error fetching Up sync status:', error);
    throw error;
  }
};

export const recordBalanceSnapshot = async () => {
  try {
    const response = await axios.post(`${API_BASE_URL}/up/snapshot`);
    return response.data;
  } catch (error) {
    console.error('Error recording balance snapshot:', error);
    throw error;
  }
};

export const fetchUpSubscriptions = async (months = 12) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/up/subscriptions`, {
      params: { months }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching Up subscriptions:', error);
    throw error;
  }
};

// =========================================================================
// ETF Analysis Functions
// =========================================================================

export const fetchETFAnalysis = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/etf/analysis`);
    return response.data;
  } catch (error) {
    console.error('Error fetching ETF analysis:', error);
    throw error;
  }
};

export const fetchSingleETFAnalysis = async (ticker) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/etf/analysis/${ticker}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching ETF analysis for ${ticker}:`, error);
    throw error;
  }
};

export const fetchETFConfig = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/etf/config`);
    return response.data;
  } catch (error) {
    console.error('Error fetching ETF config:', error);
    throw error;
  }
}; 