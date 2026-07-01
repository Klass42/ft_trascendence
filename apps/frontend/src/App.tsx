import { useState, useEffect } from 'react';

interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
}

export function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const checkHealth = async () => {
    setLoading(true);
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || '/api';
      const res = await fetch(`${backendUrl}/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setHealth(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes: number) =>
    `${(bytes / 1024 / 1024).toFixed(1)} MB`;

  return (
    <div className="container">
      <h1>ft_trascendence</h1>
      <p className="subtitle">Platform Health Monitor</p>

      <div className={`status-card ${health ? 'healthy' : error ? 'unhealthy' : 'loading'}`}>
        <div className="status-header">
          <span className="status-dot" />
          <span className="status-text">
            {loading ? 'Checking...' : health ? 'Backend Online' : 'Backend Offline'}
          </span>
        </div>

        {health && (
          <div className="status-details">
            <div className="detail-row">
              <span>Status</span>
              <span>{health.status}</span>
            </div>
            <div className="detail-row">
              <span>Uptime</span>
              <span>{Math.floor(health.uptime)}s</span>
            </div>
            <div className="detail-row">
              <span>Heap Used</span>
              <span>{formatBytes(health.memory.heapUsed)}</span>
            </div>
            <div className="detail-row">
              <span>RSS</span>
              <span>{formatBytes(health.memory.rss)}</span>
            </div>
            <div className="detail-row">
              <span>Last Check</span>
              <span>{new Date(health.timestamp).toLocaleTimeString()}</span>
            </div>
          </div>
        )}

        {error && (
          <div className="error-details">
            <p>Connection failed: {error}</p>
            <p className="hint">Is the backend running on port 3000?</p>
          </div>
        )}
      </div>

      <button onClick={checkHealth} disabled={loading} className="refresh-btn">
        {loading ? 'Checking...' : 'Refresh'}
      </button>

      <div className="links">
        <a href="http://localhost:3001" target="_blank" rel="noopener">Grafana</a>
        <a href="http://localhost:9090" target="_blank" rel="noopener">Prometheus</a>
      </div>
    </div>
  );
}
