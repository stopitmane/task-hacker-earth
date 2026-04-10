# AgriGuard API Documentation

## Overview
AgriGuard is an AI-powered agricultural insurance platform that leverages Nokia Network-as-Code CAMARA APIs to provide automated, fraud-resistant micro-insurance for farmers in Sub-Saharan Africa.

## Base URL
```
http://localhost:3000
```

## CAMARA APIs Used

### 1. Location API
- **Purpose**: Verify farmer location and field boundaries
- **Endpoint**: `/location/v0/retrieve`
- **Use Case**: Ensure farmers are physically present at their registered farm locations

### 2. SIM Swap API
- **Purpose**: Detect fraud attempts and account security risks
- **Endpoint**: `/sim-swap/v0/check`
- **Use Case**: Prevent fraudulent claims by detecting recent SIM card changes

### 3. Device Status API
- **Purpose**: Monitor connectivity reliability for critical transactions
- **Endpoint**: `/device-status/v0/connectivity`
- **Use Case**: Ensure reliable communication for claim processing and payouts

## API Endpoints

### Health Check
```http
GET /health
```
Returns API health status and basic information.

### Insurance Endpoints

#### Create Insurance Policy
```http
POST /api/insurance/policy
```

**Request Body:**
```json
{
  "farmerId": "string",
  "phoneNumber": "string",
  "fieldLocation": {
    "lat": "number",
    "lon": "number"
  },
  "cropType": "string",
  "coverageAmount": "number",
  "coverageType": ["drought", "flood", "connectivity"]
}
```

**Response:**
```json
{
  "message": "Insurance policy created successfully",
  "policyId": "string",
  "policy": { ... },
  "aiMonitoring": true
}
```

#### Submit Insurance Claim
```http
POST /api/insurance/claim
```

**Request Body:**
```json
{
  "farmerId": "string",
  "claimType": "drought|flood|connectivity",
  "description": "string",
  "estimatedLoss": "number",
  "incidentDate": "ISO string"
}
```

**Response:**
```json
{
  "claimId": "string",
  "status": "approved|rejected",
  "confidence": "number",
  "payoutAmount": "number",
  "reasoning": ["string"],
  "processedAt": "ISO string",
  "aiProcessed": true
}
```

#### Verify Location
```http
POST /api/insurance/verify-location
```

**Request Body:**
```json
{
  "phoneNumber": "string",
  "expectedLat": "number",
  "expectedLon": "number",
  "radius": "number (optional, default: 1000)"
}
```

#### Check Security Status
```http
POST /api/insurance/check-security
```

**Request Body:**
```json
{
  "phoneNumber": "string"
}
```

**Response:**
```json
{
  "phoneNumber": "string",
  "simSwap": {
    "swapped": "boolean",
    "swapDate": "ISO string|null",
    "riskLevel": "HIGH|LOW"
  },
  "deviceStatus": {
    "status": "CONNECTED_DATA|CONNECTED_SMS|NOT_CONNECTED",
    "reliable": "boolean",
    "roaming": "boolean"
  },
  "overallRisk": "string"
}
```

#### Get Weather Analysis
```http
GET /api/insurance/weather/:lat/:lon?days=30&claimType=drought
```

### Farmer Endpoints

#### Register Farmer
```http
POST /api/farmer/register
```

**Request Body:**
```json
{
  "name": "string",
  "phoneNumber": "string",
  "farmLocation": {
    "lat": "number",
    "lon": "number"
  },
  "cropTypes": ["string"],
  "farmSize": "small|medium|large"
}
```

#### Get Farmer Profile
```http
GET /api/farmer/profile/:phoneNumber
```

#### Emergency Verification
```http
POST /api/farmer/emergency-verify
```

**Request Body:**
```json
{
  "phoneNumber": "string",
  "emergencyType": "medical|weather|security",
  "location": {
    "lat": "number",
    "lon": "number"
  }
}
```

## AI Agent Features

### Automated Claim Processing
The AI agent evaluates claims using:
- **Location verification** (40% weight)
- **Weather pattern analysis** (50% weight)
- **Policy compliance** (10% weight)

### Risk Assessment
Risk scores are calculated based on:
- Location accuracy and verification
- SIM swap detection
- Device connectivity reliability
- Historical weather patterns

### Automatic Monitoring
The AI agent continuously monitors:
- Active insurance policies
- Weather conditions for covered areas
- Network connectivity status
- Potential fraud indicators

## Error Handling

All endpoints return standardized error responses:

```json
{
  "error": "Error type",
  "message": "Detailed error message",
  "timestamp": "ISO string"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `403` - Forbidden (security check failed)
- `404` - Not Found
- `500` - Internal Server Error
- `503` - Service Unavailable (device not reachable)

## Security Features

### Multi-Layer Verification
1. **Location Verification**: GPS-based field boundary validation
2. **SIM Swap Detection**: Real-time monitoring for account security
3. **Device Status**: Connectivity reliability assessment
4. **AI Risk Scoring**: Comprehensive fraud detection

### Fraud Prevention
- Real-time SIM swap monitoring
- Location-based verification
- Pattern analysis for suspicious activities
- Multi-factor authentication support

## Integration Examples

### Basic Policy Creation Flow
```javascript
// 1. Register farmer
const farmer = await registerFarmer(farmerData);

// 2. Verify location and security
const security = await checkSecurity(phoneNumber);

// 3. Create policy if verified
if (security.approved) {
  const policy = await createPolicy(policyData);
}
```

### Claim Processing Flow
```javascript
// 1. Submit claim
const claim = await submitClaim(claimData);

// 2. AI processes automatically
// - Verifies location
// - Checks weather data
// - Assesses fraud risk
// - Makes payout decision

// 3. Receive instant decision
console.log(`Claim ${claim.status}: ${claim.payoutAmount} KES`);
```

## Rate Limits
- Standard endpoints: 100 requests/minute
- CAMARA API calls: 50 requests/minute
- Emergency endpoints: 200 requests/minute

## Environment Variables
```bash
NOKIA_NAC_BASE_URL=https://network-as-code.nokia.com
NOKIA_API_KEY=your_api_key
NOKIA_CLIENT_ID=your_client_id
NOKIA_CLIENT_SECRET=your_client_secret
PORT=3000
NODE_ENV=development
```

## Testing
Run the demo script to test all features:
```bash
npm install
npm start
# In another terminal:
node demo/test-apis.js
```