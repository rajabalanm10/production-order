import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import ProductionConfirmation from './pages/ProductionConfirmation';
import GoodsReceipt from './pages/GoodsReceipt';
import ProductionOrders from './pages/ProductionOrders';
import ProductionOrderScan from './pages/ProductionOrderScan';
import ProductionExecution from './pages/ProductionExecution';
import GoodsIssue from './pages/GoodsIssue';
import TechnicalCompletion from './pages/TechnicalCompletion';

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
            to="/production-execution-scan" 
            className={location.pathname === '/production-execution-scan' ? 'active' : ''}
          >
            Execution Flow
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
            to="/goods-issue" 
            className={location.pathname === '/goods-issue' ? 'active' : ''}
          >
            Goods Issue
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
            to="/technical-completion" 
            className={location.pathname === '/technical-completion' ? 'active' : ''}
          >
            TECO
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
          <Route path="/goods-issue" element={<GoodsIssue />} />
          <Route path="/technical-completion" element={<TechnicalCompletion />} />
          <Route path="/production-orders" element={<ProductionOrders />} />
          <Route path="/production-execution-scan" element={<ProductionOrderScan />} />
          <Route path="/production-execution/:orderId" element={<ProductionExecution />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
