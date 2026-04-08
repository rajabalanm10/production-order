/**
 * Production Order Confirmation Routes
 * Handles production order confirmations
 */

import express from "express";
import { searchSapBapi, executeSapFunction, connect, isConnected } from "../services/mcpStreamClient.js";

const router = express.Router();

// Try to connect to MCP server on startup
connect().catch(err => {
  console.error('[Production Confirmation] MCP connection failed:', err.message);
  console.log('[Production Confirmation] Will retry on first request');
});

/**
 * POST /api/production-confirmation/search
 * Search for production order confirmation BAPI
 */
router.post("/search", async (req, res) => {
  try {
    console.log("[Production Confirmation] Search request received");

    if (!isConnected()) {
      console.log('[Production Confirmation] Not connected, attempting connection...');
      await connect();
    }

    const searchPayload = {
      name: "Production Order Confirmation",
      description: "Find BAPIs for confirming production orders",
      apis: [{
        name: "PP",
        description: "Production Planning",
        system_type: "SAP_ECC",
        functions: [{
          name: "CONFIRM",
          description: "Confirm Production Order",
          rfc: true
        }]
      }]
    };

    const searchResults = await searchSapBapi(searchPayload);

    res.json({
      success: true,
      data: searchResults,
      availableBAPIs: [
        "BAPI_PRODORDCONF_CREATE_TT",
        "BAPI_PRODORDCONF_GET_DETAIL"
      ]
    });
  } catch (error) {
    console.error("[Production Confirmation] Search error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/production-confirmation/confirm
 * Confirm a production order
 * Body: { productionOrderId, plant, operation, material, yieldQuantity, scrapQuantity, workCenter, confirmationType }
 */
router.post("/confirm", async (req, res) => {
  try {
    const {
      productionOrderId,
      plant,
      operation,
      material,
      yieldQuantity,
      scrapQuantity,
      workCenter,
      confirmationType
    } = req.body;

    console.log("[Production Confirmation] Confirm request:", {
      productionOrderId,
      plant,
      operation,
      material,
      yieldQuantity,
      scrapQuantity,
      workCenter,
      confirmationType
    });

    // Validate inputs
    if (!productionOrderId || !plant || !yieldQuantity || !workCenter || !operation) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: productionOrderId, plant, operation, workCenter, yieldQuantity",
        source: "SAP_ERP"
      });
    }

    if (!isConnected()) {
      console.log('[Production Confirmation] Not connected, attempting connection...');
      await connect();
    }

    console.log("[Production Confirmation] Step 1: Calling BAPI to confirm production order...");

    // Clean the order number - remove special chars but keep leading zeros
    let cleanedOrderId = productionOrderId.replace(/[$#*]/g, '').trim();
    const paddedOrderId = cleanedOrderId.padStart(12, '0');
    
    console.log("[Production Confirmation] Order ID:", productionOrderId, "→", paddedOrderId);

    // Use BAPI_PRODORDCONF_CREATE_TT - let SAP handle all validation
    const selectedBAPI = "BAPI_PRODORDCONF_CREATE_TT";
    console.log(`[Production Confirmation] Using BAPI: ${selectedBAPI}`);

    // Prepare input data with all required fields for BAPI_PRODORDCONF_CREATE_TT
    // Format date as DD.MM.YYYY for SAP
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const currentDate = `${day}.${month}.${year}`;
    
    console.log("[Production Confirmation] Posting date:", currentDate);
    
    const inputData = {
      TIMETICKETS: [{
        ORDERID: paddedOrderId,
        OPERATION: operation.padStart(4, '0'), // Pad operation to 4 digits
        PLANT: plant,
        WORK_CNTR: workCenter,
        YIELD: parseFloat(yieldQuantity).toString(),
        SCRAP: parseFloat(scrapQuantity || 0).toString(),
        POSTG_DATE: currentDate,
        CONF_ACTIVITY: '1001', // Standard confirmation activity
        CLEAR_RES: '', // Don't clear reservations
        FIN_CONF: confirmationType === 'F' ? 'X' : ''
      }]
    };

    // Add optional material field
    if (material && material.trim() !== '') {
      inputData.TIMETICKETS[0].MATERIAL = material.padStart(18, '0');
    }

    console.log("[Production Confirmation] BAPI Input:", JSON.stringify(inputData, null, 2));

    // Define expected output structure
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
      }],
      GOODSMOVEMENTS: [{
        ORDERID: 'string',
        MATERIAL: 'string',
        PLANT: 'string',
        STGE_LOC: 'string',
        MOVE_TYPE: 'string',
        ENTRY_QNT: 'string',
        ENTRY_UOM: 'string'
      }],
      DETAIL_RETURN: [{
        ORDERID: 'string',
        CONF_NO: 'string',
        CONF_CNT: 'string',
        TYPE: 'string',
        MESSAGE: 'string'
      }]
    };

    // Execute BAPI to post confirmation to SAP
    console.log("[Production Confirmation] Executing BAPI and posting to SAP...");
    console.log("[Production Confirmation] Input data:", JSON.stringify(inputData, null, 2));
    
    const executionResult = await executeSapFunction(selectedBAPI, inputData, expectedOutputStructure);

    console.log("[Production Confirmation] SAP Response:", JSON.stringify(executionResult, null, 2));

    // Check for errors in RETURN and DETAIL_RETURN
    let hasError = false;
    let errorMessages = [];
    let confirmationNumber = '';

    // Check main RETURN table
    if (executionResult.RETURN && Array.isArray(executionResult.RETURN)) {
      for (const returnMsg of executionResult.RETURN) {
        console.log(`[Production Confirmation] Return message: Type=${returnMsg.TYPE}, Message=${returnMsg.MESSAGE}`);
        if (returnMsg.TYPE === 'E' || returnMsg.TYPE === 'A') {
          hasError = true;
          errorMessages.push(returnMsg.MESSAGE || 'Unknown error');
        }
      }
    }

    // Check DETAIL_RETURN for confirmation details and errors
    if (executionResult.DETAIL_RETURN && Array.isArray(executionResult.DETAIL_RETURN)) {
      for (const detail of executionResult.DETAIL_RETURN) {
        console.log(`[Production Confirmation] Detail: CONF_NO=${detail.CONF_NO}, Type=${detail.TYPE}, Message=${detail.MESSAGE}`);
        
        if (detail.CONF_NO && detail.CONF_NO !== '0000000000') {
          confirmationNumber = detail.CONF_NO;
        }
        
        if (detail.TYPE === 'E' || detail.TYPE === 'A') {
          hasError = true;
          if (detail.MESSAGE) {
            errorMessages.push(detail.MESSAGE);
          }
        }
      }
    }

    if (hasError || !confirmationNumber || confirmationNumber === '0000000000') {
      const errorMessage = errorMessages.length > 0 
        ? errorMessages.join('; ') 
        : 'Confirmation failed';
      
      console.error("[Production Confirmation] ❌ SAP Error:", errorMessage);
      return res.status(400).json({
        success: false,
        error: errorMessage,
        sapResponse: executionResult,
        source: "SAP_ERP"
      });
    }

    console.log("[Production Confirmation] ✅ Confirmation posted to SAP successfully");
    console.log("[Production Confirmation] Confirmation Number:", confirmationNumber);

    // Commit the transaction in SAP
    try {
      console.log("[Production Confirmation] Committing transaction in SAP...");
      await executeSapFunction(
        'BAPI_TRANSACTION_COMMIT',
        {
          WAIT: 'X'
        },
        {
          RETURN: {
            TYPE: 'string',
            MESSAGE: 'string'
          }
        }
      );
      console.log("[Production Confirmation] ✅ Transaction committed in SAP");
    } catch (commitError) {
      console.warn("[Production Confirmation] ⚠️ Commit warning:", commitError.message);
    }

    res.json({
      success: true,
      confirmationId: confirmationNumber,
      selectedBAPI,
      requestPayload: inputData,
      sapResponse: executionResult,
      message: "Production order confirmed successfully in SAP",
      liveSapCall: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[Production Confirmation] Confirm error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/production-confirmation/:id
 * Get confirmation details from SAP
 */
router.get("/:id", async (req, res) => {
  try {
    const confirmationId = req.params.id;
    
    console.log("[Production Confirmation] Getting confirmation from SAP:", confirmationId);

    if (!isConnected()) {
      console.log('[Production Confirmation] Not connected, attempting connection...');
      await connect();
    }

    // Call SAP to get confirmation details
    const result = await executeSapFunction(
      'BAPI_PRODORDCONF_GET_DETAIL',
      {
        CONFIRMATION: confirmationId
      },
      {
        RETURN: { TYPE: 'string', MESSAGE: 'string' },
        DETAIL_RETURN: {
          CONF_NO: 'string',
          ORDERID: 'string',
          PLANT: 'string',
          MATERIAL: 'string',
          YIELD: 'string'
        }
      }
    );

    if (result.RETURN && result.RETURN.TYPE === 'E') {
      throw new Error(result.RETURN.MESSAGE || 'Confirmation not found in SAP');
    }

    res.json({
      success: true,
      data: result,
      source: "LIVE_SAP_VIA_MCP",
      liveSapCall: true
    });
  } catch (error) {
    console.error("[Production Confirmation] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
