import React, { useState } from 'react';

function RealSapOrders() {
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState(null);
  const [searchForm, setSearchForm] = useState({
    plant: '',
    limit: 50
  });

  const handleSearchChange = (e) => {
    setSearchForm({
      ...searchForm,
      [e.target.name]: e.target.value
    });
  };

  const getRealSapOrders = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    setOrders([]);

    try {
      console.log('[Real SAP] Loading real SAP data from API...');

      // Build query parameters
      const params = new URLSearchParams();
      if (searchForm.plant) {
        params.append('plant', searchForm.plant);
      }
      if (searchForm.limit) {
        params.append('limit', searchForm.limit);
      }

      // Call the backend API endpoint (proxied through Vite)
      const response = await fetch(`/api/real-sap-orders?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load SAP data: ${response.status} ${response.statusText}`);
      }

      const sapData = await response.json();
      console.log('[Real SAP] Loaded SAP data:', sapData);

      if (!sapData.success) {
        throw new Error(sapData.message || 'Failed to load SAP data');
      }

      if (sapData.orders && Array.isArray(sapData.orders)) {
        console.log(`[Real SAP] SUCCESS: Loaded ${sapData.orders.length} REAL SAP orders`);
        console.log(`[Real SAP] Data source: ${sapData.source}`);
        console.log(`[Real SAP] Last updated: ${sapData.timestamp}`);
        
        setOrders(sapData.orders);
      } else {
        throw new Error('No production order data found in SAP response');
      }

    } catch (err) {
      console.error('[Real SAP] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED': return '#4caf50';
      case 'RELEASED': return '#2196f3';
      case 'IN_PROGRESS': return '#ff9800';
      case 'CREATED': return '#9e9e9e';
      default: return '#666';
    }
  };

  return (
    <div className="page">
      <h2>🎯 Real SAP Production Orders (NO SIMULATION)</h2>
      
      <div style={{ 
        background: '#e3f2fd', 
        padding: '1rem', 
        borderRadius: '4px', 
        marginBottom: '2rem',
        border: '1px solid #2196f3'
      }}>
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#1976d2' }}>✅ Real SAP Integration via Kiro Bridge</h3>
        <p style={{ margin: 0, color: '#666' }}>
          This page displays REAL data from your SAP system, fetched via Kiro's MCP integration and saved to a data file.
          No simulation, no fallback - only authentic SAP production orders from your AUFK table.
        </p>
        <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#1976d2' }}>
          💡 To refresh data: Run the Kiro bridge script to fetch latest SAP data
        </div>
      </div>

      <form onSubmit={getRealSapOrders} style={{ marginBottom: '2rem' }}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="plant">Plant (Optional)</label>
            <input
              type="text"
              id="plant"
              name="plant"
              value={searchForm.plant}
              onChange={handleSearchChange}
              placeholder="e.g., 0001, 0002"
            />
          </div>

          <div className="form-group">
            <label htmlFor="limit">Max Records</label>
            <select
              id="limit"
              name="limit"
              value={searchForm.limit}
              onChange={handleSearchChange}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? '🔄 Loading Real SAP Data...' : '🎯 Load Real SAP Production Orders'}
        </button>
      </form>

      {/* Results */}
      {orders.length > 0 && (
        <div className="result-section">
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '1rem',
            padding: '1rem',
            background: '#e8f5e9',
            borderRadius: '4px',
            border: '1px solid #4caf50'
          }}>
            <div>
              <h3 style={{ margin: 0, color: '#2e7d32' }}>✅ Real SAP Production Orders</h3>
              <div style={{ marginTop: '0.25rem', color: '#666', fontSize: '0.9rem' }}>
                Real SAP AUFK table • Via Kiro Bridge • NO SIMULATION
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#2e7d32' }}>
                {orders.length} Real Orders
              </div>
              <div style={{ fontSize: '0.8rem', color: '#666' }}>
                From SAP System
              </div>
            </div>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#2e7d32', color: 'white' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Order ID</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Material</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Plant</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Order Qty</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Source</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, index) => (
                  <tr 
                    key={index}
                    style={{ 
                      background: index % 2 === 0 ? 'white' : '#f9f9f9',
                      borderBottom: '1px solid #eee'
                    }}
                  >
                    <td style={{ padding: '0.75rem', fontWeight: 'bold', color: '#2e7d32' }}>
                      {order.PRODUCTION_ORDER}
                    </td>
                    <td style={{ padding: '0.75rem' }}>{order.MATERIAL}</td>
                    <td style={{ padding: '0.75rem' }}>{order.PLANT}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      {parseFloat(order.ORDER_QUANTITY).toLocaleString()}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{ 
                        color: getStatusColor(order.STATUS), 
                        fontWeight: 'bold',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '12px',
                        background: `${getStatusColor(order.STATUS)}20`,
                        fontSize: '0.8rem'
                      }}>
                        {order.STATUS}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{ 
                        background: '#2e7d32',
                        color: 'white',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '12px',
                        fontSize: '0.7rem'
                      }}>
                        REAL SAP
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>🔄 Loading real data from SAP system...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="alert alert-error">
          <strong>❌ SAP Data Loading Error:</strong> {error}
          <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
            💡 Make sure the Kiro bridge has been run to fetch fresh SAP data.
          </div>
        </div>
      )}

      {/* No Results */}
      {!loading && !error && orders.length === 0 && (
        <div className="alert" style={{ background: '#f0f0f0', color: '#666' }}>
          Click "Load Real SAP Production Orders" to display authentic data from your SAP system.
        </div>
      )}
    </div>
  );
}

export default RealSapOrders;