import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { fetchSavingsHistory } from '../services/api';
import { formatCurrency } from '../utils/formatters';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Title,
  Tooltip,
  Legend
);

const SavingsChart = ({ dateRange = '6m' }) => {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRange, setSelectedRange] = useState(dateRange);
  const [hiddenDatasets, setHiddenDatasets] = useState(new Set());
  const [yAxisMax, setYAxisMax] = useState(null); // Fixed Y-axis max
  const chartRef = useRef(null);
  const rawAccountData = useRef(null); // Store original account data for recalculating totals

  const getDateRange = (range) => {
    const end = new Date();
    const start = new Date();

    switch (range) {
      case '1m':
        start.setMonth(start.getMonth() - 1);
        break;
      case '3m':
        start.setMonth(start.getMonth() - 3);
        break;
      case '6m':
        start.setMonth(start.getMonth() - 6);
        break;
      case '1y':
        start.setFullYear(start.getFullYear() - 1);
        break;
      case 'all':
        start.setFullYear(2020);
        break;
      default:
        start.setMonth(start.getMonth() - 6);
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  };

  // Emoji-aligned colors for each account
  const emojiColors = {
    '💛': { bg: 'rgba(255, 193, 7, 0.35)', border: '#FFC107' },    // Yellow heart - gold
    '🪺': { bg: 'rgba(139, 90, 43, 0.35)', border: '#8B5A2B' },    // Nest - brown
    '📈': { bg: 'rgba(33, 150, 243, 0.35)', border: '#2196F3' },   // Chart - blue
    '🌿': { bg: 'rgba(76, 175, 80, 0.35)', border: '#4CAF50' },    // Herb - green
    '🌊': { bg: 'rgba(0, 188, 212, 0.35)', border: '#00BCD4' },    // Wave - cyan
    '🚴': { bg: 'rgba(255, 87, 34, 0.35)', border: '#FF5722' },    // Bike - orange
    '🏠': { bg: 'rgba(233, 30, 99, 0.35)', border: '#E91E63' },    // House - pink
    '🗺️': { bg: 'rgba(156, 39, 176, 0.35)', border: '#9C27B0' },   // Map - purple
  };

  // Fallback colors for accounts without emoji matches
  const fallbackColors = [
    { bg: 'rgba(148, 180, 159, 0.4)', border: '#94B49F' },
    { bg: 'rgba(152, 193, 217, 0.4)', border: '#98C1D9' },
    { bg: 'rgba(125, 107, 145, 0.4)', border: '#7D6B91' },
    { bg: 'rgba(231, 111, 81, 0.4)', border: '#E76F51' },
    { bg: 'rgba(156, 102, 68, 0.4)', border: '#9C6644' },
    { bg: 'rgba(165, 201, 202, 0.4)', border: '#A5C9CA' },
    { bg: 'rgba(244, 162, 97, 0.4)', border: '#F4A261' },
    { bg: 'rgba(233, 196, 106, 0.4)', border: '#E9C46A' },
  ];

  const getColorForAccount = (accountName, index) => {
    // Check if account name starts with an emoji we recognize
    for (const [emoji, colors] of Object.entries(emojiColors)) {
      if (accountName.includes(emoji)) {
        return colors;
      }
    }
    // Fallback to indexed colors
    return fallbackColors[index % fallbackColors.length];
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const { start, end } = getDateRange(selectedRange);
        const data = await fetchSavingsHistory(start, end);

        if (!data.dates || data.dates.length === 0) {
          setChartData(null);
          setLoading(false);
          return;
        }

        const accountNames = Object.keys(data.accounts || {});

        // Store raw data for recalculating totals
        rawAccountData.current = {
          accounts: data.accounts,
          numPoints: data.dates.length,
        };

        // Reset hidden datasets when data changes
        setHiddenDatasets(new Set());

        const datasets = accountNames.map((name, index) => {
          const colors = getColorForAccount(name, index);
          return {
            label: name,
            data: data.accounts[name],
            fill: false, // Disabled fill to avoid overlap artifacts
            backgroundColor: colors.bg,
            borderColor: colors.border,
            borderWidth: 2.5,
            tension: 0.3,
            pointRadius: data.dates.length < 20 ? 2 : 0,
            pointHoverRadius: 5,
            pointBackgroundColor: colors.border,
            isAccountData: true, // Mark as account data for legend handling
          };
        });

        // Add total line
        datasets.push({
          label: 'Total Savings',
          data: data.totals,
          fill: false,
          backgroundColor: 'rgba(45, 48, 51, 0.1)',
          borderColor: '#2D3033',
          borderWidth: 3,
          borderDash: [5, 5],
          tension: 0.4,
          pointRadius: data.dates.length < 15 ? 4 : 0,
          pointHoverRadius: 8,
          pointBackgroundColor: '#2D3033',
          isAccountData: false, // This is the total, not an account
        });

        // Format labels with year when data spans multiple years
        const years = new Set(data.dates.map(d => new Date(d).getFullYear()));
        const showYear = years.size > 1;

        // Calculate fixed Y-axis max from total savings (with some padding)
        const maxTotal = Math.max(...data.totals);
        setYAxisMax(Math.ceil(maxTotal * 1.1 / 1000) * 1000); // Round up to nearest 1000 with 10% padding

        setChartData({
          labels: data.dates.map(d => {
            const date = new Date(d);
            if (showYear) {
              return date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: '2-digit' });
            }
            return date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
          }),
          datasets,
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedRange]);

  // Custom legend click handler to recalculate totals
  const handleLegendClick = useCallback((e, legendItem, legend) => {
    const index = legendItem.datasetIndex;
    const chart = legend.chart;
    const dataset = chart.data.datasets[index];

    // Don't allow hiding the Total Savings line via legend
    if (!dataset.isAccountData) {
      return;
    }

    // Check current visibility and toggle
    const isCurrentlyVisible = chart.isDatasetVisible(index);
    const willBeVisible = !isCurrentlyVisible;
    chart.setDatasetVisibility(index, willBeVisible);

    // Update hidden datasets and recalculate totals
    const newHidden = new Set(hiddenDatasets);
    if (willBeVisible) {
      newHidden.delete(index);
    } else {
      newHidden.add(index);
    }
    setHiddenDatasets(newHidden);

    // Recalculate totals immediately
    if (rawAccountData.current) {
      const { accounts, numPoints } = rawAccountData.current;
      const accountNames = Object.keys(accounts);
      const newTotals = new Array(numPoints).fill(0);

      accountNames.forEach((name, idx) => {
        if (!newHidden.has(idx)) {
          accounts[name].forEach((val, i) => {
            newTotals[i] += (val || 0);
          });
        }
      });

      // Update the Total Savings dataset (last dataset)
      const totalDatasetIndex = chart.data.datasets.length - 1;
      chart.data.datasets[totalDatasetIndex].data = newTotals;
      chart.update('none');
    }
  }, [hiddenDatasets]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          padding: 16,
          font: {
            family: "'Inter', sans-serif",
            size: 12,
          },
          boxWidth: 8,
          boxHeight: 8,
          // Filter out Total Savings from legend if you want, or keep it
          filter: (legendItem) => true,
        },
        onClick: handleLegendClick,
      },
      tooltip: {
        backgroundColor: 'white',
        titleColor: '#2D3033',
        bodyColor: '#2D3033',
        borderColor: '#F2E9E4',
        borderWidth: 1,
        padding: 12,
        titleFont: {
          size: 13,
          weight: '600',
        },
        bodyFont: {
          size: 12,
        },
        callbacks: {
          label: (context) => `${context.dataset.label}: ${formatCurrency(context.raw)}`,
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            family: "'Inter', sans-serif",
            size: 11,
          },
          maxRotation: 45,
          minRotation: 0,
          autoSkip: true,
          maxTicksLimit: 12,
        },
      },
      y: {
        min: 0, // Lock y-axis to never go below 0 for savings
        max: yAxisMax, // Fixed max so toggling accounts doesn't rescale
        beginAtZero: true,
        ticks: {
          callback: (value) => formatCurrency(value),
          font: {
            family: "'Inter', sans-serif",
            size: 11,
          },
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
      },
    },
  };

  const rangeButtons = [
    { value: '1m', label: '1M' },
    { value: '3m', label: '3M' },
    { value: '6m', label: '6M' },
    { value: '1y', label: '1Y' },
    { value: 'all', label: 'All' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '18px', fontWeight: '600' }}>
          Savings Growth
        </h3>
        <div style={{
          display: 'flex',
          gap: '4px',
          background: 'var(--welcoming-cream)',
          padding: '4px',
          borderRadius: '20px'
        }}>
          {rangeButtons.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setSelectedRange(value)}
              style={{
                padding: '6px 14px',
                border: 'none',
                borderRadius: '16px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                background: selectedRange === value ? 'var(--welcoming-green)' : 'transparent',
                color: selectedRange === value ? 'white' : 'var(--text-light)',
                transition: 'all 0.2s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{
        background: 'var(--welcoming-cream)',
        borderRadius: '12px',
        padding: '24px',
        height: '500px',
      }}>
        {loading ? (
          <div style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-light)',
          }}>
            Loading savings data...
          </div>
        ) : error ? (
          <div style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent)',
          }}>
            Error: {error}
          </div>
        ) : !chartData ? (
          <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-light)',
            gap: '12px',
          }}>
            <span style={{ fontSize: '48px' }}>📊</span>
            <span style={{ fontWeight: '500' }}>No savings history yet</span>
            <span style={{ fontSize: '13px', textAlign: 'center', maxWidth: '300px' }}>
              Balance snapshots are recorded daily. Check back tomorrow to see your savings trend!
            </span>
          </div>
        ) : chartData.labels.length === 1 ? (
          <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-light)',
            gap: '12px',
          }}>
            <span style={{ fontSize: '48px' }}>🌱</span>
            <span style={{ fontWeight: '500' }}>Just getting started!</span>
            <span style={{ fontSize: '13px', textAlign: 'center', maxWidth: '300px' }}>
              You have 1 balance snapshot. The chart will show trends once more daily snapshots are recorded.
            </span>
            <div style={{
              marginTop: '12px',
              fontSize: '24px',
              fontWeight: '700',
              color: 'var(--welcoming-green)'
            }}>
              {formatCurrency(chartData.datasets[chartData.datasets.length - 1].data[0])}
            </div>
          </div>
        ) : (
          <Line ref={chartRef} data={chartData} options={options} />
        )}
      </div>
    </div>
  );
};

export default SavingsChart;
