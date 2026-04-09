/**
 * SAP MCP Integration Server
 * Express server for handling Production Order Confirmation and Goods Receipt
 */

import express from "express";
import cors from "cors";
import productionConfirmationRoutes from "./routes/productionConfirmation.js";
import goodsReceiptRoutes from "./routes/goodsReceipt.js";
import productionOrdersRoutes from "./routes/productionOrders.js";
import goodsIssueRoutes from "./routes/goodsIssue.js";
import technicalCompletionRoutes from "./routes/technicalCompletion.js";

// Import MCP tools (these should be available in the Kiro environment)
export let mcp_pillir_flow_search_sap;
export let mcp_pillir_flow_execute_function;

// Try to import MCP tools if available
try {
  // These functions should be available in the Kiro environment
  // when the Pillir Flow MCP server is configured
  if (typeof globalThis.mcp_pillir_flow_search_sap === 'function') {
    mcp_pillir_flow_search_sap = globalThis.mcp_pillir_flow_search_sap;
    mcp_pillir_flow_execute_function = globalThis.mcp_pillir_flow_execute_function;
    console.log("✅ MCP tools loaded successfully");
  } else {
    console.log("⚠️  MCP tools not available - using simulation mode");
  }
} catch (error) {
  console.log("⚠️  MCP tools not available - using simulation mode:", error.message);
}

const app = express();
const PORT = process.env.PORT || 3003;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use("/api/production-confirmation", productionConfirmationRoutes);
app.use("/api/goods-receipt", goodsReceiptRoutes);
app.use("/api/production-orders", productionOrdersRoutes);
app.use("/api/goods-issue", goodsIssueRoutes);
app.use("/api/technical-completion", technicalCompletionRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    message: "SAP MCP Integration Server is running"
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("[Server Error]", err);
  res.status(500).json({
    success: false,
    error: err.message || "Internal server error"
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 SAP MCP Integration Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`\nAvailable endpoints:`);
  console.log(`  POST /api/production-confirmation/search`);
  console.log(`  POST /api/production-confirmation/confirm`);
  console.log(`  POST /api/goods-receipt/search`);
  console.log(`  POST /api/goods-receipt/post`);
  console.log(`  POST /api/goods-issue/post`);
  console.log(`  GET  /api/goods-issue/components/:orderId`);
  console.log(`  POST /api/technical-completion/teco`);
  console.log(`  GET  /api/technical-completion/status/:orderId`);
  console.log(`  GET  /api/production-orders/confirmations`);
  console.log(`  POST /api/production-orders/search`);
  console.log(`  GET  /api/production-orders/:orderId\n`);
});
