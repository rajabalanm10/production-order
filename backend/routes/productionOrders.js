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

    console.log(`[Production Orders] Search request - Page: ${page}, Limit: ${limit}`);

    if (!isConnected()) {
      console.log('[Production Orders] Connecting to SAP...');
      try {
        await connect();
      } catch (error) {
        return res.status(503).json({
          success: false,
          error: "Failed to connect to SAP system",
          message: error.message
        });
      }
    }

    // Build query options - only add plant filter if provided
    const queryOptions = [];
    if (plant && plant.trim() !== '') {
      queryOptions.push({ TEXT: `WERKS = '${plant}'` });
    }
    
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
          { FIELDNAME: 'ERNAM' }   // Created by
        ],
        ...(queryOptions.length > 0 ? { OPTIONS: queryOptions } : {}),
        ROWCOUNT: 9999  // Fetch all available records
      },
      {
        DATA: [{ WA: 'string' }]
      }
    );

    console.log(`[Production Orders] Retrieved ${headerResult.DATA?.length || 0} records from SAP`);

    // Check if we got data
    if (!headerResult.DATA || !Array.isArray(headerResult.DATA)) {
      console.error("[Production Orders] No DATA in response");
      return res.json({
        success: true,
        data: [],
        totalCount: 0,
        message: "No production orders found"
      });
    }

    // Parse the data
    const allOrders = parseSapTableData(headerResult);
    console.log(`[Production Orders] Parsed ${allOrders.length} production orders`);

    // Always fetch real status from JEST, but do it smartly based on dataset size
    let orders = [];
    
    if (allOrders.length > 100) {
      // Large dataset - fetch status only for current page to avoid timeout
      console.log(`[Production Orders] Large dataset detected - fetching status for current page only`);
      
      // First, apply pagination to get current page orders
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const currentPageOrders = allOrders.slice(startIndex, endIndex);
      
      console.log(`[Production Orders] Fetching status for ${currentPageOrders.length} orders`);
      
      // Fetch real status for current page orders only
      orders = await fetchStatusForOrders(currentPageOrders);
      
      // Apply status filter if provided
      if (status && status.trim() !== '') {
        orders = orders.filter(order => order.STATUS === status);
      }
      
      // For large datasets with status filter, we can't know exact total without fetching all
      const totalRecords = status ? orders.length : allOrders.length;
      const totalPages = Math.ceil(totalRecords / limit);
      
      res.json({
        success: true,
        source: "LIVE_SAP_VIA_MCP",
        selectedBAPI: "RFC_READ_TABLE + JEST",
        searchCriteria: { plant, material, status },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalRecords: totalRecords,
          totalPages: totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          note: status ? "Status filtering on large datasets - showing current page results" : undefined
        },
        count: orders.length,
        totalCount: totalRecords,
        data: orders,
        message: `Found ${orders.length} orders on page ${page}`,
        timestamp: new Date().toISOString()
      });
      return;
    } else {
      // Small dataset - fetch all statuses at once
      console.log(`[Production Orders] Fetching all statuses from SAP`);
      orders = await fetchStatusForOrders(allOrders);
    }

    // Apply filters
    if (material) {
      orders = orders.filter(order => 
        order.MATERIAL && order.MATERIAL.toLowerCase().includes(material.toLowerCase())
      );
    }

    if (status) {
      orders = orders.filter(order => order.STATUS === status);
    }

    // Apply pagination on the backend
    const totalRecords = orders.length;
    const totalPages = Math.ceil(totalRecords / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedOrders = orders.slice(startIndex, endIndex);

    console.log(`[Production Orders] Returning ${paginatedOrders.length} orders for page ${page}`);

    res.json({
      success: true,
      source: "SAP_ERP",
      searchCriteria: { plant, material, status },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        totalRecords: totalRecords,
        totalPages: totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      count: paginatedOrders.length,
      totalCount: totalRecords,
      data: paginatedOrders,
      message: `Found ${totalRecords} production orders`,
      timestamp: new Date().toISOString()
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
 * Helper function to fetch status from JEST table for a batch of orders
 */
async function fetchStatusForOrders(orders) {
  if (!orders || orders.length === 0) {
    return [];
  }

  try {
    console.log(`[Status Fetch] Processing ${orders.length} orders`);
    
    // Build WHERE clause for order numbers
    const orderNumbers = orders.map(o => o.PRODUCTION_ORDER).filter(Boolean);
    if (orderNumbers.length === 0) {
      return orders.map(order => ({
        ...order,
        STATUS: '',
        SYSTEM_STATUS: '',
        MATERIAL: '',
        ORDER_QUANTITY: '0',
        UNIT: '',
        RECEIVED_QUANTITY: '0',
        CONFIRMED_QUANTITY: '0',
        PROGRESS_PERCENT: 0
      }));
    }

    // Build OR conditions for each order (max 50 at a time to avoid query size issues)
    const batchSize = 50;
    const statusMap = {};
    
    for (let i = 0; i < orderNumbers.length; i += batchSize) {
      const batch = orderNumbers.slice(i, i + batchSize);
      
      // Build WHERE clause - SAP JEST table uses OBJNR format: OR + 12-digit padded order number
      const whereConditions = batch.map(orderNum => {
        const paddedNum = orderNum.padStart(12, '0');
        return `OBJNR = 'OR${paddedNum}'`;
      }).join(' OR ');
      
      try {
        const statusResult = await executeSapFunction(
          'RFC_READ_TABLE',
          {
            QUERY_TABLE: 'JEST',
            DELIMITER: '|',
            FIELDS: [
              { FIELDNAME: 'OBJNR' },  // Object number
              { FIELDNAME: 'STAT' },   // Status
              { FIELDNAME: 'INACT' }   // Inactive flag
            ],
            OPTIONS: [{ TEXT: whereConditions }],
            ROWCOUNT: 500
          },
          {
            DATA: [{ WA: 'string' }]
          }
        );

        // Parse status data
        if (statusResult.DATA && Array.isArray(statusResult.DATA)) {
          for (const row of statusResult.DATA) {
            if (!row.WA) continue;
            
            const fields = row.WA.split('|');
            const objnr = fields[0]?.trim() || '';
            const stat = fields[1]?.trim() || '';
            const inact = fields[2]?.trim() || '';
            
            // Extract order number from OBJNR (format: OR000000012345)
            const orderNum = objnr.replace(/^OR0*/, '');
            
            // Only consider active statuses
            if (inact !== 'X' && orderNum && stat) {
              if (!statusMap[orderNum]) {
                statusMap[orderNum] = [];
              }
              statusMap[orderNum].push(stat);
            }
          }
        }
      } catch (batchError) {
        console.error(`[Status Fetch] Error in batch: ${batchError.message}`);
      }
    }

    console.log(`[Status Fetch] Retrieved status for ${Object.keys(statusMap).length} orders`);

    // If we got no statuses at all, try a simpler query to test connectivity
    if (Object.keys(statusMap).length === 0 && orderNumbers.length > 0) {
      console.log(`[Status Fetch] No statuses found - testing JEST table access...`);
      try {
        // Try querying JEST with just the first order to test connectivity
        const testResult = await executeSapFunction(
          'RFC_READ_TABLE',
          {
            QUERY_TABLE: 'JEST',
            DELIMITER: '|',
            FIELDS: [
              { FIELDNAME: 'OBJNR' },
              { FIELDNAME: 'STAT' },
              { FIELDNAME: 'INACT' }
            ],
            OPTIONS: [{ TEXT: `OBJNR LIKE 'OR%'` }],
            ROWCOUNT: 10
          },
          {
            DATA: [{ WA: 'string' }]
          }
        );
        
        console.log(`[Status Fetch] Test query returned ${testResult.DATA?.length || 0} rows`);
      } catch (testError) {
        console.error(`[Status Fetch] Test query failed: ${testError.message}`);
      }
    }

    // Map statuses to orders
    return orders.map(order => {
      const statuses = statusMap[order.PRODUCTION_ORDER] || [];
      let status = '';  // Empty if no status found in SAP
      let systemStatus = statuses.join(',');
      
      // Determine status based on SAP status codes (only if statuses exist)
      if (statuses.length > 0) {
        if (statuses.includes('TECO') || statuses.includes('DLV')) {
          status = 'COMPLETED';
        } else if (statuses.includes('PCNF') || statuses.includes('CNF')) {
          status = 'IN_PROGRESS';
        } else if (statuses.includes('REL')) {
          status = 'RELEASED';
        } else if (statuses.includes('CRTD')) {
          status = 'CREATED';
        } else {
          // Has status codes but none we recognize - show the raw codes
          status = statuses[0]; // Show first status code
        }
      }

      return {
        ...order,
        STATUS: status,
        SYSTEM_STATUS: systemStatus,
        MATERIAL: '',
        ORDER_QUANTITY: '0',
        UNIT: '',
        RECEIVED_QUANTITY: '0',
        CONFIRMED_QUANTITY: '0',
        PROGRESS_PERCENT: 0
      };
    });
  } catch (error) {
    console.error('[fetchStatusForOrders] Error:', error.message);
    // Return orders with empty status on error (real data, not simulated)
    return orders.map(order => ({
      ...order,
      STATUS: '',  // Empty status indicates error fetching from SAP
      SYSTEM_STATUS: 'ERROR_FETCHING',
      MATERIAL: '',
      ORDER_QUANTITY: '0',
      UNIT: '',
      RECEIVED_QUANTITY: '0',
      CONFIRMED_QUANTITY: '0',
      PROGRESS_PERCENT: 0
    }));
  }
}

/**
 * Helper function to parse SAP RFC_READ_TABLE response from AUFK
 */
function parseSapTableData(result) {
  console.log('[parseSapTableData] Input result:', {
    hasDATA: !!result.DATA,
    isArray: Array.isArray(result.DATA),
    length: result.DATA?.length,
    firstRow: result.DATA?.[0]
  });

  if (!result.DATA || !Array.isArray(result.DATA)) {
    console.log('[parseSapTableData] No DATA or not an array, returning empty');
    return [];
  }

  const orders = [];
  
  for (const row of result.DATA) {
    if (!row.WA) {
      console.log('[parseSapTableData] Row has no WA property:', row);
      continue;
    }
    
    const fields = row.WA.split('|');
    
    // Debug: Log first few rows
    if (orders.length < 3) {
      console.log('[parseSapTableData] Row WA:', row.WA);
      console.log('[parseSapTableData] Parsed fields:', fields);
    }
    
    // Clean order number - SAP pads with special characters
    // Remove leading/trailing spaces first, then remove special padding chars
    const rawOrderNumber = fields[0]?.trim() || '';
    
    // SAP uses $ # * for padding - remove them but keep alphanumeric and hyphens
    let orderNumber = rawOrderNumber.replace(/[$#*]/g, '').trim();
    
    // Remove leading zeros if present
    orderNumber = orderNumber.replace(/^0+/, '') || '0';
    
    const plant = fields[1]?.trim() || '';
    
    // Skip if no valid order number
    if (!orderNumber || orderNumber === '0') {
      continue;
    }
    
    orders.push({
      PRODUCTION_ORDER: orderNumber,
      PLANT: plant,
      ORDER_TYPE: fields[2]?.trim() || 'PP01',
      CREATED_DATE: fields[3]?.trim() || '',
      CREATED_BY: fields[4]?.trim() || '',
      START_DATE: '',
      FINISH_DATE: '',
      STATUS: 'CREATED',  // Will be updated from JEST
      SOURCE: 'LIVE_SAP'
    });
  }

  console.log(`[parseSapTableData] Returning ${orders.length} orders`);
  if (orders.length > 0) {
    console.log('[parseSapTableData] Sample order:', orders[0]);
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