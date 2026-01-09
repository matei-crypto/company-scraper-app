#!/usr/bin/env node

import 'dotenv/config';
import chalk from 'chalk';
import { readFileSync } from 'fs';
import { readCompany, writeCompany } from './fileSystem.js';
import { CompaniesHouseScraper } from '../scrapers/companiesHouse.js';
import { CompanySchema } from '../schemas/CompanySchema.js';
import { DEFAULT_FILING_HISTORY_LIMIT } from '../config/constants.js';
import { parseCSV, mergeCSVData } from './loadFromCSV.js';

/**
 * Retry failed companies with CSV data merged
 */
async function retryFailedCompanies(
  companyNumbers: string[],
  csvPath: string
) {
  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║           RETRYING FAILED COMPANIES                        ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));

  // Parse CSV to get data
  const csvData = parseCSV(csvPath);
  console.log(chalk.green(`✓ Loaded CSV data for ${csvData.size} companies\n`));

  const scraper = new CompaniesHouseScraper();
  let successCount = 0;
  let failCount = 0;
  let mergedCount = 0;

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
            const backoffDelay = Math.min(1000 * Math.pow(2, retries), 30000);
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

        // Delay after profile fetch
        await new Promise(resolve => setTimeout(resolve, 600));

        // Fetch additional data sequentially with delays
        console.log(chalk.dim('  Fetching additional data...'));

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

        // Additional delay after saving
        await new Promise(resolve => setTimeout(resolve, 600));

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
  console.log(chalk.bold.cyan('║                      RETRY SUMMARY                         ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));

  console.log(chalk.green(`✓ Successfully retried: ${successCount} companies`));
  console.log(chalk.green(`✓ CSV data merged: ${mergedCount} companies`));
  console.log(chalk.red(`✗ Failed: ${failCount} companies`));
  console.log('');

  return { successCount, failCount, mergedCount };
}

// CLI entry point
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('retryFailedCompanies')) {
  const companyNumbersFile = process.argv[2];
  const csvPath = process.argv[3] || 'IT companies from Endole.csv';

  if (!companyNumbersFile) {
    console.error(chalk.red('Usage: tsx src/utils/retryFailedCompanies.ts <company_numbers_file> [csv_path]'));
    console.error(chalk.yellow('Example: tsx src/utils/retryFailedCompanies.ts /tmp/failed_companies.txt'));
    process.exit(1);
  }

  const companyNumbers = readFileSync(companyNumbersFile, 'utf-8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line);

  if (companyNumbers.length === 0) {
    console.log(chalk.yellow('No company numbers to retry.'));
    process.exit(0);
  }

  retryFailedCompanies(companyNumbers, csvPath).then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error(chalk.red('\n✗ Fatal error:'), error);
    process.exit(1);
  });
}

export { retryFailedCompanies };

