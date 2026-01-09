#!/usr/bin/env node

import chalk from 'chalk';
import { readAllCompanies } from './utils/fileSystem.js';
import { calculateInvestmentScore } from './schemas/CompanySchema.js';

/**
 * Extract top 20 companies by investment score with names and websites
 * Filtered to only include companies with medium or high MSP likelihood
 */
async function main() {
  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║   TOP 20 COMPANIES BY SCORE (MSP Likelihood: Medium/High)   ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));
  
  try {
    const companies = await readAllCompanies();
    console.log(chalk.dim(`Processing ${companies.length} companies...\n`));
    
    const results: Array<{
      name: string;
      website: string | undefined;
      score: number;
      mspLikelihood: number | undefined;
      mspConfidence: 'high' | 'medium' | 'low' | undefined;
    }> = [];
    
    for (const company of companies) {
      try {
        // Check MSP likelihood confidence - using stored value from JSON
        const mspConfidence = company.enrichment?.msp_likelihood_confidence;
        
        // Filter: only include medium or high MSP likelihood
        if (!mspConfidence || (mspConfidence !== 'medium' && mspConfidence !== 'high')) {
          continue; // Skip companies with low or no MSP likelihood
        }
        
        // Calculate or get existing score
        let score: number;
        if (company.investment_score?.score !== undefined) {
          score = company.investment_score.score;
        } else {
          const scoreResult = await calculateInvestmentScore(company);
          score = scoreResult.score;
        }
        
        results.push({
          name: company.company_name,
          website: company.enrichment?.website,
          score,
          mspLikelihood: company.enrichment?.msp_likelihood_score,
          mspConfidence,
        });
      } catch (error: any) {
        console.error(chalk.red(`Error processing ${company.company_number}: ${error.message}`));
      }
    }
    
    // Sort by score (highest first)
    results.sort((a, b) => b.score - a.score);
    
    // Get top 20
    const top20 = results.slice(0, 20);
    
    if (top20.length === 0) {
      console.log(chalk.yellow('No companies found with medium or high MSP likelihood.'));
      console.log(chalk.dim('Try running the MSP likelihood analysis first.'));
      return;
    }
    
    // Display results
    console.log(chalk.bold.white(`┌─ TOP ${top20.length} COMPANIES BY SCORE (MSP Filtered) ─────────────┐`));
    console.log(chalk.white('│'));
    console.log(chalk.white('│  Rank │ Score │ MSP │ Company Name                          │ Website'));
    console.log(chalk.white('├──────────────────────────────────────────────────────────────┤'));
    
    for (let i = 0; i < top20.length; i++) {
      const result = top20[i];
      const scoreColor = result.score >= 70 ? chalk.green : result.score >= 50 ? chalk.yellow : chalk.red;
      const website = result.website || chalk.dim('N/A');
      const mspColor = result.mspConfidence === 'high' ? chalk.green : chalk.yellow;
      const mspLabel = result.mspConfidence === 'high' ? 'HIGH' : 'MED';
      
      const name = result.name.length > 35 
        ? result.name.substring(0, 32) + '...'
        : result.name.padEnd(35);
      
      console.log(
        chalk.white('│  ') +
        chalk.cyan((i + 1).toString().padStart(2)) +
        chalk.white('   │ ') +
        scoreColor(result.score.toFixed(2).padStart(5)) +
        chalk.white(' │ ') +
        mspColor(mspLabel.padEnd(4)) +
        chalk.white(' │ ') +
        name +
        chalk.white(' │ ') +
        website
      );
    }
    
    console.log(chalk.white('│'));
    console.log(chalk.white('└──────────────────────────────────────────────────────────────┘'));
    console.log('');
    
    // Summary statistics
    const highMSP = top20.filter(r => r.mspConfidence === 'high').length;
    const mediumMSP = top20.filter(r => r.mspConfidence === 'medium').length;
    console.log(chalk.bold.white('┌─ SUMMARY ─────────────────────────────────────────────────┐'));
    console.log(chalk.white('│'));
    console.log(chalk.white(`│  Total Companies (MSP Filtered): ${top20.length}`));
    console.log(chalk.white(`│  High MSP Likelihood:            ${chalk.green(highMSP.toString())}`));
    console.log(chalk.white(`│  Medium MSP Likelihood:         ${chalk.yellow(mediumMSP.toString())}`));
    console.log(chalk.white('│'));
    console.log(chalk.white('└──────────────────────────────────────────────────────────────┘'));
    console.log('');
    
    // Also output as CSV format for easy copying
    console.log(chalk.bold.white('┌─ CSV FORMAT (for easy copying) ──────────────────────────┐'));
    console.log(chalk.white('│'));
    console.log(chalk.dim('Name,Website,Score,MSP_Likelihood,MSP_Confidence'));
    for (const result of top20) {
      const website = result.website || 'N/A';
      const mspLikelihood = result.mspLikelihood !== undefined ? result.mspLikelihood.toString() : 'N/A';
      const mspConfidence = result.mspConfidence || 'N/A';
      console.log(chalk.white(`${result.name},${website},${result.score.toFixed(2)},${mspLikelihood},${mspConfidence}`));
    }
    console.log(chalk.white('│'));
    console.log(chalk.white('└──────────────────────────────────────────────────────────────┘'));
    console.log('');
    
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

main();
