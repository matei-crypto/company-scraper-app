#!/usr/bin/env node

import 'dotenv/config';
import chalk from 'chalk';
import { listAllCompanies, readCompany } from './fileSystem.js';
import type { Company } from '../schemas/CompanySchema.js';

/**
 * Show top N companies by MSP likelihood score
 */
async function showTopMSPScores(limit: number = 50) {
  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan(`║        TOP ${limit} COMPANIES BY MSP LIKELIHOOD SCORE        ║`));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));

  const companyNumbers = await listAllCompanies();
  const companiesWithScores: Array<{
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

      if (mspScore !== undefined && mspScore !== null) {
        companiesWithScores.push({
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
  companiesWithScores.sort((a, b) => b.score - a.score);

  // Take top N
  const topCompanies = companiesWithScores.slice(0, limit);

  if (topCompanies.length === 0) {
    console.log(chalk.yellow('No companies with MSP likelihood scores found.'));
    console.log(chalk.dim('Run website analysis to generate scores.'));
    return;
  }

  console.log(chalk.dim(`Found ${companiesWithScores.length} companies with MSP scores\n`));

  // Display results in a cleaner format
  console.log(chalk.bold.white('┌─ RANK ─┬─ SCORE ─┬─ CONFIDENCE ─┬─ COMPANY NAME ───────────────────────────┬─ WEBSITE ─────────────────────────────────────────────────────┐'));
  
  topCompanies.forEach((item, index) => {
    const rank = (index + 1).toString().padStart(3);
    const score = item.score.toFixed(1).padStart(5);
    const confidence = item.confidence.toUpperCase().padStart(9);
    const name = item.company.company_name.substring(0, 45).padEnd(45);
    const website = (item.company.enrichment?.website || 'N/A').padEnd(60);

    const scoreColor = item.score >= 70 ? chalk.green : item.score >= 50 ? chalk.yellow : chalk.red;
    const confidenceColor = item.confidence === 'high' ? chalk.green : item.confidence === 'medium' ? chalk.yellow : chalk.dim;

    console.log(
      chalk.white('│ ') +
      chalk.bold.cyan(rank) +
      chalk.white(' │ ') +
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

  console.log(chalk.bold.white('└────────┴────────┴─────────────┴──────────────────────────────────────────────┴────────────────────────────────────────────────────────────┘'));
  console.log('');

  // Summary statistics
  const highConfidence = topCompanies.filter(c => c.confidence === 'high').length;
  const mediumConfidence = topCompanies.filter(c => c.confidence === 'medium').length;
  const lowConfidence = topCompanies.filter(c => c.confidence === 'low').length;

  console.log(chalk.dim('Summary:'));
  console.log(chalk.dim(`  High confidence: ${highConfidence}`));
  console.log(chalk.dim(`  Medium confidence: ${mediumConfidence}`));
  console.log(chalk.dim(`  Low confidence: ${lowConfidence}`));
  console.log('');
}

// CLI entry point
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('showTopMSPScores')) {
  const limitArg = process.argv[2];
  const limit = limitArg ? parseInt(limitArg, 10) : 50;

  if (isNaN(limit) || limit < 1) {
    console.error(chalk.red('Invalid limit. Please provide a positive number.'));
    console.error(chalk.yellow('Usage: tsx src/utils/showTopMSPScores.ts [limit]'));
    console.error(chalk.yellow('Example: tsx src/utils/showTopMSPScores.ts 100'));
    process.exit(1);
  }

  showTopMSPScores(limit).then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error(chalk.red('\n✗ Fatal error:'), error);
    process.exit(1);
  });
}

export { showTopMSPScores };

