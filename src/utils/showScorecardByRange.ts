#!/usr/bin/env node

import 'dotenv/config';
import chalk from 'chalk';
import { listAllCompanies, readCompany } from './fileSystem.js';
import { calculateInvestmentScore } from '../schemas/CompanySchema.js';
import type { Company } from '../schemas/CompanySchema.js';

/**
 * Show companies with scorecard scores in a specific range
 */
async function showScorecardByRange(minScore: number, maxScore: number) {
  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan(`║  COMPANIES WITH SCORECARD SCORE ${minScore}-${maxScore}                    ║`));
  console.log(chalk.bold.cyan(`║  AND MEDIUM/HIGH MSP LIKELIHOOD                           ║`));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));

  const companyNumbers = await listAllCompanies();
  const matchingCompanies: Array<{
    company: Company;
    score: number;
  }> = [];

  let processed = 0;
  console.log(chalk.dim(`Processing ${companyNumbers.length} companies...\n`));

  for (const companyNumber of companyNumbers) {
    try {
      const company = await readCompany(companyNumber);
      if (!company) continue;

      // Use stored score if available, otherwise compute it
      let score: number;
      if (company.investment_score?.score !== undefined && company.investment_score.score !== null) {
        score = company.investment_score.score;
      } else {
        // Fallback: compute if not stored
        const scoreResult = await calculateInvestmentScore(company);
        score = scoreResult.score;
      }

      // Check MSP likelihood confidence (must be medium or high)
      const mspConfidence = company.enrichment?.msp_likelihood_confidence;
      const hasMediumOrHighMSP = mspConfidence === 'medium' || mspConfidence === 'high';

      if (score >= minScore && score <= maxScore && hasMediumOrHighMSP) {
        matchingCompanies.push({
          company,
          score,
        });
      }

      processed++;
      if (processed % 200 === 0) {
        console.log(chalk.dim(`  Processed ${processed} companies...`));
      }
    } catch (error) {
      // Skip errors
    }
  }

  // Sort by score descending
  matchingCompanies.sort((a, b) => b.score - a.score);

  if (matchingCompanies.length === 0) {
    console.log(chalk.yellow('No companies found in this score range.'));
    return;
  }

  console.log(chalk.dim(`Found ${matchingCompanies.length} companies\n`));
  console.log(chalk.bold.white('┌─ SCORE ─┬─ MSP ─┬─ COMPANY NAME ───────────────────────────┬─ WEBSITE ─────────────────────────────────────────────────────┐'));
  
  matchingCompanies.forEach((item) => {
    const score = item.score.toFixed(2).padStart(6);
    const mspScore = (item.company.enrichment?.msp_likelihood_score || 0).toFixed(0).padStart(3);
    const mspConfidence = (item.company.enrichment?.msp_likelihood_confidence || 'N/A').toUpperCase().padEnd(6);
    const name = item.company.company_name.substring(0, 40).padEnd(40);
    const website = (item.company.enrichment?.website || 'N/A').padEnd(60);

    const scoreColor = item.score >= (minScore + maxScore) / 2 ? chalk.green : chalk.yellow;
    const mspColor = item.company.enrichment?.msp_likelihood_confidence === 'high' ? chalk.green : chalk.yellow;

    console.log(
      chalk.white('│ ') +
      scoreColor(score) +
      chalk.white(' │ ') +
      mspColor(`${mspScore} (${mspConfidence})`) +
      chalk.white(' │ ') +
      chalk.cyan(name) +
      chalk.white(' │ ') +
      chalk.blue(website) +
      chalk.white(' │')
    );
  });

  console.log(chalk.bold.white('└────────┴────────┴──────────────────────────────────────────────┴────────────────────────────────────────────────────────────┘'));
  console.log('');
}

// CLI entry point
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('showScorecardByRange')) {
  const minArg = process.argv[2];
  const maxArg = process.argv[3];
  
  if (!minArg || !maxArg) {
    console.error(chalk.red('Usage: tsx src/utils/showScorecardByRange.ts <min_score> <max_score>'));
    console.error(chalk.yellow('Example: tsx src/utils/showScorecardByRange.ts 51 60'));
    process.exit(1);
  }

  const minScore = parseFloat(minArg);
  const maxScore = parseFloat(maxArg);

  if (isNaN(minScore) || isNaN(maxScore) || minScore < 0 || maxScore > 100 || minScore > maxScore) {
    console.error(chalk.red('Invalid score range. Please provide valid numbers between 0-100.'));
    process.exit(1);
  }

  showScorecardByRange(minScore, maxScore).then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error(chalk.red('\n✗ Fatal error:'), error);
    process.exit(1);
  });
}

export { showScorecardByRange };

