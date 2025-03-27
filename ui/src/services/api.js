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