#!/usr/bin/env node

import 'dotenv/config';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { join } from 'path';
import { readCompany, writeCompany } from './fileSystem.js';
import type { Company } from '../schemas/CompanySchema.js';

/**
 * CSV row data structure
 */
interface CSVRow {
  companyNumber: string;
  name?: string;
  employees?: number;
  website?: string;
  turnover?: number;
  ebitda?: number;
}

/**
 * Parse a monetary value from CSV (handles £ symbols, commas, parentheses for negatives)
 * Also handles encoding issues where £ might appear as replacement character
 */
function parseMonetaryValue(value: string): number | undefined {
  if (!value || value.trim() === '') return undefined;
  
  // Remove currency symbols (including replacement characters that might represent £)
  // Also remove commas, spaces, and any non-numeric characters except minus, parentheses, and decimal point
  let cleaned = value.trim()
    .replace(/£/g, '')
    .replace(/\uFFFD/g, '') // Handle Unicode replacement character that might represent £
    .replace(/,/g, '')
    .replace(/\s+/g, '');
  
  // Handle negative values in parentheses: (123) = -123
  const isNegative = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isNegative) {
    cleaned = cleaned.slice(1, -1);
  }
  
  // Remove any remaining non-numeric characters except decimal point and minus
  cleaned = cleaned.replace(/[^\d.-]/g, '');
  
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return undefined;
  
  return isNegative ? -parsed : parsed;
}

/**
 * Normalize website URL (add https:// if missing)
 */
function normalizeWebsite(website: string | undefined): string | undefined {
  if (!website || website.trim() === '') return undefined;
  
  let url = website.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  
  return url;
}

/**
 * Parse CSV file and extract company data
 */
function parseCSV(filePath: string): Map<string, CSVRow> {
  // Try UTF-8 first, fallback to Latin1 if there are encoding issues
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
    // Check if there are replacement characters that suggest encoding issues
    if (content.includes('')) {
      content = readFileSync(filePath, 'latin1');
    }
  } catch {
    // Fallback to Latin1
    content = readFileSync(filePath, 'latin1');
  }
  
  const lines = content.split('\n');
  
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header and one data row');
  }

  // Parse header to find column indices
  const header = lines[0];
  const headerFields = parseCSVLine(header);
  
  const nameIndex = headerFields.findIndex(col => 
    col.trim().toLowerCase() === 'name'
  );
  const employeesIndex = headerFields.findIndex(col => 
    col.trim().toLowerCase() === 'employees'
  );
  const websiteIndex = headerFields.findIndex(col => 
    col.trim().toLowerCase() === 'website'
  );
  const turnoverIndex = headerFields.findIndex(col => 
    col.trim().toLowerCase() === 'turnover'
  );
  const regNumberIndex = headerFields.findIndex(col => 
    col.trim().toLowerCase().includes('reg') && 
    col.trim().toLowerCase().includes('number')
  );
  const ebitdaIndex = headerFields.findIndex(col => 
    col.trim().toLowerCase() === 'ebitda'
  );

  if (regNumberIndex === -1) {
    throw new Error('Could not find "Reg Number" column in CSV');
  }

  const csvData = new Map<string, CSVRow>();
  
  // Parse each data row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCSVLine(line);
    
    if (fields.length <= regNumberIndex) continue;
    
    const regNumber = fields[regNumberIndex]?.trim();
    if (!regNumber) continue;

    // Normalize company number
    const normalized = regNumber.padStart(8, '0');
    
    const row: CSVRow = {
      companyNumber: normalized,
    };
    
    if (nameIndex !== -1 && fields[nameIndex]) {
      row.name = fields[nameIndex].trim();
    }
    
    if (employeesIndex !== -1 && fields[employeesIndex]) {
      const employees = parseInt(fields[employeesIndex].trim(), 10);
      if (!isNaN(employees)) {
        row.employees = employees;
      }
    }
    
    if (websiteIndex !== -1 && fields[websiteIndex]) {
      row.website = normalizeWebsite(fields[websiteIndex]);
    }
    
    if (turnoverIndex !== -1 && fields[turnoverIndex]) {
      row.turnover = parseMonetaryValue(fields[turnoverIndex]);
    }
    
    if (ebitdaIndex !== -1 && fields[ebitdaIndex]) {
      row.ebitda = parseMonetaryValue(fields[ebitdaIndex]);
    }
    
    csvData.set(normalized, row);
  }

  return csvData;
}

