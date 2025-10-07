const axios = require('axios');

// ============================================================================
// MCP SERVER - Pure tool execution, no business logic
// ============================================================================
class MCPServer {
  constructor(config) {
    this.config = config;
    this.tools = [
      {
        type: "function",
        function: {
          name: 'list_entitlement_bundles',
          description: 'Get all available GCP role entitlement bundles from Okta for a specific application',
          parameters: {
            type: 'object',
            properties: {
              applicationId: {
                type: 'string',
                description: 'The Okta application ID for GCP (e.g., 0oavij8jl7fx84fA5697)'
              }
            },
            required: ['applicationId']
          }
        }
      },
      {
        type: "function", 
        function: {
          name: 'create_grant',
          description: 'Grant specific entitlement bundles to a user in Okta. Creates separate grants for each entitlement bundle.',
          parameters: {
            type: 'object',
            properties: {
              userId: {
                type: 'string',
                description: 'User ID of the requester that the grant is being assigned to (e.g., 00uq3zp622HWDY2Jc697)'
              },
              entitlementIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of entitlement bundle IDs to grant (e.g., ["enbmtw1byu10MX9wZ696"]). Each will get a separate grant.'
              },
              reasoning: {
                type: 'string',
                description: 'Explanation of why these roles were chosen'
              }
            },
            required: ['userId', 'entitlementIds', 'reasoning']
          }
        }
      },
      {
        type: "function",
        function: {
          name: 'add_request_message',
          description: 'Add a message to an existing Okta access request to provide additional information or feedback to the requester',
          parameters: {
            type: 'object',
            properties: {
              requestId: {
                type: 'string',
                description: 'The Request ID'
              },
              message: {
                type: 'string',
                description: 'The final determination of the LLM which includes what entitlement bundles were granted, if any, and the reasoning'
              }
            },
            required: ['requestId', 'message']
          }
        }
      }
    ];
  }

  async listEntitlementBundles(applicationId) {    
    try {
      console.log(`🔧 [MCP Tool] Listing entitlement bundles for app: ${applicationId}`);
      
      const response = await axios.get(
        `${this.config.okta.baseUrl}/governance/api/v1/entitlement-bundles`,
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': this.config.okta.token
          },
          params: {
            filter: `target.externalId eq "${applicationId}" AND target.type eq "APPLICATION"`
          }
        }
      );
      
      const bundles = response.data.data.map(bundle => ({
        id: bundle.id,
        name: bundle.name,
        description: bundle.description,
        status: bundle.status
      }));
      
      console.log(`✅ [MCP Tool] Retrieved ${bundles.length} entitlement bundles`);
      return { success: true, data: bundles };
      
    } catch (error) {
      console.error('❌ [MCP Tool] Error listing entitlement bundles:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  async createGrant(userId, applicationId, entitlementIds, reasoning) {    
    try {
      console.log(`🔧 [MCP Tool] Creating grants for user ${userId} with ${entitlementIds.length} entitlement bundles`);
      console.log(`💭 [MCP Tool] Reasoning: ${reasoning}`);
      
      const grantResults = [];
      
      for (const entitlementId of entitlementIds) {
        const grantData = {
          grantType: "ENTITLEMENT-BUNDLE",
          entitlementBundleId: entitlementId,
          actor: "ACCESS_REQUEST",
          targetPrincipal: {
            externalId: userId,
            type: "OKTA_USER"
          }
        };

        console.log(`📦 [MCP Tool] Creating grant for entitlement bundle: ${entitlementId}`);

        const response = await axios.post(
          `${this.config.okta.baseUrl}/governance/api/v1/grants`,
          grantData,
          {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': this.config.okta.token
            }
          }
        );

        grantResults.push({
          entitlementBundleId: entitlementId,
          grantId: response.data.id,
          status: 'created'
        });
        
        console.log(`✅ [MCP Tool] Grant created for bundle ${entitlementId}: ${response.data.id}`);
      }

      console.log(`🎉 [MCP Tool] All ${grantResults.length} grants created successfully`);
      return { success: true, data: grantResults, reasoning };
      
    } catch (error) {
      console.error('❌ [MCP Tool] Error creating grant:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  async addRequestMessage(requestId, message) {    
    try {
      console.log(`🔧 [MCP Tool] Adding message to request ${requestId}`);
      console.log(`💬 [MCP Tool] Message: ${message}`);
      
      const response = await axios.post(
        `${this.config.okta.baseUrl}/governance/api/v2/requests/${requestId}/messages`,
        { message },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': this.config.okta.token
          }
        }
      );

      console.log(`✅ [MCP Tool] Message added to request ${requestId}`);
      return { success: true, data: response.data };
      
    } catch (error) {
      console.error('❌ [MCP Tool] Error adding message to request:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  async executeTool(toolName, args) {
    switch (toolName) {
      case 'list_entitlement_bundles':
        return await this.listEntitlementBundles(args.applicationId);
      case 'create_grant':
        return await this.createGrant(args.userId, null, args.entitlementIds, args.reasoning);
      case 'add_request_message':
        return await this.addRequestMessage(args.requestId, args.message);
      default:
        throw new Error(`Unknown MCP tool: ${toolName}`);
    }
  }

  getTools() {
    return this.tools;
  }
}

module.exports = MCPServer;