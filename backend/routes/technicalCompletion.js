/**
 * Technical Completion Routes (TECO)
 * Handles technical completion of production orders
 */

import express from "express";
import { searchSapBapi, executeSapFunction, connect, isConnected } from "../services/mcpStreamClient.js";

const router = express.Router();

// Try to connect to MCP server on startup
connect().catch(err => {
  console.error('[TECO] MCP connection failed:', err.message);
  console.log('[TECO] Will retry on first request');
});

/**
 * POST /api/technical-completion/teco
 * Mark production order as technically complete
 */
router.post("/teco", async (req, res) => {
  try {
    const { productionOrderId } = req.body;

    console.log("[TECO] Request for order:", productionOrderId);

    if (!productionOrderId) {
      return res.status(400).json({
        success: false,
        error: "Missing required field: productionOrderId",
        source: "SAP_ERP"
      });
    }

    if (!isConnected()) {
      console.log('[TECO] Connecting to SAP...');
      await connect();
    }

    // Clean and pad order ID
    const cleanedOrderId = productionOrderId.replace(/[$#*]/g, '').trim();
    const paddedOrderId = cleanedOrderId.padStart(12, '0');
    
    console.log("[TECO] Order ID:", productionOrderId, "→", paddedOrderId);
    console.log("[TECO] Using BAPI: BAPI_PRODORD_SET_STATUS");

    // Prepare input for BAPI_PRODORD_SET_STATUS
    const inputData = {
      ORDERID: paddedOrderId,
      STATUS: {
        TECO: 'X'  // Technical completion flag
      }
    };

    console.log("[TECO] BAPI Input:", JSON.stringify(inputData, null, 2));

    const expectedOutputStructure = {
      RETURN: [{
        TYPE: 'string',
        ID: 'string',
        NUMBER: 'string',
        MESSAGE: 'string',
        LOG_NO: 'string',
        LOG_MSG_NO: 'string',
        MESSAGE_V1: 'string',
        MESSAGE_V2: 'string',
        MESSAGE_V3: 'string',
        MESSAGE_V4: 'string'
      }]
    };

    console.log("[TECO] Executing BAPI...");
    const executionResult = await executeSapFunction('BAPI_PRODORD_SET_STATUS', inputData, expectedOutputStructure);

    console.log("[TECO] SAP Response:", JSON.stringify(executionResult, null, 2));

    // Check for errors
    let hasError = false;
    let errorMessages = [];
    let successMessages = [];

    if (executionResult.RETURN && Array.isArray(executionResult.RETURN)) {
      for (const returnMsg of executionResult.RETURN) {
        console.log(`[TECO] Return message: Type=${returnMsg.TYPE}, Message=${returnMsg.MESSAGE}`);
        if (returnMsg.TYPE === 'E' || returnMsg.TYPE === 'A') {
          hasError = true;
          errorMessages.push(returnMsg.MESSAGE || 'Unknown error');
        } else if (returnMsg.TYPE === 'S') {
          successMessages.push(returnMsg.MESSAGE || 'Success');
        }
      }
    }

    if (hasError) {
      const errorMessage = errorMessages.length > 0 
        ? errorMessages.join('; ') 
        : 'Technical completion failed';
      
      console.error("[TECO] ❌ SAP Error:", errorMessage);
      return res.status(400).json({
        success: false,
        error: errorMessage,
        sapResponse: executionResult,
        source: "SAP_ERP"
      });
    }

    console.log("[TECO] ✅ Technical completion successful");

    // Commit transaction
    try {
      console.log("[TECO] Committing transaction...");
      await executeSapFunction(
        'BAPI_TRANSACTION_COMMIT',
        { WAIT: 'X' },
        { RETURN: { TYPE: 'string', MESSAGE: 'string' } }
      );
      console.log("[TECO] ✅ Transaction committed");
    } catch (commitError) {
      console.warn("[TECO] ⚠️ Commit warning:", commitError.message);
    }

    res.json({
      success: true,
      productionOrderId: cleanedOrderId,
      requestPayload: inputData,
      sapResponse: executionResult,
      message: successMessages.length > 0 
        ? successMessages.join('; ') 
        : "Production order marked as technically complete",
      source: "SAP_ERP",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("[TECO] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      source: "SAP_ERP"
    });
  }
});

/**
 * GET /api/technical-completion/status/:orderId
 * Check if order is technically complete
 */
router.get("/status/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    
    console.log("[TECO] Checking status for order:", orderId);

    if (!isConnected()) {
      console.log('[TECO] Connecting to SAP...');
      await connect();
    }

    const paddedOrderId = orderId.replace(/[$#*]/g, '').trim().padStart(12, '0');

    // Check JEST table for TECO status
    const result = await executeSapFunction(
      'RFC_READ_TABLE',
      {
        QUERY_TABLE: 'JEST',
        DELIMITER: '|',
        FIELDS: [
          { FIELDNAME: 'OBJNR' },
          { FIELDNAME: 'STAT' },
          { FIELDNAME: 'INACT' }
        ],
        OPTIONS: [{ TEXT: `OBJNR = 'OR${paddedOrderId}'` }],
        ROWCOUNT: 50
      },
      {
        DATA: [{ WA: 'string' }]
      }
    );

    const statuses = [];
    let isTeco = false;

    if (result.DATA && Array.isArray(result.DATA)) {
      for (const row of result.DATA) {
        if (!row.WA) continue;
        const fields = row.WA.split('|');
        const stat = fields[1]?.trim() || '';
        const inact = fields[2]?.trim() || '';
        
        if (inact !== 'X' && stat) {
          statuses.push(stat);
          if (stat === 'TECO') {
            isTeco = true;
          }
        }
      }
    }

    console.log(`[TECO] Order statuses:`, statuses);
    console.log(`[TECO] Is TECO: ${isTeco}`);

    res.json({
      success: true,
      productionOrderId: orderId,
      isTechnicallyComplete: isTeco,
      statuses: statuses,
      source: "SAP_ERP",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("[TECO] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      source: "SAP_ERP"
    });
  }
});

export default router;
