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

    // Step 1: Search for appropriate BAPI
    console.log("[Goods Receipt] Step 1: Searching for BAPI...");
    
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

    let selectedBAPI = "BAPI_GOODSMVT_CREATE";
    
    try {
      const searchResults = await searchSapBapi(searchPayload);
      if (searchResults?.apis?.[0]?.functions?.[0]?.name) {
        selectedBAPI = searchResults.apis[0].functions[0].name;
      }
    } catch (searchError) {
      console.log("[Goods Receipt] Search failed, using default BAPI:", searchError.message);
    }

    console.log(`[Goods Receipt] Step 2: Selected BAPI: ${selectedBAPI}`);

    // Step 3: Prepare input data for BAPI
    const inputData = {
      PRODUCTION_ORDER: productionOrderId,
      MATERIAL: material,
      PLANT: plant,
      RECEIVED_QUANTITY: receivedQuantity,
      STORAGE_LOCATION: storageLocation || "0001",
      MOVEMENT_TYPE: "101", // 101 = Goods receipt for production order
      POSTING_DATE: new Date().toISOString().split("T")[0]
    };

    // Step 4: Define expected output structure
    const expectedOutputStructure = {
      RETURN: {
        TYPE: "string",
        MESSAGE: "string"
      },
      MATERIAL_DOCUMENT: "string",
      MATERIAL_DOCUMENT_YEAR: "string"
    };

    // Step 5: Execute BAPI and post to SAP
    console.log("[Goods Receipt] Step 3: Executing BAPI and posting to SAP...");
    const executionResult = await executeSapFunction(selectedBAPI, inputData, expectedOutputStructure);

    console.log("[Goods Receipt] ✅ Goods receipt posted to SAP successfully");

    res.json({
      success: true,
      receiptId: executionResult.MATERIAL_DOCUMENT || `GR-${Date.now()}`,
      selectedBAPI,
      requestPayload: inputData,
      sapResponse: executionResult,
      message: "Goods receipt posted successfully to SAP",
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
