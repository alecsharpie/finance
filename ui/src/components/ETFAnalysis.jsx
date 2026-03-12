import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { fetchETFAnalysis } from '../services/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const ETFAnalysis = () => {
  const [etfData, setEtfData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchETFAnalysis();
        setEtfData(data.etfs || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const createChartData = (analysis) => {
    if (!analysis.has_data || !analysis.data_points.length) return null;

    return {
      labels: analysis.data_points.map(p => {
        const date = new Date(p.date);
        return date.toLocaleDateString('en-AU', { month: 'short', year: '2-digit' });
      }),
      datasets: [
        {
          label: 'Actual Price',
          data: analysis.data_points.map(p => p.price),
          borderColor: '#2c3e50',
          backgroundColor: 'rgba(44, 62, 80, 0.1)',
          borderWidth: 2,
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 5,
          fill: false,
        },
        {
          label: 'Prediction',
          data: analysis.trend_line.map(p => p.price),
          borderColor: '#34495e',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [6, 4],
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 5,
          fill: false,
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          usePointStyle: true,
          padding: 16,
          font: { family: "'DM Sans', sans-serif", size: 12 },
          color: '#7f8c8d',
          boxWidth: 8,
        },
      },
      tooltip: {
        backgroundColor: '#1A1D27',
        titleColor: '#E8E9ED',
        bodyColor: '#9CA3AF',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        padding: 12,
        titleFont: { size: 13, weight: '600', family: "'DM Sans', sans-serif" },
        bodyFont: { size: 12, family: "'JetBrains Mono', monospace" },
        callbacks: {
          label: (context) => `${context.dataset.label}: ${formatCurrency(context.raw)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { family: "'DM Sans', sans-serif", size: 10 },
          color: '#7f8c8d',
          maxRotation: 45,
          autoSkip: true,
          maxTicksLimit: 10,
        },
      },
      y: {
        ticks: {
          callback: (value) => formatCurrency(value),
          font: { family: "'JetBrains Mono', monospace", size: 11 },
          color: '#7f8c8d',
        },
        grid: { color: 'rgba(236, 240, 241, 0.7)' },
      },
    },
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner} />
        <span style={styles.loadingText}>Loading ETF data from Yahoo Finance...</span>
        <span style={styles.loadingSubtext}>This may take a moment as we fetch historical data</span>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>Error loading ETF data</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{error}</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <h1 style={styles.title}>Simple ETF Analysis</h1>
          <p style={styles.description}>
            Linear regression analysis of ETF price trends. This analysis assumes the price will revert to the mean.
            Green indicates price is below prediction (potentially undervalued), red indicates above prediction (potentially overvalued).
          </p>
        </div>
      </div>

      {/* ETF Cards */}
      {etfData.map((etf) => (
        <div key={etf.ticker} style={styles.etfCard}>
          {/* ETF Title */}
          <div style={styles.etfHeader}>
            <h2 style={styles.etfTitle}>{etf.title} ({etf.ticker})</h2>
            <p style={styles.etfSubtitle}>{etf.name} ({etf.etf_type})</p>
            <p style={styles.etfDescription}>{etf.description}</p>
          </div>

          {/* Period Charts Grid */}
          <div className="etf-charts-grid" style={styles.chartsGrid}>
            {etf.analyses.map((analysis) => {
              const chartData = createChartData(analysis);

              return (
                <div key={analysis.period} style={styles.chartCard}>
                  {/* Period Title & Badge */}
                  <div style={styles.chartHeader}>
                    <span style={styles.periodTitle}>{analysis.period}</span>
                    {analysis.has_data && (
                      <span style={{
                        ...styles.badge,
                        backgroundColor: analysis.direction === 'below' ? '#2ecc71' : '#e74c3c',
                      }}>
                        Price is {Math.abs(analysis.delta_percent).toFixed(2)}% {analysis.direction} prediction
                      </span>
                    )}
                  </div>

                  {/* Chart */}
                  {chartData ? (
                    <div style={styles.chartContainer}>
                      <Line data={chartData} options={chartOptions} />
                    </div>
                  ) : (
                    <div style={styles.noData}>
                      Insufficient data for this period
                    </div>
                  )}

                  {/* CAGR Info */}
                  {analysis.has_data && (
                    <div style={styles.cagrInfo}>
                      <span style={styles.cagrLabel}>CAGR:</span>
                      <span style={styles.cagrValue}>{analysis.cagr}%</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Disclaimer */}
      <div style={styles.disclaimer}>
        <strong>Disclaimer:</strong> This analysis assumes price mean reversion based on linear regression.
        This is not financial advice. Past performance does not indicate future results.
        Always do your own research before making investment decisions.
      </div>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 20px',
    color: 'var(--text-muted)',
    gap: '16px',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '4px solid var(--border)',
    borderTopColor: 'var(--accent)',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    fontSize: '16px',
    fontWeight: '500',
  },
  loadingSubtext: {
    fontSize: '14px',
    opacity: 0.7,
  },
  errorContainer: {
    padding: '60px 20px',
    textAlign: 'center',
    color: 'var(--negative)',
  },
  header: {
    background: 'var(--bg-card)',
    padding: '48px 40px',
    borderRadius: '16px',
    textAlign: 'center',
    border: '1px solid var(--border)',
    position: 'relative',
    overflow: 'hidden',
  },
  headerContent: {
    position: 'relative',
    zIndex: 2,
  },
  title: {
    margin: '0 0 16px 0',
    fontSize: '32px',
    fontWeight: '600',
    color: 'var(--text)',
  },
  description: {
    margin: 0,
    fontSize: '15px',
    color: 'var(--text-muted)',
    maxWidth: '700px',
    marginLeft: 'auto',
    marginRight: 'auto',
    lineHeight: '1.6',
  },
  etfCard: {
    background: 'var(--bg-card)',
    borderRadius: '16px',
    padding: '28px',
    border: '1px solid var(--border)',
  },
  etfHeader: {
    marginBottom: '24px',
  },
  etfTitle: {
    margin: '0 0 8px 0',
    fontSize: '24px',
    fontWeight: '600',
    color: 'var(--text)',
  },
  etfSubtitle: {
    margin: '0 0 8px 0',
    fontSize: '14px',
    color: 'var(--text-muted)',
  },
  etfDescription: {
    margin: 0,
    fontSize: '14px',
    color: 'var(--text-muted)',
    opacity: 0.8,
  },
  chartsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '20px',
  },
  chartCard: {
    background: 'var(--bg-surface)',
    borderRadius: '12px',
    padding: '20px',
    border: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
  },
  chartHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '16px',
  },
  periodTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--text)',
  },
  badge: {
    display: 'inline-block',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    color: 'white',
    alignSelf: 'flex-start',
  },
  chartContainer: {
    height: '220px',
    marginBottom: '12px',
  },
  noData: {
    height: '220px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-muted)',
    fontSize: '14px',
  },
  cagrInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: 'auto',
    paddingTop: '12px',
    borderTop: '1px solid var(--border)',
  },
  cagrLabel: {
    fontSize: '14px',
    color: 'var(--text-muted)',
  },
  cagrValue: {
    fontSize: '16px',
    fontWeight: '600',
    color: 'var(--text)',
    fontFamily: 'var(--font-mono)',
  },
  disclaimer: {
    padding: '20px 24px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    fontSize: '13px',
    color: 'var(--text-muted)',
    lineHeight: '1.6',
  },
};

// Add responsive styles via CSS
const responsiveStyles = `
  @media (max-width: 1200px) {
    .etf-charts-grid {
      grid-template-columns: repeat(2, 1fr) !important;
    }
  }
  @media (max-width: 768px) {
    .etf-charts-grid {
      grid-template-columns: 1fr !important;
    }
  }
`;

// Inject responsive styles
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.textContent = responsiveStyles;
  if (!document.getElementById('etf-responsive-styles')) {
    styleEl.id = 'etf-responsive-styles';
    document.head.appendChild(styleEl);
  }
}

export default ETFAnalysis;
