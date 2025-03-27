// Format currency values
export const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '$0.00';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(Math.abs(parseFloat(value)));
};

// Format date to a more readable format
export const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
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