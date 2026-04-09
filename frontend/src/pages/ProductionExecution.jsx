import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';

function ProductionExecution() {
  const { orderId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [orderData, setOrderData] = useState(location.state?.orderData || null);
  const [components, setComponents] = useState([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [completedSteps, setCompletedSteps] = useState([]);

  // Load order data if not provided
  useEffect(() => {
    if (!orderData) {
      loadOrderData();
    }
  }, [orderId]);

  // Load components when on step 2
  useEffect(() => {
    if (currentStep === 2) {
      loadComponents();
    }
  }, [currentStep]);

  const loadOrderData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/production-orders/${orderId}`);
      const data = await response.json();
      if (data.success) {
        setOrderData(data.data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadComponents = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/goods-issue/components/${orderId}`);
      const data = await response.json();
      if (data.success) {
        setComponents(data.data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const markStepComplete = (step) => {
    if (!completedSteps.includes(step)) {
      setCompletedSteps([...completedSteps, step]);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString || dateString === '00000000') return '-';
    if (dateString.length === 8) {
      return `${dateString.substring(6, 8)}.${dateString.substring(4, 6)}.${dateString.substring(0, 4)}`;
    }
    return dateString;
  };

  const steps = [
    { id: 1, name: 'Order Details', icon: '📋' },
    { id: 2, name: 'Issue Components', icon: '📦' },
    { id: 3, name: 'Confirm Production', icon: '✓' },
    { id: 4, name: 'Goods Receipt', icon: '📥' },
    { id: 5, name: 'Technical Completion', icon: '🏁' }
  ];

  return (
    <div className="page">
      <div className="page-header">
        <h2>Production Execution Flow</h2>
        <p className="page-description">
          Order: <strong style={{ color: '#1976d2', fontSize: '1.2rem' }}>{orderId}</strong>
        </p>
      </div>

      {/* Progress Steps */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        marginBottom: '2rem',
        padding: '1rem',
        background: '#f9f9f9',
        borderRadius: '8px'
      }}>
        {steps.map((step, index) => (
          <div key={step.id} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              background: completedSteps.includes(step.id) 
                ? '#4caf50' 
                : currentStep === step.id 
                  ? '#1976d2' 
                  : '#e0e0e0',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              fontSize: '1.5rem',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
            onClick={() => setCurrentStep(step.id)}
            >
              {completedSteps.includes(step.id) ? '✓' : step.icon}
            </div>
            <div style={{ 
              marginTop: '0.5rem', 
              fontSize: '0.85rem',
              fontWeight: currentStep === step.id ? 'bold' : 'normal',
              color: currentStep === step.id ? '#1976d2' : '#666'
            }}>
              {step.name}
            </div>
            {index < steps.length - 1 && (
              <div style={{
                position: 'absolute',
                top: '25px',
                left: '50%',
                width: '100%',
                height: '2px',
                background: completedSteps.includes(step.id) ? '#4caf50' : '#e0e0e0',
                zIndex: -1
              }} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div style={{ minHeight: '400px' }}>
        {/* Step 1: Order Details */}
        {currentStep === 1 && orderData && (
          <div>
            <h3 style={{ color: '#1976d2', marginBottom: '1rem' }}>📋 Production Order Details</h3>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '1rem',
              background: '#f9f9f9',
              padding: '1.5rem',
              borderRadius: '8px'
            }}>
              <div>
                <strong>Order Number:</strong>
                <div style={{ fontSize: '1.2rem', color: '#1976d2', fontFamily: 'monospace' }}>
                  {orderData.PRODUCTION_ORDER}
                </div>
              </div>
              <div>
                <strong>Plant:</strong>
                <div>{orderData.PLANT}</div>
              </div>
              <div>
                <strong>Material:</strong>
                <div>{orderData.MATERIAL || '-'}</div>
              </div>
              <div>
                <strong>Material Description:</strong>
                <div>{orderData.MATERIAL_DESC || '-'}</div>
              </div>
              <div>
                <strong>Target Quantity:</strong>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                  {orderData.TARGET_QUANTITY ? `${parseFloat(orderData.TARGET_QUANTITY).toFixed(2)} ${orderData.UNIT || ''}` : '-'}
                </div>
              </div>
              <div>
                <strong>Confirmed Quantity:</strong>
                <div style={{ color: '#4caf50', fontWeight: 'bold' }}>
                  {orderData.CONFIRMED_QUANTITY ? `${parseFloat(orderData.CONFIRMED_QUANTITY).toFixed(2)} ${orderData.UNIT || ''}` : '0'}
                </div>
              </div>
              <div>
                <strong>Remaining Quantity:</strong>
                <div style={{ color: '#ff9800', fontWeight: 'bold' }}>
                  {orderData.TARGET_QUANTITY && orderData.CONFIRMED_QUANTITY
                    ? `${(parseFloat(orderData.TARGET_QUANTITY) - parseFloat(orderData.CONFIRMED_QUANTITY)).toFixed(2)} ${orderData.UNIT || ''}`
                    : '-'}
                </div>
              </div>
              <div>
                <strong>Order Type:</strong>
                <div>{orderData.ORDER_TYPE}</div>
              </div>
              {orderData.OPERATIONS && orderData.OPERATIONS.length > 0 && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <strong>Operations:</strong>
                  <div style={{ marginTop: '0.5rem' }}>
                    {orderData.OPERATIONS.map((op, idx) => (
                      <div key={idx} style={{ 
                        padding: '0.5rem', 
                        background: 'white', 
                        marginBottom: '0.5rem',
                        borderRadius: '4px'
                      }}>
                        <strong>Op {op.OPERATION}:</strong> {op.WORK_CENTER} - {op.DESCRIPTION}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  markStepComplete(1);
                  setCurrentStep(2);
                }}
              >
                Next: Issue Components →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Issue Components */}
        {currentStep === 2 && (
          <div>
            <h3 style={{ color: '#1976d2', marginBottom: '1rem' }}>📦 Issue Components (Movement Type 261)</h3>
            {components.length === 0 ? (
              <div className="alert" style={{ background: '#fff3cd', color: '#856404' }}>
                No components found for this order or all components already issued.
              </div>
            ) : (
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
                    </tr>
                  </thead>
                  <tbody>
                    {components.map((comp, idx) => (
                      <tr key={idx} style={{ background: idx % 2 === 0 ? 'white' : '#f9f9f9' }}>
                        <td style={{ padding: '0.75rem' }}>{comp.material}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{parseFloat(comp.requiredQuantity).toFixed(2)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{parseFloat(comp.withdrawnQuantity).toFixed(2)}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 'bold', color: '#ff9800' }}>
                          {parseFloat(comp.remainingQuantity).toFixed(2)}
                        </td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>{comp.unit}</td>
                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>{comp.storageLocation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ marginTop: '1.5rem', textAlign: 'center', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                className="btn btn-secondary"
                onClick={() => setCurrentStep(1)}
              >
                ← Back
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => navigate('/goods-issue', { state: { orderId, orderData } })}
              >
                Issue Components
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  markStepComplete(2);
                  setCurrentStep(3);
                }}
              >
                Skip / Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Confirm Production */}
        {currentStep === 3 && (
          <div>
            <h3 style={{ color: '#1976d2', marginBottom: '1rem' }}>✓ Confirm Production</h3>
            <div className="alert" style={{ background: '#e3f2fd', color: '#1976d2' }}>
              <strong>Ready to confirm production?</strong>
              <p>Click below to go to the production confirmation page with pre-filled order details.</p>
            </div>
            <div style={{ marginTop: '1.5rem', textAlign: 'center', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                className="btn btn-secondary"
                onClick={() => setCurrentStep(2)}
              >
                ← Back
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => navigate('/', { state: { orderId, orderData } })}
              >
                Go to Confirmation
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  markStepComplete(3);
                  setCurrentStep(4);
                }}
              >
                Skip / Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Goods Receipt */}
        {currentStep === 4 && (
          <div>
            <h3 style={{ color: '#1976d2', marginBottom: '1rem' }}>📥 Goods Receipt (Movement Type 101)</h3>
            <div className="alert" style={{ background: '#e3f2fd', color: '#1976d2' }}>
              <strong>Post goods receipt for finished goods</strong>
              <p>Click below to go to the goods receipt page with pre-filled order details.</p>
            </div>
            <div style={{ marginTop: '1.5rem', textAlign: 'center', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                className="btn btn-secondary"
                onClick={() => setCurrentStep(3)}
              >
                ← Back
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => navigate('/goods-receipt', { state: { orderId, orderData } })}
              >
                Go to Goods Receipt
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  markStepComplete(4);
                  setCurrentStep(5);
                }}
              >
                Skip / Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Technical Completion */}
        {currentStep === 5 && (
          <div>
            <h3 style={{ color: '#1976d2', marginBottom: '1rem' }}>🏁 Technical Completion (TECO)</h3>
            <div className="alert" style={{ background: '#fff3cd', color: '#856404' }}>
              <strong>⚠️ Final Step</strong>
              <p>Marking the order as technically complete (TECO) will prevent further postings to this order.</p>
            </div>
            <div style={{ marginTop: '1.5rem', textAlign: 'center', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                className="btn btn-secondary"
                onClick={() => setCurrentStep(4)}
              >
                ← Back
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => navigate('/technical-completion', { state: { orderId, orderData } })}
                style={{ background: '#4caf50' }}
              >
                Mark as TECO
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginTop: '1rem' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      )}
    </div>
  );
}

export default ProductionExecution;
