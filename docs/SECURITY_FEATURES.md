# AgriGuard Security Features

## Overview
AgriGuard implements enterprise-grade security features to protect agricultural insurance data and ensure secure API access. This document outlines all security measures implemented in the platform.

## 🔐 Authentication & Authorization

### JWT Authentication
- **Access Tokens**: Short-lived (24h) JWT tokens for API access
- **Refresh Tokens**: Long-lived (7d) tokens for token renewal
- **Token Validation**: Comprehensive JWT verification with issuer/audience checks
- **Secure Storage**: Tokens stored securely with proper expiration handling

### API Key Authentication
- **External Integration**: API keys for Nokia CAMARA API access
- **Permission-Based**: Granular permissions per API key
- **Usage Tracking**: Monitor API key usage and last access times
- **Rotation Support**: Built-in support for API key rotation

### Role-Based Access Control (RBAC)
- **Farmer Role**: Access to own policies and claims
- **Admin Role**: Full system access and management
- **API Client Role**: External integration access
- **Nokia Partner Role**: CAMARA API access with specific permissions

## ⏱️ Rate Limiting & DDoS Protection

### Multi-Tier Rate Limiting
```javascript
// General API: 100 requests per 15 minutes
// Authentication: 5 attempts per 15 minutes  
// CAMARA APIs: 10 requests per minute
// Claims: 3 submissions per 5 minutes
```

### Progressive Delays
- **Speed Limiter**: Adds delays after 50 requests
- **Burst Protection**: Max 5 requests per second
- **Violation Tracking**: Monitor and log rate limit violations

### Smart Bypassing
- Health checks excluded from rate limits
- Admin users get higher limits
- Trusted API keys have special allowances

## ✅ Input Validation & Sanitization

### Comprehensive Validation Schemas
- **Phone Numbers**: International format validation (`^\+[1-9]\d{1,14}$`)
- **Coordinates**: Valid latitude/longitude ranges
- **Email Addresses**: RFC-compliant email validation
- **Coverage Amounts**: Reasonable financial limits (1K-1M)
- **Dates**: ISO 8601 format validation

### Security Sanitization
- **NoSQL Injection**: MongoDB query sanitization
- **XSS Protection**: HTML/script tag removal
- **Request Size**: 1MB maximum request body
- **Content Type**: Strict content-type validation

## 🛡️ Security Headers & Protection

### Helmet.js Security Headers
```http
Content-Security-Policy: default-src 'self'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### Custom Security Measures
- **IP Filtering**: Blacklist/whitelist support
- **Request ID Tracking**: Unique request identification
- **User Agent Validation**: Suspicious pattern detection
- **Geographic Restrictions**: IP-based location filtering

## 📝 Comprehensive Audit Logging

### Log Categories
- **Security Logs**: Authentication, authorization, suspicious activity
- **Business Logs**: Policy creation, claim processing, payouts
- **Performance Logs**: Response times, system metrics
- **Audit Logs**: Admin actions, configuration changes

### Log Rotation & Retention
- **File Rotation**: 5MB max file size, 5-10 files retained
- **Retention Period**: 30 days automatic cleanup
- **Log Levels**: Error, Warn, Info, Debug with filtering
- **Structured Logging**: JSON format for easy parsing

### Security Event Monitoring
```javascript
// Suspicious patterns detected:
- Script injection attempts
- SQL injection patterns  
- Unusual request patterns
- Failed authentication spikes
- Rate limit violations
```

## 🔍 Real-Time Security Monitoring

### Threat Detection
- **Brute Force**: Multiple failed login attempts
- **Injection Attacks**: SQL/NoSQL/XSS pattern detection
- **Anomaly Detection**: Unusual request patterns
- **Geographic Anomalies**: Unexpected location access

### Security Metrics
- **Authentication Success Rate**: Track login success/failure
- **API Usage Patterns**: Monitor endpoint usage
- **Error Rate Monitoring**: Track 4xx/5xx responses
- **Performance Metrics**: Response time monitoring

## 🚨 Incident Response

### Automated Responses
- **Account Lockout**: Temporary suspension after failed attempts
- **IP Blocking**: Automatic blacklisting of malicious IPs
- **Rate Limiting**: Progressive delays and blocking
- **Alert Generation**: Real-time security alerts

### Manual Interventions
- **Emergency Shutdown**: Admin-triggered system shutdown
- **User Suspension**: Manual account deactivation
- **API Key Revocation**: Immediate key invalidation
- **Security Patches**: Hot-fix deployment procedures

## 🔧 Security Configuration

### Environment Variables
```bash
# JWT Configuration
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_EXPIRES_IN=7d

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS Settings
ALLOWED_ORIGINS=https://yourdomain.com
```

### Security Middleware Stack
1. **IP Filtering** - Block malicious IPs
2. **Request Size Limiting** - Prevent large payloads
3. **Security Headers** - Apply protective headers
4. **Rate Limiting** - Control request frequency
5. **Input Sanitization** - Clean user input
6. **Authentication** - Verify user identity
7. **Authorization** - Check permissions
8. **Audit Logging** - Record security events

## 📊 Security Endpoints

### Public Endpoints
- `GET /security/status` - Security feature status
- `GET /auth/demo-users` - Demo credentials (dev only)

### Admin Security Endpoints
- `GET /admin/security/stats` - Security statistics
- `GET /admin/system/health` - System health metrics
- `POST /admin/emergency/shutdown` - Emergency shutdown

### Security Testing
- `npm run demo:security` - Run security feature demo
- `node verify-setup.js` - Verify security configuration

## 🎯 Compliance & Standards

### Security Standards
- **OWASP Top 10**: Protection against common vulnerabilities
- **JWT Best Practices**: Secure token implementation
- **API Security**: RESTful API security guidelines
- **Data Protection**: Input validation and sanitization

### Audit Trail
- **Complete Logging**: All security events logged
- **Immutable Records**: Tamper-proof audit logs
- **Compliance Reporting**: Security metrics and reports
- **Incident Documentation**: Detailed security incident records

## 🚀 Production Security Checklist

### Pre-Deployment
- [ ] Change default JWT secret
- [ ] Configure proper CORS origins
- [ ] Set up SSL/TLS certificates
- [ ] Configure firewall rules
- [ ] Set up monitoring alerts

### Runtime Security
- [ ] Monitor security logs
- [ ] Regular security updates
- [ ] API key rotation
- [ ] User access reviews
- [ ] Incident response testing

### Ongoing Maintenance
- [ ] Security patch management
- [ ] Log analysis and review
- [ ] Performance monitoring
- [ ] Threat intelligence updates
- [ ] Security training updates

## 📞 Security Contact

For security issues or questions:
- **Security Email**: security@agriguard.io
- **Emergency Contact**: Use GitHub Security Advisory
- **Response Time**: 24 hours for critical issues

## 🔗 Related Documentation

- [API Documentation](API_DOCUMENTATION.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Contributing Guidelines](../CONTRIBUTING.md)
- [Security Policy](../SECURITY.md)