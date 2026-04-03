import React, { useState } from 'react';

function GoodsReceipt() {
  const [formData, setFormData] = useState({
    productionOrderId: '',
    material: '',
    plant: '',
    receivedQuantity: '',
    storageLocation: ''
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
      const response = await fetch('/api/goods-receipt/post', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Failed to post goods receipt');
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
      material: '',
      plant: '',
      receivedQuantity: '',
      storageLocation: ''
    });
    setResult(null);
    setError(null);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Goods Receipt</h2>
        <p className="page-description">Post goods receipt for completed production orders</p>
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
            <label htmlFor="material">Material *</label>
            <input
              type="text"
              id="material"
              name="material"
              value={formData.material}
              onChange={handleChange}
              required
              placeholder="Enter material number"
            />
          </div>
        </div>

        <div className="form-row">
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

          <div className="form-group">
            <label htmlFor="storageLocation">Storage Location</label>
            <input
              type="text"
              id="storageLocation"
              name="storageLocation"
              value={formData.storageLocation}
              onChange={handleChange}
              placeholder="Enter storage location"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="receivedQuantity">Received Quantity *</label>
          <input
            type="number"
            id="receivedQuantity"
            name="receivedQuantity"
            value={formData.receivedQuantity}
            onChange={handleChange}
            required
            min="0"
            step="0.01"
            placeholder="Enter received quantity"
          />
        </div>

        <div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Processing...' : 'Post Goods Receipt'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleReset}>
            Reset
          </button>
        </div>
      </form>

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Posting goods receipt...</p>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="result-section">
          <h3>Goods Receipt Result</h3>
          
          <div className="alert alert-success">
            {result.message}
          </div>

          <div className="result-item">
            <strong>Receipt ID:</strong>
            <div>{result.receiptId}</div>
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

export default GoodsReceipt;
