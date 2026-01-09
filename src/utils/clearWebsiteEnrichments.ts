#!/usr/bin/env node

import 'dotenv/config';
import { readCompany, writeCompany, listAllCompanies } from './fileSystem.js';
import { CompanySchema } from '../schemas/CompanySchema.js';
import chalk from 'chalk';

/**
 * Clear website enrichment data from all companies
 */
async function clearWebsiteEnrichments() {
  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║         CLEARING WEBSITE ENRICHMENT DATA                    ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));

  const companyNumbers = await listAllCompanies();
  let cleared = 0;
  let skipped = 0;
  let errors = 0;

  for (const companyNumber of companyNumbers) {
    try {
      const company = await readCompany(companyNumber);
      if (!company) {
        skipped++;
        continue;
      }

      // Only clear if enrichment exists
      if (!company.enrichment) {
        skipped++;
        continue;
      }

      // Clear website-related enrichment fields
      // Keep: website URL, headcount (from CSV), enrichment_status
      // Remove: business_keywords, services, customer_segments, business_description, tech_stack, website_analyzed_at, msp_likelihood_score, etc.

      const websiteUrl = company.enrichment.website;
      const headcount = company.enrichment.headcount;
      const enrichmentStatus = company.enrichment.enrichment_status;

      // Reset enrichment to minimal state
      company.enrichment = {
        website: websiteUrl,
        headcount: headcount,
        enrichment_status: enrichmentStatus === 'completed' ? 'pending' : enrichmentStatus || 'pending',
      };

      // Remove website analysis fields
      delete (company.enrichment as any).business_keywords;
      delete (company.enrichment as any).services;
      delete (company.enrichment as any).customer_segments;
      delete (company.enrichment as any).business_description;
      delete (company.enrichment as any).tech_stack;
      delete (company.enrichment as any).website_analyzed_at;
      delete (company.enrichment as any).msp_likelihood_score;
      delete (company.enrichment as any).msp_likelihood_confidence;
      delete (company.enrichment as any).msp_likelihood_computed_at;

      // Validate and write
      const validated = CompanySchema.parse(company);
      await writeCompany(validated);
      
      cleared++;
      
      if (cleared % 100 === 0) {
        console.log(chalk.dim(`  Cleared ${cleared} companies...`));
      }
    } catch (error: any) {
      console.log(chalk.red(`  ✗ Error clearing ${companyNumber}: ${error.message}`));
      errors++;
    }
  }

  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║                      SUMMARY                                ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));

  console.log(chalk.green(`✓ Cleared: ${cleared} companies`));
  console.log(chalk.yellow(`○ Skipped: ${skipped} companies`));
  console.log(chalk.red(`✗ Errors: ${errors} companies`));
  console.log('');
}

// CLI entry point
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('clearWebsiteEnrichments')) {
  clearWebsiteEnrichments().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error(chalk.red('\n✗ Fatal error:'), error);
    process.exit(1);
  });
}

export { clearWebsiteEnrichments };

