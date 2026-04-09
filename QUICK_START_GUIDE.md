# Quick Start Guide - Production Order Execution Flow

## 🚀 Getting Started

### Start the Application

1. **Start Backend Server**
   ```bash
   cd sap-mcp-app/backend
   npm start
   ```
   Server runs on: http://localhost:3003

2. **Start Frontend**
   ```bash
   cd sap-mcp-app/frontend
   npm run dev
   ```
   Frontend runs on: http://localhost:5173

## 📱 Using the Application

### Method 1: Complete Execution Flow (NEW)

**Perfect for: Following the complete production process step-by-step**

1. Click **"Execution Flow"** in the navigation menu
2. Enter or scan a production order number (e.g., `000060005121`)
3. Click **"Start Production Flow"**
4. Follow the 5-step guided process:
   - **Step 1:** View order details → Click "Next"
   - **Step 2:** Review components → Click "Issue Components" or "Skip"
   - **Step 3:** Click "Go to Confirmation" → Enter quantities → Submit
   - **Step 4:** Click "Go to Goods Receipt" → Enter received qty → Submit
   - **Step 5:** Click "Mark as TECO" → Confirm → Complete!

**Benefits:**
- ✅ Data pre-filled automatically
- ✅ Visual progress tracking
- ✅ Guided workflow
- ✅ Less data entry

### Method 2: Standalone Pages (EXISTING)

**Perfect for: Quick single transactions**

#### Order Confirmation
1. Click **"Order Confirmation"** in menu
2. Enter all details manually
3. Submit to SAP

#### Goods Issue
1. Click **"Goods Issue"** in menu
2. Enter order number
3. Load components
4. Select and issue

#### Goods Receipt
1. Click **"Goods Receipt"** in menu
2. Enter all details manually
3. Submit to SAP

#### Technical Completion
1. Click **"TECO"** in menu
2. Enter order number
3. Check status
4. Mark as complete

## 🎯 Key Features

### Navigation Menu
```
Manufacturing Execution System
├── Production Orders     → View all orders
├── Execution Flow       → NEW: Guided 5-step process
├── Order Confirmation   → Quick confirmation
├── Goods Issue         → NEW: Issue components (261)
├── Goods Receipt       → Quick goods receipt (101)
└── TECO               → NEW: Technical completion
```

### What's New?
- 🆕 **Execution Flow** - Complete guided process
- 🆕 **Goods Issue** - Component issue (Movement Type 261)
- 🆕 **TECO** - Technical completion
- ✨ **Enhanced** - Confirmation and Goods Receipt now accept pre-filled data

### What's Unchanged?
- ✅ All existing pages work exactly as before
- ✅ Can still use pages independently
- ✅ Same SAP integration
- ✅ Same data validation

## 📊 Example Workflow

### Complete Production Order: 000060005121

```
1. Scan Order
   └─> Validates in SAP
       └─> Shows order details

2. Issue Components
   └─> Loads BOM from RESB
       └─> Issue Material X: 100 PC
           └─> Posts 261 to SAP

3. Confirm Production
   └─> Pre-filled: Order, Plant, Material
       └─> Enter: Yield 100, Work Center
           └─> Posts confirmation to SAP

4. Goods Receipt
   └─> Pre-filled: Order, Material, Plant
       └─> Enter: Received 100
           └─> Posts 101 to SAP

5. Technical Completion
   └─> Check status: REL, CNF
       └─> Confirm TECO
           └─> Marks order complete in SAP
```

## 🔍 Troubleshooting

### Order Not Found
- ✅ Check order number format (e.g., 000060005121)
- ✅ Verify order exists in SAP
- ✅ Check plant filter if applicable

### Components Not Loading
- ✅ Verify order has BOM components
- ✅ Check RESB table in SAP
- ✅ Ensure order is released

### Confirmation Fails
- ✅ Verify order is released (not TECO)
- ✅ Check work center exists
- ✅ Verify operation number
- ✅ Read SAP error message

### Goods Receipt Fails
- ✅ Verify material number
- ✅ Check storage location
- ✅ Ensure quantity is valid
- ✅ Read SAP error message

### TECO Fails
- ✅ Ensure all confirmations complete
- ✅ Check order status
- ✅ Verify no open operations
- ✅ Read SAP error message

## 📞 API Endpoints

### Production Orders
- `GET /api/production-orders/:orderId` - Get single order
- `POST /api/production-orders/search` - Search orders

### Goods Issue (NEW)
- `GET /api/goods-issue/components/:orderId` - Get components
- `POST /api/goods-issue/post` - Post goods issue (261)

### Production Confirmation
- `POST /api/production-confirmation/confirm` - Confirm order

### Goods Receipt
- `POST /api/goods-receipt/post` - Post goods receipt (101)

### Technical Completion (NEW)
- `GET /api/technical-completion/status/:orderId` - Check status
- `POST /api/technical-completion/teco` - Mark as TECO

## 💡 Tips

### For Best Performance
- Use plant filter when searching orders
- Issue components before confirmation
- Verify quantities before posting
- Check order status before TECO

### For Data Entry
- Use barcode scanner for order numbers
- Tab through form fields
- Pre-filled data can be edited
- Required fields marked with *

### For Error Resolution
- Always read SAP error messages
- Check SAP transaction codes (CO11N, MIGO, etc.)
- Verify master data (materials, work centers)
- Contact SAP team for authorization issues

## 🎓 Training Scenarios

### Scenario 1: New Production Order
1. Start execution flow
2. Scan order: 000060005121
3. Review details
4. Issue all components
5. Confirm production
6. Post goods receipt
7. Mark as TECO

### Scenario 2: Partial Confirmation
1. Go to Order Confirmation
2. Enter order manually
3. Select "Partial" confirmation
4. Enter partial quantity
5. Submit

### Scenario 3: Component Issue Only
1. Go to Goods Issue
2. Enter order number
3. Load components
4. Select specific component
5. Issue partial quantity

### Scenario 4: Quick Goods Receipt
1. Go to Goods Receipt
2. Enter all details
3. Submit directly

## ✅ Success Indicators

### Order Validated
- ✅ Order details displayed
- ✅ Operations loaded
- ✅ Status shown

### Component Issued
- ✅ Material document number received
- ✅ Withdrawn quantity updated
- ✅ Success message from SAP

### Production Confirmed
- ✅ Confirmation number received
- ✅ Confirmed quantity recorded
- ✅ Success message from SAP

### Goods Receipt Posted
- ✅ Material document number received
- ✅ Stock updated in SAP
- ✅ Success message from SAP

### Order Completed
- ✅ TECO status active
- ✅ Order locked for postings
- ✅ Success message from SAP

## 🎉 You're Ready!

The application is fully functional and ready to use. Choose your preferred method:
- **Guided Flow** for complete process
- **Standalone Pages** for quick transactions

All features integrate with SAP in real-time. No data is cached locally.

Happy Manufacturing! 🏭
