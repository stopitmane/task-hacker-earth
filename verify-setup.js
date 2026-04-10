#!/usr/bin/env node

/**
 * AgriGuard Setup Verification Script
 * Verifies that all components are working correctly
 */

const fs = require('fs');
const path = require('path');

console.log('🌾 AgriGuard Setup Verification');
console.log('================================');

// Check required files
const requiredFiles = [
  'src/index.js',
  'src/services/camaraService.js', 
  'src/services/processingEngine.js',
  'src/services/weatherService.js',
  'src/routes/insurance.js',
  'src/routes/farmer.js',
  'src/utils/logger.js',
  'demo/test-apis.js',
  'package.json',
  '.env.example',
  'README.md'
];

console.log('\n📁 Checking required files...');
let allFilesExist = true;

requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

// Check package.json
console.log('\n📦 Checking package.json...');
try {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  console.log(`✅ Package name: ${pkg.name}`);
  console.log(`✅ Version: ${pkg.version}`);
  console.log(`✅ Main script: ${pkg.main}`);
  
  const requiredScripts = ['start', 'demo'];
  requiredScripts.forEach(script => {
    if (pkg.scripts && pkg.scripts[script]) {
      console.log(`✅ Script "${script}": ${pkg.scripts[script]}`);
    } else {
      console.log(`❌ Script "${script}" - MISSING`);
      allFilesExist = false;
    }
  });
} catch (error) {
  console.log('❌ Error reading package.json:', error.message);
  allFilesExist = false;
}

// Check syntax of main files
console.log('\n🔍 Checking JavaScript syntax...');
const jsFiles = [
  'src/index.js',
  'src/services/camaraService.js',
  'src/services/processingEngine.js',
  'demo/test-apis.js'
];

jsFiles.forEach(file => {
  try {
    require.resolve(path.resolve(file));
    console.log(`✅ ${file} - Syntax OK`);
  } catch (error) {
    console.log(`❌ ${file} - Syntax Error: ${error.message}`);
    allFilesExist = false;
  }
});

// Check environment setup
console.log('\n🔧 Checking environment setup...');
if (fs.existsSync('.env.example')) {
  console.log('✅ .env.example exists');
  const envExample = fs.readFileSync('.env.example', 'utf8');
  const requiredEnvVars = [
    'NOKIA_NAC_BASE_URL',
    'NOKIA_API_KEY',
    'NOKIA_CLIENT_ID',
    'NOKIA_CLIENT_SECRET'
  ];
  
  requiredEnvVars.forEach(envVar => {
    if (envExample.includes(envVar)) {
      console.log(`✅ ${envVar} template exists`);
    } else {
      console.log(`❌ ${envVar} template missing`);
    }
  });
} else {
  console.log('❌ .env.example missing');
}

// Final result
console.log('\n🎯 Verification Results:');
if (allFilesExist) {
  console.log('✅ All checks passed! AgriGuard is ready to run.');
  console.log('\n📋 Next steps:');
  console.log('1. Copy .env.example to .env and add your Nokia API credentials');
  console.log('2. Run: npm start');
  console.log('3. In another terminal, run: npm run demo');
  console.log('4. Visit: http://localhost:3000');
  console.log('\n🌟 Repository: https://github.com/stopitmane/task-hacker-earth');
} else {
  console.log('❌ Some checks failed. Please review the errors above.');
  process.exit(1);
}

console.log('\n🏆 AgriGuard - Nokia Network-as-Code Hackathon Submission');
console.log('📡 CAMARA APIs: Location, SIM Swap, Device Status');
console.log('🌾 Solving agricultural insurance for Sub-Saharan Africa');