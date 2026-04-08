import { useState, useEffect } from 'react';

function ProductionOrders() {
  const [activeTab, setActiveTab] = useState('search');
  const [searchForm, setSearchForm] = useState({
    plant: '',
    status: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [confirmations, setConfirmations] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
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
      console.log('[Production Orders] Fetching confirmations from SAP...');
      
      const response = await fetch('/api/production-orders/confirmations');
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setConfirmations(data.data || []);
          console.log('[Production Orders] Loaded confirmations from SAP:', data.data?.length || 0);
        }
      }
    } catch (err) {
      console.error('Failed to load confirmations from SAP:', err);
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

    try {
      console.log('[Production Orders] Making LIVE SAP call via backend...');
      console.log('[Production Orders] Page:', currentPage, 'Limit:', recordsPerPage);
      
      const response = await fetch('/api/production-orders/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          plant: searchForm.plant,
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
        console.log(`[Production Orders] Page ${currentPage}: Showing ${data.data?.length} of ${data.totalCount} total orders`);
        
        setOrders(data.data);
        setFilteredOrders(data.data);
        setTotalRecords(data.totalCount);
        
        // Show warning if we hit the record limit
        if (data.warning) {
          console.warn('[Production Orders] Warning:', data.warning);
        }
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
    const actualTotalRecords = totalRecords || filteredOrders.length;
    const totalPages = Math.ceil(actualTotalRecords / recordsPerPage);
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  // Effect to trigger search when page changes
  useEffect(() => {
    if (filteredOrders.length > 0 || totalRecords > 0) {
      // Only auto-search if we've already done an initial search
      const fetchData = async () => {
        await handleSearch();
      };
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const handleRecordsPerPageChange = (newLimit) => {
    setRecordsPerPage(newLimit);
    setCurrentPage(1);
  };

  // Effect to trigger search when records per page changes
  useEffect(() => {
    if (filteredOrders.length > 0 || totalRecords > 0) {
      // Only auto-search if we've already done an initial search
      const fetchData = async () => {
        await handleSearch();
      };
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordsPerPage]);

  const handleOrderDetails = async (order) => {
    setSelectedOrder(order);
    setLoadingDetails(true);
    setOrderDetails(null);
    
    try {
      // Fetch detailed order information from backend
      const response = await fetch(`/api/production-orders/${order.PRODUCTION_ORDER}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setOrderDetails(data.data);
        }
      }
    } catch (err) {
      console.error('Failed to load order details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    // Handle SAP date format (YYYYMMDD)
    if (dateString.length === 8 && !dateString.includes('-') && !dateString.includes('.')) {
      const year = dateString.substring(0, 4);
      const month = dateString.substring(4, 6);
      const day = dateString.substring(6, 8);
      return `${day}.${month}.${year}`;
    }
    
    // Handle ISO date format or other formats
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}.${month}.${year}`;
    } catch (e) {
      return dateString; // Return as-is if can't parse
    }
  };

  const getStatusColor = (status) => {
    if (!status) return '#999'; // Gray for no status
    switch (status) {
      case 'COMPLETED': return '#4caf50';
      case 'RELEASED': return '#2196f3';
      case 'IN PROGRESS': return '#ff9800';
      case 'CREATED': return '#9e9e9e';
      case 'CLOSED': return '#607d8b';
      case 'DELETED': return '#f44336';
      case 'UNKNOWN': return '#999';
      default: return '#666';
    }
  };

  // Calculate pagination - no slicing, show all data from current page
  const actualTotalRecords = totalRecords || filteredOrders.length;
  const totalPages = Math.ceil(actualTotalRecords / recordsPerPage);
  const startIndex = (currentPage - 1) * recordsPerPage;
  const endIndex = startIndex + recordsPerPage;
  const paginatedOrders = filteredOrders; // Show all data from backend (already paginated)

  return (
    <div className="page">
      <div className="page-header">
        <h2>Production Orders</h2>
        <p className="page-description">Search and manage production orders from SAP</p>
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
                  placeholder="e.g., SL31, 0001"
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
                  <option value="CREATED">CREATED</option>
                  <option value="RELEASED">RELEASED</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Searching...' : 'Search Orders'}
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
              {/* Warning if hit record limit */}
              {orders.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <div className="alert" style={{ 
                    background: '#fff3cd', 
                    color: '#856404', 
                    border: '1px solid #ffeaa7',
                    padding: '1rem',
                    borderRadius: '4px'
                  }}>
                    ℹ️ <strong>Tip:</strong> Showing first 100 records (300 with plant filter). Use <strong>Plant filter</strong> (e.g., "SL31") to see specific plant orders.
                  </div>
                </div>
              )}
              
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                marginBottom: '1rem',
                padding: '1rem',
                background: '#f9f9f9',
                borderRadius: '8px',
                border: '1px solid #e0e0e0'
              }}>
                <div>
                  <h3 style={{ margin: 0, color: '#1976d2', fontSize: '1.3rem' }}>Search Results</h3>
                  <div style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.95rem' }}>
                    <strong style={{ color: '#1976d2', fontSize: '1.1rem' }}>{actualTotalRecords}</strong> production orders found
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1rem', color: '#1976d2', fontWeight: 'bold' }}>
                    Showing {startIndex + 1}-{Math.min(endIndex, actualTotalRecords)} of {actualTotalRecords}
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
                        <td style={{ padding: '0.75rem' }}>{order.PLANT || ''}</td>
                        <td style={{ padding: '0.75rem' }}>{order.ORDER_TYPE}</td>
                        <td style={{ padding: '0.75rem' }}>{formatDate(order.CREATED_DATE)}</td>
                        <td style={{ padding: '0.75rem' }}>
                          {order.STATUS ? (
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
                          ) : (
                            <span style={{ color: '#999' }}>-</span>
                          )}
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
                  <div style={{ color: '#666', fontSize: '0.9rem' }}>
                    Showing <strong>{startIndex + 1}</strong> to <strong>{Math.min(endIndex, actualTotalRecords)}</strong> of <strong>{actualTotalRecords}</strong> total records
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
                  
                  <div style={{ color: '#666', fontSize: '0.9rem' }}>
                    Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Loading Overlay */}
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
                <p>Searching production orders...</p>
              </div>
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
            <div className="alert" style={{ background: '#f5f5f5', color: '#666', border: '1px solid #e0e0e0' }}>
              Click "Search Orders" to view production orders from SAP
            </div>
          )}
        </div>
      )}

      {/* Confirmations Tab */}
      {activeTab === 'confirmations' && (
        <div>
          {confirmations.length === 0 ? (
            <div className="alert" style={{ background: '#f5f5f5', color: '#666', padding: '1.5rem', border: '1px solid #e0e0e0' }}>
              No confirmations found. Create confirmations using the "Order Confirmation" page.
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
                Order Details: {selectedOrder.PRODUCTION_ORDER}
              </h3>
              <button
                onClick={() => {
                  setSelectedOrder(null);
                  setOrderDetails(null);
                }}
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
            
            {loadingDetails ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <div className="spinner"></div>
                <p>Loading order details...</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <strong>Production Order:</strong>
                    <div style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 'bold', color: '#1976d2' }}>
                      {selectedOrder.PRODUCTION_ORDER}
                    </div>
                  </div>
                  <div>
                    <strong>Plant:</strong>
                    <div style={{ marginBottom: '1rem' }}>{selectedOrder.PLANT || '-'}</div>
                  </div>
                  <div>
                    <strong>Order Type:</strong>
                    <div style={{ marginBottom: '1rem' }}>{selectedOrder.ORDER_TYPE}</div>
                  </div>
                  <div>
                    <strong>Created Date:</strong>
                    <div style={{ marginBottom: '1rem' }}>{formatDate(selectedOrder.CREATED_DATE)}</div>
                  </div>
                  <div>
                    <strong>Created By:</strong>
                    <div style={{ marginBottom: '1rem' }}>{selectedOrder.CREATED_BY}</div>
                  </div>
                  <div>
                    <strong>Status:</strong>
                    <div style={{ marginBottom: '1rem' }}>
                      {selectedOrder.STATUS ? (
                        <>
                          <span style={{ 
                            color: getStatusColor(selectedOrder.STATUS),
                            fontWeight: 'bold',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '12px',
                            background: `${getStatusColor(selectedOrder.STATUS)}20`
                          }}>
                            {selectedOrder.STATUS}
                          </span>
                          {selectedOrder.SYSTEM_STATUS && (
                            <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                              System: {selectedOrder.SYSTEM_STATUS}
                            </div>
                          )}
                        </>
                      ) : (
                        <span style={{ color: '#999' }}>-</span>
                      )}
                    </div>
                  </div>
                </div>

                {orderDetails && (
                  <>
                    <div style={{ 
                      marginTop: '1.5rem', 
                      paddingTop: '1.5rem', 
                      borderTop: '2px solid #e0e0e0' 
                    }}>
                      <h4 style={{ color: '#1976d2', marginBottom: '1rem' }}>Material & Quantity Information</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <strong>Material Number:</strong>
                          <div style={{ marginBottom: '1rem', fontSize: '1rem', color: '#333' }}>
                            {orderDetails.MATERIAL || '-'}
                          </div>
                        </div>
                        <div>
                          <strong>Material Description:</strong>
                          <div style={{ marginBottom: '1rem', fontSize: '1rem', color: '#333' }}>
                            {orderDetails.MATERIAL_DESC || '-'}
                          </div>
                        </div>
                        <div>
                          <strong>Target Quantity:</strong>
                          <div style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 'bold', color: '#1976d2' }}>
                            {orderDetails.TARGET_QUANTITY ? `${parseFloat(orderDetails.TARGET_QUANTITY).toFixed(2)} ${orderDetails.UNIT || ''}` : '-'}
                          </div>
                        </div>
                        <div>
                          <strong>Confirmed Quantity:</strong>
                          <div style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 'bold', color: '#4caf50' }}>
                            {orderDetails.CONFIRMED_QUANTITY ? `${parseFloat(orderDetails.CONFIRMED_QUANTITY).toFixed(2)} ${orderDetails.UNIT || ''}` : '-'}
                          </div>
                        </div>
                        <div>
                          <strong>Delivered Quantity:</strong>
                          <div style={{ marginBottom: '1rem', fontSize: '1rem' }}>
                            {orderDetails.DELIVERED_QUANTITY ? `${parseFloat(orderDetails.DELIVERED_QUANTITY).toFixed(2)} ${orderDetails.UNIT || ''}` : '-'}
                          </div>
                        </div>
                        <div>
                          <strong>Scrap Quantity:</strong>
                          <div style={{ marginBottom: '1rem', fontSize: '1rem', color: '#f44336' }}>
                            {orderDetails.SCRAP_QUANTITY ? `${parseFloat(orderDetails.SCRAP_QUANTITY).toFixed(2)} ${orderDetails.UNIT || ''}` : '-'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ 
                      marginTop: '1.5rem', 
                      paddingTop: '1.5rem', 
                      borderTop: '1px solid #e0e0e0' 
                    }}>
                      <h4 style={{ color: '#1976d2', marginBottom: '1rem' }}>Schedule Information</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <strong>Basic Start Date:</strong>
                          <div style={{ marginBottom: '1rem' }}>
                            {formatDate(orderDetails.BASIC_START_DATE) || '-'}
                          </div>
                        </div>
                        <div>
                          <strong>Basic Finish Date:</strong>
                          <div style={{ marginBottom: '1rem' }}>
                            {formatDate(orderDetails.BASIC_FINISH_DATE) || '-'}
                          </div>
                        </div>
                        <div>
                          <strong>Scheduled Start:</strong>
                          <div style={{ marginBottom: '1rem' }}>
                            {formatDate(orderDetails.SCHEDULED_START) || '-'}
                          </div>
                        </div>
                        <div>
                          <strong>Scheduled Finish:</strong>
                          <div style={{ marginBottom: '1rem' }}>
                            {formatDate(orderDetails.SCHEDULED_FINISH) || '-'}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ 
                      marginTop: '1.5rem', 
                      paddingTop: '1.5rem', 
                      borderTop: '1px solid #e0e0e0' 
                    }}>
                      <h4 style={{ color: '#1976d2', marginBottom: '1rem' }}>Additional Information</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <strong>Work Center:</strong>
                          <div style={{ marginBottom: '1rem' }}>
                            {orderDetails.WORK_CENTER || '-'}
                          </div>
                        </div>
                        <div>
                          <strong>Production Supervisor:</strong>
                          <div style={{ marginBottom: '1rem' }}>
                            {orderDetails.PRODUCTION_SUPERVISOR || '-'}
                          </div>
                        </div>
                        <div>
                          <strong>Priority:</strong>
                          <div style={{ marginBottom: '1rem' }}>
                            {orderDetails.PRIORITY || '-'}
                          </div>
                        </div>
                        <div>
                          <strong>MRP Controller:</strong>
                          <div style={{ marginBottom: '1rem' }}>
                            {orderDetails.MRP_CONTROLLER || '-'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {orderDetails.OPERATIONS && orderDetails.OPERATIONS.length > 0 && (
                      <div style={{ 
                        marginTop: '1.5rem', 
                        paddingTop: '1.5rem', 
                        borderTop: '1px solid #e0e0e0' 
                      }}>
                        <h4 style={{ color: '#1976d2', marginBottom: '1rem' }}>
                          Operations ({orderDetails.OPERATIONS.length})
                        </h4>
                        <div style={{ 
                          background: '#f9f9f9', 
                          padding: '1rem', 
                          borderRadius: '4px',
                          border: '1px solid #e0e0e0'
                        }}>
                          {orderDetails.OPERATIONS.map((op, index) => (
                            <div key={index} style={{ 
                              marginBottom: index < orderDetails.OPERATIONS.length - 1 ? '0.75rem' : '0',
                              paddingBottom: index < orderDetails.OPERATIONS.length - 1 ? '0.75rem' : '0',
                              borderBottom: index < orderDetails.OPERATIONS.length - 1 ? '1px solid #ddd' : 'none'
                            }}>
                              <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                                <div>
                                  <strong style={{ color: '#1976d2' }}>Operation:</strong>
                                  <span style={{ marginLeft: '0.5rem', fontFamily: 'monospace', fontSize: '1.1rem' }}>
                                    {op.OPERATION}
                                  </span>
                                </div>
                                <div>
                                  <strong style={{ color: '#1976d2' }}>Work Center:</strong>
                                  <span style={{ marginLeft: '0.5rem', fontFamily: 'monospace', fontSize: '1.1rem' }}>
                                    {op.WORK_CENTER}
                                  </span>
                                </div>
                                {op.DESCRIPTION && (
                                  <div style={{ flex: 1 }}>
                                    <strong>Description:</strong>
                                    <span style={{ marginLeft: '0.5rem', color: '#666' }}>
                                      {op.DESCRIPTION}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        {orderDetails.DEFAULT_OPERATION && (
                          <div style={{ 
                            marginTop: '0.75rem', 
                            padding: '0.75rem', 
                            background: '#e3f2fd', 
                            borderRadius: '4px',
                            fontSize: '0.9rem',
                            color: '#1976d2'
                          }}>
                            💡 <strong>For Confirmation:</strong> Use Operation <code style={{ 
                              background: 'white', 
                              padding: '0.2rem 0.4rem', 
                              borderRadius: '3px',
                              fontFamily: 'monospace'
                            }}>{orderDetails.DEFAULT_OPERATION}</code> and Work Center <code style={{ 
                              background: 'white', 
                              padding: '0.2rem 0.4rem', 
                              borderRadius: '3px',
                              fontFamily: 'monospace'
                            }}>{orderDetails.DEFAULT_WORK_CENTER}</code>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                <div style={{ gridColumn: '1 / -1', paddingTop: '1rem', marginTop: '1rem', borderTop: '1px solid #e0e0e0' }}>
                  <strong>Data Source:</strong>
                  <div style={{ marginTop: '0.5rem' }}>
                    <span style={{ 
                      padding: '0.4rem 0.8rem',
                      borderRadius: '6px',
                      background: '#e3f2fd',
                      color: '#1976d2',
                      fontSize: '0.9rem',
                      fontWeight: '500'
                    }}>
                      SAP ERP System
                    </span>
                  </div>
                </div>
              </>
            )}

            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <button
                onClick={() => {
                  setSelectedOrder(null);
                  setOrderDetails(null);
                }}
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
