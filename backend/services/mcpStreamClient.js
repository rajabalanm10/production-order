/**
 * MCP Stream Client - Multiple Connection Strategies
 * Tries different approaches to connect to Pillir Flow MCP server
 */

import { EventEmitter } from 'events';
import { EventSource } from 'eventsource';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '../mcp-config.json');

// Load configuration
let config = {
  type: 'http',
  url: 'https://flow.pillir.ai/mcp/sse',
  headers: {
    'X-FLOW-API-KEY': 'jux8l5taT5QVpngFY6rVLoCTe3YyVVk9_yEyFYstz4o',
    'mcp-protocol-version': '2024-11-05'
  },
  enabled: true
};

try {
  const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
  const fileConfig = JSON.parse(configData);
  config = { ...config, ...fileConfig };
} catch (error) {
  console.log('[MCP Stream] No config file found, using defaults');
}

class MCPStreamClient extends EventEmitter {
  constructor() {
    super();
    this.requestId = 0;
    this.connected = false;
    this.config = config;
    this.sessionId = null;
    this.eventSource = null;
    this.connectionStrategy = null;
  }

  /**
   * Strategy 1: Direct POST without session (stateless)
   */
  async connectStateless() {
    console.log('[MCP Stream] Strategy 1: Stateless POST requests');
    this.connectionStrategy = 'stateless';
    this.connected = true;
    return true;
  }

