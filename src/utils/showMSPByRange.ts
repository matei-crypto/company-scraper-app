#!/usr/bin/env node

import 'dotenv/config';
import chalk from 'chalk';
import { listAllCompanies, readCompany } from './fileSystem.js';
import type { Company } from '../schemas/CompanySchema.js';

/**
 * Show companies with MSP likelihood scores in a specific range
 */
async function showMSPByRange(minScore: number, maxScore: number) {
  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan(`║  COMPANIES WITH MSP LIKELIHOOD SCORE ${minScore}-${maxScore}                 ║`));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));

  const companyNumbers = await listAllCompanies();
  const matchingCompanies: Array<{
    company: Company;
    score: number;
    confidence: string;
  }> = [];

  for (const companyNumber of companyNumbers) {
    try {
      const company = await readCompany(companyNumber);
      if (!company) continue;

      const mspScore = company.enrichment?.msp_likelihood_score;
      const mspConfidence = company.enrichment?.msp_likelihood_confidence;

      if (mspScore !== undefined && mspScore !== null && mspScore >= minScore && mspScore <= maxScore) {
        matchingCompanies.push({
          company,
          score: mspScore,
          confidence: mspConfidence || 'unknown',
        });
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
  console.log(chalk.bold.white('┌─ SCORE ─┬─ CONFIDENCE ─┬─ COMPANY NAME ───────────────────────────┬─ WEBSITE ─────────────────────────────────────────────────────┐'));
  
  matchingCompanies.forEach((item) => {
    const score = item.score.toFixed(1).padStart(5);
    const confidence = (item.confidence.toUpperCase() || 'UNKNOWN').padStart(9);
    const name = item.company.company_name.substring(0, 45).padEnd(45);
    const website = (item.company.enrichment?.website || 'N/A').padEnd(60);

    const scoreColor = item.score >= (minScore + maxScore) / 2 ? chalk.green : chalk.yellow;
    const confidenceColor = item.confidence === 'high' ? chalk.green : item.confidence === 'medium' ? chalk.yellow : chalk.dim;

    console.log(
      chalk.white('│ ') +
      scoreColor(score) +
      chalk.white(' │ ') +
      confidenceColor(confidence) +
      chalk.white(' │ ') +
      chalk.cyan(name) +
      chalk.white(' │ ') +
      chalk.blue(website) +
      chalk.white(' │')
    );
  });

  console.log(chalk.bold.white('└────────┴─────────────┴──────────────────────────────────────────────┴────────────────────────────────────────────────────────────┘'));
  console.log('');
}

// CLI entry point
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('showMSPByRange')) {
  const minArg = process.argv[2];
  const maxArg = process.argv[3];
  
  if (!minArg || !maxArg) {
    console.error(chalk.red('Usage: tsx src/utils/showMSPByRange.ts <min_score> <max_score>'));
    console.error(chalk.yellow('Example: tsx src/utils/showMSPByRange.ts 25 30'));
    process.exit(1);
  }

  const minScore = parseInt(minArg, 10);
  const maxScore = parseInt(maxArg, 10);

  if (isNaN(minScore) || isNaN(maxScore) || minScore < 0 || maxScore > 100 || minScore > maxScore) {
    console.error(chalk.red('Invalid score range. Please provide valid numbers between 0-100.'));
    process.exit(1);
  }

  showMSPByRange(minScore, maxScore).then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error(chalk.red('\n✗ Fatal error:'), error);
    process.exit(1);
  });
}

export { showMSPByRange };

