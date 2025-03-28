// Format currency values
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(amount || 0);
};

// Format date to a more readable format
export const formatDate = (date, viewMode = 'monthly') => {
  const options = {
    yearly: { year: 'numeric' },
    monthly: { month: 'long', year: 'numeric' },
    daily: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
    hourly: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric' }
  };
  
  return new Date(date).toLocaleDateString('en-US', options[viewMode] || options.monthly);
};

// Convert snake_case or any case to Title Case
export const titleCase = (text) => {
  if (!text) return '';
  
  // Replace underscores and hyphens with spaces
  const spacedText = text.replace(/_/g, ' ').replace(/-/g, ' ');
  
  // Special cases for financial terms
  const specialCases = {
    'Usd': 'USD',
    'Aud': 'AUD',
    'Nzd': 'NZD',
    'Id': 'ID',
  };
  
  // Title case the text
  let titled = spacedText
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  
  // Apply special cases
  Object.entries(specialCases).forEach(([search, replace]) => {
    titled = titled.replace(new RegExp(search, 'g'), replace);
  });
  
  return titled;
}; 