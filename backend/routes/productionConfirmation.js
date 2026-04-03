/**
 * Production Order Confirmation Routes
 * Handles production order confirmations
 */

import express from "express";

const router = express.Router();

// In-memory storage for confirmations
const confirmations = {};

/**
 * POST /api/production-confirmation/search
 * Search for production order confirmation BAPI
 */
router.post("/search", async (req, res) => {
  try {
    console.log("[Production Confirmation] Search request received");

    const searchQuery = "production order confirmation PP";
    const searchResults = await searchBAPI(searchQuery);

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

    // Validate inputs
    if (!productionOrderId || !plant || !material || !yieldQuantity) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: productionOrderId, plant, material, yieldQuantity"
      });
    }

    // Step 1: Search for appropriate BAPI
    console.log("[Production Confirmation] Step 1: Searching for BAPI...");
    const searchResults = await searchBAPI("production order confirmation");
    
    // Step 2: Select BAPI (use first available or fallback)
    let selectedBAPI = "BAPI_PRODORDCONF_CREATE_TT";
    if (searchResults.results?.apis?.[0]?.functions?.[0]?.name) {
      selectedBAPI = searchResults.results.apis[0].functions[0].name;
    } else {
      selectedBAPI = getFallbackBAPI("production_confirmation");
    }

    console.log(`[Production Confirmation] Step 2: Selected BAPI: ${selectedBAPI}`);

    // Step 3: Prepare input data for BAPI
    const inputData = {
      PRODUCTION_ORDER: productionOrderId,
      PLANT: plant,
      MATERIAL: material,
      CONFIRMED_QUANTITY: yieldQuantity,
      SCRAP_QUANTITY: scrapQuantity || "0",
      WORK_CENTER: workCenter,
      CONFIRMATION_TYPE: confirmationType || "P" // P = Partial, F = Final
    };

    // Step 4: Define expected output structure
    const expectedOutputStructure = {
      RETURN: {
        TYPE: "string",
        MESSAGE: "string"
      },
      CONFIRMATION_NUMBER: "string",
      MATERIAL_DOCUMENT: "string"
    };

    // Step 5: Execute BAPI
    console.log("[Production Confirmation] Step 3: Executing BAPI...");
    const executionResult = await executeBAPI(selectedBAPI, inputData, expectedOutputStructure);

    // Step 6: Store confirmation in memory (for this session only)
    const confirmationId = `CONF-${Date.now()}`;
    confirmations[confirmationId] = {
      id: confirmationId,
      productionOrderId,
      plant,
      material,
      yieldQuantity,
      scrapQuantity,
      workCenter,
      confirmationType,
      selectedBAPI,
      executionResult,
      timestamp: new Date().toISOString()
    };

    console.log("[Production Confirmation] Confirmation posted to SAP:", confirmationId);

    res.json({
      success: true,
      confirmationId,
      selectedBAPI,
      requestPayload: inputData,
      sapResponse: executionResult,
      message: "Production order confirmed successfully"
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
 * Get confirmation details
 */
router.get("/:id", (req, res) => {
  const confirmation = confirmations[req.params.id];
  if (!confirmation) {
    return res.status(404).json({
      success: false,
      error: "Confirmation not found"
    });
  }

  res.json({
    success: true,
    data: confirmation
  });
});

export default router;
