# Manufacturing Execution System - Deployment Guide

## Overview
Production-ready SAP integration platform for manufacturing operations including production order management, order confirmation, and goods receipt processing.

## System Requirements

### Backend
- Node.js 16.x or higher
- npm 8.x or higher
- Access to SAP ERP system
- MCP (Model Context Protocol) server configured

### Frontend
- Modern web browser (Chrome, Firefox, Edge, Safari)
- Node.js 16.x or higher for build process

## Installation

### 1. Backend Setup

```bash
cd backend
npm install
```

### 2. Frontend Setup

```bash
cd frontend
npm install
```

## Configuration

### Backend Configuration

1. Configure MCP connection in `backend/mcp-config.json`
2. Set environment variables:
   ```bash
   PORT=3003
   NODE_ENV=production
   ```

### Frontend Configuration

1. Update API endpoint in `frontend/vite.config.js` if needed
2. Build for production:
   ```bash
   cd frontend
   npm run build
   ```

## Running the Application

### Development Mode

**Backend:**
```bash
cd backend
npm start
```

**Frontend:**
```bash
cd frontend
npm run dev
```

### Production Mode

**Backend:**
```bash
cd backend
NODE_ENV=production npm start
```

**Frontend:**
```bash
cd frontend
npm run build
npm run preview
```

## Cloud Deployment

### Option 1: Docker Deployment

Create `Dockerfile` in root:
```dockerfile
FROM node:18-alpine

# Backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --production
COPY backend/ ./

# Frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

EXPOSE 3003
CMD ["node", "/app/backend/server.js"]
```

Build and run:
```bash
docker build -t manufacturing-app .
docker run -p 3003:3003 manufacturing-app
```

### Option 2: AWS Deployment

1. **EC2 Instance:**
   - Launch Ubuntu 22.04 instance
   - Install Node.js and npm
   - Clone repository
   - Run installation steps
   - Use PM2 for process management:
     ```bash
     npm install -g pm2
     pm2 start backend/server.js --name manufacturing-backend
     pm2 startup
     pm2 save
     ```

2. **Load Balancer:**
   - Configure Application Load Balancer
   - Set health check endpoint: `/api/health`
   - Enable HTTPS with SSL certificate

### Option 3: Azure Deployment

1. Create Azure App Service
2. Configure deployment from Git
3. Set environment variables in App Service configuration
4. Deploy using Azure CLI:
   ```bash
   az webapp up --name manufacturing-app --resource-group myResourceGroup
   ```

### Option 4: Google Cloud Platform

1. Create App Engine application
2. Configure `app.yaml`:
   ```yaml
   runtime: nodejs18
   instance_class: F2
   env_variables:
     NODE_ENV: 'production'
   ```
3. Deploy:
   ```bash
   gcloud app deploy
   ```

## Security Considerations

1. **Authentication:** Implement authentication middleware before production
2. **HTTPS:** Always use HTTPS in production
3. **Environment Variables:** Never commit sensitive data
4. **CORS:** Configure CORS properly for your domain
5. **Rate Limiting:** Implement rate limiting on API endpoints
6. **Input Validation:** All inputs are validated on backend

## Monitoring

### Health Check Endpoint
```
GET /api/health
```

### Logging
- Backend logs are written to console
- Use log aggregation service (CloudWatch, Azure Monitor, Stackdriver)
- Monitor SAP connection status

### Performance Metrics
- Response time for SAP queries
- Success/failure rates
- Active connections

## Troubleshooting

### Backend Won't Start
- Check Node.js version: `node --version`
- Verify MCP server is running
- Check port 3003 is available

### SAP Connection Issues
- Verify MCP configuration
- Check network connectivity to SAP
- Review SAP user permissions

### Frontend Build Fails
- Clear node_modules: `rm -rf node_modules && npm install`
- Check Node.js version compatibility
- Verify all dependencies are installed

## Support

For issues or questions:
1. Check application logs
2. Verify SAP connectivity
3. Review configuration files
4. Contact system administrator

## Version
1.0.0 - Production Ready
