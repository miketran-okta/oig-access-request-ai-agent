# MCP Access Management System v2.0

An intelligent access management system that uses the Model Context Protocol (MCP) with OpenAI GPT-4o-mini to autonomously process access requests and grant appropriate permissions in Okta.

## Architecture

```
Webhook → MCP Client (GPT-4o-mini) → MCP Server → Okta APIs
```

- **Production Server** (`server.js`): Clean, production-ready webhook handler
- **Test Server** (`test-server.js`): Comprehensive testing suite with mock data
- **MCP Server**: Tool execution layer for Okta API interactions
- **MCP Client**: AI-powered decision engine using OpenAI GPT-4o-mini

## Quick Start

### 1. Environment Setup

Create a `.env` file:

```env
OKTA_TOKEN=your_okta_api_token
OPENAI_API_KEY=your_openai_api_key
PORT=3000
MOCK_MODE=true
NODE_ENV=development
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Production Server

```bash
npm start
```

### 4. Run Test Server

```bash
npm run test
```

### 5. Run Both Servers

```bash
npm run both
```

## API Endpoints

### Production Server (Port 3000)

- **POST** `/webhook/access-request` - Production webhook endpoint
- **GET** `/health` - Health check

### Test Server (Port 4000)

- **POST** `/test` - Run test scenarios
- **GET** `/test/scenarios` - Available test scenarios
- **GET** `/test/network` - Network connectivity test
- **POST** `/test/openai` - OpenAI API test
- **GET** `/test/okta` - Okta API test (skipped in mock mode)
- **POST** `/test/webhook` - Mock webhook test
- **POST** `/test/load` - Load testing
- **GET** `/test/health` - Test server health

## Test Scenarios

### Available Scenarios

| Scenario | Description | Expected Outcome |
|----------|-------------|------------------|
| `basic` | Basic read-only access | Grant requested BigQuery Data Viewer role only |
| `vague` | Vague justification | Grant only originally requested role (minimal access) |
| `admin` | Admin-level request | Grant admin roles for BigQuery management |
| `specific` | Specific analysis request | Grant appropriate viewer roles for data analysis |

### Running Tests

```bash
# Test specific scenario
npm run test:basic
npm run test:vague
npm run test:admin

# View available scenarios
npm run test:scenarios

# Test network connectivity
npm run test:network

# Check test server health
npm run test:health
```

### Custom Test

```bash
curl -X POST http://localhost:4000/test \
  -H "Content-Type: application/json" \
  -d '{
    "scenario": "basic",
    "justification": "I need to analyze quarterly sales data for the board presentation"
  }'
```

### Mock Webhook Test

```bash
curl -X POST http://localhost:4000/test/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "justification": "requesting access to view customer analytics data"
  }'
```

### Load Testing

```bash
curl -X POST http://localhost:4000/test/load \
  -H "Content-Type: application/json" \
  -d '{
    "count": 10,
    "delay": 500
  }'
```

## Configuration

### Mock Mode

Set `MOCK_MODE=true` in `.env` to use mock data instead of real Okta APIs. This is recommended for development and testing.

### Security Settings

The system implements security-first principles:

- **Vague justifications** → Minimal access (original role only)
- **Admin requests** → Elevated permissions (only with admin keywords)
- **Read-only needs** → Viewer roles only
- **Maximum 2-3 roles** unless clearly justified

### Okta Configuration

Required Okta settings:
- API token with governance API access
- Application ID for GCP integration
- Entitlement bundles configured

## Development

### File Structure

```
├── server.js           # Production server
├── test-server.js      # Testing server with mocks
├── package.json        # Dependencies and scripts
├── .env               # Environment variables
└── README.md          # Documentation
```

### Adding New Test Scenarios

Edit `test-server.js` and add to the `testScenarios` object:

```javascript
newScenario: {
  justification: "Your test justification",
  description: "Description of what this tests"
}
```

### Development Mode

```bash
# Auto-restart on file changes
npm run dev          # Production server
npm run test:dev     # Test server
npm run both:dev     # Both servers
```

## Monitoring

### Health Checks

```bash
# Production server health
curl http://localhost:3000/health

# Test server health
curl http://localhost:4000/test/health
```

### Logs

The system provides detailed logging:
- **🤖** MCP Client actions
- **🔧** MCP Tool executions
- **📡** Webhook processing
- **🎭** Mock mode operations
- **✅/❌** Success/failure indicators

## Security Features

1. **Justification Analysis** - AI analyzes request context
2. **Role Pre-filtering** - Security level assessment
3. **Maximum Role Limits** - Prevents over-privileging
4. **Admin Access Controls** - Requires explicit admin justification
5. **Vague Request Protection** - Minimal access for unclear requests

## Troubleshooting

### Common Issues

1. **OpenAI API Errors**: Check API key and network connectivity
2. **Okta API Errors**: Verify token permissions and application ID
3. **SSL Errors**: Development mode disables SSL validation
4. **Port Conflicts**: Adjust PORT in `.env`

### Debug Mode

Add verbose logging by setting:
```env
NODE_ENV=development
```

### Network Issues

Test connectivity:
```bash
npm run test:network
```

## Production Deployment

1. Set `NODE_ENV=production`
2. Set `MOCK_MODE=false`
3. Configure proper SSL certificates
4. Use process manager (PM2, systemd)
5. Set up monitoring and logging
6. Configure firewall rules

## API Documentation

### Webhook Payload

The system expects Okta webhook payloads with these fields:

```json
{
  "Access Duration": "PT2H",
  "Access Level Description": "Role description",
  "Access Level Name": "Role name",
  "Catalog Entry ID": "enbmtz8r2XuZWboE696",
  "Requester's User ID": "00uq3zp622HWDY2Jc697",
  "Requester's Email Address": "user@company.com",
  "Resource Name": "GCP - Engineering",
  "Response to Justification": "User's justification",
  // ... additional fields
}
```

### Response Format

```json
{
  "status": "processed",
  "message": "Access request completed successfully",
  "requestId": "reqmugy3wLZYLyU8696",
  "timestamp": "2025-01-XX:XX:XX.XXXZ"
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT License - see LICENSE file for details