#!/usr/bin/env node

// Simple wrapper to run the scraper
// This file can be executed directly if Node.js is available

console.log('Companies House Scraper');
console.log('======================');
console.log('');
console.log('To run the scraper, execute:');
console.log('  npm run scrape "62020,62090" 10');
console.log('');
console.log('Or if npm is not available, ensure Node.js is installed and run:');
console.log('  npx tsx src/scrapers/companiesHouse.ts "62020,62090" 10');
console.log('');

// Try to load and run if we're in a Node.js environment
if (typeof require !== 'undefined') {
  try {
    const { execSync } = require('child_process');
    const fs = require('fs');
    
    // Check if .env exists
    if (fs.existsSync('.env')) {
      console.log('✓ .env file found');
      const envContent = fs.readFileSync('.env', 'utf8');
      if (envContent.includes('COMPANIES_HOUSE_API_KEY')) {
        console.log('✓ API key configured');
      } else {
        console.log('✗ API key not found in .env');
      }
    } else {
      console.log('✗ .env file not found');
    }
    
    // Check if node_modules exists
    if (fs.existsSync('node_modules')) {
      console.log('✓ Dependencies installed');
    } else {
      console.log('✗ Dependencies not installed - run: npm install');
    }
    
    console.log('');
    console.log('Setup check complete. Ready to scrape!');
  } catch (e) {
    // If we can't execute, just show the message
  }
}

