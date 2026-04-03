import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import ProductionConfirmation from './pages/ProductionConfirmation';
import GoodsReceipt from './pages/GoodsReceipt';
import TestBapi from './pages/TestBapi';
import ProductionOrders from './pages/ProductionOrders';
import RealSapOrders from './pages/RealSapOrders';

function Navigation() {
  const location = useLocation();
  
  return (
    <nav className="nav">
      <h1>SAP MCP Integration - Manufacturing</h1>
      <ul className="nav-links">
        <li>
          <Link 
            to="/" 
            className={location.pathname === '/' ? 'active' : ''}
          >
            Production Confirmation
          </Link>
        </li>
        <li>
          <Link 
            to="/goods-receipt" 
            className={location.pathname === '/goods-receipt' ? 'active' : ''}
          >
            Goods Receipt
          </Link>
        </li>
        <li>
          <Link 
            to="/production-orders" 
            className={location.pathname === '/production-orders' ? 'active' : ''}
          >
            Production Orders
          </Link>
        </li>
        <li>
          <Link 
            to="/real-sap-orders" 
            className={location.pathname === '/real-sap-orders' ? 'active' : ''}
            style={{ 
              background: location.pathname === '/real-sap-orders' ? '#2e7d32' : 'transparent',
              color: location.pathname === '/real-sap-orders' ? 'white' : 'inherit'
            }}
          >
            🎯 Real SAP Orders
          </Link>
        </li>
        {/* <li>
          <Link 
            to="/test-bapi" 
            className={location.pathname === '/test-bapi' ? 'active' : ''}
          >
            Test BAPI
          </Link>
        </li> */}
      </ul>
    </nav>
  );
}

function App() {
  return (
    <Router>
      <Navigation />
      <div className="container">
        <Routes>
          <Route path="/" element={<ProductionConfirmation />} />
          <Route path="/goods-receipt" element={<GoodsReceipt />} />
          <Route path="/production-orders" element={<ProductionOrders />} />
          <Route path="/real-sap-orders" element={<RealSapOrders />} />
          <Route path="/test-bapi" element={<TestBapi />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
