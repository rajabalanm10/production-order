/**
 * Production Orders Routes
 * Handles listing and searching production order records
 * Connects directly to Pillir Flow MCP server via stdio/SSE
 */

import express from "express";
import { executeSapFunction, connect, isConnected } from "../services/mcpStreamClient.js";

const router = express.Router();

// Try to connect to MCP server on startup (don't fail if it doesn't work)
connect().catch(err => {
  console.error('[Production Orders] MCP connection failed:', err.message);
  console.log('[Production Orders] Will retry on first request');
});

/**
 * GET /api/production-orders/confirmations
 * Get all production order confirmations from SAP via MCP client
 */
router.get("/confirmations", async (req, res) => {
  try {
    console.log("[Production Orders] Getting confirmations from SAP...");

    if (!isConnected()) {
      console.log('[Production Orders] Not connected, attempting connection...');
      try {
        await connect();
      } catch (error) {
        return res.status(503).json({
          success: false,
          error: "Failed to connect to MCP server",
          message: error.message
        });
      }
    }

    // Call SAP to get confirmations from AFRU table (Production order confirmations)
    const result = await executeSapFunction(
      'RFC_READ_TABLE',
      {
        QUERY_TABLE: 'AFRU',
        DELIMITER: '|',
        FIELDS: [
          { FIELDNAME: 'RUECK' },  // Confirmation number
          { FIELDNAME: 'AUFNR' },  // Order number
          { FIELDNAME: 'WERKS' },  // Plant
          { FIELDNAME: 'LMNGA' },  // Yield quantity
          { FIELDNAME: 'XMNGA' },  // Scrap quantity
          { FIELDNAME: 'BUDAT' }   // Posting date
        ],
        OPTIONS: [{ TEXT: "WERKS IN ('0001', '0002')" }],
        ROWCOUNT: 100
      },
      {
        DATA: [{ WA: 'string' }]
      }
    );

    const confirmations = parseConfirmationData(result);
    
    console.log(`[Production Orders] Found ${confirmations.length} confirmations from SAP`);

    res.json({
      success: true,
      count: confirmations.length,
      data: confirmations,
      source: "LIVE_SAP_VIA_MCP",
      message: `Found ${confirmations.length} production order confirmations`,
      timestamp: new Date().toISOString(),
      liveSapCall: true
    });

  } catch (error) {
    console.error("[Production Orders] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/production-orders/search
 * Search for production orders from SAP via MCP client
 */
router.post("/search", async (req, res) => {
  try {
    const { plant, material, status, page = 1, limit = 10 } = req.body;

    console.log("[Production Orders] Search request:", {
      plant, material, status, page, limit
    });

    if (!isConnected()) {
      console.log('[Production Orders] Not connected, attempting connection...');
      try {
        await connect();
      } catch (error) {
        return res.status(503).json({
          success: false,
          error: "Failed to connect to MCP server",
          message: error.message
        });
      }
    }

    // Build SAP query options
    const options = [];
    if (plant) {
      options.push({ TEXT: `WERKS = '${plant}'` });
    }
    
    console.log("[Production Orders] Calling SAP via MCP client...");
    
    // First, get order headers from AUFK
    const headerResult = await executeSapFunction(
      'RFC_READ_TABLE',
      {
        QUERY_TABLE: 'AUFK',
        DELIMITER: '|',
        FIELDS: [
          { FIELDNAME: 'AUFNR' },  // Order number
          { FIELDNAME: 'WERKS' },  // Plant
          { FIELDNAME: 'AUART' },  // Order type
          { FIELDNAME: 'ERDAT' },  // Created date
          { FIELDNAME: 'ERNAM' },  // Created by
          { FIELDNAME: 'FTRMI' }   // Release date (if released, this will have a date)
        ],
        OPTIONS: options.length > 0 ? options : [{ TEXT: "WERKS IN ('0001', '0002')" }],
        ROWCOUNT: 9999  // High number to fetch all available records
      },
      {
        DATA: [{ WA: 'string' }]
      }
    );

    console.log("[Production Orders] Header data received, fetching quantity details...");

    // Then get quantity details from AFPO (Production order items)
    const quantityResult = await executeSapFunction(
      'RFC_READ_TABLE',
      {
        QUERY_TABLE: 'AFPO',
        DELIMITER: '|',
        FIELDS: [
          { FIELDNAME: 'AUFNR' },  // Order number
          { FIELDNAME: 'MATNR' },  // Material
          { FIELDNAME: 'PSMNG' },  // Order quantity
          { FIELDNAME: 'MEINS' },  // Unit of measure
          { FIELDNAME: 'WEMNG' }   // Goods receipt quantity
        ],
        OPTIONS: options.length > 0 ? options : [{ TEXT: "WERKS IN ('0001', '0002')" }],
        ROWCOUNT: 9999
      },
      {
        DATA: [{ WA: 'string' }]
      }
    );

    console.log("[Production Orders] Quantity data received, merging results...");

    // Parse both results
    const headers = parseSapTableData(headerResult);
    const quantities = parseAfpoData(quantityResult);

    // Merge header and quantity data
    const result = mergeOrderData(headers, quantities);

    console.log("[Production Orders] SAP response received");

    // Parse SAP response - result is already merged
    let orders = result;

    // Apply filters
    if (material) {
      orders = orders.filter(order => 
        order.MATERIAL && order.MATERIAL.toLowerCase().includes(material.toLowerCase())
      );
    }

    if (status) {
      orders = orders.filter(order => order.STATUS === status);
    }

    // Calculate progress
    orders = orders.map(order => {
      const orderQty = parseFloat(order.ORDER_QUANTITY || 0);
      const confirmedQty = parseFloat(order.CONFIRMED_QUANTITY || 0);
      const progressPercent = orderQty > 0 ? Math.round((confirmedQty / orderQty) * 100) : 0;
      
      return {
        ...order,
        PROGRESS_PERCENT: progressPercent
      };
    });

    // Pagination
    const totalRecords = orders.length;
    const totalPages = Math.ceil(totalRecords / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedOrders = orders.slice(startIndex, endIndex);

    console.log(`[Production Orders] SUCCESS: Found ${totalRecords} orders`);

    res.json({
      success: true,
      source: "LIVE_SAP_VIA_MCP_CLIENT",
      selectedBAPI: "RFC_READ_TABLE",
      searchCriteria: { plant, material, status },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalRecords,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      count: paginatedOrders.length,
      totalCount: totalRecords,
      data: paginatedOrders,
      message: `Found ${totalRecords} production orders from SAP`,
      timestamp: new Date().toISOString(),
      liveSapCall: true
    });

  } catch (error) {
    console.error("[Production Orders] Error:", error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to search production orders in SAP",
      instruction: "Check if Pillir Flow MCP server is running"
    });
  }
});

/**
 * GET /api/production-orders/:orderId
 * Get details of a specific production order from SAP via MCP client
 */
router.get("/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log("[Production Orders] Order details request:", orderId);

    if (!isConnected()) {
      console.log('[Production Orders] Not connected, attempting connection...');
      try {
        await connect();
      } catch (error) {
        return res.status(503).json({
          success: false,
          error: "Failed to connect to MCP server",
          message: error.message
        });
      }
    }

    // Call SAP via MCP client
    const result = await executeSapFunction(
      'BAPI_PRODORD_GET_DETAIL',
      {
        NUMBER: orderId
      },
      {
        RETURN: { TYPE: 'string', MESSAGE: 'string' },
        ORDERKEY: { ORDER_NUMBER: 'string' },
        HEADER: {
          MATERIAL: 'string',
          PLANT: 'string',
          ORDER_QUANTITY: 'string'
        }
      }
    );

    if (result.RETURN && result.RETURN.TYPE === 'E') {
      throw new Error(result.RETURN.MESSAGE || 'SAP returned an error');
    }

    console.log(`[Production Orders] SUCCESS: Retrieved order ${orderId}`);

    res.json({
      success: true,
      source: "LIVE_SAP_VIA_MCP_CLIENT",
      selectedBAPI: "BAPI_PRODORD_GET_DETAIL",
      productionOrder: orderId,
      data: result,
      message: "Production order details retrieved from SAP",
      timestamp: new Date().toISOString(),
      liveSapCall: true
    });

  } catch (error) {
    console.error("[Production Orders] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: "Failed to get order details from SAP"
    });
  }
});

/**
 * Helper function to parse SAP RFC_READ_TABLE response from AUFK
 */
function parseSapTableData(result) {
  if (!result.DATA || !Array.isArray(result.DATA)) {
    return [];
  }

  const orders = [];
  
  for (const row of result.DATA) {
    if (!row.WA) continue;
    
    const fields = row.WA.split('|');
    const releaseDate = fields[5]?.trim() || '';
    
    // Determine status based on release date
    let status = 'CREATED';
    if (releaseDate && releaseDate !== '00000000') {
      status = 'RELEASED';
    }
    
    orders.push({
      PRODUCTION_ORDER: fields[0]?.trim() || '',
      PLANT: fields[1]?.trim() || '',
      ORDER_TYPE: fields[2]?.trim() || 'PP01',
      CREATED_DATE: fields[3]?.trim() || '',
      CREATED_BY: fields[4]?.trim() || '',
      RELEASE_DATE: releaseDate,
      STATUS: status,
      SOURCE: 'LIVE_SAP'
    });
  }

  return orders;
}

/**
 * Helper function to parse AFRU (Production order confirmations) data
 */
function parseConfirmationData(result) {
  if (!result.DATA || !Array.isArray(result.DATA)) {
    return [];
  }

  const confirmations = [];
  
  for (const row of result.DATA) {
    if (!row.WA) continue;
    
    const fields = row.WA.split('|');
    
    confirmations.push({
      confirmationId: fields[0]?.trim() || '',
      productionOrderId: fields[1]?.trim() || '',
      plant: fields[2]?.trim() || '',
      yieldQuantity: fields[3]?.trim() || '0',
      scrapQuantity: fields[4]?.trim() || '0',
      postingDate: fields[5]?.trim() || '',
      type: 'CONFIRMATION',
      timestamp: fields[5]?.trim() || new Date().toISOString()
    });
  }

  return confirmations;
}

/**
 * Helper function to parse AFPO (Production order items) data
 */
function parseAfpoData(result) {
  if (!result.DATA || !Array.isArray(result.DATA)) {
    return {};
  }

  const quantities = {};
  
  for (const row of result.DATA) {
    if (!row.WA) continue;
    
    const fields = row.WA.split('|');
    const orderNumber = fields[0]?.trim() || '';
    
    if (orderNumber) {
      quantities[orderNumber] = {
        MATERIAL: fields[1]?.trim() || '',
        ORDER_QUANTITY: fields[2]?.trim() || '0',
        UNIT: fields[3]?.trim() || '',
        RECEIVED_QUANTITY: fields[4]?.trim() || '0'
      };
    }
  }

  return quantities;
}

/**
 * Merge header data with quantity data
 */
function mergeOrderData(headers, quantities) {
  return headers.map(order => {
    const orderNum = order.PRODUCTION_ORDER;
    const quantityData = quantities[orderNum] || {
      MATERIAL: '',
      ORDER_QUANTITY: '0',
      UNIT: '',
      RECEIVED_QUANTITY: '0'
    };

    // Calculate confirmed quantity (same as received for now)
    const orderQty = parseFloat(quantityData.ORDER_QUANTITY) || 0;
    const receivedQty = parseFloat(quantityData.RECEIVED_QUANTITY) || 0;
    const confirmedQty = receivedQty;
    const progressPercent = orderQty > 0 ? Math.round((confirmedQty / orderQty) * 100) : 0;

    return {
      ...order,
      MATERIAL: quantityData.MATERIAL,
      ORDER_QUANTITY: quantityData.ORDER_QUANTITY,
      UNIT: quantityData.UNIT,
      RECEIVED_QUANTITY: quantityData.RECEIVED_QUANTITY,
      CONFIRMED_QUANTITY: confirmedQty.toFixed(3),
      PROGRESS_PERCENT: progressPercent,
      START_DATE: '',
      FINISH_DATE: ''
    };
  });
}

export default router;