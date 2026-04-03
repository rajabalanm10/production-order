/**
 * Kiro Bridge Client
 * Allows Node.js backend to communicate with Kiro environment for MCP access
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

class KiroBridgeClient {
  constructor() {
    this.requestDir = join(process.cwd(), '..', 'bridge-requests');
    this.responseDir = join(process.cwd(), '..', 'bridge-responses');
    this.timeout = 30000; // 30 seconds timeout
  }

  /**
   * Search SAP BAPIs via Kiro bridge
   */
  async searchSap(payload) {
    console.log('[Bridge Client] Sending search SAP request to Kiro...');
    
    const request = {
      id: randomUUID(),
      type: 'search_sap',
      payload: payload,
      timestamp: new Date().toISOString()
    };
    
    return await this.sendRequest(request);
  }

  /**
   * Execute SAP function via Kiro bridge
   */
  async executeFunction(payload) {
    console.log('[Bridge Client] Sending execute function request to Kiro...');
    
    const request = {
      id: randomUUID(),
      type: 'execute_function',
      payload: payload,
      timestamp: new Date().toISOString()
    };
    
    return await this.sendRequest(request);
  }

  /**
   * Send request to Kiro bridge and wait for response
   */
  async sendRequest(request) {
    const filename = `${request.id}.json`;
    const requestPath = join(this.requestDir, filename);
    const responsePath = join(this.responseDir, filename);
    
    try {
      // Ensure directories exist
      this.ensureDirectories();
      
      // Write request file
      writeFileSync(requestPath, JSON.stringify(request, null, 2));
      console.log(`[Bridge Client] Request sent: ${filename}`);
      
      // Wait for response
      const response = await this.waitForResponse(responsePath);
      
      if (response.success) {
        console.log(`[Bridge Client] Request successful: ${request.type}`);
        return response.result;
      } else {
        throw new Error(`Bridge request failed: ${response.error}`);
      }
      
    } catch (error) {
      console.error(`[Bridge Client] Request failed:`, error.message);
      throw error;
    }
  }

  /**
   * Wait for response file to appear
   */
  async waitForResponse(responsePath) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < this.timeout) {
      if (existsSync(responsePath)) {
        try {
          const responseData = readFileSync(responsePath, 'utf8');
          const response = JSON.parse(responseData);
          
          // Clean up response file
          try {
            const fs = await import('fs');
            fs.unlinkSync(responsePath);
          } catch (e) {
            // Ignore cleanup errors
          }
          
          return response;
        } catch (e) {
          // File might be partially written, wait a bit more
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } else {
        // Wait 100ms before checking again
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    throw new Error('Bridge request timeout - Kiro bridge may not be running');
  }

  /**
   * Ensure directories exist
   */
  ensureDirectories() {
    try {
      if (!existsSync(this.requestDir)) {
        mkdirSync(this.requestDir, { recursive: true });
      }
      if (!existsSync(this.responseDir)) {
        mkdirSync(this.responseDir, { recursive: true });
      }
    } catch (error) {
      console.error('[Bridge Client] Failed to create directories:', error.message);
    }
  }

  /**
   * Check if Kiro bridge is running
   */
  async isKiroBridgeRunning() {
    try {
      // Send a simple ping request
      const request = {
        id: randomUUID(),
        type: 'ping',
        payload: {},
        timestamp: new Date().toISOString()
      };
      
      await this.sendRequest(request);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const kiroBridgeClient = new KiroBridgeClient();