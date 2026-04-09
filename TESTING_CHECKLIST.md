# Testing Checklist - Production Order Execution Flow

## 🧪 Pre-Testing Setup

### Prerequisites
- [ ] Backend server running on http://localhost:3003
- [ ] Frontend running on http://localhost:5173
- [ ] Pillir Flow MCP server accessible
- [ ] Valid SAP credentials configured
- [ ] Test production order numbers available

### Test Data Required
- Production Order Number (e.g., 000060005121)
- Plant Code (e.g., SL31)
- Material Number
- Work Center
- Storage Location

---

## 📋 Test Scenarios

### 1. Production Order Scan & Validation

#### Test 1.1: Valid Order Scan
- [ ] Navigate to "Execution Flow"
- [ ] Enter valid production order number
- [ ] Click "Start Production Flow"
- [ ] **Expected:** Order validated, navigates to execution flow
- [ ] **Expected:** Order details displayed correctly

#### Test 1.2: Invalid Order Scan
- [ ] Navigate to "Execution Flow"
- [ ] Enter invalid/non-existent order number
- [ ] Click "Start Production Flow"
- [ ] **Expected:** Error message from SAP displayed
- [ ] **Expected:** User remains on scan page

#### Test 1.3: Empty Order Number
- [ ] Navigate to "Execution Flow"
- [ ] Leave order number empty
- [ ] Click "Start Production Flow"
- [ ] **Expected:** Validation error shown
- [ ] **Expected:** Form not submitted

---

### 2. Production Execution Flow - Step 1: Order Details

#### Test 2.1: View Order Details
- [ ] Complete valid order scan
- [ ] **Expected:** Order number displayed prominently
- [ ] **Expected:** Plant, Material, Material Description shown
- [ ] **Expected:** Target Quantity displayed
- [ ] **Expected:** Confirmed Quantity displayed
- [ ] **Expected:** Remaining Quantity calculated correctly
- [ ] **Expected:** Order Type shown
- [ ] **Expected:** Operations list displayed (if available)

#### Test 2.2: Navigate to Next Step
- [ ] Click "Next: Issue Components →"
- [ ] **Expected:** Progress indicator updates to Step 2
- [ ] **Expected:** Components section displayed

---

### 3. Production Execution Flow - Step 2: Issue Components

#### Test 3.1: Load Components
- [ ] Navigate to Step 2
- [ ] **Expected:** Components loaded from SAP RESB table
- [ ] **Expected:** Table shows: Material, Required, Withdrawn, Remaining, Unit, Storage Loc
- [ ] **Expected:** Remaining quantity calculated correctly

#### Test 3.2: Navigate to Goods Issue
- [ ] Click "Issue Components" button
- [ ] **Expected:** Navigates to Goods Issue page
- [ ] **Expected:** Order number pre-filled
- [ ] **Expected:** Components loaded automatically

#### Test 3.3: Skip Components Step
- [ ] Click "Skip / Next →"
- [ ] **Expected:** Progress indicator updates to Step 3
- [ ] **Expected:** Confirmation section displayed

---

### 4. Goods Issue (Movement Type 261)

#### Test 4.1: Load Components Standalone
- [ ] Navigate to "Goods Issue" from menu
- [ ] Enter production order number
- [ ] Click "Load Components"
- [ ] **Expected:** Components fetched from SAP
- [ ] **Expected:** Table populated with component data

#### Test 4.2: Select Component
- [ ] Click on a component row
- [ ] **Expected:** Row highlighted
- [ ] **Expected:** Issue form displayed below
- [ ] **Expected:** Component details shown
- [ ] **Expected:** Quantity field pre-filled with remaining quantity

#### Test 4.3: Issue Component - Valid
- [ ] Select a component
- [ ] Enter valid quantity (≤ remaining)
- [ ] Click "Post Goods Issue"
- [ ] **Expected:** Success message displayed
- [ ] **Expected:** Material document number received
- [ ] **Expected:** Components table refreshes
- [ ] **Expected:** Withdrawn quantity updated

#### Test 4.4: Issue Component - Exceed Remaining
- [ ] Select a component
- [ ] Enter quantity > remaining quantity
- [ ] Click "Post Goods Issue"
- [ ] **Expected:** SAP error message displayed
- [ ] **Expected:** Transaction not posted

#### Test 4.5: Issue Component - Invalid Data
- [ ] Select a component
- [ ] Enter invalid quantity (negative, zero, non-numeric)
- [ ] Click "Post Goods Issue"
- [ ] **Expected:** Validation error or SAP error
- [ ] **Expected:** Transaction not posted

---

### 5. Production Execution Flow - Step 3: Confirm Production

#### Test 5.1: Navigate to Confirmation
- [ ] Navigate to Step 3 in execution flow
- [ ] Click "Go to Confirmation"
- [ ] **Expected:** Navigates to Production Confirmation page
- [ ] **Expected:** Order number pre-filled
- [ ] **Expected:** Plant pre-filled
- [ ] **Expected:** Material pre-filled
- [ ] **Expected:** Work center pre-filled (if available)

