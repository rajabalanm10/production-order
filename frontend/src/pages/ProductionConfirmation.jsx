import React, { useState } from 'react';

function ProductionConfirmation() {
  const [formData, setFormData] = useState({
    productionOrderId: '',
    plant: '',
    material: '',
    yieldQuantity: '',
    scrapQuantity: '',
    workCenter: '',
    confirmationType: 'P'
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/production-confirmation/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
        console.log('[Production Confirmation] ✅ Posted to SAP successfully');
      } else {
        // Show detailed error from SAP
        let errorMsg = data.error || 'Failed to confirm production order';
        
        // Add helpful hints based on error type
        if (errorMsg.includes('not released')) {
          errorMsg += '\n\nThe production order must be released in SAP before it can be confirmed. Please release the order first.';
        } else if (errorMsg.includes('work center') || errorMsg.includes('operation')) {
          errorMsg += '\n\nWork center or operation information may be required. Please provide these details.';
        }
        
        setError(errorMsg);
      }
    } catch (err) {
      setError(err.message || 'Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      productionOrderId: '',
      plant: '',
      material: '',
      yieldQuantity: '',
      scrapQuantity: '',
      workCenter: '',
      confirmationType: 'P'
    });
    setResult(null);
    setError(null);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Production Order Confirmation</h2>
        <p className="page-description">Confirm production order completion and record yield quantities</p>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="productionOrderId">Production Order ID *</label>
            <input
              type="text"
              id="productionOrderId"
              name="productionOrderId"
              value={formData.productionOrderId}
              onChange={handleChange}
              required
              placeholder="Enter production order number"
            />
          </div>

          <div className="form-group">
            <label htmlFor="plant">Plant *</label>
            <input
              type="text"
              id="plant"
              name="plant"
              value={formData.plant}
              onChange={handleChange}
              required
              placeholder="Enter plant code"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="material">Material (Optional)</label>
            <input
              type="text"
              id="material"
              name="material"
              value={formData.material}
              onChange={handleChange}
              placeholder="Optional"
            />
          </div>

          <div className="form-group">
            <label htmlFor="workCenter">Work Center</label>
            <input
              type="text"
              id="workCenter"
              name="workCenter"
              value={formData.workCenter}
              onChange={handleChange}
              placeholder="Enter work center"
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="yieldQuantity">Yield Quantity (Confirmed) *</label>
            <input
              type="number"
              id="yieldQuantity"
              name="yieldQuantity"
              value={formData.yieldQuantity}
              onChange={handleChange}
              required
              min="0"
              step="0.01"
              placeholder="Enter confirmed quantity"
            />
          </div>

          <div className="form-group">
            <label htmlFor="scrapQuantity">Scrap Quantity</label>
            <input
              type="number"
              id="scrapQuantity"
              name="scrapQuantity"
              value={formData.scrapQuantity}
              onChange={handleChange}
              min="0"
              step="0.01"
              placeholder="Enter scrap quantity"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="confirmationType">Confirmation Type *</label>
          <select
            id="confirmationType"
            name="confirmationType"
            value={formData.confirmationType}
            onChange={handleChange}
            required
          >
            <option value="P">Partial</option>
            <option value="F">Final</option>
          </select>
        </div>

        <div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Processing...' : 'Confirm Production Order'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleReset}>
            Reset
          </button>
        </div>
      </form>

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Confirming production order...</p>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="result-section">
          <h3>Confirmation Result</h3>
          
          <div className="alert alert-success">
            {result.message}
          </div>

          <div className="result-item">
            <strong>Confirmation ID:</strong>
            <div>{result.confirmationId}</div>
          </div>

          <div className="result-item">
            <strong>Selected BAPI:</strong>
            <div>{result.selectedBAPI}</div>
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
        </div>
      )}
    </div>
  );
}

export default ProductionConfirmation;