/**
 * Parse a CSV line handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let currentField = '';
  let inQuotes = false;
  
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(currentField.trim());
      currentField = '';
    } else {
      currentField += char;
    }
  }
  fields.push(currentField.trim()); // Add last field
  
  return fields;
}

/**
 * Merge CSV data into company record
 */
function mergeCSVData(company: Company, csvRow: CSVRow): Company {
  const updated = { ...company };
  
  // Merge enrichment data
  if (!updated.enrichment) {
    updated.enrichment = { enrichment_status: 'pending' };
  }
  
  if (csvRow.website && !updated.enrichment.website) {
    updated.enrichment.website = csvRow.website;
  }
  
  if (csvRow.employees !== undefined && updated.enrichment.headcount === undefined) {
    updated.enrichment.headcount = csvRow.employees;
  }
  
  // Merge financials data
  if (!updated.financials) {
    updated.financials = {};
  }
  
  if (csvRow.turnover !== undefined && updated.financials.revenue === undefined) {
    updated.financials.revenue = csvRow.turnover;
  }
  
  if (csvRow.ebitda !== undefined && updated.financials.ebitda === undefined) {
    updated.financials.ebitda = csvRow.ebitda;
  }
  
  if (csvRow.employees !== undefined && updated.financials.employees === undefined) {
    updated.financials.employees = csvRow.employees;
  }
  
  return updated;
}

/**
 * Load companies from CSV file
 */
