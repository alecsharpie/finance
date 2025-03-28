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
    const response = await fetch(
      `${API_BASE_URL}/transactions/timeline?start_date=${start_date}&end_date=${end_date}&view_mode=${view_mode}`
    );
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
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

export const fetchMerchantCategories = async (merchantName) => {
  try {
    // Check if we've already tried to fetch this merchant's categories recently
    // This helps avoid repeated 404 errors for the same merchant
    const cacheKey = `merchant_category_${merchantName}`;
    const cachedResult = sessionStorage.getItem(cacheKey);
    
    if (cachedResult) {
      return JSON.parse(cachedResult);
    }
    
    const response = await axios.get(`${API_BASE_URL}/merchants/${encodeURIComponent(merchantName)}/categories`);
    const data = response.data;
    
    // Cache the result for 5 minutes
    sessionStorage.setItem(cacheKey, JSON.stringify(data));
    sessionStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
    
    return data;
  } catch (error) {
    // Instead of logging every 404, just cache an empty result
    if (error.response && error.response.status === 404) {
      // Cache empty result to prevent repeated requests
      const cacheKey = `merchant_category_${merchantName}`;
      sessionStorage.setItem(cacheKey, JSON.stringify([]));
      sessionStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
      
      // Only log in development environment
      if (process.env.NODE_ENV === 'development') {
        // Use a more subtle console method
        console.debug(`No categories found for merchant: ${merchantName}`);
      }
      return [];
    }
    
    // For other errors, still log them but return empty array
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