import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function TechnicalCompletion() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const prefilledOrderId = location.state?.orderId || '';
  const prefilledOrderData = location.state?.orderData || null;

  const [productionOrderId, setProductionOrderId] = useState(prefilledOrderId);
  const [orderStatus, setOrderStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (prefilledOrderId) {
      checkOrderStatus(prefilledOrderId);
    }
  }, [prefilledOrderId]);

  const checkOrderStatus = async (orderId) => {
    if (!orderId) return;
    
    setLoadingStatus(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/technical-completion/status/${orderId}`);
      const data = await response.json();
      
      if (data.success) {
        setOrderStatus(data);
      } else {
        setError(data.error || 'Failed to check order status');
      }
    } catch (err) {
      setError(err.message || 'Network error occurred');
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleCheckStatus = () => {
    checkOrderStatus(productionOrderId);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!productionOrderId) {
      setError('Please enter a production order ID');
      return;
    }

    // Confirm action
    if (!window.confirm(
      `⚠️ WARNING: Marking order ${productionOrderId} as technically complete (TECO) will prevent further postings.\n\nAre you sure you want to continue?`
    )) {
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/technical-completion/teco', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          productionOrderId: productionOrderId
        })
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
        // Reload status
        setTimeout(() => checkOrderStatus(productionOrderId), 1000);
      } else {
        setError(data.error || 'Failed to mark order as technically complete');
      }
    } catch (err) {
      setError(err.message || 'Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setProductionOrderId('');
    setOrderStatus(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Technical Completion (TECO)</h2>
        <p className="page-description">Mark production orders as technically complete</p>
      </div>

      {/* Warning Banner */}
      <div className="alert" style={{ background: '#fff3cd', color: '#856404', marginBottom: '2rem' }}>
        <strong>⚠️ Important:</strong> Technical completion (TECO) is a final step that prevents further postings to the production order. 
        Ensure all confirmations and goods movements are complete before proceeding.
      </div>

      {/* Order Input Section */}
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label htmlFor="productionOrderId">Production Order ID *</label>
            <input
              type="text"
              id="productionOrderId"
              value={productionOrderId}
              onChange={(e) => setProductionOrderId(e.target.value)}
              required
              placeholder="Enter production order number"
              disabled={loading}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
            <button 
              type="button"
              className="btn btn-secondary"
              onClick={handleCheckStatus}
              disabled={!productionOrderId || loadingStatus}
            >
              {loadingStatus ? 'Checking...' : 'Check Status'}
            </button>
          </div>
        </div>

        {/* Order Status Display */}
        {orderStatus && (
          <div style={{ 
            background: orderStatus.isTechnicallyComplete ? '#d4edda' : '#f9f9f9',
            padding: '1.5rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            border: orderStatus.isTechnicallyComplete ? '2px solid #28a745' : '1px solid #ddd'
          }}>
            <h3 style={{ 
              color: orderStatus.isTechnicallyComplete ? '#28a745' : '#1976d2',
              marginBottom: '1rem'
            }}>
              {orderStatus.isTechnicallyComplete ? '✓ Order is Technically Complete' : 'Order Status'}
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <strong>Production Order:</strong>
                <div style={{ fontSize: '1.2rem', fontFamily: 'monospace' }}>
                  {orderStatus.productionOrderId}
                </div>
              </div>
              <div>
                <strong>TECO Status:</strong>
                <div style={{ 
                  fontSize: '1.1rem', 
                  fontWeight: 'bold',
                  color: orderStatus.isTechnicallyComplete ? '#28a745' : '#ff9800'
                }}>
                  {orderStatus.isTechnicallyComplete ? 'COMPLETE' : 'NOT COMPLETE'}
                </div>
              </div>
            </div>

            {orderStatus.statuses && orderStatus.statuses.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <strong>Active Statuses:</strong>
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '0.5rem',
                  marginTop: '0.5rem'
                }}>
                  {orderStatus.statuses.map((status, idx) => (
                    <span 
                      key={idx}
                      style={{
                        padding: '0.25rem 0.75rem',
                        background: status === 'TECO' ? '#28a745' : '#1976d2',
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        fontWeight: 'bold'
                      }}
                    >
                      {status}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {orderStatus && !orderStatus.isTechnicallyComplete && (
          <div>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={loading}
              style={{ background: '#4caf50', borderColor: '#4caf50' }}
            >
              {loading ? 'Processing...' : '🏁 Mark as Technically Complete'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleReset}>
              Reset
            </button>
          </div>
        )}

        {orderStatus && orderStatus.isTechnicallyComplete && (
          <div className="alert alert-success">
            <strong>✓ This order is already technically complete.</strong>
            <p>No further action is required.</p>
          </div>
        )}

        {!orderStatus && (
          <div>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={loading}
              style={{ background: '#4caf50', borderColor: '#4caf50' }}
            >
              {loading ? 'Processing...' : '🏁 Mark as Technically Complete'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleReset}>
              Reset
            </button>
          </div>
        )}
      </form>

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Marking order as technically complete...</p>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="result-section">
          <h3>Technical Completion Result</h3>
          
          <div className="alert alert-success">
            {result.message}
          </div>

          <div className="result-item">
            <strong>Production Order:</strong>
            <div style={{ fontSize: '1.2rem', color: '#1976d2', fontFamily: 'monospace' }}>
              {result.productionOrderId}
            </div>
          </div>

          <div className="result-item">
            <strong>Request Payload:</strong>
            <pre className="code-block">
              {JSON.stringify(result.requestPayload, null, 2)}
            </pre>
          </div>

          <div className="result-item">
            <strong>SAP Response:</strong>
            <pre className="code-block">
              {JSON.stringify(result.sapResponse, null, 2)}
            </pre>
          </div>

          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <button 
              className="btn btn-primary"
              onClick={() => navigate('/production-orders')}
            >
              Return to Production Orders
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TechnicalCompletion;
