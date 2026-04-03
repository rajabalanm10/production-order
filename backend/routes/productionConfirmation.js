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
 * Body: { productionOrderId, plant, material, yieldQuantity, scrapQuantity, workCenter, confirmationType }
 */
router.post("/confirm", async (req, res) => {
  try {
    const {
      productionOrderId,
      plant,
      material,
      yieldQuantity,
      scrapQuantity,
      workCenter,
      confirmationType
    } = req.body;

    console.log("[Production Confirmation] Confirm request:", {
      productionOrderId,
      plant,
      material,
      yieldQuantity,
      scrapQuantity,
      workCenter,
      confirmationType
    });

    // Validate inputs - material is optional
    if (!productionOrderId || !plant || !yieldQuantity) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: productionOrderId, plant, yieldQuantity"
      });
    }

    if (!isConnected()) {
      console.log('[Production Confirmation] Not connected, attempting connection...');
      await connect();
    }

    console.log("[Production Confirmation] Step 1: Validating production order exists in SAP...");
    
    // Clean the order number before validation - remove special chars and leading zeros
    let cleanedOrderId = productionOrderId.replace(/[$#*]/g, '').trim();
    cleanedOrderId = cleanedOrderId.replace(/^0+/, '') || '0';
    
    console.log("[Production Confirmation] Original order ID:", productionOrderId);
    console.log("[Production Confirmation] Cleaned order ID:", cleanedOrderId);
    
    // Pad to 12 digits for SAP query
    const paddedOrderId = cleanedOrderId.padStart(12, '0');
    console.log("[Production Confirmation] Padded order ID for query:", paddedOrderId);
    
    // First, verify the production order exists
    try {
      const orderCheck = await executeSapFunction(
        'RFC_READ_TABLE',
        {
          QUERY_TABLE: 'AUFK',
          DELIMITER: '|',
          FIELDS: [
            { FIELDNAME: 'AUFNR' },
            { FIELDNAME: 'WERKS' },
            { FIELDNAME: 'AUART' }
          ],
          OPTIONS: [{ TEXT: `AUFNR = '${paddedOrderId}'` }],
          ROWCOUNT: 1
        },
        {
          DATA: [{ WA: 'string' }]
        }
      );

      if (!orderCheck.DATA || orderCheck.DATA.length === 0) {
        return res.status(404).json({
          success: false,
          error: `Production order ${cleanedOrderId} not found in SAP`,
          message: "Please verify the production order number",
          searchedFor: paddedOrderId
        });
      }

      console.log("[Production Confirmation] ✓ Production order found in SAP");
    } catch (checkError) {
      console.warn("[Production Confirmation] Could not verify order:", checkError.message);
    }

    // Use BAPI_PRODORDCONF_CREATE_TT with corrected structure
    const selectedBAPI = "BAPI_PRODORDCONF_CREATE_TT";
    console.log(`[Production Confirmation] Step 2: Using BAPI: ${selectedBAPI}`);

    // Prepare input data with all required fields for BAPI_PRODORDCONF_CREATE_TT
    const currentDate = new Date().toISOString().split('T')[0].replace(/-/g, '');
    
    const inputData = {
      TIMETICKETS: [{
        ORDERID: paddedOrderId,
        PLANT: plant,
        YIELD: parseFloat(yieldQuantity).toString(),
        SCRAP: parseFloat(scrapQuantity || 0).toString(),
        POSTG_DATE: currentDate,
        CONF_ACTIVITY: '1001', // Standard confirmation activity
        CLEAR_RES: '', // Don't clear reservations
        FIN_CONF: confirmationType === 'F' ? 'X' : ''
      }]
    };

    // Add optional fields
    if (material) {
      inputData.TIMETICKETS[0].MATERIAL = material.padStart(18, '0');
    }
    if (workCenter) {
      inputData.TIMETICKETS[0].WORK_CNTR = workCenter;
    }

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
        : 'Confirmation failed - check production order details (order type, work center, operation may be required)';
      
      console.error("[Production Confirmation] ❌ SAP returned error:", errorMessage);
      return res.status(400).json({
        success: false,
        error: errorMessage,
        sapResponse: executionResult,
        message: "Failed to confirm production order in SAP",
        hint: "Make sure the production order exists, is released, and all required fields are provided"
      });
    }

    console.log("[Production Confirmation] ✅ Confirmation posted to SAP successfully");
    console.log("[Production Confirmation] Confirmation Number:", confirmationNumber);

    if (hasError) {
      console.error("[Production Confirmation] ❌ SAP returned error:", errorMessage);
      return res.status(400).json({
        success: false,
        error: errorMessage,
        sapResponse: executionResult,
        message: "Failed to confirm production order in SAP"
      });
    }

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
