import React, { useState, useEffect } from 'react';

function TestBapi() {
  const [formData, setFormData] = useState({
    confirmation: '',
    plant: ''
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [sampleData, setSampleData] = useState(null);

  // Load sample data on component mount
  useEffect(() => {
    fetchSampleData();
  }, []);

  const fetchSampleData = async () => {
    try {
      const response = await fetch('/api/test/sample-data');
      const data = await response.json();
      if (data.success) {
        setSampleData(data.sampleData);
      }
    } catch (err) {
      console.error('Failed to load sample data:', err);
    }
  };

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
      const response = await fetch('/api/test/prodordconf-detail', {
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
        setError(data.error || 'Failed to execute BAPI');
      }
    } catch (err) {
      setError(err.message || 'Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleUseSample = (sampleInput) => {
    setFormData(sampleInput);
  };

  const handleReset = () => {
    setFormData({
      confirmation: '',
      plant: ''
    });
    setResult(null);
    setError(null);
  };

  return (
    <div className="page">
      <h2>Test BAPI: BAPI_PRODORDCONF_GET_DETAIL</h2>
      
      <div className="alert alert-info" style={{background: '#e3f2fd', color: '#1565c0', marginBottom: '2rem'}}>
        <strong>Purpose:</strong> This BAPI retrieves detailed information about an existing production order confirmation in SAP.
      </div>

      {/* Sample Data Section */}
      {sampleData && (
        <div className="result-section" style={{marginBottom: '2rem'}}>
          <h3>Sample Test Cases</h3>
          <p>Click on any test case to populate the form:</p>
          {sampleData["BAPI_PRODORDCONF_GET_DETAIL"]?.testCases?.map((testCase, index) => (
            <div key={index} style={{marginBottom: '1rem'}}>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => handleUseSample(testCase.input)}
                style={{marginRight: '1rem'}}
              >
                Use: {testCase.name}
              </button>
              <span style={{color: '#666'}}>
                Confirmation: {testCase.input.confirmation}, Plant: {testCase.input.plant}
              </span>
            </div>
          ))}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="confirmation">Confirmation Number *</label>
            <input
              type="text"
              id="confirmation"
              name="confirmation"
              value={formData.confirmation}
              onChange={handleChange}
              required
              placeholder="e.g., 12345678"
              maxLength="8"
            />
            <small style={{color: '#666'}}>8-digit confirmation number</small>
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
              placeholder="e.g., 1000"
              maxLength="4"
            />
            <small style={{color: '#666'}}>4-character plant code</small>
          </div>
        </div>

        <div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Executing BAPI...' : 'Get Confirmation Details'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={handleReset}>
            Reset
          </button>
        </div>
      </form>

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Executing BAPI_PRODORDCONF_GET_DETAIL...</p>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="result-section">
          <h3>BAPI Execution Result</h3>
          
          <div className="alert alert-success">
            {result.message}
          </div>

          <div className="result-item">
            <strong>BAPI Name:</strong>
            <div>{result.bapi}</div>
          </div>

          <div className="result-item">
            <strong>Input Parameters:</strong>
            <pre className="code-block">
              {JSON.stringify(result.inputData, null, 2)}
            </pre>
          </div>

          <div className="result-item">
            <strong>SAP Response:</strong>
            <pre className="code-block">
              {JSON.stringify(result.sapResponse, null, 2)}
            </pre>
          </div>

          {/* Parse and display key information */}
          {result.sapResponse?.output_data && (
            <div className="result-item">
              <strong>Key Information:</strong>
              <div style={{marginTop: '0.5rem'}}>
                {result.sapResponse.output_data.CONFIRMATION_HEADER && (
                  <div>
                    <strong>Production Order:</strong> {result.sapResponse.output_data.CONFIRMATION_HEADER.PRODUCTION_ORDER || 'N/A'}<br/>
                    <strong>Material:</strong> {result.sapResponse.output_data.CONFIRMATION_HEADER.MATERIAL || 'N/A'}<br/>
                    <strong>Confirmed Quantity:</strong> {result.sapResponse.output_data.CONFIRMATION_HEADER.CONFIRMED_QUANTITY || 'N/A'}<br/>
                    <strong>Work Center:</strong> {result.sapResponse.output_data.CONFIRMATION_HEADER.WORK_CENTER || 'N/A'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TestBapi;