# SAP Manufacturing Application

Production-ready SAP manufacturing application with real-time integration via Pillir Flow MCP.

## Features

- **Production Orders**: Search and view production orders from SAP in real-time
- **Production Confirmation**: Confirm production order yields
- **Goods Receipt**: Post goods receipts for production orders
- **Live SAP Integration**: Every action makes a real-time call to SAP via Pillir Flow MCP

## Architecture

```
Frontend (React) → Backend (Node.js/Express) → Pillir Flow MCP → SAP
```

## Prerequisites

- Node.js 18+ and npm
- Access to Pillir Flow MCP server
- SAP system with production orders

## Installation

### Backend

```bash
cd backend
npm install
```

### Frontend

```bash
cd frontend
npm install
```

## Configuration

Update `backend/mcp-config.json` with your Pillir Flow MCP credentials:

```json
{
  "type": "http",
  "url": "https://flow.pillir.ai/mcp/sse",
  "headers": {
    "X-FLOW-API-KEY": "your-api-key-here",
    "mcp-protocol-version": "2024-11-05"
  },
  "enabled": true
}
```

## Running the Application

### Start Backend

```bash
cd backend
npm start
```

Backend runs on: http://localhost:3003

### Start Frontend

```bash
cd frontend
npm run dev
```

Frontend runs on: http://localhost:3001

## Usage

1. Open http://localhost:3001 in your browser
2. Navigate to "Production Orders" tab
3. Click "Search SAP (Live Call)" to fetch real-time data from SAP
4. View order details, create confirmations, and post goods receipts

## API Endpoints

### Production Orders
- `POST /api/production-orders/search` - Search production orders
- `GET /api/production-orders/:orderId` - Get order details
- `GET /api/production-orders/confirmations` - Get confirmations

### Production Confirmation
- `POST /api/production-confirmation/search` - Search orders for confirmation
- `POST /api/production-confirmation/confirm` - Confirm production

### Goods Receipt
- `POST /api/goods-receipt/search` - Search orders for goods receipt
- `POST /api/goods-receipt/post` - Post goods receipt

## Technology Stack

- **Frontend**: React, Vite
- **Backend**: Node.js, Express
- **Integration**: Pillir Flow MCP (Model Context Protocol)
- **SAP**: RFC_READ_TABLE, Production Order BAPIs

## Production Deployment

1. Build frontend: `cd frontend && npm run build`
2. Configure environment variables for production
3. Use process manager (PM2) for backend
4. Set up reverse proxy (nginx) for frontend
5. Enable HTTPS with SSL certificates

## Support

For issues or questions, contact your system administrator.
