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
 * Get all production order confirmations from SAP via MCP client using BAPI
 */
router.get("/confirmations", async (req, res) => {
  try {
    console.log("[Production Orders] Getting confirmations from SAP using BAPI_PRODORDCONF_GETLIST...");

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

    // Use BAPI_PRODORDCONF_GETLIST to get all production order confirmations
    // This BAPI can fetch confirmations by order number range or confirmation number range
    const result = await executeSapFunction(
      'BAPI_PRODORDCONF_GETLIST',
      {
        // Leave empty to get all confirmations, or specify ranges
        // CONFIRMATION_FROM: '',
        // CONFIRMATION_TO: '',
        // ORDERID_FROM: '',
        // ORDERID_TO: ''
      },
      {
        CONFIRMATIONS: [{
          CONF_NO: 'string',
          CONF_CNT: 'string',
          ORDERID: 'string',
          OPERATION: 'string',
          PLANT: 'string',
          WORK_CNTR: 'string',
          YIELD: 'string',
          SCRAP: 'string',
          POSTG_DATE: 'string',
          CONF_TEXT: 'string',
          FIN_CONF: 'string'
        }],
        RETURN: [{
          TYPE: 'string',
          MESSAGE: 'string'
        }]
      }
    );

    console.log(`[Production Orders] BAPI response received`);
    
    // Check for errors
    if (result.RETURN && Array.isArray(result.RETURN)) {
      for (const msg of result.RETURN) {
        if (msg.TYPE === 'E' || msg.TYPE === 'A') {
          console.error(`[Production Orders] BAPI Error: ${msg.MESSAGE}`);
          return res.status(500).json({
            success: false,
            error: msg.MESSAGE || 'Failed to fetch confirmations',
            sapResponse: result
          });
        }
      }
    }

    // Parse confirmations from BAPI response
    const confirmations = result.CONFIRMATIONS || [];
    
    console.log(`[Production Orders] Found ${confirmations.length} confirmations from SAP`);

    // Transform BAPI response to match frontend expectations
    const transformedConfirmations = confirmations.map(conf => ({
      confirmationId: conf.CONF_NO || '',
      confirmationCounter: conf.CONF_CNT || '',
      productionOrderId: conf.ORDERID || '',
      operation: conf.OPERATION || '',
      plant: conf.PLANT || '',
      workCenter: conf.WORK_CNTR || '',
      yieldQuantity: conf.YIELD || '0',
      scrapQuantity: conf.SCRAP || '0',
      postingDate: conf.POSTG_DATE || '',
      confirmationText: conf.CONF_TEXT || '',
      finalConfirmation: conf.FIN_CONF === 'X' ? 'Yes' : 'No',
      type: 'CONFIRMATION',
      timestamp: conf.POSTG_DATE || new Date().toISOString()
    }));

    res.json({
      success: true,
      count: transformedConfirmations.length,
      data: transformedConfirmations,
      source: "LIVE_SAP_VIA_BAPI",
      bapi: "BAPI_PRODORDCONF_GETLIST",
      message: `Found ${transformedConfirmations.length} production order confirmations`,
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

    // Step 1: Use Pillir Flow to search for the correct BAPI
    console.log('[Production Orders] Step 1: Searching for correct BAPI using Pillir Flow...');
    
    const searchPayload = {
      name: "Production Order List",
      description: "Get list of production orders with details like order number, plant, material, status, quantities",
      apis: [{
        name: "PP",
        description: "Production Planning",
        system_type: "SAP_ECC",
        functions: [{
          name: "GET_PRODUCTION_ORDERS",
          description: "Retrieve production orders list",
          rfc: true
        }]
      }]
    };

    let selectedBAPI = null;
    try {
      const searchResult = await searchSapBapi(searchPayload);
      console.log('[Production Orders] Search result:', JSON.stringify(searchResult, null, 2));
      
      // Extract BAPI name from search result
      if (searchResult && searchResult.apis && searchResult.apis[0] && 
          searchResult.apis[0].functions && searchResult.apis[0].functions[0]) {
        selectedBAPI = searchResult.apis[0].functions[0].name;
        console.log(`[Production Orders] ✅ Selected BAPI: ${selectedBAPI}`);
      }
    } catch (searchError) {
      console.warn('[Production Orders] ⚠️ BAPI search failed, falling back to RFC_READ_TABLE:', searchError.message);
    }

    // Step 2: Execute the BAPI or fallback to RFC_READ_TABLE
    let headerResult;
    
    if (selectedBAPI && selectedBAPI !== 'RFC_READ_TABLE') {
      console.log(`[Production Orders] Step 2: Using discovered BAPI: ${selectedBAPI}`);
      
      // Build input parameters based on filters
      const bapiInput = {};
      
      if (plant && plant.trim() !== '') {
        bapiInput.PLANT = plant.trim();
        console.log(`[Production Orders] Filtering by plant: ${plant}`);
      }
      
      if (material && material.trim() !== '') {
        bapiInput.MATERIAL = material.trim();
        console.log(`[Production Orders] Filtering by material: ${material}`);
      }
      
      // Expected output structure for production orders
      const expectedOutput = {
        RETURN: [{
          TYPE: 'string',
          MESSAGE: 'string'
        }],
        ORDERS: [{
          AUFNR: 'string',
          WERKS: 'string',
          MATNR: 'string',
          AUART: 'string',
          GAMNG: 'string',
          GMEIN: 'string'
        }]
      };
      
      try {
        headerResult = await executeSapFunction(selectedBAPI, bapiInput, expectedOutput);
        console.log(`[Production Orders] BAPI response:`, JSON.stringify(headerResult, null, 2));
      } catch (bapiError) {
        console.warn(`[Production Orders] ⚠️ BAPI ${selectedBAPI} failed:`, bapiError.message);
        console.log('[Production Orders] Falling back to RFC_READ_TABLE...');
        selectedBAPI = null;
      }
    }
    
    // Fallback to RFC_READ_TABLE if BAPI not found or failed
    if (!selectedBAPI || !headerResult) {
      console.log('[Production Orders] Step 2: Using RFC_READ_TABLE (fallback)');
      
      // Build query options for SAP
      const queryOptions = [];
      
      // Always filter for production orders only (AUTYP = 10)
      queryOptions.push({ TEXT: `AUTYP = '10'` });
      
      // Add plant filter if provided
      if (plant && plant.trim() !== '') {
        queryOptions.push({ TEXT: `AND WERKS = '${plant.trim()}'` });
        console.log(`[Production Orders] Filtering by plant: ${plant}`);
      }
      
      console.log(`[Production Orders] Query filters:`, queryOptions);
      
      // Fetch a smaller number of records to avoid timeout
      const rowCount = (plant && plant.trim() !== '') ? 300 : 100;
      
      console.log(`[Production Orders] Fetching up to ${rowCount} records from AUFK...`);
      
      headerResult = await executeSapFunction(
        'RFC_READ_TABLE',
        {
          QUERY_TABLE: 'AUFK',
          DELIMITER: '|',
          FIELDS: [
            { FIELDNAME: 'AUFNR' },
            { FIELDNAME: 'AUTYP' },
            { FIELDNAME: 'WERKS' },
            { FIELDNAME: 'AUART' },
            { FIELDNAME: 'ERDAT' },
            { FIELDNAME: 'ERNAM' },
            { FIELDNAME: 'IDAT1' },
            { FIELDNAME: 'IDAT2' },
            { FIELDNAME: 'IDAT3' }
          ],
          OPTIONS: queryOptions,
          ROWCOUNT: rowCount
        },
        {
          DATA: [{ WA: 'string' }],
          RETURN: [{ TYPE: 'string', MESSAGE: 'string' }]
        }
      );
      
      selectedBAPI = 'RFC_READ_TABLE';
    }

    console.log(`[Production Orders] Retrieved ${headerResult.DATA?.length || headerResult.ORDERS?.length || 0} records from SAP`);
    console.log(`[Production Orders] Full SAP response:`, JSON.stringify(headerResult, null, 2));

    // Check if we got data
    if ((!headerResult.DATA || !Array.isArray(headerResult.DATA)) && 
        (!headerResult.ORDERS || !Array.isArray(headerResult.ORDERS))) {
      console.error("[Production Orders] No DATA or ORDERS in response");
      console.error("[Production Orders] Response structure:", Object.keys(headerResult));
      
      // Check for SAP errors
      if (headerResult.RETURN && Array.isArray(headerResult.RETURN)) {
        const errors = headerResult.RETURN.filter(r => r.TYPE === 'E' || r.TYPE === 'A');
        if (errors.length > 0) {
          const errorMessage = errors.map(e => e.MESSAGE).join('; ');
          console.error("[Production Orders] SAP Error:", errorMessage);
          return res.status(400).json({
            success: false,
            error: errorMessage,
            message: "SAP returned an error",
            source: "SAP_ERP"
          });
        }
      }
      
      return res.json({
        success: true,
        data: [],
        totalCount: 0,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalRecords: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false
        },
        message: "No production orders found in SAP. This could be due to: 1) No orders matching the criteria, 2) Authorization issues, or 3) MCP connection issue. Try reconnecting or check SAP authorization.",
        source: "SAP_ERP",
        debug: {
          selectedBAPI: selectedBAPI,
          responseKeys: Object.keys(headerResult)
        }
      });
    }

    // Parse the data based on response type
    let allOrders;
    if (headerResult.ORDERS && Array.isArray(headerResult.ORDERS)) {
      // BAPI response
      console.log(`[Production Orders] Parsing ${headerResult.ORDERS.length} orders from BAPI response`);
      allOrders = headerResult.ORDERS.map(order => ({
        PRODUCTION_ORDER: order.AUFNR?.replace(/^0+/, '') || '',
        PLANT: order.WERKS || '',
        ORDER_TYPE: order.AUART || '',
        MATERIAL: order.MATNR?.replace(/^0+/, '') || '',
        TARGET_QUANTITY: order.GAMNG || '0',
        UNIT: order.GMEIN || '',
        STATUS: 'Released', // BAPI typically returns only released orders
        CREATED_DATE: order.ERDAT || '',
        CREATED_BY: order.ERNAM || ''
      }));
    } else {
      // RFC_READ_TABLE response
      allOrders = parseSapTableData(headerResult);
      console.log(`[Production Orders] Parsed ${allOrders.length} production orders from RFC_READ_TABLE`);
    }

    // Log sample of first few orders to verify data
    if (allOrders.length > 0) {
      console.log('[Production Orders] Sample orders:', allOrders.slice(0, 2).map(o => ({
        order: o.PRODUCTION_ORDER,
        plant: o.PLANT,
        type: o.ORDER_TYPE,
        status: o.STATUS,
        releaseDate: o.RELEASE_DATE
      })));
    }

    // Apply status filter if provided
    let orders = allOrders;
    if (status && status.trim() !== '') {
      console.log(`[Production Orders] Filtering by status: ${status}`);
      orders = orders.filter(order => order.STATUS === status);
      console.log(`[Production Orders] After status filter: ${orders.length} orders`);
    }

    // Apply pagination on the backend
    const totalRecords = orders.length;
    const totalPages = Math.ceil(totalRecords / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedOrders = orders.slice(startIndex, endIndex);

    console.log(`[Production Orders] Returning ${paginatedOrders.length} orders for page ${page} (total: ${totalRecords})`);
    
    // Check if we hit the row limit
    const hitLimit = headerResult.DATA.length >= rowCount;
    const warningMessage = hitLimit 
      ? `Showing first ${rowCount} records. Please use plant filter to see more specific results.`
      : null;

    if (warningMessage) {
      console.warn(`[Production Orders] ${warningMessage}`);
    }

    res.json({
      success: true,
      source: "SAP_ERP",
      searchCriteria: { plant, status },
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
      warning: warningMessage,
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

    // Fetch order header from AUFK
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
          { FIELDNAME: 'AEDAT' },  // Changed date
          { FIELDNAME: 'AENAM' }   // Changed by
        ],
        OPTIONS: [{ TEXT: `AUFNR = '${orderId.padStart(12, '0')}'` }],
        ROWCOUNT: 1
      },
      {
        DATA: [{ WA: 'string' }]
      }
    );

    if (!headerResult.DATA || headerResult.DATA.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Production order ${orderId} not found`
      });
    }

    // Parse header data
    const headerFields = headerResult.DATA[0].WA.split('|');
    const orderData = {
      PRODUCTION_ORDER: headerFields[0]?.trim().replace(/[$#*]/g, ''),
      PLANT: headerFields[1]?.trim() || '',
      ORDER_TYPE: headerFields[2]?.trim() || '',
      CREATED_DATE: headerFields[3]?.trim() || '',
      CREATED_BY: headerFields[4]?.trim() || '',
      CHANGED_DATE: headerFields[5]?.trim() || '',
      CHANGED_BY: headerFields[6]?.trim() || ''
    };

    // Fetch order item details from AFPO
    try {
      const itemResult = await executeSapFunction(
        'RFC_READ_TABLE',
        {
          QUERY_TABLE: 'AFPO',
          DELIMITER: '|',
          FIELDS: [
            { FIELDNAME: 'AUFNR' },  // Order number
            { FIELDNAME: 'MATNR' },  // Material number
            { FIELDNAME: 'PSMNG' },  // Target quantity
            { FIELDNAME: 'MEINS' },  // Unit
            { FIELDNAME: 'WEMNG' },  // Delivered quantity
            { FIELDNAME: 'GLTRP' },  // Scheduled finish
            { FIELDNAME: 'GSTRP' }   // Scheduled start
          ],
          OPTIONS: [{ TEXT: `AUFNR = '${orderId.padStart(12, '0')}'` }],
          ROWCOUNT: 1
        },
        {
          DATA: [{ WA: 'string' }]
        }
      );

      if (itemResult.DATA && itemResult.DATA.length > 0) {
        const itemFields = itemResult.DATA[0].WA.split('|');
        orderData.MATERIAL = itemFields[1]?.trim().replace(/^0+/, '') || '';
        orderData.TARGET_QUANTITY = itemFields[2]?.trim() || '0';
        orderData.UNIT = itemFields[3]?.trim() || '';
        orderData.DELIVERED_QUANTITY = itemFields[4]?.trim() || '0';
        orderData.SCHEDULED_FINISH = itemFields[5]?.trim() || '';
        orderData.SCHEDULED_START = itemFields[6]?.trim() || '';
      }
    } catch (afpoError) {
      console.log('[Production Orders] Could not fetch AFPO data:', afpoError.message);
    }

    // Fetch material description from MAKT if material exists
    if (orderData.MATERIAL) {
      try {
        const materialResult = await executeSapFunction(
          'RFC_READ_TABLE',
          {
            QUERY_TABLE: 'MAKT',
            DELIMITER: '|',
            FIELDS: [
              { FIELDNAME: 'MATNR' },  // Material number
              { FIELDNAME: 'MAKTX' }   // Material description
            ],
            OPTIONS: [{ TEXT: `MATNR = '${orderData.MATERIAL.padStart(18, '0')}'` }],
            ROWCOUNT: 1
          },
          {
            DATA: [{ WA: 'string' }]
          }
        );

        if (materialResult.DATA && materialResult.DATA.length > 0) {
          const matFields = materialResult.DATA[0].WA.split('|');
          orderData.MATERIAL_DESC = matFields[1]?.trim() || '';
        }
      } catch (matError) {
        console.log('[Production Orders] Could not fetch material description:', matError.message);
      }
    }

    // Fetch confirmation data from AFRU
    try {
      const confirmResult = await executeSapFunction(
        'RFC_READ_TABLE',
        {
          QUERY_TABLE: 'AFRU',
          DELIMITER: '|',
          FIELDS: [
            { FIELDNAME: 'AUFNR' },  // Order number
            { FIELDNAME: 'LMNGA' },  // Yield quantity
            { FIELDNAME: 'XMNGA' }   // Scrap quantity
          ],
          OPTIONS: [{ TEXT: `AUFNR = '${orderId.padStart(12, '0')}'` }],
          ROWCOUNT: 100
        },
        {
          DATA: [{ WA: 'string' }]
        }
      );

      let totalConfirmed = 0;
      let totalScrap = 0;

      if (confirmResult.DATA && confirmResult.DATA.length > 0) {
        for (const row of confirmResult.DATA) {
          const fields = row.WA.split('|');
          totalConfirmed += parseFloat(fields[1]?.trim() || '0');
          totalScrap += parseFloat(fields[2]?.trim() || '0');
        }
      }

      orderData.CONFIRMED_QUANTITY = totalConfirmed.toString();
      orderData.SCRAP_QUANTITY = totalScrap.toString();
    } catch (confError) {
      console.log('[Production Orders] Could not fetch confirmation data:', confError.message);
      orderData.CONFIRMED_QUANTITY = '0';
      orderData.SCRAP_QUANTITY = '0';
    }

    // Fetch operations from AFVC (Order Operations)
    // First get routing number from AFKO
    try {
      const afkoResult = await executeSapFunction(
        'RFC_READ_TABLE',
        {
          QUERY_TABLE: 'AFKO',
          DELIMITER: '|',
          FIELDS: [
            { FIELDNAME: 'AUFNR' },  // Order number
            { FIELDNAME: 'AUFPL' }   // Routing number
          ],
          OPTIONS: [{ TEXT: `AUFNR = '${orderId.padStart(12, '0')}'` }],
          ROWCOUNT: 1
        },
        {
          DATA: [{ WA: 'string' }]
        }
      );

      if (afkoResult.DATA && afkoResult.DATA.length > 0) {
        const afkoFields = afkoResult.DATA[0].WA.split('|');
        const routingNumber = afkoFields[1]?.trim() || '';
        
        if (routingNumber) {
          // Now fetch operations using the routing number
          const operationsResult = await executeSapFunction(
            'RFC_READ_TABLE',
            {
              QUERY_TABLE: 'AFVC',
              DELIMITER: '|',
              FIELDS: [
                { FIELDNAME: 'AUFPL' },  // Routing number
                { FIELDNAME: 'VORNR' },  // Operation number
                { FIELDNAME: 'ARBPL' },  // Work center
                { FIELDNAME: 'LTXA1' }   // Operation description
              ],
              OPTIONS: [{ TEXT: `AUFPL = '${routingNumber}'` }],
              ROWCOUNT: 10
            },
            {
              DATA: [{ WA: 'string' }]
            }
          );

          if (operationsResult.DATA && operationsResult.DATA.length > 0) {
            const operations = [];
            for (const row of operationsResult.DATA) {
              const fields = row.WA.split('|');
              operations.push({
                OPERATION: fields[1]?.trim() || '',
                WORK_CENTER: fields[2]?.trim() || '',
                DESCRIPTION: fields[3]?.trim() || ''
              });
            }
            orderData.OPERATIONS = operations;
            
            // Set first operation as default
            if (operations.length > 0) {
              orderData.DEFAULT_OPERATION = operations[0].OPERATION;
              orderData.DEFAULT_WORK_CENTER = operations[0].WORK_CENTER;
            }
            
            console.log(`[Production Orders] Found ${operations.length} operations for order ${orderId}`);
          }
        }
      }
    } catch (afvcError) {
      console.log('[Production Orders] Could not fetch operations:', afvcError.message);
      orderData.OPERATIONS = [];
    }

    // Fetch additional details from AFKO (order header additional data)
    try {
      const afkoResult = await executeSapFunction(
        'RFC_READ_TABLE',
        {
          QUERY_TABLE: 'AFKO',
          DELIMITER: '|',
          FIELDS: [
            { FIELDNAME: 'AUFNR' },  // Order number
            { FIELDNAME: 'ARBPL' },  // Work center
            { FIELDNAME: 'FEVOR' },  // Production supervisor
            { FIELDNAME: 'DISPO' },  // MRP controller
            { FIELDNAME: 'PRIOK' }   // Priority
          ],
          OPTIONS: [{ TEXT: `AUFNR = '${orderId.padStart(12, '0')}'` }],
          ROWCOUNT: 1
        },
        {
          DATA: [{ WA: 'string' }]
        }
      );

      if (afkoResult.DATA && afkoResult.DATA.length > 0) {
        const afkoFields = afkoResult.DATA[0].WA.split('|');
        orderData.WORK_CENTER = afkoFields[1]?.trim() || '';
        orderData.PRODUCTION_SUPERVISOR = afkoFields[2]?.trim() || '';
        orderData.MRP_CONTROLLER = afkoFields[3]?.trim() || '';
        orderData.PRIORITY = afkoFields[4]?.trim() || '';
      }
    } catch (afkoError) {
      console.log('[Production Orders] Could not fetch AFKO data:', afkoError.message);
    }

    console.log(`[Production Orders] Retrieved detailed information for order ${orderId}`);

    res.json({
      success: true,
      data: orderData,
      message: "Order details retrieved successfully"
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
        SYSTEM_STATUS: ''
      }));
    }

    console.log(`[Status Fetch] Sample order numbers:`, orderNumbers.slice(0, 3));

    // First, do a quick test to see if JEST table is accessible
    console.log(`[Status Fetch] Testing JEST table access...`);
    try {
      const testQuery = await executeSapFunction(
        'RFC_READ_TABLE',
        {
          QUERY_TABLE: 'JEST',
          DELIMITER: '|',
          FIELDS: [
            { FIELDNAME: 'OBJNR' },
            { FIELDNAME: 'STAT' }
          ],
          ROWCOUNT: 3
        },
        {
          DATA: [{ WA: 'string' }]
        }
      );
      
      console.log(`[Status Fetch] JEST test query returned ${testQuery.DATA?.length || 0} rows`);
      if (testQuery.DATA && testQuery.DATA.length > 0) {
        console.log(`[Status Fetch] Sample JEST records:`, testQuery.DATA.map(r => r.WA));
      }
    } catch (testError) {
      console.error(`[Status Fetch] JEST test query failed:`, testError.message);
      // If JEST is not accessible, return orders without status
      return orders.map(order => ({
        ...order,
        STATUS: '',
        SYSTEM_STATUS: 'JEST_NOT_ACCESSIBLE'
      }));
    }

    // Build OR conditions for each order (smaller batches to avoid query issues)
    const batchSize = 10;  // Reduced from 50 to 10 for more reliable queries
    const statusMap = {};
    
    for (let i = 0; i < orderNumbers.length; i += batchSize) {
      const batch = orderNumbers.slice(i, i + batchSize);
      
      // Build WHERE clause - SAP JEST table uses OBJNR format: OR + 12-digit padded order number
      const whereConditions = batch.map(orderNum => {
        // Pad the order number to 12 digits
        const paddedNum = orderNum.padStart(12, '0');
        return `OBJNR = 'OR${paddedNum}'`;
      }).join(' OR ');
      
      console.log(`[Status Fetch] Batch ${Math.floor(i / batchSize) + 1}: Querying ${batch.length} orders`);
      console.log(`[Status Fetch] Sample WHERE: ${whereConditions.substring(0, 100)}...`);
      
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
            ROWCOUNT: 200  // Reduced from 500
          },
          {
            DATA: [{ WA: 'string' }]
          }
        );

        console.log(`[Status Fetch] Batch ${Math.floor(i / batchSize) + 1}: Received ${statusResult.DATA?.length || 0} status records`);
        
        // Log the raw response for debugging
        if (i === 0 && statusResult.DATA && statusResult.DATA.length > 0) {
          console.log(`[Status Fetch] First batch raw data sample:`, JSON.stringify(statusResult.DATA.slice(0, 2), null, 2));
        }

        // Parse status data
        if (statusResult.DATA && Array.isArray(statusResult.DATA)) {
          let activeCount = 0;
          for (const row of statusResult.DATA) {
            if (!row.WA) continue;
            
            const fields = row.WA.split('|');
            const objnr = fields[0]?.trim() || '';
            const stat = fields[1]?.trim() || '';
            const inact = fields[2]?.trim() || '';
            
            // Log first few rows for debugging
            if (activeCount < 3 && i === 0) {
              console.log(`[Status Fetch] Row ${activeCount + 1}: OBJNR="${objnr}", STAT="${stat}", INACT="${inact}"`);
            }
            
            // Extract order number from OBJNR (format: OR000000012345)
            const orderNum = objnr.replace(/^OR0*/, '');
            
            // Only consider active statuses
            if (inact !== 'X' && orderNum && stat) {
              if (!statusMap[orderNum]) {
                statusMap[orderNum] = [];
              }
              statusMap[orderNum].push(stat);
              activeCount++;
            }
          }
          console.log(`[Status Fetch] Batch ${Math.floor(i / batchSize) + 1}: Found ${activeCount} active statuses`);
        }
      } catch (batchError) {
        console.error(`[Status Fetch] Error in batch ${Math.floor(i / batchSize) + 1}:`, batchError.message);
      }
    }

    console.log(`[Status Fetch] Total: Retrieved status for ${Object.keys(statusMap).length} out of ${orderNumbers.length} orders`);
    
    // Log sample of status map
    if (Object.keys(statusMap).length > 0) {
      const sample = Object.entries(statusMap).slice(0, 3);
      console.log(`[Status Fetch] Sample status map:`, sample);
    } else {
      console.log(`[Status Fetch] WARNING: No statuses found in JEST table`);
      
      // Try a simple test query to check JEST table access
      console.log(`[Status Fetch] Testing JEST table access with simple query...`);
      try {
        const testResult = await executeSapFunction(
          'RFC_READ_TABLE',
          {
            QUERY_TABLE: 'JEST',
            DELIMITER: '|',
            FIELDS: [
              { FIELDNAME: 'OBJNR' },
              { FIELDNAME: 'STAT' }
            ],
            ROWCOUNT: 5  // Just get 5 rows to test
          },
          {
            DATA: [{ WA: 'string' }]
          }
        );
        
        console.log(`[Status Fetch] Test query returned ${testResult.DATA?.length || 0} rows`);
        if (testResult.DATA && testResult.DATA.length > 0) {
          console.log(`[Status Fetch] Sample JEST data:`, testResult.DATA.slice(0, 2).map(r => r.WA));
        }
      } catch (testError) {
        console.error(`[Status Fetch] Test query failed:`, testError.message);
      }
    }

    // Map statuses to orders
    return orders.map(order => {
      const statuses = statusMap[order.PRODUCTION_ORDER] || [];
      let status = 'UNKNOWN';  // Default to UNKNOWN if no status found
      let systemStatus = statuses.join(',');
      
      // Determine status based on SAP status codes (only if statuses exist)
      if (statuses.length > 0) {
        if (statuses.includes('TECO') || statuses.includes('DLV')) {
          status = 'COMPLETED';
        } else if (statuses.includes('PCNF') || statuses.includes('CNF')) {
          status = 'IN PROGRESS';
        } else if (statuses.includes('REL')) {
          status = 'RELEASED';
        } else if (statuses.includes('CRTD')) {
          status = 'CREATED';
        } else {
          // Has status codes but none we recognize - show the raw codes
          status = statuses[0]; // Show first status code
        }
      } else {
        // No status found - log for debugging
        console.log(`[Status Fetch] No status found for order: ${order.PRODUCTION_ORDER}`);
      }

      return {
        ...order,
        STATUS: status,
        SYSTEM_STATUS: systemStatus || 'NO_STATUS_IN_JEST'
      };
    });
  } catch (error) {
    console.error('[Status Fetch] Error:', error.message);
    // Return orders with UNKNOWN status on error
    return orders.map(order => ({
      ...order,
      STATUS: 'UNKNOWN',
      SYSTEM_STATUS: 'ERROR_FETCHING'
    }));
  }
}

/**
 * Helper function to parse SAP RFC_READ_TABLE response from AUFK
 */
function parseSapTableData(result) {
  console.log('[parseSapTableData] Processing SAP data...');

  if (!result.DATA || !Array.isArray(result.DATA)) {
    console.log('[parseSapTableData] No DATA array found');
    return [];
  }

  console.log(`[parseSapTableData] Raw data rows from SAP: ${result.DATA.length}`);

  const orders = [];
  let skippedCount = 0;
  let nonProductionCount = 0;
  
  for (const row of result.DATA) {
    if (!row.WA) {
      skippedCount++;
      continue;
    }
    
    const fields = row.WA.split('|');
    
    // Log first few rows to see the data format
    if (orders.length < 2) {
      console.log(`[parseSapTableData] Sample row ${orders.length + 1}:`, row.WA);
      console.log(`[parseSapTableData] Fields count: ${fields.length}`);
    }
    
    // Clean order number - SAP pads with special characters
    const rawOrderNumber = fields[0]?.trim() || '';
    
    // SAP uses $ # * for padding - remove them
    let orderNumber = rawOrderNumber.replace(/[$#*]/g, '').trim();
    
    // Keep leading zeros - they might be significant
    // Only skip if completely empty
    if (!orderNumber) {
      skippedCount++;
      continue;
    }
    
    const autyp = fields[1]?.trim() || ''; // Order category
    const plant = fields[2]?.trim() || '';
    const orderType = fields[3]?.trim() || 'PP01';
    const createdDate = fields[4]?.trim() || '';
    const createdBy = fields[5]?.trim() || '';
    const idat1 = fields[6]?.trim() || ''; // Release date
    const idat2 = fields[7]?.trim() || ''; // Completed date
    const idat3 = fields[8]?.trim() || ''; // Closed date
    
    // Filter: Only include production orders (AUTYP = 10)
    // Skip maintenance orders (AUTYP = 30) and other order types
    if (autyp !== '10') {
      nonProductionCount++;
      if (nonProductionCount <= 3) {
        console.log(`[parseSapTableData] Skipping non-production order: ${orderNumber}, AUTYP: ${autyp}`);
      }
      continue;
    }
    
    // Determine status based on IDAT fields (check in reverse order - most advanced status first)
    // IDAT1 = Release date, IDAT2 = Completed date, IDAT3 = Closed date
    let status = 'CREATED';
    if (idat3 && idat3 !== '00000000') {
      status = 'CLOSED';
    } else if (idat2 && idat2 !== '00000000') {
      status = 'COMPLETED';
    } else if (idat1 && idat1 !== '00000000') {
      status = 'RELEASED';
    }
    
    orders.push({
      PRODUCTION_ORDER: orderNumber,
      ORDER_CATEGORY: autyp,
      PLANT: plant,
      ORDER_TYPE: orderType,
      CREATED_DATE: createdDate,
      CREATED_BY: createdBy,
      STATUS: status,
      RELEASE_DATE: idat1, // Store dates for reference
      COMPLETED_DATE: idat2,
      CLOSED_DATE: idat3,
      START_DATE: '',
      FINISH_DATE: '',
      SOURCE: 'SAP'
    });
  }

  console.log(`[parseSapTableData] Parsed ${orders.length} production orders (AUTYP=10)`);
  console.log(`[parseSapTableData] Skipped ${nonProductionCount} non-production orders (AUTYP≠10)`);
  console.log(`[parseSapTableData] Skipped ${skippedCount} empty rows`);
  
  if (orders.length > 0) {
    console.log(`[parseSapTableData] First order: ${orders[0].PRODUCTION_ORDER}, AUTYP: ${orders[0].ORDER_CATEGORY}, Plant: "${orders[0].PLANT}", Status: "${orders[0].STATUS}", IDAT1: "${orders[0].RELEASE_DATE}"`);
    console.log(`[parseSapTableData] Last order: ${orders[orders.length - 1].PRODUCTION_ORDER}, Status: "${orders[orders.length - 1].STATUS}"`);
  }
  
  return orders;
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