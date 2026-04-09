/**
 * Goods Issue Routes (Movement Type 261)
 * Handles component issue to production orders
 */

import express from "express";
import { searchSapBapi, executeSapFunction, connect, isConnected } from "../services/mcpStreamClient.js";

const router = express.Router();

// Try to connect to MCP server on startup
connect().catch(err => {
  console.error('[Goods Issue] MCP connection failed:', err.message);
  console.log('[Goods Issue] Will retry on first request');
});

/**
 * GET /api/goods-issue/components/:orderId
 * Get BOM components for a production order
 */
router.get("/components/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    
    console.log("[Goods Issue] Getting components for order:", orderId);

    if (!isConnected()) {
      console.log('[Goods Issue] Connecting to SAP...');
      await connect();
    }

    // Fetch components from RESB table (Reservation/dependent requirements)
    const paddedOrderId = orderId.replace(/[$#*]/g, '').trim().padStart(12, '0');
    
    const result = await executeSapFunction(
      'RFC_READ_TABLE',
      {
        QUERY_TABLE: 'RESB',
        DELIMITER: '|',
        FIELDS: [
          { FIELDNAME: 'RSNUM' },  // Reservation number
          { FIELDNAME: 'RSPOS' },  // Item number
          { FIELDNAME: 'MATNR' },  // Material number
          { FIELDNAME: 'BDMNG' },  // Requirement quantity
          { FIELDNAME: 'ENMNG' },  // Quantity withdrawn
          { FIELDNAME: 'MEINS' },  // Unit of measure
          { FIELDNAME: 'WERKS' },  // Plant
          { FIELDNAME: 'LGORT' }   // Storage location
        ],
        OPTIONS: [{ TEXT: `AUFNR = '${paddedOrderId}'` }],
        ROWCOUNT: 50
      },
      {
        DATA: [{ WA: 'string' }]
      }
    );

    const components = [];
    if (result.DATA && Array.isArray(result.DATA)) {
      for (const row of result.DATA) {
        if (!row.WA) continue;
        const fields = row.WA.split('|');
        
        const requiredQty = parseFloat(fields[3]?.trim() || '0');
        const withdrawnQty = parseFloat(fields[4]?.trim() || '0');
        const remainingQty = requiredQty - withdrawnQty;
        
        components.push({
          reservationNumber: fields[0]?.trim() || '',
          itemNumber: fields[1]?.trim() || '',
          material: fields[2]?.trim().replace(/^0+/, '') || '',
          requiredQuantity: requiredQty.toString(),
          withdrawnQuantity: withdrawnQty.toString(),
          remainingQuantity: remainingQty.toString(),
          unit: fields[5]?.trim() || '',
          plant: fields[6]?.trim() || '',
          storageLocation: fields[7]?.trim() || ''
        });
      }
    }

    console.log(`[Goods Issue] Found ${components.length} components`);

    res.json({
      success: true,
      count: components.length,
      data: components,
      source: "SAP_ERP",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("[Goods Issue] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      source: "SAP_ERP"
    });
  }
});

/**
 * POST /api/goods-issue/post
 * Post goods issue for production order components (Movement Type 261)
 */
router.post("/post", async (req, res) => {
  try {
    const {
      productionOrderId,
      material,
      plant,
      issuedQuantity,
      storageLocation,
      reservationNumber,
      itemNumber
    } = req.body;

    console.log("[Goods Issue] Post request:", {
      productionOrderId,
      material,
      plant,
      issuedQuantity,
      storageLocation
    });

    // Validate inputs
    if (!productionOrderId || !material || !plant || !issuedQuantity) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: productionOrderId, material, plant, issuedQuantity",
        source: "SAP_ERP"
      });
    }

    if (!isConnected()) {
      console.log('[Goods Issue] Connecting to SAP...');
      await connect();
    }

    console.log("[Goods Issue] Using BAPI: BAPI_GOODSMVT_CREATE");

    // Format date as DD.MM.YYYY for SAP
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const postingDate = `${day}.${month}.${year}`;
    
    console.log("[Goods Issue] Posting date:", postingDate);
    
    const inputData = {
      GOODSMVT_HEADER: {
        PSTNG_DATE: postingDate,
        DOC_DATE: postingDate,
        REF_DOC_NO: productionOrderId
      },
      GOODSMVT_CODE: {
        GM_CODE: '03' // 03 = Goods issue
      },
      GOODSMVT_ITEM: [{
        MATERIAL: material.padStart(18, '0'),
        PLANT: plant,
        STGE_LOC: storageLocation || '0001',
        MOVE_TYPE: '261', // 261 = Goods issue to production order
        ENTRY_QNT: parseFloat(issuedQuantity).toString(),
        ORDERID: productionOrderId.replace(/[$#*]/g, '').trim().padStart(12, '0')
      }]
    };

    // Add reservation info if provided
    if (reservationNumber && itemNumber) {
      inputData.GOODSMVT_ITEM[0].RES_ITEM = itemNumber;
      inputData.GOODSMVT_ITEM[0].RESERV_NO = reservationNumber;
    }

    console.log("[Goods Issue] BAPI Input:", JSON.stringify(inputData, null, 2));

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

    console.log("[Goods Issue] Executing BAPI...");
    const executionResult = await executeSapFunction('BAPI_GOODSMVT_CREATE', inputData, expectedOutputStructure);

    console.log("[Goods Issue] SAP Response:", JSON.stringify(executionResult, null, 2));

    // Check for errors
    let hasError = false;
    let errorMessages = [];
    let materialDocument = '';

    if (executionResult.RETURN && Array.isArray(executionResult.RETURN)) {
      for (const returnMsg of executionResult.RETURN) {
        console.log(`[Goods Issue] Return message: Type=${returnMsg.TYPE}, Message=${returnMsg.MESSAGE}`);
        if (returnMsg.TYPE === 'E' || returnMsg.TYPE === 'A') {
          hasError = true;
          errorMessages.push(returnMsg.MESSAGE || 'Unknown error');
        }
      }
    }

    materialDocument = executionResult.MATERIALDOCUMENT || 
                      executionResult.GOODSMVT_HEADRET?.MAT_DOC || 
                      '';

    if (hasError || !materialDocument) {
      const errorMessage = errorMessages.length > 0 
        ? errorMessages.join('; ') 
        : 'Goods issue failed';
      
      console.error("[Goods Issue] ❌ SAP Error:", errorMessage);
      return res.status(400).json({
        success: false,
        error: errorMessage,
        sapResponse: executionResult,
        source: "SAP_ERP"
      });
    }

    console.log("[Goods Issue] ✅ Goods issue posted successfully");
    console.log("[Goods Issue] Material Document:", materialDocument);

    // Commit transaction
    try {
      console.log("[Goods Issue] Committing transaction...");
      await executeSapFunction(
        'BAPI_TRANSACTION_COMMIT',
        { WAIT: 'X' },
        { RETURN: { TYPE: 'string', MESSAGE: 'string' } }
      );
      console.log("[Goods Issue] ✅ Transaction committed");
    } catch (commitError) {
      console.warn("[Goods Issue] ⚠️ Commit warning:", commitError.message);
    }

    res.json({
      success: true,
      materialDocument: materialDocument,
      documentYear: executionResult.MATDOC_DOCUMENTYEAR || executionResult.GOODSMVT_HEADRET?.DOC_YEAR || '',
      requestPayload: inputData,
      sapResponse: executionResult,
      message: "Goods issue posted successfully to SAP",
      source: "SAP_ERP",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("[Goods Issue] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      source: "SAP_ERP"
    });
  }
});

export default router;
