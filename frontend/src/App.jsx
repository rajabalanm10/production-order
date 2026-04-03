import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import ProductionConfirmation from './pages/ProductionConfirmation';
import GoodsReceipt from './pages/GoodsReceipt';
import ProductionOrders from './pages/ProductionOrders';

function Navigation() {
  const location = useLocation();
  
  return (
    <nav className="nav">
      <div className="nav-header">
        <h1>Manufacturing Execution System</h1>
        <p className="nav-subtitle">SAP Integration Platform</p>
      </div>
      <ul className="nav-links">
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
            to="/" 
            className={location.pathname === '/' ? 'active' : ''}
          >
            Order Confirmation
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
        </Routes>
      </div>
    </Router>
  );
}

export default App;