  /**
   * Strategy 2: GET SSE connection to establish session, then POST
   */
  async connectSSEWithPOST() {
    console.log('[MCP Stream] Strategy 2: SSE GET + POST');
    
    return new Promise((resolve, reject) => {
      try {
        // Open SSE connection
        this.eventSource = new EventSource(this.config.url, {
          headers: this.config.headers
        });

        let sessionReceived = false;

        this.eventSource.onopen = () => {
          console.log('[MCP Stream] SSE connection opened');
        };

        this.eventSource.onmessage = (event) => {
          console.log('[MCP Stream] SSE Message:', event.data);
          
          try {
            const data = JSON.parse(event.data);
            
            // Look for session ID in various places
            if (data.session_id || data.sessionId || data.id) {
              this.sessionId = data.session_id || data.sessionId || data.id;
              console.log('[MCP Stream] Session ID:', this.sessionId);
              sessionReceived = true;
              this.connected = true;
              this.connectionStrategy = 'sse-post';
              resolve(true);
            }
          } catch (e) {
            console.log('[MCP Stream] Non-JSON message:', event.data);
          }
        };

        this.eventSource.onerror = (error) => {
          console.error('[MCP Stream] SSE error:', error);
          if (!sessionReceived) {
            reject(new Error('SSE connection failed'));
          }
        };

        // Timeout after 5 seconds
        setTimeout(() => {
          if (!sessionReceived) {
            console.log('[MCP Stream] No session ID received via SSE');
            this.eventSource?.close();
            reject(new Error('No session ID received'));
          }
        }, 5000);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Strategy 3: POST to create session, extract from response
   */
  async connectPOSTSession() {
    console.log('[MCP Stream] Strategy 3: POST to create session');
    
    try {
      const response = await fetch(this.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
              name: 'sap-mcp-app',
              version: '1.0.0'
            }
          }
        })
      });

      console.log('[MCP Stream] Response status:', response.status);
      console.log('[MCP Stream] Response headers:', Object.fromEntries(response.headers.entries()));

      // Check for session in headers
      const sessionHeader = response.headers.get('mcp-session-id') ||
                           response.headers.get('x-session-id') || 
                           response.headers.get('session-id') ||
                           response.headers.get('x-mcp-session');
      
      if (sessionHeader) {
        this.sessionId = sessionHeader;
        console.log('[MCP Stream] Session from header:', this.sessionId);
        this.connected = true;
        this.connectionStrategy = 'post-session';
        return true;
      }

      // Check for session in response body
      if (response.ok) {
        const data = await response.json();
        console.log('[MCP Stream] Response body:', JSON.stringify(data, null, 2));
        
        if (data.session_id || data.sessionId) {
          this.sessionId = data.session_id || data.sessionId;
          console.log('[MCP Stream] Session from body:', this.sessionId);
          this.connected = true;
          this.connectionStrategy = 'post-session';
          return true;
        }
      }

      throw new Error('No session ID in response');

    } catch (error) {
      console.error('[MCP Stream] POST session error:', error);
      throw error;
    }
  }

  /**
   * Strategy 4: Use query parameter for session
   */
  async connectQuerySession() {
    console.log('[MCP Stream] Strategy 4: Generate session, use query param');
    
    // Generate a session ID
    this.sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log('[MCP Stream] Generated session:', this.sessionId);
    
    this.connected = true;
    this.connectionStrategy = 'query-session';
    return true;
  }

  /**
   * Try all connection strategies
   */
  async connect() {
    if (this.connected) {
      console.log('[MCP Stream] Already connected');
      return;
    }

    if (!this.config.enabled) {
      console.log('[MCP Stream] ⚠️  MCP client is disabled in config');
      return;
    }

    console.log('[MCP Stream] Connecting to Pillir Flow MCP server...');
    console.log('[MCP Stream] URL:', this.config.url);

    // Try strategies in order - test each one with a real call
    const strategies = [
      { name: 'POST Session', fn: () => this.connectPOSTSession() },
      { name: 'Query Session', fn: () => this.connectQuerySession() },
      { name: 'SSE + POST', fn: () => this.connectSSEWithPOST() },
      { name: 'Stateless POST', fn: () => this.connectStateless() }
    ];

    let lastError = null;

    for (const strategy of strategies) {
      try {
        console.log(`\n[MCP Stream] Trying: ${strategy.name}...`);
        await strategy.fn();
        
        // Test the connection with a simple call
        console.log('[MCP Stream] Testing connection with a simple call...');
        await this.testConnection();
        
        console.log(`[MCP Stream] ✅ Connected using: ${strategy.name}`);
        return;
      } catch (error) {
        console.log(`[MCP Stream] ❌ ${strategy.name} failed:`, error.message);
        lastError = error;
        this.connected = false;
        this.sessionId = null;
        this.connectionStrategy = null;
      }
    }

    throw new Error(`All connection strategies failed. Last error: ${lastError?.message}`);
  }

  /**
   * Test connection with a minimal call
   */
  async testConnection() {
    // Try to call a simple MCP method to verify connection works
    const testRequest = {
      jsonrpc: '2.0',
      id: 999,
      method: 'tools/list',
      params: {}
    };

    try {
      await this.sendRequestByStrategy(testRequest);
      console.log('[MCP Stream] Connection test passed');
    } catch (error) {
      console.log('[MCP Stream] Connection test failed:', error.message);
      throw error;
    }
  }

  /**
   * Send request using current strategy
   */
  async sendRequestByStrategy(request) {
    switch (this.connectionStrategy) {
      case 'stateless':
        return this.sendStatelessRequest(request);
      
      case 'post-session':
        return this.sendSessionRequest(request);
      
      case 'query-session':
        return this.sendQueryRequest(request);
      
      case 'sse-post':
        return this.sendSSERequest(request);
      
      default:
        throw new Error('No connection strategy established');
    }
  }

  /**
   * Call MCP tool with current strategy
   */
  async callTool(toolName, toolArguments) {
    if (!this.connected) {
      await this.connect();
    }

    const requestId = ++this.requestId;
    const request = {
      jsonrpc: '2.0',
      id: requestId,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: toolArguments
      }
    };

    console.log(`[MCP Stream] Calling tool: ${toolName} (strategy: ${this.connectionStrategy})`);

    return this.sendRequestByStrategy(request);
  }

  /**
   * Send stateless POST request
   */
  async sendStatelessRequest(request) {
    console.log('[MCP Stream] Sending stateless request...');
    
    const response = await fetch(this.config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers
      },
      body: JSON.stringify(request)
    });

    return this.parseResponse(response);
  }

  /**
   * Send request with session in query parameter
   */
  async sendSessionRequest(request) {
    console.log('[MCP Stream] Sending request with session in query...');
    
    // Send session as query parameter
    const url = `${this.config.url}?session_id=${encodeURIComponent(this.sessionId)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers
      },
      body: JSON.stringify(request)
    });

    return this.parseResponse(response);
  }

  /**
   * Send request with session in query
   */
  async sendQueryRequest(request) {
    console.log('[MCP Stream] Sending request with query session...');
    
    const url = `${this.config.url}?session_id=${encodeURIComponent(this.sessionId)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers
      },
      body: JSON.stringify(request)
    });

    return this.parseResponse(response);
  }

  /**
   * Send request via SSE connection
   */
  async sendSSERequest(request) {
    console.log('[MCP Stream] Sending request via SSE...');
    
    // For SSE, we still need to POST but with the session
    const url = `${this.config.url}?session_id=${encodeURIComponent(this.sessionId)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers
      },
      body: JSON.stringify(request)
    });

    return this.parseResponse(response);
  }

  /**
   * Parse response from any strategy
   */
  async parseResponse(response) {
    console.log('[MCP Stream] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[MCP Stream] Error response:', errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log('[MCP Stream] Response:', JSON.stringify(result, null, 2));

    if (result.error) {
      throw new Error(result.error.message || JSON.stringify(result.error));
    }

    // Extract actual data from MCP response format
    if (result.result && result.result.content && Array.isArray(result.result.content)) {
      const content = result.result.content[0];
      if (content.type === 'text') {
        try {
          const sapResponse = JSON.parse(content.text);
          console.log('[MCP Stream] Parsed SAP response');
          
          // Check if there's another level of nesting (Pillir Flow double-wraps)
          if (sapResponse.content && Array.isArray(sapResponse.content) && sapResponse.content[0]) {
            const innerContent = sapResponse.content[0];
            if (innerContent.type === 'text') {
              try {
                const innerResponse = JSON.parse(innerContent.text);
                // Pillir Flow wraps in {"type": "result", "result": {...}}
                if (innerResponse.type === 'result' && innerResponse.result) {
                  return innerResponse.result;
                }
                return innerResponse;
              } catch (e) {
                // If inner parse fails, return the outer parsed response
              }
            }
          }
          
          // Pillir Flow wraps in {"type": "result", "result": {...}}
          if (sapResponse.type === 'result' && sapResponse.result) {
            return sapResponse.result;
          }
          
          return sapResponse;
        } catch (e) {
          return content.text;
        }
      }
    }

    return result.result || result;
  }

  /**
   * Disconnect
   */
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.connected = false;
    this.sessionId = null;
    this.connectionStrategy = null;
    console.log('[MCP Stream] Disconnected');
  }
}

// Create singleton
const client = new MCPStreamClient();

/**
 * Execute SAP function
 */
export async function executeSapFunction(functionName, inputData, expectedOutput) {
  try {
    console.log(`[MCP Stream] Executing: ${functionName}`);

    const result = await client.callTool('execute_function', {
      function_module_name: functionName,
      input_data: inputData,
      expected_output_structure: expectedOutput
    });

    console.log('[MCP Stream] ✅ Success');
    return result;

  } catch (error) {
    console.error('[MCP Stream] ❌ Error:', error.message);
    throw error;
  }
}

/**
 * Search SAP
 */
export async function searchSapBapi(payload) {
  try {
    console.log('[MCP Stream] Searching SAP');

    const result = await client.callTool('search_sap', payload);

    console.log('[MCP Stream] ✅ Search complete');
    return result;

  } catch (error) {
    console.error('[MCP Stream] ❌ Search error:', error.message);
    throw error;
  }
}

export function isConnected() {
  return client.connected;
}

export async function connect() {
  return client.connect();
}

export function disconnect() {
  client.disconnect();
}

export default client;