#### Test 5.2: Pre-filled Data Editable
- [ ] Verify all pre-filled fields can be edited
- [ ] **Expected:** User can modify any field if needed

---

### 6. Production Confirmation

#### Test 6.1: Confirm Production - Valid
- [ ] Enter/verify all required fields
- [ ] Enter yield quantity
- [ ] Select confirmation type (Partial/Final)
- [ ] Click "Confirm Production Order"
- [ ] **Expected:** Success message displayed
- [ ] **Expected:** Confirmation ID received
- [ ] **Expected:** SAP response shown

#### Test 6.2: Confirm Production - Missing Required Fields
- [ ] Leave required fields empty
- [ ] Click "Confirm Production Order"
- [ ] **Expected:** Validation errors shown
- [ ] **Expected:** Form not submitted

#### Test 6.3: Confirm Production - Invalid Work Center
- [ ] Enter non-existent work center
- [ ] Fill other fields correctly
- [ ] Click "Confirm Production Order"
- [ ] **Expected:** SAP error message displayed
- [ ] **Expected:** Transaction not posted

#### Test 6.4: Confirm Production - Invalid Operation
- [ ] Enter non-existent operation
- [ ] Fill other fields correctly
- [ ] Click "Confirm Production Order"
- [ ] **Expected:** SAP error message displayed
- [ ] **Expected:** Transaction not posted

---

### 7. Production Execution Flow - Step 4: Goods Receipt

#### Test 7.1: Navigate to Goods Receipt
- [ ] Navigate to Step 4 in execution flow
- [ ] Click "Go to Goods Receipt"
- [ ] **Expected:** Navigates to Goods Receipt page
- [ ] **Expected:** Order number pre-filled
- [ ] **Expected:** Material pre-filled
- [ ] **Expected:** Plant pre-filled

---

### 8. Goods Receipt (Movement Type 101)

#### Test 8.1: Post Goods Receipt - Valid
- [ ] Enter/verify all required fields
- [ ] Enter received quantity
- [ ] Enter storage location (optional)
- [ ] Click "Post Goods Receipt"
- [ ] **Expected:** Success message displayed
- [ ] **Expected:** Material document number received
- [ ] **Expected:** SAP response shown

#### Test 8.2: Post Goods Receipt - Missing Required Fields
- [ ] Leave required fields empty
- [ ] Click "Post Goods Receipt"
- [ ] **Expected:** Validation errors shown
- [ ] **Expected:** Form not submitted

#### Test 8.3: Post Goods Receipt - Invalid Material
- [ ] Enter non-existent material
- [ ] Fill other fields correctly
- [ ] Click "Post Goods Receipt"
- [ ] **Expected:** SAP error message displayed
- [ ] **Expected:** Transaction not posted

---

### 9. Production Execution Flow - Step 5: Technical Completion

#### Test 9.1: Navigate to TECO
- [ ] Navigate to Step 5 in execution flow
- [ ] Click "Mark as TECO"
- [ ] **Expected:** Navigates to Technical Completion page
- [ ] **Expected:** Order number pre-filled

---

### 10. Technical Completion (TECO)

#### Test 10.1: Check Order Status
- [ ] Enter production order number
- [ ] Click "Check Status"
- [ ] **Expected:** Order status fetched from SAP
- [ ] **Expected:** TECO status displayed (Complete/Not Complete)
- [ ] **Expected:** Active statuses shown (REL, CNF, TECO, etc.)

#### Test 10.2: Mark as TECO - Valid
- [ ] Enter order number (not already TECO)
- [ ] Click "Check Status" (optional)
- [ ] Click "Mark as Technically Complete"
- [ ] Confirm in dialog
- [ ] **Expected:** Success message displayed
- [ ] **Expected:** Order marked as TECO in SAP
- [ ] **Expected:** Status refreshes automatically

#### Test 10.3: Mark as TECO - Already Complete
- [ ] Enter order number already marked as TECO
- [ ] Click "Check Status"
- [ ] **Expected:** Status shows "COMPLETE"
- [ ] **Expected:** Message indicates order already complete
- [ ] **Expected:** TECO button disabled or hidden

#### Test 10.4: Mark as TECO - Confirmation Dialog
- [ ] Click "Mark as Technically Complete"
- [ ] **Expected:** Warning dialog appears
- [ ] **Expected:** Dialog explains TECO prevents further postings
- [ ] Click "Cancel"
- [ ] **Expected:** Dialog closes, no action taken

---

### 11. Backward Compatibility Tests

#### Test 11.1: Standalone Confirmation Page
- [ ] Navigate directly to "Order Confirmation" from menu
- [ ] Enter all fields manually (no pre-fill)
- [ ] Submit confirmation
- [ ] **Expected:** Works exactly as before
- [ ] **Expected:** No errors or issues

#### Test 11.2: Standalone Goods Receipt Page
- [ ] Navigate directly to "Goods Receipt" from menu
- [ ] Enter all fields manually (no pre-fill)
- [ ] Submit goods receipt
- [ ] **Expected:** Works exactly as before
- [ ] **Expected:** No errors or issues

