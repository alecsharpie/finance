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
  const [yAxisMax, setYAxisMax] = useState(null);
  const chartRef = useRef(null);
  const rawAccountData = useRef(null);

  const getDateRange = (range) => {
    const end = new Date();
    const start = new Date();

    switch (range) {
      case '1m': start.setMonth(start.getMonth() - 1); break;
      case '3m': start.setMonth(start.getMonth() - 3); break;
      case '6m': start.setMonth(start.getMonth() - 6); break;
      case '1y': start.setFullYear(start.getFullYear() - 1); break;
      case 'all': start.setFullYear(2020); break;
      default: start.setMonth(start.getMonth() - 6);
    }

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
  };

  // Warm, rich colors for light backgrounds
  const emojiColors = {
    '\u{1F49B}': { bg: 'rgba(202, 138, 4, 0.12)', border: '#B8860B' },
    '\u{1FAA2}': { bg: 'rgba(160, 100, 45, 0.12)', border: '#8B6914' },
    '\u{1F4C8}': { bg: 'rgba(59, 130, 246, 0.12)', border: '#3B7DD8' },
    '\u{1F33F}': { bg: 'rgba(45, 142, 111, 0.12)', border: '#2D8E6F' },
    '\u{1F30A}': { bg: 'rgba(14, 165, 188, 0.12)', border: '#0E8DAC' },
    '\u{1F6B4}': { bg: 'rgba(194, 83, 58, 0.12)', border: '#C2533A' },
    '\u{1F3E0}': { bg: 'rgba(190, 75, 135, 0.12)', border: '#BE4B87' },
    '\u{1F5FA}\uFE0F': { bg: 'rgba(139, 92, 196, 0.12)', border: '#8B5CC4' },
  };

  const fallbackColors = [
    { bg: 'rgba(45, 142, 111, 0.12)', border: '#2D8E6F' },
    { bg: 'rgba(59, 130, 246, 0.12)', border: '#3B7DD8' },
    { bg: 'rgba(139, 92, 196, 0.12)', border: '#8B5CC4' },
    { bg: 'rgba(194, 83, 58, 0.12)', border: '#C2533A' },
    { bg: 'rgba(202, 138, 4, 0.12)', border: '#B8860B' },
    { bg: 'rgba(16, 163, 127, 0.12)', border: '#10A37F' },
    { bg: 'rgba(190, 75, 135, 0.12)', border: '#BE4B87' },
    { bg: 'rgba(196, 77, 77, 0.12)', border: '#C44D4D' },
  ];

  const getColorForAccount = (accountName, index) => {
    for (const [emoji, colors] of Object.entries(emojiColors)) {
      if (accountName.includes(emoji)) {
        return colors;
      }
    }
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

        rawAccountData.current = {
          accounts: data.accounts,
          numPoints: data.dates.length,
        };

        setHiddenDatasets(new Set());

        const datasets = accountNames.map((name, index) => {
          const colors = getColorForAccount(name, index);
          return {
            label: name,
            data: data.accounts[name],
            fill: false,
            backgroundColor: colors.bg,
            borderColor: colors.border,
            borderWidth: 2.5,
            tension: 0.3,
            pointRadius: data.dates.length < 20 ? 2 : 0,
            pointHoverRadius: 5,
            pointBackgroundColor: colors.border,
            isAccountData: true,
          };
        });

        datasets.push({
          label: 'Total Savings',
          data: data.totals,
          fill: false,
          backgroundColor: 'rgba(42, 42, 40, 0.08)',
          borderColor: '#2A2A28',
          borderWidth: 3,
          borderDash: [5, 5],
          tension: 0.4,
          pointRadius: data.dates.length < 15 ? 4 : 0,
          pointHoverRadius: 8,
          pointBackgroundColor: '#2A2A28',
          isAccountData: false,
        });

        const years = new Set(data.dates.map(d => new Date(d).getFullYear()));
        const showYear = years.size > 1;

        const maxTotal = Math.max(...data.totals);
        setYAxisMax(Math.ceil(maxTotal * 1.1 / 1000) * 1000);

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

  const handleLegendClick = useCallback((e, legendItem, legend) => {
    const index = legendItem.datasetIndex;
    const chart = legend.chart;
    const dataset = chart.data.datasets[index];

    if (!dataset.isAccountData) return;

    const isCurrentlyVisible = chart.isDatasetVisible(index);
    const willBeVisible = !isCurrentlyVisible;
    chart.setDatasetVisibility(index, willBeVisible);

    const newHidden = new Set(hiddenDatasets);
    if (willBeVisible) {
      newHidden.delete(index);
    } else {
      newHidden.add(index);
    }
    setHiddenDatasets(newHidden);

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
            family: "'Outfit', sans-serif",
            size: 12,
          },
          color: '#636360',
          boxWidth: 8,
          boxHeight: 8,
          filter: () => true,
        },
        onClick: handleLegendClick,
      },
      tooltip: {
        backgroundColor: '#FFFFFF',
        titleColor: '#2A2A28',
        bodyColor: '#636360',
        borderColor: 'rgba(0,0,0,0.08)',
        borderWidth: 1,
        padding: 12,
        titleFont: { size: 13, weight: '600', family: "'Outfit', sans-serif" },
        bodyFont: { size: 12, family: "'IBM Plex Mono', monospace" },
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        callbacks: {
          label: (context) => `${context.dataset.label}: ${formatCurrency(context.raw)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { family: "'Outfit', sans-serif", size: 11 },
          color: '#9A9A94',
          maxRotation: 45,
          minRotation: 0,
          autoSkip: true,
          maxTicksLimit: 12,
        },
      },
      y: {
        min: 0,
        max: yAxisMax,
        beginAtZero: true,
        ticks: {
          callback: (value) => formatCurrency(value),
          font: { family: "'IBM Plex Mono', monospace", size: 11 },
          color: '#9A9A94',
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.04)',
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
          background: 'var(--bg-surface)',
          padding: '4px',
          borderRadius: '10px',
          border: '1px solid var(--border)',
        }}>
          {rangeButtons.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setSelectedRange(value)}
              style={{
                padding: '6px 14px',
                border: 'none',
                borderRadius: '7px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                fontFamily: 'var(--font-mono)',
                background: selectedRange === value ? 'var(--accent)' : 'transparent',
                color: selectedRange === value ? 'white' : 'var(--text-muted)',
                transition: 'all 0.2s',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        padding: '24px',
        height: '500px',
      }}>
        {loading ? (
          <div style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-muted)',
          }}>
            Loading savings data...
          </div>
        ) : error ? (
          <div style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--negative)',
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
            color: 'var(--text-muted)',
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
            color: 'var(--text-muted)',
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
              color: 'var(--positive)',
              fontFamily: 'var(--font-mono)',
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
