#!/usr/bin/env node

import 'dotenv/config';
import chalk from 'chalk';
import { listAllCompanies, readCompany, writeCompany } from './fileSystem.js';
import { calculateInvestmentScore } from '../schemas/CompanySchema.js';

/**
 * Compute and store investment scores for all companies
 */
async function computeAndStoreScores() {
  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║        COMPUTING AND STORING INVESTMENT SCORES             ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));

  const companyNumbers = await listAllCompanies();
  let computed = 0;
  let skipped = 0;
  let errors = 0;

  for (const companyNumber of companyNumbers) {
    try {
      const company = await readCompany(companyNumber);
      if (!company) {
        skipped++;
        continue;
      }

      // Compute and store investment score
      try {
        const scoreResult = await calculateInvestmentScore(company);
        
        // Extract location distance if available from factors
        const locationFactor = scoreResult.factors.find(f => f.factor.includes('Location') || f.factor.includes('distance'));
        const locationDistance = locationFactor && locationFactor.value > 0 ? locationFactor.value : undefined;
        
        company.investment_score = {
          score: scoreResult.score,
          factors: scoreResult.factors,
          computed_at: new Date().toISOString(),
          location_distance_km: locationDistance,
        };
        
        await writeCompany(company);
        computed++;
      } catch (error: any) {
        // If score calculation fails, continue without it
        console.log(chalk.dim(`  ⚠ Could not compute score for ${companyNumber}: ${error.message}`));
        errors++;
      }

      if (computed % 50 === 0) {
        console.log(chalk.dim(`  Computed scores for ${computed} companies...`));
      }
    } catch (error: any) {
      console.log(chalk.red(`  ✗ Error computing score for ${companyNumber}: ${error.message}`));
      errors++;
    }
  }

  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║                      SUMMARY                                ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));

  console.log(chalk.green(`✓ Computed: ${computed} companies`));
  console.log(chalk.yellow(`○ Skipped: ${skipped} companies`));
  console.log(chalk.red(`✗ Errors: ${errors} companies`));
  console.log('');
}

// CLI entry point
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('computeAndStoreScores')) {
  computeAndStoreScores().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error(chalk.red('\n✗ Fatal error:'), error);
    process.exit(1);
  });
}

export { computeAndStoreScores };