async function loadCompaniesFromCSV(csvPath: string, options: {
  skipExisting?: boolean;
  limit?: number;
} = {}) {
  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║           LOADING COMPANIES FROM CSV                       ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));

  console.log(chalk.dim(`Reading CSV: ${csvPath}\n`));

  try {
    // Parse CSV - get both company numbers and CSV data
    const csvData = parseCSV(csvPath);
    const allCompanyNumbers = Array.from(csvData.keys());
    
    console.log(chalk.green(`✓ Found ${allCompanyNumbers.length} companies in CSV`));
    console.log(chalk.dim(`  - ${Array.from(csvData.values()).filter(r => r.website).length} with website`));
    console.log(chalk.dim(`  - ${Array.from(csvData.values()).filter(r => r.turnover !== undefined).length} with turnover`));
    console.log(chalk.dim(`  - ${Array.from(csvData.values()).filter(r => r.ebitda !== undefined).length} with EBITDA`));
    console.log(chalk.dim(`  - ${Array.from(csvData.values()).filter(r => r.employees !== undefined).length} with employees\n`));

    // Apply limit if specified
    let companyNumbers = allCompanyNumbers;
    if (options.limit && options.limit > 0) {
      companyNumbers = allCompanyNumbers.slice(0, options.limit);
      console.log(chalk.yellow(`⚠ Limited to first ${options.limit} companies\n`));
    }

    // Filter out existing companies if requested
    if (options.skipExisting) {
      const filtered: string[] = [];
      let existingCount = 0;
      
      for (const companyNumber of companyNumbers) {
        const existing = await readCompany(companyNumber);
        if (existing) {
          existingCount++;
          // Still merge CSV data into existing companies
          const csvRow = csvData.get(companyNumber);
          if (csvRow) {
            const updated = mergeCSVData(existing, csvRow);
            await writeCompany(updated);
          }
        } else {
          filtered.push(companyNumber);
        }
      }
      
      if (existingCount > 0) {
        console.log(chalk.green(`✓ Updated ${existingCount} existing companies with CSV data`));
      }
      console.log(chalk.cyan(`  ${filtered.length} new companies to load\n`));
      companyNumbers = filtered;
    }

    if (companyNumbers.length === 0) {
      console.log(chalk.yellow('No companies to load.'));
      return;
    }

    // Load companies and merge CSV data
    // We'll do this company-by-company to ensure CSV data is merged immediately
    console.log(chalk.cyan(`\nFetching ${companyNumbers.length} companies from Companies House and merging CSV data...\n`));
    
    const { CompaniesHouseScraper } = await import('../scrapers/companiesHouse.js');
    const { CompanySchema } = await import('../schemas/CompanySchema.js');
    const { RATE_LIMIT_DELAY_MS, DEFAULT_FILING_HISTORY_LIMIT } = await import('../config/constants.js');
    
    const scraper = new CompaniesHouseScraper();
    let successCount = 0;
    let failCount = 0;
    let mergedCount = 0;
    
    // Wait 2 minutes before starting to ensure rate limit window is clear
    console.log(chalk.yellow('\n⚠ Waiting 2 minutes for rate limit window to reset...\n'));
    await new Promise(resolve => setTimeout(resolve, 120000));
    console.log(chalk.green('✓ Rate limit window should be clear. Starting...\n'));
    
    for (const companyNumber of companyNumbers) {
      console.log(chalk.cyan(`\nProcessing: ${companyNumber}`));
      console.log(chalk.dim('─'.repeat(60)));
      
      let retries = 0;
      const maxRetries = 3;
      let success = false;
      
      while (retries <= maxRetries && !success) {
        try {
          // Get company profile with retry logic for rate limits
          let companyProfile;
          try {
            companyProfile = await scraper.getCompanyProfile(companyNumber);
          } catch (error: any) {
            if (error.message?.includes('429') && retries < maxRetries) {
              const backoffDelay = Math.min(1000 * Math.pow(2, retries), 30000); // Exponential backoff, max 30s
              console.log(chalk.yellow(`  ⚠ Rate limited (429), retrying in ${backoffDelay/1000}s... (attempt ${retries + 1}/${maxRetries + 1})`));
              await new Promise(resolve => setTimeout(resolve, backoffDelay));
              retries++;
              continue;
            }
            throw error;
          }
          
          if (!companyProfile) {
            console.log(chalk.red(`  ✗ Company not found`));
            failCount++;
            break;
          }
          
          console.log(chalk.green(`  ✓ Profile fetched: ${companyProfile.company_name}`));
          
          // Delay after profile fetch before additional calls
          await new Promise(resolve => setTimeout(resolve, 600));
          
          // Fetch additional data sequentially with delays to avoid rate limits
          // Companies House allows 600 requests per 5 minutes = 2 requests/second
          // We make 5 additional calls, so we need at least 500ms between each
          console.log(chalk.dim('  Fetching additional data...'));
          
          // Fetch sequentially with delays to respect rate limits
          // Each call waits for the previous to complete + delay
          // Total: 1 profile + 5 additional = 6 calls per company
          // With 600ms between each = ~3.6 seconds per company = ~16 companies/minute
          // This is well under the 600 requests/5 minutes = 120 requests/minute limit
          const officersData = await Promise.allSettled([
            scraper.getCompanyOfficers(companyNumber)
          ]).then(results => results[0]);
          await new Promise(resolve => setTimeout(resolve, 600));
          
          const pscsData = await Promise.allSettled([
            scraper.getCompanyPSCs(companyNumber)
          ]).then(results => results[0]);
          await new Promise(resolve => setTimeout(resolve, 600));
          
          const chargesData = await Promise.allSettled([
            scraper.getCompanyCharges(companyNumber)
          ]).then(results => results[0]);
          await new Promise(resolve => setTimeout(resolve, 600));
          
          const insolvencyData = await Promise.allSettled([
            scraper.getCompanyInsolvency(companyNumber)
          ]).then(results => results[0]);
          await new Promise(resolve => setTimeout(resolve, 600));
          
          const filingHistoryData = await Promise.allSettled([
            scraper.getCompanyFilingHistory(companyNumber, DEFAULT_FILING_HISTORY_LIMIT)
          ]).then(results => results[0]);
          await new Promise(resolve => setTimeout(resolve, 600));
          
          const officers = officersData.status === 'fulfilled' ? officersData.value : null;
          const pscs = pscsData.status === 'fulfilled' ? pscsData.value : null;
          const charges = chargesData.status === 'fulfilled' ? chargesData.value : null;
          const insolvency = insolvencyData.status === 'fulfilled' ? insolvencyData.value : null;
          const filingHistory = filingHistoryData.status === 'fulfilled' ? filingHistoryData.value : null;
          
          // Transform to our schema
          let companyData = scraper.transformToCompany(
            companyProfile,
            officers,
            pscs,
            charges,
            insolvency,
            filingHistory
          );
          
          // Merge CSV data BEFORE validation
          const csvRow = csvData.get(companyNumber);
          if (csvRow) {
            companyData = mergeCSVData(companyData as any, csvRow);
            mergedCount++;
            console.log(chalk.dim('  ✓ CSV data merged'));
          }
          
          // Validate
          const validationResult = CompanySchema.safeParse(companyData);
          
          if (!validationResult.success) {
            const firstError = validationResult.error.errors[0];
            const errorPath = firstError?.path?.join('.') || 'unknown';
            const errorMessage = firstError?.message || 'Schema error';
            console.log(chalk.red(`  ✗ Validation failed at "${errorPath}": ${errorMessage}`));
            failCount++;
            break;
          }
          
          // Save the company (with CSV data already merged)
          await writeCompany(validationResult.data);
          console.log(chalk.green(`  ✓ Successfully saved: ${companyData.company_name}`));
          successCount++;
          success = true;
          
          // Rate limiting delay after completing a company
          // We make 6 API calls per company (1 profile + 5 additional)
          // Companies House allows 600 requests per 5 minutes = 2 requests/second = 500ms per request
          // With 6 requests per company, we need at least 3 seconds between companies
          // Use 3.5 seconds to stay safely under the limit
          await new Promise(resolve => setTimeout(resolve, 3500));
          
        } catch (error: any) {
          if (error.message?.includes('429') && retries < maxRetries) {
            const backoffDelay = Math.min(1000 * Math.pow(2, retries), 30000);
            console.log(chalk.yellow(`  ⚠ Rate limited (429), retrying in ${backoffDelay/1000}s... (attempt ${retries + 1}/${maxRetries + 1})`));
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
            retries++;
            continue;
          }
          console.log(chalk.red(`  ✗ Error: ${error.message}`));
          failCount++;
          break;
        }
      }
    }
    
    // Summary
    console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║                      LOAD SUMMARY                          ║'));
    console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));
    
    console.log(chalk.green(`✓ Successfully loaded: ${successCount} companies`));
    console.log(chalk.green(`✓ CSV data merged: ${mergedCount} companies`));
    console.log(chalk.red(`✗ Failed: ${failCount} companies`));
    console.log('');

  } catch (error: any) {
    console.error(chalk.red(`\n✗ Error loading companies: ${error.message}`));
    if (error.stack) {
      console.error(chalk.dim(error.stack));
    }
    process.exit(1);
  }
}

// CLI entry point
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('loadFromCSV')) {
  const csvPath = process.argv[2] || 'IT companies from Endole.csv';
  const skipExisting = process.argv.includes('--skip-existing');
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

  // Resolve path relative to project root
  const resolvedPath = csvPath.startsWith('/') 
    ? csvPath 
    : join(process.cwd(), csvPath);

  loadCompaniesFromCSV(resolvedPath, { skipExisting, limit }).then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error(chalk.red('\n✗ Fatal error:'), error);
    process.exit(1);
  });
}

export { loadCompaniesFromCSV, parseCSV, mergeCSVData, type CSVRow };

