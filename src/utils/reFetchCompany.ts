#!/usr/bin/env node

import 'dotenv/config';
import chalk from 'chalk';
import { CompaniesHouseScraper } from '../scrapers/companiesHouse.js';
import { readCompany, writeCompany } from './fileSystem.js';
import { CompanySchema } from '../schemas/CompanySchema.js';
import { RATE_LIMIT_DELAY_MS, DEFAULT_FILING_HISTORY_LIMIT } from '../config/constants.js';

/**
 * Re-fetch specific companies to test validation fixes
 */
async function reFetchCompanies(companyNumbers: string[]) {
  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║           RE-FETCHING COMPANIES - VALIDATION TEST           ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));

  const scraper = new CompaniesHouseScraper();
  let successCount = 0;
  let failCount = 0;

  for (const companyNumber of companyNumbers) {
    console.log(chalk.cyan(`\nProcessing: ${companyNumber}`));
    console.log(chalk.dim('─'.repeat(60)));

    try {
      // Get company profile
      const companyProfile = await scraper.getCompanyProfile(companyNumber);
      
      if (!companyProfile) {
        console.log(chalk.red(`  ✗ Company not found`));
        failCount++;
        continue;
      }

      console.log(chalk.green(`  ✓ Profile fetched: ${companyProfile.company_name}`));

      // Fetch additional data
      console.log(chalk.dim('  Fetching additional data...'));
      
      const [officersData, pscsData, chargesData, insolvencyData, filingHistoryData] = await Promise.allSettled([
        scraper.getCompanyOfficers(companyNumber),
        scraper.getCompanyPSCs(companyNumber),
        scraper.getCompanyCharges(companyNumber),
        scraper.getCompanyInsolvency(companyNumber),
        scraper.getCompanyFilingHistory(companyNumber, DEFAULT_FILING_HISTORY_LIMIT),
      ]);

      const officers = officersData.status === 'fulfilled' ? officersData.value : null;
      const pscs = pscsData.status === 'fulfilled' ? pscsData.value : null;
      const charges = chargesData.status === 'fulfilled' ? chargesData.value : null;
      const insolvency = insolvencyData.status === 'fulfilled' ? insolvencyData.value : null;
      const filingHistory = filingHistoryData.status === 'fulfilled' ? filingHistoryData.value : null;

      // Transform to our schema
      // Note: transformToCompany is a public method on CompaniesHouseScraper
      const companyData = scraper.transformToCompany(
        companyProfile,
        officers,
        pscs,
        charges,
        insolvency,
        filingHistory
      );

      // Validate
      const validationResult = CompanySchema.safeParse(companyData);
      
      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        const errorPath = firstError?.path?.join('.') || 'unknown';
        const errorMessage = firstError?.message || 'Schema error';
        console.log(chalk.red(`  ✗ Validation failed at "${errorPath}": ${errorMessage}`));
        console.log(chalk.dim(`     Full error: ${JSON.stringify(validationResult.error.errors, null, 2)}`));
        failCount++;
        continue;
      }

      // Save the company
      await writeCompany(validationResult.data);
      console.log(chalk.green(`  ✓ Successfully saved: ${companyData.company_name}`));
      successCount++;

      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));

    } catch (error: any) {
      console.log(chalk.red(`  ✗ Error: ${error.message}`));
      failCount++;
    }
  }

  // Summary
  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║                      TEST SUMMARY                          ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));

  console.log(chalk.green(`✓ Success: ${successCount} companies`));
  console.log(chalk.red(`✗ Failed:  ${failCount} companies`));
  console.log('');

  return { successCount, failCount };
}

// CLI entry point
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('reFetchCompany')) {
  const companyNumbers = process.argv.slice(2);
  
  if (companyNumbers.length === 0) {
    console.error(chalk.red('Usage: tsx src/utils/reFetchCompany.ts <company_number> [company_number...]'));
    console.error(chalk.yellow('Example: tsx src/utils/reFetchCompany.ts 14897055 04298949 06228885'));
    process.exit(1);
  }

  reFetchCompanies(companyNumbers).then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error(chalk.red('\n✗ Fatal error:'), error);
    process.exit(1);
  });
}

export { reFetchCompanies };

