#!/usr/bin/env node

import 'dotenv/config';
import chalk from 'chalk';
import { readAllCompanies, writeCompany } from './fileSystem.js';
import { analyzeMSPLikelihood } from '../schemas/CompanySchema.js';

/**
 * Recompute MSP likelihood scores for all companies with enrichment data
 */
async function main() {
  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║        RECOMPUTING MSP LIKELIHOOD SCORES                  ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));

  try {
    const companies = await readAllCompanies();
    let recomputed = 0;
    let skipped = 0;
    let errors = 0;

    for (const company of companies) {
      try {
        // Check if company has enrichment data
        const hasEnrichmentData = 
          (company.enrichment.business_keywords && company.enrichment.business_keywords.length > 0) ||
          (company.enrichment.services && company.enrichment.services.length > 0) ||
          (company.enrichment.tech_stack && company.enrichment.tech_stack.length > 0) ||
          company.enrichment.business_description;

        if (!hasEnrichmentData) {
          skipped++;
          continue;
        }

        // Recompute MSP likelihood score
        const mspAnalysis = analyzeMSPLikelihood(company);
        
        // Update company with new score
        if (!company.enrichment) {
          company.enrichment = { enrichment_status: 'pending' };
        }
        
        company.enrichment.msp_likelihood_score = mspAnalysis.score;
        company.enrichment.msp_likelihood_confidence = mspAnalysis.confidence;
        company.enrichment.msp_likelihood_computed_at = new Date().toISOString();

        await writeCompany(company);
        
        recomputed++;
        
        if (recomputed % 100 === 0) {
          console.log(chalk.dim(`  Processed ${recomputed} companies...`));
        }
      } catch (error: any) {
        console.error(chalk.red(`  ✗ Error processing ${company.company_number}: ${error.message}`));
        errors++;
      }
    }

    // Summary
    console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║                      SUMMARY                              ║'));
    console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));

    console.log(chalk.green(`✓ Recomputed: ${recomputed} companies`));
    console.log(chalk.yellow(`○ Skipped: ${skipped} companies (no enrichment data)`));
    console.log(chalk.red(`✗ Errors: ${errors} companies`));
    console.log('');

  } catch (error) {
    console.error(chalk.red('\n✗ Fatal error:'), error);
    process.exit(1);
  }
}

main();

