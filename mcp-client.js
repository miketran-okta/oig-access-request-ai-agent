const { OpenAI } = require('openai');

// ============================================================================
// MCP CLIENT - GPT-4 that uses MCP tools to accomplish tasks
// ============================================================================
class MCPClient {
  constructor(mcpServer, openaiApiKey) {
    this.mcpServer = mcpServer;
    this.openai = new OpenAI({ apiKey: openaiApiKey });
  }

  async processAccessRequest(webhookData) {
    console.log('\n🤖 [MCP Client] Starting autonomous access request processing...');
    console.log(`👤 [MCP Client] Request from: ${webhookData.userEmail}`);
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
        tools: this.mcpServer.getTools(),
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
        tools: this.mcpServer.getTools(),
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

module.exports = MCPClient;