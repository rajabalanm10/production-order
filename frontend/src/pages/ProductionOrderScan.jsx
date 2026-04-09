import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function ProductionOrderScan() {
  const [orderNumber, setOrderNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleScan = async (e) => {
    e.preventDefault();
    
    if (!orderNumber.trim()) {
      setError('Please enter a production order number');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Validate order exists in SAP
      const response = await fetch(`/api/production-orders/${orderNumber}`);
      const data = await response.json();

      if (data.success) {
        // Navigate to execution flow with order data
        navigate(`/production-execution/${orderNumber}`, {
          state: { orderData: data.data }
        });
      } else {
        setError(data.error || 'Production order not found in SAP');
      }
    } catch (err) {
      setError(err.message || 'Failed to validate production order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>🔍 Scan Production Order</h2>
        <p className="page-description">Start the production execution flow by scanning or entering a production order number</p>
      </div>

      <div style={{ 
        maxWidth: '600px', 
        margin: '2rem auto',
        padding: '2rem',
        background: '#f9f9f9',
        borderRadius: '8px',
        border: '2px solid #1976d2'
      }}>
        <form onSubmit={handleScan}>
          <div className="form-group">
            <label htmlFor="orderNumber" style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
              Production Order Number *
            </label>
            <input
              type="text"
              id="orderNumber"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="Enter or scan order number (e.g., 000060005121)"
              required
              autoFocus
              style={{
                fontSize: '1.2rem',
                padding: '1rem',
                textAlign: 'center',
                fontFamily: 'monospace'
              }}
            />
            <small style={{ color: '#666', fontSize: '0.9rem' }}>
              Use barcode scanner or enter manually
            </small>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
            style={{ 
              width: '100%', 
              padding: '1rem', 
              fontSize: '1.1rem',
              marginTop: '1rem'
            }}
          >
            {loading ? '🔄 Validating...' : '✓ Start Production Flow'}
          </button>
        </form>

        {error && (
          <div className="alert alert-error" style={{ marginTop: '1rem' }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        <div style={{ 
          marginTop: '2rem', 
          padding: '1rem', 
          background: '#e3f2fd', 
          borderRadius: '4px',
          fontSize: '0.9rem'
        }}>
          <strong style={{ color: '#1976d2' }}>📋 Production Flow Steps:</strong>
          <ol style={{ marginTop: '0.5rem', marginBottom: 0, paddingLeft: '1.5rem' }}>
            <li>View Order Details</li>
            <li>Issue Components (261)</li>
            <li>Confirm Production</li>
            <li>Post Goods Receipt (101)</li>
            <li>Technical Completion (TECO)</li>
          </ol>
        </div>
      </div>

      {loading && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(255, 255, 255, 0.95)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div className="loading">
            <div className="spinner"></div>
            <p>Validating production order...</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductionOrderScan;
