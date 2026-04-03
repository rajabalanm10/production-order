import { useState, useEffect } from 'react';

function ProductionOrders() {
  const [activeTab, setActiveTab] = useState('search');
  const [searchForm, setSearchForm] = useState({
    plant: '',
    material: '',
    status: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [confirmations, setConfirmations] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [error, setError] = useState(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);

  // Load data on component mount
  useEffect(() => {
    loadProductionOrders();
    loadConfirmations();
  }, []);

  const loadProductionOrders = async () => {
    // Don't auto-load - user must click search to make live SAP call
    console.log('[Production Orders] Ready for live SAP search');
  };

  const loadConfirmations = async () => {
    try {
      const storedConfirmations = JSON.parse(localStorage.getItem('productionConfirmations') || '[]');
      const storedReceipts = JSON.parse(localStorage.getItem('goodsReceipts') || '[]');
      
      const allConfirmations = [
        ...storedConfirmations.map(conf => ({
          ...conf,
          type: 'CONFIRMATION'
        })),
        ...storedReceipts.map(receipt => ({
          ...receipt,
          type: 'GOODS_RECEIPT'
        }))
      ];
      
      setConfirmations(allConfirmations);
      console.log('[Production Orders] Loaded confirmations:', allConfirmations.length);
    } catch (err) {
      console.error('Failed to load confirmations:', err);
    }
  };

  const handleSearchChange = (e) => {
    setSearchForm({
      ...searchForm,
      [e.target.name]: e.target.value
    });
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    
    setLoading(true);
    setError(null);
    setFilteredOrders([]);

    try {
      console.log('[Production Orders] Making LIVE SAP call via backend...');
      
      const response = await fetch('/api/production-orders/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          plant: searchForm.plant,
          material: searchForm.material,
          status: searchForm.status,
          page: currentPage,
          limit: recordsPerPage
        })
      });

      // Check if response is ok
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Production Orders] HTTP Error:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText || 'Server error'}`);
      }

      // Check if response has content
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('[Production Orders] Non-JSON response:', text);
        throw new Error('Server returned non-JSON response. Is the backend running?');
      }

      const data = await response.json();

      if (data.success) {
        console.log('[Production Orders] LIVE SAP call successful!');
        console.log(`[Production Orders] Source: ${data.source}`);
        console.log(`[Production Orders] Found ${data.totalCount} total orders from SAP`);
        
        setOrders(data.data);
        setFilteredOrders(data.data);
        setTotalRecords(data.totalCount);
        setCurrentPage(1); // Reset to first page on new search
      } else {
        setError(data.error || data.message || 'Failed to search production orders in SAP');
      }
    } catch (err) {
      console.error('[Production Orders] Error:', err);
      
      let errorMessage = err.message;
      
      // Provide helpful error messages
      if (err.message.includes('Failed to fetch')) {
        errorMessage = 'Cannot connect to backend server. Is it running on port 3003?';
      } else if (err.message.includes('Unexpected end of JSON')) {
        errorMessage = 'Backend returned empty response. Check if Kiro bridge handler is running.';
      } else if (err.message.includes('timeout')) {
        errorMessage = 'Request timeout. Make sure Kiro bridge handler is running: node kiro-bridge-handler.js';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage) => {
    const totalPages = Math.ceil(filteredOrders.length / recordsPerPage);
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleRecordsPerPageChange = (newLimit) => {
    setRecordsPerPage(newLimit);
    setCurrentPage(1);
    // Don't auto-fetch - user can click search if they want fresh data
  };

  const handleOrderDetails = (order) => {
    setSelectedOrder(order);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
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

  // Calculate pagination
  const totalPages = Math.ceil(totalRecords / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

  return (
    <div className="page">
      <h2>Production Orders (Live SAP Integration)</h2>
      
      <div style={{ 
        background: '#e3f2fd', 
        padding: '1rem', 
        borderRadius: '4px', 
        marginBottom: '2rem',
        border: '1px solid #2196f3'
      }}>
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#1976d2' }}>🔴 LIVE SAP Integration</h3>
        <p style={{ margin: 0, color: '#666' }}>
          Every search makes a REAL-TIME call to your SAP system via Kiro MCP bridge.
          Results are fetched directly from SAP AUFK table - no cached data.
        </p>
      </div>
      
      {/* Tab Navigation */}
      <div style={{ marginBottom: '2rem', borderBottom: '1px solid #ddd' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => setActiveTab('search')}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              background: activeTab === 'search' ? '#1976d2' : 'transparent',
              color: activeTab === 'search' ? 'white' : '#666',
              borderBottom: activeTab === 'search' ? '2px solid #1976d2' : 'none',
              cursor: 'pointer'
            }}
          >
            Search Production Orders
          </button>
          <button
            onClick={() => setActiveTab('confirmations')}
            style={{
              padding: '0.75rem 1.5rem',
              border: 'none',
              background: activeTab === 'confirmations' ? '#1976d2' : 'transparent',
              color: activeTab === 'confirmations' ? 'white' : '#666',
              borderBottom: activeTab === 'confirmations' ? '2px solid #1976d2' : 'none',
              cursor: 'pointer'
            }}
          >
            My Confirmations ({confirmations.length})
          </button>
        </div>
      </div>

      {/* Search Tab */}
      {activeTab === 'search' && (
        <div>
          <h3>Search Production Orders in SAP</h3>
          
          <form onSubmit={handleSearch} style={{ marginBottom: '2rem' }}>
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
                <label htmlFor="material">Material (Optional)</label>
                <input
                  type="text"
                  id="material"
                  name="material"
                  value={searchForm.material}
                  onChange={handleSearchChange}
                  placeholder="Leave empty to search all"
                />
              </div>

              <div className="form-group">
                <label htmlFor="status">Status (Optional)</label>
                <select
                  id="status"
                  name="status"
                  value={searchForm.status}
                  onChange={handleSearchChange}
                >
                  <option value="">All Statuses</option>
                  <option value="CREATED">Created</option>
                  <option value="RELEASED">Released</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? '🔄 Calling SAP...' : '🔴 Search SAP (Live Call)'}
              </button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.9rem', color: '#666' }}>Records per page:</label>
                <select 
                  value={recordsPerPage} 
                  onChange={(e) => handleRecordsPerPageChange(parseInt(e.target.value))}
                  disabled={loading}
                  style={{ 
                    padding: '0.5rem', 
                    borderRadius: '4px', 
                    border: '1px solid #ddd'
                  }}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                </select>
              </div>
            </div>
          </form>

          {/* Results */}
          {filteredOrders.length > 0 && (
            <div className="result-section">
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: '1rem',
                padding: '1rem',
                background: '#f9f9f9',
                borderRadius: '4px',
                border: '1px solid #ddd'
              }}>
                <div>
                  <h3 style={{ margin: 0, color: '#1976d2' }}>Production Orders from SAP</h3>
                  <div style={{ marginTop: '0.25rem', color: '#666', fontSize: '0.9rem' }}>
                    {totalRecords} records • LIVE SAP via Kiro Bridge • RFC_READ_TABLE
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    Showing {paginatedOrders.length} of {totalRecords}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.25rem' }}>
                    Page {currentPage} of {totalPages}
                  </div>
                </div>
              </div>

              <div style={{ 
                overflowX: 'auto', 
                border: '1px solid #ddd', 
                borderRadius: '4px'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#1976d2', color: 'white' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left' }}>Order ID</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left' }}>Plant</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left' }}>Order Type</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left' }}>Created Date</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left' }}>Created By</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left' }}>Status</th>
                      <th style={{ padding: '0.75rem', textAlign: 'left' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedOrders.map((order, index) => (
                      <tr 
                        key={index}
                        style={{ 
                          background: index % 2 === 0 ? 'white' : '#f9f9f9',
                          borderBottom: '1px solid #eee'
                        }}
                      >
                        <td style={{ padding: '0.75rem', fontWeight: 'bold', color: '#1976d2' }}>
                          {order.PRODUCTION_ORDER}
                        </td>
                        <td style={{ padding: '0.75rem' }}>{order.PLANT}</td>
                        <td style={{ padding: '0.75rem' }}>{order.ORDER_TYPE}</td>
                        <td style={{ padding: '0.75rem' }}>{order.CREATED_DATE}</td>
                        <td style={{ padding: '0.75rem' }}>{order.CREATED_BY}</td>
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
                          <button
                            onClick={() => handleOrderDetails(order)}
                            className="btn btn-secondary"
                            style={{ 
                              fontSize: '0.8rem', 
                              padding: '0.25rem 0.75rem'
                            }}
                          >
                            📋 View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ 
                  marginTop: '1.5rem', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '1rem',
                  background: '#f9f9f9',
                  borderRadius: '4px'
                }}>
                  <div style={{ color: '#666' }}>
                    Showing {startIndex + 1} to {Math.min(endIndex, totalRecords)} of {totalRecords}
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      onClick={() => handlePageChange(1)}
                      disabled={currentPage === 1}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                    >
                      First
                    </button>
                    
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                    >
                      Previous
                    </button>
                    
                    {/* Smart page number display */}
                    {(() => {
                      const pageNumbers = [];
                      const maxPagesToShow = 7;
                      
                      if (totalPages <= maxPagesToShow) {
                        // Show all pages if total is small
                        for (let i = 1; i <= totalPages; i++) {
                          pageNumbers.push(i);
                        }
                      } else {
                        // Show smart pagination with ellipsis
                        if (currentPage <= 4) {
                          // Near start
                          for (let i = 1; i <= 5; i++) pageNumbers.push(i);
                          pageNumbers.push('...');
                          pageNumbers.push(totalPages);
                        } else if (currentPage >= totalPages - 3) {
                          // Near end
                          pageNumbers.push(1);
                          pageNumbers.push('...');
                          for (let i = totalPages - 4; i <= totalPages; i++) pageNumbers.push(i);
                        } else {
                          // Middle
                          pageNumbers.push(1);
                          pageNumbers.push('...');
                          for (let i = currentPage - 1; i <= currentPage + 1; i++) pageNumbers.push(i);
                          pageNumbers.push('...');
                          pageNumbers.push(totalPages);
                        }
                      }
                      
                      return pageNumbers.map((page, index) => {
                        if (page === '...') {
                          return (
                            <span key={`ellipsis-${index}`} style={{ padding: '0 0.25rem', color: '#999' }}>
                              ...
                            </span>
                          );
                        }
                        
                        return (
                          <button
                            key={page}
                            onClick={() => handlePageChange(page)}
                            style={{
                              fontSize: '0.8rem',
                              padding: '0.25rem 0.5rem',
                              background: page === currentPage ? '#1976d2' : '#f0f0f0',
                              color: page === currentPage ? 'white' : '#333',
                              border: '1px solid #ddd',
                              minWidth: '32px',
                              cursor: 'pointer',
                              borderRadius: '4px',
                              fontWeight: page === currentPage ? 'bold' : 'normal'
                            }}
                          >
                            {page}
                          </button>
                        );
                      });
                    })()}
                    
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                    >
                      Next
                    </button>
                    
                    <button
                      onClick={() => handlePageChange(totalPages)}
                      disabled={currentPage === totalPages}
                      className="btn btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                    >
                      Last
                    </button>
                  </div>
                  
                  <div style={{ color: '#666' }}>
                    Page {currentPage} of {totalPages}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="loading">
              <div className="spinner"></div>
              <p>🔴 Calling SAP system in real-time...</p>
              <p style={{ fontSize: '0.9rem', color: '#666' }}>This may take a few seconds</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="alert alert-error">
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* No Results */}
          {!loading && filteredOrders.length === 0 && !error && (
            <div className="alert" style={{ background: '#f0f0f0', color: '#666' }}>
              Click "Search SAP (Live Call)" to fetch production orders from your SAP system in real-time.
            </div>
          )}
        </div>
      )}

      {/* Confirmations Tab */}
      {activeTab === 'confirmations' && (
        <div>
          <h3>My Production Order Confirmations</h3>
          
          {confirmations.length === 0 ? (
            <div className="alert" style={{ background: '#f0f0f0', color: '#666', padding: '1rem' }}>
              No confirmations found. Create some confirmations using the "Production Confirmation" page.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Confirmation ID</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Production Order</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Material</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Plant</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Yield Qty</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Type</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {confirmations.map((confirmation, index) => (
                    <tr key={index}>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                        {confirmation.confirmationId || confirmation.id || `CONF-${String(index + 1).padStart(3, '0')}`}
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                        {confirmation.productionOrderId || 'N/A'}
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                        {confirmation.material || 'N/A'}
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                        {confirmation.plant || 'N/A'}
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                        {confirmation.yieldQuantity || confirmation.receivedQuantity || '0'}
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '12px',
                          fontSize: '0.8rem',
                          background: confirmation.type === 'GOODS_RECEIPT' ? '#e8f5e9' : '#e3f2fd',
                          color: confirmation.type === 'GOODS_RECEIPT' ? '#2e7d32' : '#1976d2'
                        }}>
                          {confirmation.type === 'GOODS_RECEIPT' ? 'Goods Receipt' : 'Confirmation'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                        {formatDate(confirmation.timestamp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '8px',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto',
            width: '90%'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ color: '#1976d2', margin: 0 }}>
                Order: {selectedOrder.PRODUCTION_ORDER}
              </h3>
              <button
                onClick={() => setSelectedOrder(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <strong>Production Order:</strong>
                <div style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 'bold', color: '#1976d2' }}>
                  {selectedOrder.PRODUCTION_ORDER}
                </div>
              </div>
              <div>
                <strong>Plant:</strong>
                <div style={{ marginBottom: '1rem' }}>{selectedOrder.PLANT}</div>
              </div>
              <div>
                <strong>Order Type:</strong>
                <div style={{ marginBottom: '1rem' }}>{selectedOrder.ORDER_TYPE}</div>
              </div>
              <div>
                <strong>Status:</strong>
                <div style={{ marginBottom: '1rem' }}>
                  <span style={{ 
                    color: getStatusColor(selectedOrder.STATUS),
                    fontWeight: 'bold',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '12px',
                    background: `${getStatusColor(selectedOrder.STATUS)}20`
                  }}>
                    {selectedOrder.STATUS}
                  </span>
                </div>
              </div>
              <div>
                <strong>Created Date:</strong>
                <div style={{ marginBottom: '1rem' }}>{selectedOrder.CREATED_DATE}</div>
              </div>
              <div>
                <strong>Created By:</strong>
                <div style={{ marginBottom: '1rem' }}>{selectedOrder.CREATED_BY}</div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <strong>Source:</strong>
                <div style={{ marginBottom: '1rem' }}>
                  <span style={{ 
                    padding: '0.25rem 0.5rem',
                    borderRadius: '12px',
                    background: '#e3f2fd',
                    color: '#1976d2',
                    fontSize: '0.9rem'
                  }}>
                    🔴 LIVE SAP - RFC_READ_TABLE (AUFK)
                  </span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <button
                onClick={() => setSelectedOrder(null)}
                className="btn btn-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductionOrders;
