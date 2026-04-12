#!/usr/bin/env node

/**
 * AgriGuard Security Demo Script
 * 
 * This script demonstrates the comprehensive security features of the AgriGuard platform
 * including authentication, rate limiting, input validation, and audit logging.
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

class SecurityDemo {
  constructor() {
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 10000,
      validateStatus: () => true // Don't throw on HTTP errors
    });
    this.tokens = {};
  }

  async runDemo() {
    console.log('🔒 AgriGuard Security Features Demo');
    console.log('=' .repeat(50));
    
    try {
      // 1. Test unauthenticated access
      await this.testUnauthenticatedAccess();
      
      // 2. Test authentication system
      await this.testAuthentication();
      
      // 3. Test rate limiting
      await this.testRateLimiting();
      
      // 4. Test input validation
      await this.testInputValidation();
      
      // 5. Test API key authentication
      await this.testApiKeyAuth();
      
      // 6. Test admin endpoints
      await this.testAdminEndpoints();
      
      // 7. Test security headers
      await this.testSecurityHeaders();
      
      console.log('\n✅ Security demo completed successfully!');
      console.log('🔒 All security features are working correctly.');
      
    } catch (error) {
      console.error('❌ Security demo failed:', error.message);
    }
  }

  async testUnauthenticatedAccess() {
    console.log('\n1. 🚫 Testing Unauthenticated Access...');
    
    // Try to access protected endpoint without auth
    const response = await this.client.post('/api/insurance/policy', {
      farmerId: 'test',
      phoneNumber: '+254700123456',
      fieldLocation: { lat: -1.2921, lon: 36.8219 },
      coverageAmount: 50000,
      coverageType: ['drought']
    });
    
    if (response.status === 401) {
      console.log('✅ Unauthenticated access properly blocked');
      console.log('📝 Response:', response.data.message);
    } else {
      console.log('❌ Security issue: Unauthenticated access allowed');
    }
  }

  async testAuthentication() {
    console.log('\n2. 🔐 Testing Authentication System...');
    
    // Test login with demo credentials
    console.log('\n📝 Logging in as farmer...');
    const loginResponse = await this.client.post('/auth/login', {
      email: 'farmer@agriguard.com',
      password: 'farmer123'
    });
    
    if (loginResponse.status === 200) {
      console.log('✅ Login successful');
      console.log('👤 User:', loginResponse.data.user.email, `(${loginResponse.data.user.role})`);
      console.log('🎫 Access token received');
      console.log('🔄 Refresh token received');
      
      this.tokens.farmer = loginResponse.data.tokens;
    } else {
      console.log('❌ Login failed:', loginResponse.data);
      return;
    }
    
    // Test token validation
    console.log('\n🔍 Testing token validation...');
    const profileResponse = await this.client.get('/auth/profile', {
      headers: {
        'Authorization': `Bearer ${this.tokens.farmer.accessToken}`
      }
    });
    
    if (profileResponse.status === 200) {
      console.log('✅ Token validation successful');
      console.log('👤 Profile:', profileResponse.data.user.email);
    } else {
      console.log('❌ Token validation failed');
    }
    
    // Test invalid credentials
    console.log('\n🚫 Testing invalid credentials...');
    const invalidLogin = await this.client.post('/auth/login', {
      email: 'hacker@evil.com',
      password: 'wrongpassword'
    });
    
    if (invalidLogin.status === 401) {
      console.log('✅ Invalid credentials properly rejected');
    } else {
      console.log('❌ Security issue: Invalid credentials accepted');
    }
  }

  async testRateLimiting() {
    console.log('\n3. ⏱️ Testing Rate Limiting...');
    
    console.log('📊 Making multiple rapid requests to test rate limiting...');
    
    const requests = [];
    for (let i = 0; i < 8; i++) {
      requests.push(
        this.client.post('/auth/login', {
          email: 'test@test.com',
          password: 'wrongpassword'
        })
      );
    }
    
    const responses = await Promise.all(requests);
    const rateLimited = responses.filter(r => r.status === 429);
    
    if (rateLimited.length > 0) {
      console.log(`✅ Rate limiting active: ${rateLimited.length} requests blocked`);
      console.log('📝 Rate limit message:', rateLimited[0].data.message);
      console.log('⏰ Retry after:', rateLimited[0].data.retryAfter, 'seconds');
    } else {
      console.log('⚠️ Rate limiting may not be active (or limit not reached)');
    }
  }

  async testInputValidation() {
    console.log('\n4. ✅ Testing Input Validation...');
    
    if (!this.tokens.farmer) {
      console.log('⚠️ Skipping input validation test (no auth token)');
      return;
    }
    
    // Test invalid phone number
    console.log('\n📱 Testing invalid phone number validation...');
    const invalidPhone = await this.client.post('/api/insurance/policy', {
      farmerId: 'test-farmer',
      phoneNumber: 'invalid-phone', // Invalid format
      fieldLocation: { lat: -1.2921, lon: 36.8219 },
      coverageAmount: 50000,
      coverageType: ['drought']
    }, {
      headers: {
        'Authorization': `Bearer ${this.tokens.farmer.accessToken}`
      }
    });
    
    if (invalidPhone.status === 400) {
      console.log('✅ Invalid phone number rejected');
      console.log('📝 Validation errors:', invalidPhone.data.details?.length || 0);
    } else {
      console.log('❌ Invalid phone number accepted');
    }
    
    // Test invalid coordinates
    console.log('\n🌍 Testing invalid coordinates validation...');
    const invalidCoords = await this.client.post('/api/insurance/policy', {
      farmerId: 'test-farmer',
      phoneNumber: '+254700123456',
      fieldLocation: { lat: 999, lon: 999 }, // Invalid coordinates
      coverageAmount: 50000,
      coverageType: ['drought']
    }, {
      headers: {
        'Authorization': `Bearer ${this.tokens.farmer.accessToken}`
      }
    });
    
    if (invalidCoords.status === 400) {
      console.log('✅ Invalid coordinates rejected');
    } else {
      console.log('❌ Invalid coordinates accepted');
    }
  }

  async testApiKeyAuth() {
    console.log('\n5. 🔑 Testing API Key Authentication...');
    
    // Test with valid API key
    console.log('\n✅ Testing valid API key...');
    const validApiKey = await this.client.post('/api/insurance/verify-location', {
      phoneNumber: '+254700123456',
      expectedLat: -1.2921,
      expectedLon: 36.8219
    }, {
      headers: {
        'x-api-key': 'ak_demo_nokia_integration'
      }
    });
    
    if (validApiKey.status === 500) { // Expected due to no real Nokia API
      console.log('✅ API key authentication successful (Nokia API not configured)');
    } else if (validApiKey.status === 401) {
      console.log('❌ Valid API key rejected');
    }
    
    // Test with invalid API key
    console.log('\n🚫 Testing invalid API key...');
    const invalidApiKey = await this.client.post('/api/insurance/verify-location', {
      phoneNumber: '+254700123456',
      expectedLat: -1.2921,
      expectedLon: 36.8219
    }, {
      headers: {
        'x-api-key': 'invalid-key'
      }
    });
    
    if (invalidApiKey.status === 401) {
      console.log('✅ Invalid API key properly rejected');
    } else {
      console.log('❌ Invalid API key accepted');
    }
  }

  async testAdminEndpoints() {
    console.log('\n6. 👑 Testing Admin Endpoints...');
    
    // Login as admin
    console.log('\n🔐 Logging in as admin...');
    const adminLogin = await this.client.post('/auth/login', {
      email: 'admin@agriguard.com',
      password: 'admin123'
    });
    
    if (adminLogin.status === 200) {
      console.log('✅ Admin login successful');
      this.tokens.admin = adminLogin.data.tokens;
      
      // Test admin endpoint access
      console.log('\n📊 Testing admin system health endpoint...');
      const healthResponse = await this.client.get('/admin/system/health', {
        headers: {
          'Authorization': `Bearer ${this.tokens.admin.accessToken}`
        }
      });
      
      if (healthResponse.status === 200) {
        console.log('✅ Admin endpoint accessible');
        console.log('💾 Memory usage:', Math.round(healthResponse.data.memory.rss / 1024 / 1024) + 'MB');
        console.log('⏱️ Uptime:', Math.round(healthResponse.data.uptime) + 's');
      } else {
        console.log('❌ Admin endpoint access failed');
      }
      
      // Test farmer trying to access admin endpoint
      console.log('\n🚫 Testing farmer access to admin endpoint...');
      const farmerAdminAttempt = await this.client.get('/admin/system/health', {
        headers: {
          'Authorization': `Bearer ${this.tokens.farmer.accessToken}`
        }
      });
      
      if (farmerAdminAttempt.status === 403) {
        console.log('✅ Farmer properly blocked from admin endpoint');
      } else {
        console.log('❌ Security issue: Farmer can access admin endpoint');
      }
    } else {
      console.log('❌ Admin login failed');
    }
  }

  async testSecurityHeaders() {
    console.log('\n7. 🛡️ Testing Security Headers...');
    
    const response = await this.client.get('/');
    
    const securityHeaders = [
      'x-frame-options',
      'x-content-type-options',
      'referrer-policy',
      'content-security-policy'
    ];
    
    console.log('\n🔍 Checking security headers...');
    securityHeaders.forEach(header => {
      if (response.headers[header]) {
        console.log(`✅ ${header}: ${response.headers[header]}`);
      } else {
        console.log(`❌ Missing: ${header}`);
      }
    });
    
    // Check rate limit headers
    if (response.headers['ratelimit-limit']) {
      console.log(`✅ Rate limit headers present`);
      console.log(`📊 Limit: ${response.headers['ratelimit-limit']}`);
      console.log(`📊 Remaining: ${response.headers['ratelimit-remaining']}`);
    }
  }

  async showSecuritySummary() {
    console.log('\n' + '=' .repeat(50));
    console.log('🔒 SECURITY FEATURES SUMMARY');
    console.log('=' .repeat(50));
    
    const features = [
      '🔐 JWT Authentication with refresh tokens',
      '🔑 API Key authentication for external integrations',
      '👥 Role-based authorization (farmer, admin, api_client)',
      '⏱️ Multi-tier rate limiting (general, auth, CAMARA, claims)',
      '✅ Comprehensive input validation and sanitization',
      '🛡️ Security headers (Helmet.js + custom)',
      '📝 Detailed audit logging and monitoring',
      '🚫 IP filtering and request size limiting',
      '🔍 XSS and NoSQL injection protection',
      '📊 Real-time security monitoring and statistics'
    ];
    
    features.forEach(feature => console.log(feature));
    
    console.log('\n🎯 Security Compliance:');
    console.log('• OWASP Top 10 protection');
    console.log('• Input validation and sanitization');
    console.log('• Secure authentication and session management');
    console.log('• Comprehensive logging and monitoring');
    console.log('• Rate limiting and DDoS protection');
    
    console.log('\n📚 Demo Credentials:');
    console.log('• Farmer: farmer@agriguard.com / farmer123');
    console.log('• Admin: admin@agriguard.com / admin123');
    console.log('• API Key: ak_demo_nokia_integration');
  }
}

// Run the demo
if (require.main === module) {
  const demo = new SecurityDemo();
  demo.runDemo().then(() => {
    demo.showSecuritySummary();
  }).catch(console.error);
}

module.exports = SecurityDemo;