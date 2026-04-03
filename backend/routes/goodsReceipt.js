/**
 * Goods Receipt Routes
 * Handles goods receipt posting
 */

import express from "express";

const router = express.Router();

// In-memory storage for goods receipts
const goodsReceipts = {};

/**
 * POST /api/goods-receipt/search
 * Search for goods receipt BAPI
 */
router.post("/search", async (req, res) => {
  try {
    console.log("[Goods Receipt] Search request received");

    const searchQuery = "goods receipt production order MM";
    const searchResults = await searchBAPI(searchQuery);

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

    // Step 1: Search for appropriate BAPI
    console.log("[Goods Receipt] Step 1: Searching for BAPI...");
    const searchResults = await searchBAPI("goods receipt production order");
    
    // Step 2: Select BAPI (use first available or fallback)
    let selectedBAPI = "BAPI_GOODSMVT_CREATE";
    if (searchResults.results?.apis?.[1]?.functions?.[0]?.name) {
      selectedBAPI = searchResults.results.apis[1].functions[0].name;
    } else {
      selectedBAPI = getFallbackBAPI("goods_receipt");
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

    // Step 5: Execute BAPI
    console.log("[Goods Receipt] Step 3: Executing BAPI...");
    const executionResult = await executeBAPI(selectedBAPI, inputData, expectedOutputStructure);

    // Step 6: Store goods receipt in memory (for this session only)
    const receiptId = `GR-${Date.now()}`;
    goodsReceipts[receiptId] = {
      id: receiptId,
      productionOrderId,
      material,
      plant,
      receivedQuantity,
      storageLocation,
      selectedBAPI,
      executionResult,
      timestamp: new Date().toISOString()
    };

    console.log("[Goods Receipt] Goods receipt posted to SAP:", receiptId);

    res.json({
      success: true,
      receiptId,
      selectedBAPI,
      requestPayload: inputData,
      sapResponse: executionResult,
      message: "Goods receipt posted successfully"
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
 * Get goods receipt details
 */
router.get("/:id", (req, res) => {
  const receipt = goodsReceipts[req.params.id];
  if (!receipt) {
    return res.status(404).json({
      success: false,
      error: "Goods receipt not found"
    });
  }

  res.json({
    success: true,
    data: receipt
  });
});

export default router;
