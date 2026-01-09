#!/usr/bin/env node

import chalk from 'chalk';
import { readCompany } from './utils/fileSystem.js';
import { analyzeMSPLikelihood } from './schemas/CompanySchema.js';

async function main() {
  const companyNumber = process.argv[2] || '02442290';
  
  const company = await readCompany(companyNumber);
  if (!company) {
    console.error(chalk.red(`Company ${companyNumber} not found`));
    process.exit(1);
  }
  
  const analysis = analyzeMSPLikelihood(company);
  
  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║              MSP LIKELIHOOD ANALYSIS                       ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));
  
  console.log(chalk.bold.white('Company: ') + company.company_name);
  console.log(chalk.bold.white('Score: ') + chalk.yellow(`${analysis.score} / 100`));
  console.log(chalk.bold.white('Confidence: ') + 
    (analysis.confidence === 'high' ? chalk.green(analysis.confidence.toUpperCase()) :
     analysis.confidence === 'medium' ? chalk.yellow(analysis.confidence.toUpperCase()) :
     chalk.red(analysis.confidence.toUpperCase())));
  console.log('');
  
  console.log(chalk.bold.white('┌─ INDICATORS ───────────────────────────────────────────────┐'));
  console.log(chalk.white('│'));
  analysis.indicators.forEach(ind => {
    const status = ind.found ? chalk.green('✓') : chalk.yellow('○');
    const evidence = ind.evidence.length > 0 
      ? chalk.dim(`: ${ind.evidence.slice(0, 3).join(', ')}${ind.evidence.length > 3 ? '...' : ''}`)
      : chalk.dim(' (No evidence found)');
    console.log(chalk.white(`│  ${status} ${ind.category.padEnd(35)}${evidence}`));
  });
  console.log(chalk.white('│'));
  console.log(chalk.white('└──────────────────────────────────────────────────────────────┘'));
  console.log('');
  
  console.log(chalk.bold.white('┌─ ENRICHMENT DATA ──────────────────────────────────────────┐'));
  console.log(chalk.white('│'));
  if (company.enrichment.business_description) {
    console.log(chalk.white('│  ') + chalk.bold.yellow('Description:'));
    console.log(chalk.white('│    ') + company.enrichment.business_description);
    console.log(chalk.white('│'));
  }
  if (company.enrichment.services && company.enrichment.services.length > 0) {
    console.log(chalk.white('│  ') + chalk.bold.yellow('Services:'));
    company.enrichment.services.forEach(service => {
      console.log(chalk.white('│    • ') + service);
    });
    console.log(chalk.white('│'));
  }
  if (company.enrichment.business_keywords && company.enrichment.business_keywords.length > 0) {
    console.log(chalk.white('│  ') + chalk.bold.yellow('Keywords:'));
    console.log(chalk.white('│    ') + company.enrichment.business_keywords.slice(0, 10).join(', '));
    if (company.enrichment.business_keywords.length > 10) {
      console.log(chalk.dim(`│    ... and ${company.enrichment.business_keywords.length - 10} more`));
    }
    console.log(chalk.white('│'));
  }
  console.log(chalk.white('└──────────────────────────────────────────────────────────────┘'));
  console.log('');
  
  // Conclusion
  console.log(chalk.bold.white('┌─ CONCLUSION ──────────────────────────────────────────────┐'));
  console.log(chalk.white('│'));
  if (analysis.score >= 30) {
    console.log(chalk.white('│  ') + chalk.green('✓ This company appears to be an IT MSP'));
    console.log(chalk.white('│  ') + chalk.dim('Strong indicators of managed IT services'));
  } else if (analysis.score >= 15) {
    console.log(chalk.white('│  ') + chalk.yellow('⚠ This company may be an IT MSP'));
    console.log(chalk.white('│  ') + chalk.dim('Some MSP indicators, but not definitive'));
  } else {
    console.log(chalk.white('│  ') + chalk.red('✗ This company does NOT appear to be an IT MSP'));
    console.log(chalk.white('│  ') + chalk.dim('Limited or no MSP indicators found'));
    console.log(chalk.white('│  ') + chalk.dim('Likely a different type of IT business'));
  }
  console.log(chalk.white('│'));
  console.log(chalk.white('└──────────────────────────────────────────────────────────────┘'));
  console.log('');
}

main().catch(console.error);
