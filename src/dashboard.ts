#!/usr/bin/env node

import chalk from 'chalk';
import { readAllCompanies } from './utils/fileSystem.js';
import { isHighValueTarget, calculateInvestmentScore, matchesThesisCriteria } from './schemas/CompanySchema.js';

/**
 * Terminal Dashboard for Buy & Build Strategy Engine
 * Displays high-contrast ASCII summary of acquisition funnel
 */
async function main() {
  console.clear();
  
  // Header
  console.log(chalk.bold.cyan('╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║     BUY & BUILD STRATEGY ENGINE - INVESTMENT DASHBOARD     ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝'));
  console.log('');

  try {
    const companies = await readAllCompanies();
    const totalScraped = companies.length;
    
    // Calculate enriched companies (those with enrichment data)
    const enriched = companies.filter(
      c => c.enrichment.enrichment_status === 'completed' || 
           c.enrichment.website || 
           c.enrichment.headcount ||
           (c.enrichment.tech_stack && c.enrichment.tech_stack.length > 0)
    ).length;
    
    // Calculate high-value targets
    const highValueTargets = companies.filter(isHighValueTarget);
    
    // Calculate thesis-aligned targets
    const thesisAligned = companies.filter(c => matchesThesisCriteria(c).matches);
    
    // Calculate average investment score
    const scores = await Promise.all(companies.map(calculateInvestmentScore));
    const avgScore = scores.length > 0
      ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length
      : 0;
    
    // Calculate companies by status
    const pending = companies.filter(c => c.enrichment.enrichment_status === 'pending').length;
    const failed = companies.filter(c => c.enrichment.enrichment_status === 'failed').length;
    const completed = companies.filter(c => c.enrichment.enrichment_status === 'completed').length;

    // Display metrics
    console.log(chalk.bold.white('┌─ ACQUISITION FUNNEL ───────────────────────────────────────┐'));
    console.log(chalk.white('│'));
    console.log(chalk.white('│  ') + chalk.bold.yellow('Total Scraped:') + chalk.white(`        ${chalk.bold.cyan(totalScraped.toString().padStart(6))} companies`));
    console.log(chalk.white('│  ') + chalk.bold.yellow('Total Enriched:') + chalk.white(`      ${chalk.bold.green(enriched.toString().padStart(6))} companies`));
    console.log(chalk.white('│  ') + chalk.bold.yellow('High-Value Targets:') + chalk.white(`  ${chalk.bold.magenta(highValueTargets.length.toString().padStart(6))} companies`));
    console.log(chalk.white('│  ') + chalk.bold.yellow('Thesis-Aligned:') + chalk.white(`      ${chalk.bold.cyan(thesisAligned.length.toString().padStart(6))} companies`));
    console.log(chalk.white('│  ') + chalk.bold.yellow('Avg Investment Score:') + chalk.white(` ${chalk.bold.cyan(avgScore.toFixed(2).padStart(6))} / 100`));
    console.log(chalk.white('│'));
    console.log(chalk.white('└──────────────────────────────────────────────────────────────┘'));
    console.log('');

    // Enrichment Status Breakdown
    console.log(chalk.bold.white('┌─ ENRICHMENT STATUS ───────────────────────────────────────┐'));
    console.log(chalk.white('│'));
    console.log(chalk.white('│  ') + chalk.green('✓ Completed:') + chalk.white(`    ${completed.toString().padStart(6)}`));
    console.log(chalk.white('│  ') + chalk.yellow('○ Pending:') + chalk.white(`      ${pending.toString().padStart(6)}`));
    console.log(chalk.white('│  ') + chalk.red('✗ Failed:') + chalk.white(`        ${failed.toString().padStart(6)}`));
    console.log(chalk.white('│'));
    console.log(chalk.white('└──────────────────────────────────────────────────────────────┘'));
    console.log('');

    // Top Thesis-Aligned Targets
    if (thesisAligned.length > 0) {
      const topTargetsWithScores = await Promise.all(
        thesisAligned.map(async c => ({ company: c, score: await calculateInvestmentScore(c) }))
      );
      const topTargets = topTargetsWithScores
        .sort((a, b) => b.score.score - a.score.score)
        .slice(0, 5);

      console.log(chalk.bold.white('┌─ TOP 5 THESIS-ALIGNED TARGETS ────────────────────────────┐'));
      console.log(chalk.white('│'));
      topTargets.forEach((target, index) => {
        const { company, score } = target;
        const rank = chalk.bold.magenta(`#${index + 1}`);
        const name = chalk.cyan(company.company_name.substring(0, 35).padEnd(35));
        const scoreDisplay = chalk.bold.green(score.score.toFixed(2).padStart(6));
        console.log(chalk.white(`│  ${rank}  ${name}  Score: ${scoreDisplay}`));
      });
      console.log(chalk.white('│'));
      console.log(chalk.white('└──────────────────────────────────────────────────────────────┘'));
    } else if (highValueTargets.length > 0) {
      const topTargetsWithScores = await Promise.all(
        highValueTargets.map(async c => ({ company: c, score: await calculateInvestmentScore(c) }))
      );
      const topTargets = topTargetsWithScores
        .sort((a, b) => b.score.score - a.score.score)
        .slice(0, 5);

      console.log(chalk.bold.white('┌─ TOP 5 HIGH-VALUE TARGETS ───────────────────────────────┐'));
      console.log(chalk.white('│'));
      topTargets.forEach((target, index) => {
        const { company, score } = target;
        const rank = chalk.bold.magenta(`#${index + 1}`);
        const name = chalk.cyan(company.company_name.substring(0, 35).padEnd(35));
        const scoreDisplay = chalk.bold.green(score.score.toFixed(2).padStart(6));
        console.log(chalk.white(`│  ${rank}  ${name}  Score: ${scoreDisplay}`));
      });
      console.log(chalk.white('│'));
      console.log(chalk.white('└──────────────────────────────────────────────────────────────┘'));
    } else {
      console.log(chalk.yellow('⚠  No high-value targets identified yet.'));
    }

    console.log('');
    console.log(chalk.dim('Run `npm run scorecard <company_number>` to see detailed analysis'));
    console.log('');

  } catch (error) {
    console.error(chalk.red('Error loading dashboard:'), error);
    process.exit(1);
  }
}

main();

