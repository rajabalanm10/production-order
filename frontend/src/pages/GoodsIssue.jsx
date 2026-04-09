import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function GoodsIssue() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const prefilledOrderId = location.state?.orderId || '';
  const prefilledOrderData = location.state?.orderData || null;

  const [productionOrderId, setProductionOrderId] = useState(prefilledOrderId);
  const [components, setComponents] = useState([]);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [issuedQuantity, setIssuedQuantity] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingComponents, setLoadingComponents] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (prefilledOrderId) {
      loadComponents(prefilledOrderId);
    }
  }, [prefilledOrderId]);

  const loadComponents = async (orderId) => {
    if (!orderId) return;
    
    setLoadingComponents(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/goods-issue/components/${orderId}`);
      const data = await response.json();
      
      if (data.success) {
        setComponents(data.data || []);
        if (data.data.length === 0) {
          setError('No components found for this order or all components already issued.');
        }
      } else {
        setError(data.error || 'Failed to load components');
      }
    } catch (err) {
      setError(err.message || 'Network error occurred');
    } finally {
      setLoadingComponents(false);
    }
  };

  const handleLoadComponents = () => {
    loadComponents(productionOrderId);
  };

  const handleSelectComponent = (component) => {
    setSelectedComponent(component);
    setIssuedQuantity(component.remainingQuantity);
    setResult(null);
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedComponent) {
      setError('Please select a component to issue');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/goods-issue/post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          productionOrderId: productionOrderId,
          material: selectedComponent.material,
          plant: selectedComponent.plant,
          issuedQuantity: issuedQuantity,
          storageLocation: selectedComponent.storageLocation,
          reservationNumber: selectedComponent.reservationNumber,
          itemNumber: selectedComponent.itemNumber
        })
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
        // Reload components to show updated quantities
        setTimeout(() => loadComponents(productionOrderId), 1000);
      } else {
        setError(data.error || 'Failed to post goods issue');
      }
    } catch (err) {
      setError(err.message || 'Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedComponent(null);
    setIssuedQuantity('');
    setResult(null);
    setError(null);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Goods Issue (Movement Type 261)</h2>
        <p className="page-description">Issue components to production orders</p>
      </div>

      {/* Order Input Section */}
      <div style={{ marginBottom: '2rem' }}>
        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label htmlFor="productionOrderId">Production Order ID *</label>
            <input
              type="text"
              id="productionOrderId"
              value={productionOrderId}
              onChange={(e) => setProductionOrderId(e.target.value)}
              placeholder="Enter production order number"
              disabled={loadingComponents}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button 
              type="button"
              className="btn btn-primary"
              onClick={handleLoadComponents}
              disabled={!productionOrderId || loadingComponents}
            >
              {loadingComponents ? 'Loading...' : 'Load Components'}
            </button>
          </div>
        </div>
      </div>

      {/* Components Table */}
      {components.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ color: '#1976d2', marginBottom: '1rem' }}>Available Components</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#1976d2', color: 'white' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Material</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Required</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Withdrawn</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right' }}>Remaining</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Unit</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Storage Loc</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {components.map((comp, idx) => (
                  <tr 
                    key={idx} 
                    style={{ 
                      background: selectedComponent === comp ? '#e3f2fd' : (idx % 2 === 0 ? 'white' : '#f9f9f9'),
                      cursor: 'pointer'
                    }}
                    onClick={() => handleSelectComponent(comp)}
                  >
                    <td style={{ padding: '0.75rem' }}>{comp.material}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      {parseFloat(comp.requiredQuantity).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      {parseFloat(comp.withdrawnQuantity).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', color: '#ff9800' }}>
                      {parseFloat(comp.remainingQuantity).toFixed(2)}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>{comp.unit}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>{comp.storageLocation}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectComponent(comp);
                        }}
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Issue Form */}
      {selectedComponent && (
        <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
          <h3 style={{ color: '#1976d2', marginBottom: '1rem' }}>Issue Component</h3>
          
          <div style={{ 
            background: '#f9f9f9', 
            padding: '1rem', 
            borderRadius: '8px',
            marginBottom: '1rem'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <strong>Material:</strong>
                <div>{selectedComponent.material}</div>
              </div>
              <div>
                <strong>Plant:</strong>
                <div>{selectedComponent.plant}</div>
              </div>
              <div>
                <strong>Storage Location:</strong>
                <div>{selectedComponent.storageLocation}</div>
              </div>
              <div>
                <strong>Remaining Quantity:</strong>
                <div style={{ color: '#ff9800', fontWeight: 'bold' }}>
                  {parseFloat(selectedComponent.remainingQuantity).toFixed(2)} {selectedComponent.unit}
                </div>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="issuedQuantity">Quantity to Issue *</label>
            <input
              type="number"
              id="issuedQuantity"
              value={issuedQuantity}
              onChange={(e) => setIssuedQuantity(e.target.value)}
              required
              min="0"
              step="0.01"
              max={selectedComponent.remainingQuantity}
              placeholder="Enter quantity to issue"
            />
            <small style={{ color: '#666', fontSize: '0.85rem' }}>
              Maximum: {parseFloat(selectedComponent.remainingQuantity).toFixed(2)} {selectedComponent.unit}
            </small>
          </div>

          <div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Processing...' : 'Post Goods Issue'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={handleReset}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Posting goods issue...</p>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="result-section">
          <h3>Goods Issue Result</h3>
          
          <div className="alert alert-success">
            {result.message}
          </div>

          <div className="result-item">
            <strong>Material Document:</strong>
            <div style={{ fontSize: '1.2rem', color: '#1976d2', fontFamily: 'monospace' }}>
              {result.materialDocument}
            </div>
          </div>

          {result.documentYear && (
            <div className="result-item">
              <strong>Document Year:</strong>
              <div>{result.documentYear}</div>
            </div>
          )}

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
        </div>
      )}
    </div>
  );
}

export default GoodsIssue;
