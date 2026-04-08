/**
 * Goods Receipt Routes
 * Handles goods receipt posting
 */

import express from "express";
import { searchSapBapi, executeSapFunction, connect, isConnected } from "../services/mcpStreamClient.js";

const router = express.Router();

// Try to connect to MCP server on startup
connect().catch(err => {
  console.error('[Goods Receipt] MCP connection failed:', err.message);
  console.log('[Goods Receipt] Will retry on first request');
});

/**
 * POST /api/goods-receipt/search
 * Search for goods receipt BAPI
 */
router.post("/search", async (req, res) => {
  try {
    console.log("[Goods Receipt] Search request received");

    if (!isConnected()) {
      console.log('[Goods Receipt] Not connected, attempting connection...');
      await connect();
    }

    const searchPayload = {
      name: "Goods Receipt",
      description: "Find BAPIs for posting goods receipt",
      apis: [{
        name: "MM",
        description: "Materials Management",
        system_type: "SAP_ECC",
        functions: [{
          name: "GOODS_RECEIPT",
          description: "Post Goods Receipt",
          rfc: true
        }]
      }]
    };

    const searchResults = await searchSapBapi(searchPayload);

    res.json({
      success: true,
      data: searchResults,
      availableBAPIs: [
        "BAPI_GOODSMVT_CREATE",
        "BAPI_GOODSMVT_GET_DETAIL"
      ]
    });
  } catch (error) {
    console.error("[Goods Receipt] Search error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/goods-receipt/post
 * Post goods receipt for a production order
 * Body: { productionOrderId, material, plant, receivedQuantity, storageLocation }
 */
router.post("/post", async (req, res) => {
  try {
    const {
      productionOrderId,
      material,
      plant,
      receivedQuantity,
      storageLocation
    } = req.body;

    console.log("[Goods Receipt] Post request:", {
      productionOrderId,
      material,
      plant,
      receivedQuantity,
      storageLocation
    });

    // Validate inputs
    if (!productionOrderId || !material || !plant || !receivedQuantity) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: productionOrderId, material, plant, receivedQuantity"
      });
    }

    if (!isConnected()) {
      console.log('[Goods Receipt] Not connected, attempting connection...');
      await connect();
    }

    console.log("[Goods Receipt] Step 1: Preparing goods receipt for SAP...");
    console.log(`[Goods Receipt] Step 2: Using BAPI: BAPI_GOODSMVT_CREATE`);

    // Step 3: Prepare input data for BAPI_GOODSMVT_CREATE
    // Format date as DD.MM.YYYY for SAP
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const postingDate = `${day}.${month}.${year}`;
    
    console.log("[Goods Receipt] Posting date:", postingDate);
    
    const inputData = {
      GOODSMVT_HEADER: {
        PSTNG_DATE: postingDate,
        DOC_DATE: postingDate,
        REF_DOC_NO: productionOrderId
      },
      GOODSMVT_CODE: {
        GM_CODE: '01' // 01 = Goods receipt
      },
      GOODSMVT_ITEM: [{
        MATERIAL: material.padStart(18, '0'),
        PLANT: plant,
        STGE_LOC: storageLocation || '0001',
        MOVE_TYPE: '101', // 101 = Goods receipt for production order
        ENTRY_QNT: parseFloat(receivedQuantity).toString(),
        ORDERID: productionOrderId.padStart(12, '0')
      }]
    };

    console.log("[Goods Receipt] BAPI Input:", JSON.stringify(inputData, null, 2));

    // Step 4: Define expected output structure
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
      MATERIALDOCUMENT: 'string',
      MATDOC_DOCUMENTYEAR: 'string',
      GOODSMVT_HEADRET: {
        MAT_DOC: 'string',
        DOC_YEAR: 'string'
      }
    };

    // Step 5: Execute BAPI and post to SAP
    console.log("[Goods Receipt] Step 3: Executing BAPI and posting to SAP...");
    const executionResult = await executeSapFunction('BAPI_GOODSMVT_CREATE', inputData, expectedOutputStructure);

    console.log("[Goods Receipt] SAP Response:", JSON.stringify(executionResult, null, 2));

    // Check for errors in RETURN table
    let hasError = false;
    let errorMessages = [];
    let materialDocument = '';

    if (executionResult.RETURN && Array.isArray(executionResult.RETURN)) {
      for (const returnMsg of executionResult.RETURN) {
        console.log(`[Goods Receipt] Return message: Type=${returnMsg.TYPE}, Message=${returnMsg.MESSAGE}`);
        if (returnMsg.TYPE === 'E' || returnMsg.TYPE === 'A') {
          hasError = true;
          errorMessages.push(returnMsg.MESSAGE || 'Unknown error');
        }
      }
    }

    // Get material document number
    materialDocument = executionResult.MATERIALDOCUMENT || 
                      executionResult.GOODSMVT_HEADRET?.MAT_DOC || 
                      '';

    if (hasError || !materialDocument) {
      const errorMessage = errorMessages.length > 0 
        ? errorMessages.join('; ') 
        : 'Goods receipt failed';
      
      console.error("[Goods Receipt] ❌ SAP Error:", errorMessage);
      return res.status(400).json({
        success: false,
        error: errorMessage,
        sapResponse: executionResult,
        source: "SAP_ERP"
      });
    }

    console.log("[Goods Receipt] ✅ Goods receipt posted successfully");
    console.log("[Goods Receipt] Material Document:", materialDocument);

    // Commit the transaction in SAP
    try {
      console.log("[Goods Receipt] Committing transaction in SAP...");
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
      console.log("[Goods Receipt] ✅ Transaction committed in SAP");
    } catch (commitError) {
      console.warn("[Goods Receipt] ⚠️ Commit warning:", commitError.message);
    }

    res.json({
      success: true,
      materialDocument: materialDocument,
      documentYear: executionResult.MATDOC_DOCUMENTYEAR || executionResult.GOODSMVT_HEADRET?.DOC_YEAR || '',
      requestPayload: inputData,
      sapResponse: executionResult,
      message: "Goods receipt posted successfully to SAP",
      source: "SAP_ERP",
      liveSapCall: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("[Goods Receipt] Post error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/goods-receipt/:id
 * Get goods receipt details from SAP
 */
router.get("/:id", async (req, res) => {
  try {
    const receiptId = req.params.id;
    
    console.log("[Goods Receipt] Getting receipt from SAP:", receiptId);

    if (!isConnected()) {
      console.log('[Goods Receipt] Not connected, attempting connection...');
      await connect();
    }

    // Call SAP to get goods receipt details
    const result = await executeSapFunction(
      'BAPI_GOODSMVT_GET_DETAIL',
      {
        MATERIALDOCUMENT: receiptId
      },
      {
        RETURN: { TYPE: 'string', MESSAGE: 'string' },
        GOODSMVT_HEADER: {
          DOC_DATE: 'string',
          PSTNG_DATE: 'string',
          REF_DOC_NO: 'string'
        },
        GOODSMVT_ITEMS: [{
          MATERIAL: 'string',
          PLANT: 'string',
          STGE_LOC: 'string',
          QUANTITY: 'string'
        }]
      }
    );

    if (result.RETURN && result.RETURN.TYPE === 'E') {
      throw new Error(result.RETURN.MESSAGE || 'Goods receipt not found in SAP');
    }

    res.json({
      success: true,
      data: result,
      source: "LIVE_SAP_VIA_MCP",
      liveSapCall: true
    });
  } catch (error) {
    console.error("[Goods Receipt] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
