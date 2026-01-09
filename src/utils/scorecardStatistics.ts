#!/usr/bin/env node

import 'dotenv/config';
import chalk from 'chalk';
import { listAllCompanies, readCompany } from './fileSystem.js';
import { calculateInvestmentScore } from '../schemas/CompanySchema.js';

/**
 * Calculate and display scorecard score distribution statistics
 */
async function calculateScorecardStatistics() {
  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║     SCORECARD SCORE DISTRIBUTION STATISTICS                 ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));

  const companyNumbers = await listAllCompanies();
  const scores: number[] = [];
  let processed = 0;
  let errors = 0;

  console.log(chalk.dim(`Processing ${companyNumbers.length} companies...\n`));

  for (const companyNumber of companyNumbers) {
    try {
      const company = await readCompany(companyNumber);
      if (!company) continue;

      const scoreResult = await calculateInvestmentScore(company);
      scores.push(scoreResult.score);
      processed++;

      if (processed % 100 === 0) {
        console.log(chalk.dim(`  Processed ${processed} companies...`));
      }
    } catch (error) {
      errors++;
      // Continue processing
    }
  }

  if (scores.length === 0) {
    console.log(chalk.yellow('No scorecard scores calculated.'));
    return;
  }

  // Sort scores
  scores.sort((a, b) => a - b);

  // Basic statistics
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const median = scores[Math.floor(scores.length / 2)];
  const min = scores[0];
  const max = scores[scores.length - 1];

  // Standard deviation
  const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  // Percentiles
  const p25 = scores[Math.floor(scores.length * 0.25)];
  const p75 = scores[Math.floor(scores.length * 0.75)];
  const p90 = scores[Math.floor(scores.length * 0.90)];
  const p95 = scores[Math.floor(scores.length * 0.95)];

  // Distribution by score ranges
  const ranges: Record<string, number> = {
    '0-10': 0,
    '11-20': 0,
    '21-30': 0,
    '31-40': 0,
    '41-50': 0,
    '51-60': 0,
    '61-70': 0,
    '71-80': 0,
    '81-90': 0,
    '91-100': 0
  };

  scores.forEach(score => {
    if (score <= 10) ranges['0-10']++;
    else if (score <= 20) ranges['11-20']++;
    else if (score <= 30) ranges['21-30']++;
    else if (score <= 40) ranges['31-40']++;
    else if (score <= 50) ranges['41-50']++;
    else if (score <= 60) ranges['51-60']++;
    else if (score <= 70) ranges['61-70']++;
    else if (score <= 80) ranges['71-80']++;
    else if (score <= 90) ranges['81-90']++;
    else ranges['91-100']++;
  });

  // Display statistics
  console.log(chalk.bold.white('OVERALL STATISTICS:'));
  console.log(chalk.white(`  Total companies with scores: ${chalk.bold.cyan(scores.length)}`));
  console.log(chalk.white(`  Mean (Average): ${chalk.bold.green(mean.toFixed(2))}`));
  console.log(chalk.white(`  Median: ${chalk.bold.green(median.toFixed(2))}`));
  console.log(chalk.white(`  Standard Deviation: ${chalk.bold.yellow(stdDev.toFixed(2))}`));
  console.log(chalk.white(`  Min: ${chalk.dim(min.toFixed(2))}`));
  console.log(chalk.white(`  Max: ${chalk.bold.green(max.toFixed(2))}`));
  console.log('');

  console.log(chalk.bold.white('PERCENTILES:'));
  console.log(chalk.white(`  25th percentile: ${chalk.cyan(p25.toFixed(2))}`));
  console.log(chalk.white(`  50th percentile (Median): ${chalk.cyan(median.toFixed(2))}`));
  console.log(chalk.white(`  75th percentile: ${chalk.cyan(p75.toFixed(2))}`));
  console.log(chalk.white(`  90th percentile: ${chalk.cyan(p90.toFixed(2))}`));
  console.log(chalk.white(`  95th percentile: ${chalk.cyan(p95.toFixed(2))}`));
  console.log('');

  console.log(chalk.bold.white('DISTRIBUTION BY SCORE RANGE:'));
  Object.entries(ranges).forEach(([range, count]) => {
    const percentage = ((count / scores.length) * 100).toFixed(1);
    const barLength = Math.floor((count / scores.length) * 50);
    const bar = '█'.repeat(barLength);
    const color = count > 0 ? (parseInt(range.split('-')[0]) >= 50 ? chalk.green : parseInt(range.split('-')[0]) >= 30 ? chalk.yellow : chalk.dim) : chalk.dim;
    console.log(
      chalk.white(`  ${range.padStart(7)}: `) +
      chalk.cyan(count.toString().padStart(4)) +
      chalk.white(` companies (`) +
      chalk.cyan(percentage.padStart(5) + '%') +
      chalk.white(`) `) +
      color(bar)
    );
  });
  console.log('');

  if (errors > 0) {
    console.log(chalk.yellow(`⚠ ${errors} companies had errors during calculation`));
    console.log('');
  }

  console.log(chalk.bold.cyan('═══════════════════════════════════════════════════════════'));
  console.log('');
}

// CLI entry point
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('scorecardStatistics')) {
  calculateScorecardStatistics().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error(chalk.red('\n✗ Fatal error:'), error);
    process.exit(1);
  });
}

export { calculateScorecardStatistics };