#### Test 11.3: Production Orders List
- [ ] Navigate to "Production Orders"
- [ ] Search for orders
- [ ] View order details
- [ ] **Expected:** All existing functionality works
- [ ] **Expected:** No changes to behavior

---

### 12. Navigation & UI Tests

#### Test 12.1: Navigation Menu
- [ ] Verify all menu items visible
- [ ] Click each menu item
- [ ] **Expected:** Correct page loads for each item
- [ ] **Expected:** Active menu item highlighted

#### Test 12.2: Progress Tracker
- [ ] Start execution flow
- [ ] Navigate through steps
- [ ] **Expected:** Progress indicator updates correctly
- [ ] **Expected:** Completed steps marked with checkmark
- [ ] **Expected:** Current step highlighted
- [ ] **Expected:** Can click on steps to navigate

#### Test 12.3: Back Navigation
- [ ] Use browser back button during flow
- [ ] **Expected:** Returns to previous page
- [ ] **Expected:** Data preserved (if applicable)

#### Test 12.4: Direct URL Access
- [ ] Access `/production-execution/:orderId` directly
- [ ] **Expected:** Order data loads from SAP
- [ ] **Expected:** Flow works correctly

---

### 13. Error Handling Tests

#### Test 13.1: Network Error
- [ ] Stop backend server
- [ ] Try any operation
- [ ] **Expected:** Network error message displayed
- [ ] **Expected:** User informed of issue

#### Test 13.2: SAP Connection Error
- [ ] Simulate MCP server unavailable
- [ ] Try any operation
- [ ] **Expected:** Connection error message displayed
- [ ] **Expected:** Instruction to check MCP server

#### Test 13.3: SAP Business Error
- [ ] Try to confirm unreleased order
- [ ] **Expected:** SAP error message displayed
- [ ] **Expected:** No generic error messages

#### Test 13.4: Timeout Error
- [ ] Trigger long-running query
- [ ] **Expected:** Timeout error handled gracefully
- [ ] **Expected:** User informed of timeout

---

### 14. Data Validation Tests

#### Test 14.1: Date Format
- [ ] Check all date displays
- [ ] **Expected:** All dates in DD.MM.YYYY format
- [ ] **Expected:** SAP dates converted correctly

#### Test 14.2: Quantity Precision
- [ ] Enter decimal quantities
- [ ] **Expected:** Decimals handled correctly
- [ ] **Expected:** Display shows 2 decimal places

#### Test 14.3: Order Number Cleaning
- [ ] Enter order with special characters ($, #, *)
- [ ] **Expected:** Characters removed before SAP call
- [ ] **Expected:** Order processed correctly

#### Test 14.4: Leading Zeros
- [ ] Enter order without leading zeros
- [ ] **Expected:** Padded to 12 characters for SAP
- [ ] **Expected:** Order found correctly

---

### 15. Performance Tests

#### Test 15.1: Component Loading Speed
- [ ] Load order with many components
- [ ] **Expected:** Components load within 3 seconds
- [ ] **Expected:** Loading indicator shown

#### Test 15.2: Order Validation Speed
- [ ] Scan production order
- [ ] **Expected:** Validation completes within 2 seconds
- [ ] **Expected:** Loading indicator shown

#### Test 15.3: Multiple Operations
- [ ] Perform multiple transactions in sequence
- [ ] **Expected:** Each operation completes successfully
- [ ] **Expected:** No performance degradation

---

### 16. Integration Tests

#### Test 16.1: Complete Flow End-to-End
- [ ] Start with order scan
- [ ] Complete all 5 steps
- [ ] Issue components
- [ ] Confirm production
- [ ] Post goods receipt
- [ ] Mark as TECO
- [ ] **Expected:** All steps complete successfully
- [ ] **Expected:** Data consistent across steps
- [ ] **Expected:** SAP updated correctly

#### Test 16.2: Partial Flow
- [ ] Start execution flow
- [ ] Complete only some steps
- [ ] Skip others
- [ ] **Expected:** Skipped steps don't cause errors
- [ ] **Expected:** Completed steps recorded in SAP

---

## 📊 Test Results Summary

### Pass/Fail Tracking
- Total Tests: 60+
- Passed: ___
- Failed: ___
- Blocked: ___
- Not Tested: ___

### Critical Issues Found
1. 
2. 
3. 

### Minor Issues Found
1. 
2. 
3. 

### Recommendations
1. 
2. 
3. 

---

## ✅ Sign-Off

### Tested By
- Name: _______________
- Date: _______________
- Signature: _______________

### Approved By
- Name: _______________
- Date: _______________
- Signature: _______________

---

## 📝 Notes

### Environment Details
- Backend URL: _______________
- Frontend URL: _______________
- SAP System: _______________
- MCP Server: _______________

### Test Data Used
- Production Orders: _______________
- Plants: _______________
- Materials: _______________
- Work Centers: _______________

### Additional Comments
_______________________________________________
_______________________________________________
_______________________________________________
