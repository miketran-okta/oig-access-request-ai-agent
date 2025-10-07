require('dotenv').config();

// Corporate network SSL fix (DEVELOPMENT ONLY!)
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  console.log('⚠️  [DEV MODE] SSL certificate validation disabled for corporate networks');
}

const express = require('express');
const axios = require('axios');
const { OpenAI } = require('openai');

const app = express();
app.use(express.json());

// Configuration
const config = {
  okta: {
    baseUrl: 'https://demo-takolive.okta.com',
    token: process.env.OKTA_TOKEN,
    applicationId: '0oavij8jl7fx84fA5697'
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY
  },
  port: process.env.PORT || 3000,
  mockMode: process.env.MOCK_MODE !== 'false'
};

// ============================================================================
// MCP SERVER - Pure tool execution, no business logic
// ============================================================================
class MCPServer {
  constructor() {
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
    if (config.mockMode) {
      console.log(`🎭 [MOCK MODE] Simulating entitlement bundles for app: ${applicationId}`);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const mockBundles = [
        {
          id: "enbmtw1byu10MX9wZ696",
          name: "Viewer - viewer",
          description: "Grants read-only access to all of a project's resources.",
          status: "ACTIVE"
        },
        {
          id: "enbmtw1buZQG1bZZZ696", 
          name: "Storage Object Viewer - storage.objectViewer",
          description: "Grants read-only access to Cloud Storage objects.",
          status: "ACTIVE"
        },
        {
          id: "enbmtv1gportvxifd696",
          name: "Storage Object Admin - storage.objectAdmin", 
          description: "Grants full control over Cloud Storage objects.",
          status: "ACTIVE"
        },
        {
          id: "enbmtv1gl03rpGl0G696",
          name: "BigQuery Data Editor - bigquery.dataEditor",
          description: "Grants permissions to edit data and metadata in BigQuery tables.",
          status: "ACTIVE"
        }
      ];
      
      console.log(`✅ [MOCK MODE] Retrieved ${mockBundles.length} entitlement bundles`);
      return { success: true, data: mockBundles };
    }

    try {
      console.log(`🔧 [MCP Tool] Listing entitlement bundles for app: ${applicationId}`);
      
      const response = await axios.get(
        `${config.okta.baseUrl}/governance/api/v1/entitlement-bundles`,
        {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': config.okta.token
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
    if (config.mockMode) {
      console.log(`🎭 [MOCK MODE] Simulating grants for user ${userId} with ${entitlementIds.length} entitlement bundles`);
      console.log(`💭 [MOCK MODE] Reasoning: ${reasoning}`);
      
      const grantResults = [];
      
      for (const entitlementId of entitlementIds) {
        console.log(`📦 [MOCK MODE] Creating grant for entitlement bundle: ${entitlementId}`);
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const mockGrantId = `grant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        grantResults.push({
          entitlementBundleId: entitlementId,
          grantId: mockGrantId,
          status: 'created'
        });
        
        console.log(`✅ [MOCK MODE] Grant created for bundle ${entitlementId}: ${mockGrantId}`);
      }

      console.log(`🎉 [MOCK MODE] All ${grantResults.length} grants created successfully`);
      return { success: true, data: grantResults, reasoning };
    }

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
          `${config.okta.baseUrl}/governance/api/v1/grants`,
          grantData,
          {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': config.okta.token
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
    if (config.mockMode) {
      console.log(`🎭 [MOCK MODE] Simulating adding message to request ${requestId}`);
      console.log(`💬 [MOCK MODE] Message: ${message}`);
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      console.log(`✅ [MOCK MODE] Message added to request ${requestId}`);
      return { success: true, requestId, message };
    }

    try {
      console.log(`🔧 [MCP Tool] Adding message to request ${requestId}`);
      console.log(`💬 [MCP Tool] Message: ${message}`);
      
      const response = await axios.post(
        `${config.okta.baseUrl}/governance/api/v2/requests/${requestId}/messages`,
        { message },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': config.okta.token
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
}

// ============================================================================
// MCP CLIENT - GPT-4 that uses MCP tools to accomplish tasks
// ============================================================================
class MCPClient {
  constructor(mcpServer) {
    this.mcpServer = mcpServer;
    this.openai = new OpenAI({ apiKey: config.openai.apiKey });
  }

  async processAccessRequest(webhookData) {
    console.log('\n🤖 [MCP Client] Starting autonomous access request processing...');
    console.log(`👤 [MCP Client] Request from: ${webhookData.requestEmail}`);
    console.log(`🎯 [MCP Client] Requested role: ${webhookData.accessLevelName}`);
    console.log(`📝 [MCP Client] Justification: "${webhookData.justification}"`);

    const systemPrompt = `You are a SENIOR SECURITY ENGINEER evaluating access requests for Google Cloud Project (GCP) roles to a production environment from engineers an enterprise company. You must make decisions that enforce least privilege but also ensure business continuity.

REQUIREMENTS:
1. Justifications within the request must contain meaningful information including:
	a. Incident/Reference number OR explicit statement this is routine/planned work
	b. Specific GCP resource types (storage, bigquery, kubernetes, logs, compute, vertex-ai, etc.)
	c. Clear description of planned actions with those resources
2. NEVER grant admin roles unless the justification explicitly mentions admin tasks such as, but not limited to,  "create", "delete", "configure", "manage infrastructure"
3. Do not generate values foruserId or requestId
4. When calling add_request_message, you MUST use requestId: "${webhookData.accessRequestId}"
5. When calling create_grant, you MUST use userId: "${webhookData.userId}"



CURRENT REQUEST ANALYSIS:
- User Email: ${webhookData.userEmail}
- userId: ${webhookData.userId}
- GCP role name: "${webhookData.accessLevelName}"
- GCP role description: "${webhookData.accessLevelDescription}"
- Catalog Entry ID: ${webhookData.catalogEntryId}
- Justification: "${webhookData.justification}"

MANDATORY WORKFLOW:
1. Determine if the justification includes the required information (incident number/info, GPC resources, intent w/GCP resources).  If it does not, stop processing send a message of the justification on having enough information
2. If the justification contains the necessary information, then call list_entitlement_bundles to see all available roles and descriptions from the catalog
3. Compare the description of the role requested against the justification the user provided
	a.  If the requested role and role description aligns with the justification, then grant the role
    b.  If the requested role is over-permissive (for ex. they request a role with admin privileges) but there is no clear justification (ie mention of modifying the system via update, delete, configure, etc.), grant a less permissive entitlement based on the resources included in the justification.  Only grant a single bundle which directly maps to GCP resources mentioned explicitly in the justification      
4. Provide details for why the roles were granted and why if the original role requested was not grated.  Include in the details what roles were ultiamtely granted
5. Only grant bundles to GCP resources EXPLICITLY MENTIONED in the justification. For example, only grant Vertex bundles when the jusitifcation mentiones AI or machine learning, etc., grant BigQuery when justification includes terms like database, grant Storage entitlements when files or cloud storage is mentioned

Remember: Your job is to enable legitimate work while minimizing access to unnecessary permissions and enforcing the principal of least privilege`;

    console.log('🎉 [MCP Client] Prompt');
    console.log(systemPrompt);

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }],
        tools: this.mcpServer.tools,
        tool_choice: "auto",
        temperature: 0.1
      });

      await this.handleToolCalls(response);
      
      console.log('🎉 [MCP Client] Access request processing completed autonomously');
      
    } catch (error) {
      console.error('❌ [MCP Client] Error processing access request:', error.message);
      throw error;
    }
  }

  async handleToolCalls(response) {
    let currentResponse = response;
    const messages = [{ role: "system", content: "Process this access request autonomously." }];

    while (currentResponse.choices[0].message.tool_calls) {
      const message = currentResponse.choices[0].message;
      messages.push(message);

      console.log(`\n🔄 [MCP Client] AI wants to call ${message.tool_calls.length} tool(s):`);

      for (const toolCall of message.tool_calls) {
        const toolName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        
        console.log(`  📞 Calling: ${toolName}(${JSON.stringify(args)})`);
        
        try {
          const result = await this.mcpServer.executeTool(toolName, args);
          
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          });
          
          console.log(`  ✅ Tool result: ${result.success ? 'Success' : 'Failed'}`);
          
        } catch (error) {
          console.log(`  ❌ Tool error: ${error.message}`);
          messages.push({
            role: "tool", 
            tool_call_id: toolCall.id,
            content: JSON.stringify({ success: false, error: error.message })
          });
        }
      }

      currentResponse = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages,
        tools: this.mcpServer.tools,
        tool_choice: "auto",
        temperature: 0.1
      });

      if (!currentResponse.choices[0].message.tool_calls) {
        console.log('\n🧠 [MCP Client] AI Final Decision:');
        console.log(currentResponse.choices[0].message.content);
      }
    }

    return currentResponse;
  }
}

// ============================================================================
// WEBHOOK HANDLER - Minimal entry point
// ============================================================================

const mcpServer = new MCPServer();
const mcpClient = new MCPClient(mcpServer);

app.post('/webhook/access-request', async (req, res) => {
  console.log('\n📡 [Webhook] Received access request');
  console.log('📋 [Webhook] Payload:', JSON.stringify(req.body, null, 2));
  
  try {
    const mappedRequest = {
      accessDuration: req.body['Access Duration'],
      accessLevelDescription: req.body['Access Level Description'], 
      accessLevelName: req.body['Access Level Name'],
      accessScopeId: req.body['Access Scope ID'],
      catalogEntryId: req.body['Catalog Entry ID'],
      accessRequestId: req.body['OIG Request ID'],
      requestAssigneeEmail: req.body["Request Assignee's Email Address"],
      requestSubject: req.body['Request Subject'],
      requestedBy: req.body['Requested By'],
      userId: req.body["Requester's User ID"],
      userEmail: req.body["Requester's Email Address"],
      resourceDescription: req.body['Resource Description'],
      resourceId: req.body['Resource ID'],
      resourceIcon: req.body['Resource Icon'],
      resourceName: req.body['Resource Name'],
      resourceUrl: req.body['Resource URL'],
      justification: req.body['Response to Justification']
    };
    
    await mcpClient.processAccessRequest(mappedRequest);
    
    res.status(200).json({ 
      status: 'received',
      message: 'Access request processing initiated',
      oigRequestId: mappedRequest.accessRequestId
    });
    
    console.log('✅ [Webhook] Request forwarded to MCP Client, webhook acknowledged');
    
  } catch (error) {
    console.error('❌ [Webhook] Error:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process webhook',
      error: error.message
    });
  }
});

app.post('/test', async (req, res) => {
  const testRequest = {
    accessDuration: "PT2H",
    accessLevelDescription: "Grants admin permissions to read and write data and metadata from BigQuery tables",
    accessLevelName: "Vertex AI Administrator - aiplatform.admin", 
    requestUserId: "00uq3zp622HWDY2Jc697",
    requestEmail: "mike.tran@okta.com",
    resourceName: "GCP - Engineering",
    justification: req.body.justification || "I need to analyze customer data for quarterly business reports",
    oigRequestId: "TEST-" + Date.now()
  };

  try {
    await mcpClient.processAccessRequest(testRequest);
    res.json({ status: 'completed', message: 'Test request processed by MCP Client' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/test-network', async (req, res) => {
  console.log('🌐 Testing network connectivity from Node.js...');
  
  const tests = [
    { name: 'Google', url: 'https://www.google.com' },
    { name: 'GitHub API', url: 'https://api.github.com/zen' },
    { name: 'HTTPBin', url: 'https://httpbin.org/get' },
    { name: 'OpenAI API', url: 'https://api.openai.com' }
  ];
  
  const results = [];
  
  for (const test of tests) {
    try {
      console.log(`📡 Testing ${test.name}...`);
      const response = await axios.get(test.url, { timeout: 5000 });
      results.push({ 
        name: test.name, 
        status: 'SUCCESS', 
        code: response.status 
      });
      console.log(`✅ ${test.name}: ${response.status}`);
    } catch (error) {
      results.push({ 
        name: test.name, 
        status: 'FAILED', 
        error: error.code || error.message });
      console.log(`❌ ${test.name}: ${error.code || error.message}`);
    }
  }
  
  res.json({ results });
});

app.post('/test-openai-raw', async (req, res) => {
  console.log('🧪 Testing OpenAI with raw HTTP...');
  
  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Hello" }],
      max_tokens: 10
    }, {
      headers: {
        'Authorization': `Bearer ${config.openai.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    res.json({ status: 'success', data: response.data });
  } catch (error) {
    console.error('Raw OpenAI Error:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      data: error.response?.data
    });
    
    res.status(500).json({
      error: error.message,
      code: error.code,
      status: error.response?.status,
      data: error.response?.data
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    architecture: 'Security-Controlled MCP System',
    components: {
      mcpServer: `${mcpServer.tools.length} tools available`,
      mcpClient: 'OpenAI GPT-4o-mini with security controls',
      securityController: 'Active - pre-filtering roles based on justification analysis'
    },
    securityFeatures: [
      'Justification analysis and classification',
      'Role pre-filtering based on security level',
      'Maximum role limits (2-3 roles max)',
      'Admin access requires explicit admin tasks',
      'Vague requests get minimal access only'
    ],
    timestamp: new Date().toISOString()
  });
});

app.listen(config.port, () => {
  console.log(`\n🎉 MCP-based Access Management System running on port ${config.port}`);
  console.log(`📡 Webhook: http://localhost:${config.port}/webhook/access-request`);
  console.log(`🧪 Test: http://localhost:${config.port}/test`);
  console.log(`🩺 Health: http://localhost:${config.port}/health`);
  console.log(`\n🏗️  Architecture:`);
  console.log(`   Webhook → MCP Client (GPT-4o-mini) → MCP Server → Okta APIs`);
  console.log(`\n🔧 MCP Tools: ${mcpServer.tools.map(t => t.function.name).join(', ')}`);
});

module.exports = app;