#!/usr/bin/env node

import chalk from 'chalk';
import { readdir } from 'fs/promises';
import { readCompany } from './utils/fileSystem.js';
import { calculateInvestmentScore, getRedFlags, matchesThesisCriteria } from './schemas/CompanySchema.js';
import { calculateYearsActive } from './utils/dateHelpers.js';
import path from 'path';

/**
 * Generate scorecards for all companies in the database
 */
async function main() {
  const companiesDir = path.join(process.cwd(), 'data', 'companies');
  
  try {
    const files = await readdir(companiesDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║           ALL COMPANIES SCORECARD SUMMARY                   ║'));
    console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));
    
    const results: Array<{
      companyNumber: string;
      companyName: string;
      score: number;
      yearsActive: number;
      matchesThesis: boolean;
      redFlags: string[];
      sicCodes: string[];
    }> = [];
    
    for (const file of jsonFiles) {
      const companyNumber = path.basename(file, '.json');
      
      try {
        const company = await readCompany(companyNumber);
        if (!company) continue;
        
        const scoreResult = await calculateInvestmentScore(company);
        const score = scoreResult.score;
          const yearsActive = calculateYearsActive(company.date_of_incorporation);
        const thesisMatch = matchesThesisCriteria(company);
        const redFlags = getRedFlags(company);
        
        results.push({
          companyNumber,
          companyName: company.company_name,
          score,
          yearsActive,
          matchesThesis: thesisMatch.matches,
          redFlags,
          sicCodes: company.sic_codes || [],
        });
      } catch (error: any) {
        console.log(chalk.red(`  ✗ Error processing ${companyNumber}: ${error.message}`));
      }
    }
    
    // Sort by score (highest first)
    results.sort((a, b) => b.score - a.score);
    
    // Summary statistics
    const total = results.length;
    const thesisMatches = results.filter(r => r.matchesThesis).length;
    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / total;
    const withRedFlags = results.filter(r => r.redFlags.length > 0).length;
    
    console.log(chalk.bold.white('┌─ SUMMARY STATISTICS ─────────────────────────────────────┐'));
    console.log(chalk.white('│'));
    console.log(chalk.white(`│  Total Companies:        ${total.toString().padStart(6)}`));
    console.log(chalk.white(`│  Thesis Matches:         ${thesisMatches.toString().padStart(6)} (${((thesisMatches/total)*100).toFixed(1)}%)`));
    console.log(chalk.white(`│  Average Score:          ${avgScore.toFixed(2).padStart(6)} / 100`));
    console.log(chalk.white(`│  Companies with Red Flags: ${withRedFlags.toString().padStart(6)}`));
    console.log(chalk.white('│'));
    console.log(chalk.white('└──────────────────────────────────────────────────────────────┘'));
    console.log('');
    
    // Detailed results table
    console.log(chalk.bold.white('┌─ DETAILED RESULTS (Sorted by Score) ──────────────────────┐'));
    console.log(chalk.white('│'));
    console.log(chalk.white('│  Score │ Years │ Thesis │ Company Number │ Company Name'));
    console.log(chalk.white('├──────────────────────────────────────────────────────────────┤'));
    
    for (const result of results) {
      const scoreColor = result.score >= 70 ? chalk.green : result.score >= 50 ? chalk.yellow : chalk.red;
      const thesisIcon = result.matchesThesis ? chalk.green('✓') : chalk.red('✗');
      const redFlagIcon = result.redFlags.length > 0 ? chalk.red('⚠') : ' ';
      
      const name = result.companyName.length > 35 
        ? result.companyName.substring(0, 32) + '...'
        : result.companyName;
      
      console.log(
        chalk.white('│  ') +
        scoreColor(result.score.toFixed(2).padStart(5)) +
        chalk.white(' │ ') +
        chalk.cyan(result.yearsActive.toFixed(1).padStart(5)) +
        chalk.white(' │  ') +
        thesisIcon +
        chalk.white('    │ ') +
        chalk.dim(result.companyNumber.padEnd(14)) +
        chalk.white(' │ ') +
        name +
        (result.redFlags.length > 0 ? ' ' + redFlagIcon : '')
      );
    }
    
    console.log(chalk.white('│'));
    console.log(chalk.white('└──────────────────────────────────────────────────────────────┘'));
    console.log('');
    
    // Top 10 companies
    const top10 = results.slice(0, 10);
    console.log(chalk.bold.white('┌─ TOP 10 COMPANIES BY SCORE ───────────────────────────────┐'));
    console.log(chalk.white('│'));
    
    for (let i = 0; i < top10.length; i++) {
      const result = top10[i];
      const scoreColor = result.score >= 70 ? chalk.green : result.score >= 50 ? chalk.yellow : chalk.red;
      const thesisIcon = result.matchesThesis ? chalk.green('✓') : chalk.red('✗');
      
      console.log(
        chalk.white(`│  ${(i + 1).toString().padStart(2)}. `) +
        scoreColor(`Score: ${result.score.toFixed(2)}`) +
        chalk.white(' | ') +
        thesisIcon +
        chalk.white(' Thesis | ') +
        chalk.cyan(result.yearsActive.toFixed(1) + 'y') +
        chalk.white(' | ') +
        chalk.dim(result.companyNumber) +
        chalk.white(' | ') +
        result.companyName
      );
      
      if (result.redFlags.length > 0) {
        console.log(chalk.red(`│      ⚠ Red Flags: ${result.redFlags.join(', ')}`));
      }
    }
    
    console.log(chalk.white('│'));
    console.log(chalk.white('└──────────────────────────────────────────────────────────────┘'));
    console.log('');
    
    // Companies with red flags
    const redFlagCompanies = results.filter(r => r.redFlags.length > 0);
    if (redFlagCompanies.length > 0) {
      console.log(chalk.bold.red('┌─ COMPANIES WITH RED FLAGS ───────────────────────────────┐'));
      console.log(chalk.white('│'));
      
      for (const result of redFlagCompanies) {
        console.log(
          chalk.white('│  ') +
          chalk.dim(result.companyNumber) +
          chalk.white(' | ') +
          result.companyName
        );
        console.log(chalk.red(`│      ⚠ ${result.redFlags.join(', ')}`));
      }
      
      console.log(chalk.white('│'));
      console.log(chalk.white('└──────────────────────────────────────────────────────────────┘'));
      console.log('');
    }
    
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
  }
}

main();

