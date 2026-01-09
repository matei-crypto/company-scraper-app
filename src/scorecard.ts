#!/usr/bin/env node

import chalk from 'chalk';
import { readCompany } from './utils/fileSystem.js';
import { calculateInvestmentScore, getRedFlags, matchesThesisCriteria, analyzeMSPLikelihood } from './schemas/CompanySchema.js';
import { calculateYearsActive, yearsBetween } from './utils/dateHelpers.js';

/**
 * Investment Scorecard - Detailed analysis of a single company
 */
async function main() {
  const companyNumber = process.argv[2];

  if (!companyNumber) {
    console.error(chalk.red('Usage: npm run scorecard <company_number>'));
    process.exit(1);
  }

  try {
    const company = await readCompany(companyNumber);

    if (!company) {
      console.error(chalk.red(`Company ${companyNumber} not found in database`));
      process.exit(1);
    }

    const score = await calculateInvestmentScore(company);
    const yearsActive = calculateYearsActive(company.date_of_incorporation);

    console.clear();
    
    // Header
    console.log(chalk.bold.cyan('╔════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║              INVESTMENT SCORECARD                          ║'));
    console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝'));
    console.log('');

    // Company Info
    console.log(chalk.bold.white('┌─ COMPANY INFORMATION ─────────────────────────────────────┐'));
    console.log(chalk.white('│'));
    console.log(chalk.white('│  ') + chalk.bold.yellow('Name:') + chalk.white(`              ${company.company_name}`));
    console.log(chalk.white('│  ') + chalk.bold.yellow('Number:') + chalk.white(`            ${company.company_number}`));
    console.log(chalk.white('│  ') + chalk.bold.yellow('Status:') + chalk.white(`            ${company.company_status || 'N/A'}`));
    console.log(chalk.white('│  ') + chalk.bold.yellow('Incorporated:') + chalk.white(`       ${company.date_of_incorporation} (${yearsActive.toFixed(1)} years)`));
    console.log(chalk.white('│  ') + chalk.bold.yellow('SIC Codes:') + chalk.white(`          ${company.sic_codes.join(', ') || 'None'}`));
    console.log(chalk.white('│'));
    console.log(chalk.white('└──────────────────────────────────────────────────────────────┘'));
    console.log('');

    // Investment Score
    console.log(chalk.bold.white('┌─ INVESTMENT SCORE ────────────────────────────────────────┐'));
    console.log(chalk.white('│'));
    const scoreBar = '█'.repeat(Math.floor(score.score / 2));
    const scoreColor = score.score >= 70 ? chalk.green : score.score >= 40 ? chalk.yellow : chalk.red;
    console.log(chalk.white('│  ') + chalk.bold.white('Overall Score:') + ` ${scoreColor(score.score.toFixed(2))} / 100`);
    console.log(chalk.white('│  ') + scoreColor(scoreBar.padEnd(50)));
    console.log(chalk.white('│'));
    console.log(chalk.white('└──────────────────────────────────────────────────────────────┘'));
    console.log('');

    // Thesis Criteria Match
    const thesisMatch = matchesThesisCriteria(company);
    const thesisColor = thesisMatch.matches ? chalk.green : chalk.yellow;
    console.log(chalk.bold.white('┌─ THESIS CRITERIA MATCH ───────────────────────────────────┐'));
    console.log(chalk.white('│'));
    console.log(chalk.white('│  ') + chalk.bold.white('Status:') + ` ${thesisColor(thesisMatch.matches ? '✓ MATCHES' : '⚠ PARTIAL MATCH')}`);
    console.log(chalk.white('│'));
    thesisMatch.criteria.forEach(criterion => {
      const status = criterion.met ? chalk.green('✓') : chalk.yellow('○');
      console.log(chalk.white(`│  ${status} ${criterion.name.padEnd(35)} ${chalk.dim(criterion.details)}`));
    });
    console.log(chalk.white('│'));
    console.log(chalk.white('└──────────────────────────────────────────────────────────────┘'));
    console.log('');

    // Score Breakdown
    console.log(chalk.bold.white('┌─ SCORE BREAKDOWN ──────────────────────────────────────────┐'));
    console.log(chalk.white('│'));
    score.factors.forEach(factor => {
      const valueStr = typeof factor.value === 'number' 
        ? factor.value.toFixed(2) 
        : String(factor.value);
      const weightStr = factor.weight.toFixed(2).padStart(6);
      console.log(chalk.white(`│  ${factor.factor.padEnd(30)}  ${valueStr.padStart(10)}  ${chalk.cyan(weightStr)} pts`));
    });
    console.log(chalk.white('│'));
    console.log(chalk.white('└──────────────────────────────────────────────────────────────┘'));
    console.log('');

    // Financials
    if (company.financials.revenue || company.financials.profit || company.financials.ebitda || company.financials.employees) {
      console.log(chalk.bold.white('┌─ FINANCIAL DATA ──────────────────────────────────────────┐'));
      console.log(chalk.white('│'));
      if (company.financials.revenue) {
        console.log(chalk.white('│  ') + chalk.bold.yellow('Revenue:') + chalk.white(`           £${company.financials.revenue.toLocaleString()}`));
      }
      if (company.financials.ebitda) {
        console.log(chalk.white('│  ') + chalk.bold.yellow('EBITDA:') + chalk.white(`            £${company.financials.ebitda.toLocaleString()}`));
      }
      if (company.financials.profit) {
        const profitColor = company.financials.profit > 0 ? chalk.green : chalk.red;
        console.log(chalk.white('│  ') + chalk.bold.yellow('Profit:') + chalk.white(`            ${profitColor('£' + company.financials.profit.toLocaleString())}`));
      }
      if (company.financials.employees) {
        console.log(chalk.white('│  ') + chalk.bold.yellow('Employees:') + chalk.white(`         ${company.financials.employees}`));
      }
      console.log(chalk.white('│'));
      console.log(chalk.white('└──────────────────────────────────────────────────────────────┘'));
      console.log('');
    }

    // Red Flags
    const redFlags = getRedFlags(company);
    if (redFlags.length > 0) {
      console.log(chalk.bold.white('┌─ RED FLAGS ───────────────────────────────────────────────┐'));
      console.log(chalk.white('│'));
      redFlags.forEach(flag => {
        console.log(chalk.white('│  ') + chalk.red('⚠ ') + chalk.red(flag));
      });
      console.log(chalk.white('│'));
      console.log(chalk.white('└──────────────────────────────────────────────────────────────┘'));
      console.log('');
    }

    // Officers
    if (company.officers && (company.officers.directors?.length > 0 || company.officers.secretaries?.length > 0)) {
      console.log(chalk.bold.white('┌─ OFFICERS ────────────────────────────────────────────────┐'));
      console.log(chalk.white('│'));
      if (company.officers.directors && company.officers.directors.length > 0) {
        console.log(chalk.white('│  ') + chalk.bold.yellow('Directors:'));
        company.officers.directors.slice(0, 5).forEach((director: any) => {
          let tenure = 'N/A';
          if (director.appointed_on) {
            const endDate = director.resigned_on || new Date();
            tenure = `${yearsBetween(director.appointed_on, endDate).toFixed(1)} years`;
            if (director.resigned_on) {
              tenure += ' (resigned)';
            }
          }
          console.log(chalk.white(`│    • ${director.name} (${tenure})`));
          if (director.occupation) {
            console.log(chalk.dim(`│      ${director.occupation}`));
          }
        });
        if (company.officers.directors.length > 5) {
          console.log(chalk.dim(`│    ... and ${company.officers.directors.length - 5} more`));
        }
      }
      console.log(chalk.white('│'));
      console.log(chalk.white('└──────────────────────────────────────────────────────────────┘'));
      console.log('');
    }

    // Persons with Significant Control
    if (company.persons_with_significant_control?.persons_with_significant_control && 
        company.persons_with_significant_control.persons_with_significant_control.length > 0) {
      console.log(chalk.bold.white('┌─ PERSONS WITH SIGNIFICANT CONTROL ──────────────────────────┐'));
      console.log(chalk.white('│'));
      company.persons_with_significant_control.persons_with_significant_control.slice(0, 5).forEach((psc: any) => {
        console.log(chalk.white(`│  • ${psc.name || 'Unknown'}`));
        if (psc.natures_of_control && psc.natures_of_control.length > 0) {
          console.log(chalk.dim(`│    ${psc.natures_of_control.join(', ')}`));
        }
      });
      console.log(chalk.white('│'));
      console.log(chalk.white('└──────────────────────────────────────────────────────────────┘'));
      console.log('');
    }

    // Charges
    if (company.charges && company.charges.total_count && company.charges.total_count > 0) {
      console.log(chalk.bold.white('┌─ CHARGES / MORTGAGES ─────────────────────────────────────┐'));
      console.log(chalk.white('│'));
      console.log(chalk.white('│  ') + chalk.bold.yellow('Total:') + chalk.white(`            ${company.charges.total_count}`));
      if (company.charges.unsatisfied_count && company.charges.unsatisfied_count > 0) {
        console.log(chalk.white('│  ') + chalk.bold.red('Unsatisfied:') + chalk.red(`      ${company.charges.unsatisfied_count}`));
      }
      if (company.charges.satisfied_count && company.charges.satisfied_count > 0) {
        console.log(chalk.white('│  ') + chalk.bold.green('Satisfied:') + chalk.green(`        ${company.charges.satisfied_count}`));
      }
      console.log(chalk.white('│'));
      console.log(chalk.white('└──────────────────────────────────────────────────────────────┘'));
      console.log('');
    }

    // Accounts Information
    if (company.accounts) {
      console.log(chalk.bold.white('┌─ ACCOUNTS INFORMATION ─────────────────────────────────────┐'));
      console.log(chalk.white('│'));
      if (company.accounts.last_accounts_made_up_to) {
        console.log(chalk.white('│  ') + chalk.bold.yellow('Last Accounts:') + chalk.white(`     ${company.accounts.last_accounts_made_up_to}`));
      }
      if (company.accounts.next_accounts_due_on) {
        const dueDate = new Date(company.accounts.next_accounts_due_on);
        const isOverdue = dueDate < new Date();
        const dueColor = isOverdue ? chalk.red : chalk.green;
        console.log(chalk.white('│  ') + chalk.bold.yellow('Next Due:') + chalk.white(`          ${dueColor(company.accounts.next_accounts_due_on)}`));
      }
      if (company.accounts.next_accounts_overdue) {
        console.log(chalk.white('│  ') + chalk.red('⚠ Accounts are overdue'));
      }
      console.log(chalk.white('│'));
      console.log(chalk.white('└──────────────────────────────────────────────────────────────┘'));
      console.log('');
    }

    // Enrichment Data
    if (company.enrichment.website || company.enrichment.headcount || company.enrichment.tech_stack) {
      console.log(chalk.bold.white('┌─ ENRICHMENT DATA ─────────────────────────────────────────┐'));
      console.log(chalk.white('│'));
      if (company.enrichment.website) {
        console.log(chalk.white('│  ') + chalk.bold.yellow('Website:') + chalk.white(`           ${company.enrichment.website}`));
      }
      if (company.enrichment.linkedin_url) {
        console.log(chalk.white('│  ') + chalk.bold.yellow('LinkedIn:') + chalk.white(`          ${company.enrichment.linkedin_url}`));
      }
      if (company.enrichment.headcount) {
        console.log(chalk.white('│  ') + chalk.bold.yellow('Headcount:') + chalk.white(`         ${company.enrichment.headcount}`));
      }
      if (company.enrichment.tech_stack && company.enrichment.tech_stack.length > 0) {
        console.log(chalk.white('│  ') + chalk.bold.yellow('Tech Stack:') + chalk.white(`        ${company.enrichment.tech_stack.join(', ')}`));
      }
      console.log(chalk.white('│  ') + chalk.bold.yellow('Status:') + chalk.white(`            ${company.enrichment.enrichment_status}`));
      console.log(chalk.white('│'));
      console.log(chalk.white('└──────────────────────────────────────────────────────────────┘'));
      console.log('');
    }

    // MSP Likelihood Analysis (from stored score)
    if (company.enrichment.msp_likelihood_score !== undefined) {
      const score = company.enrichment.msp_likelihood_score;
      const confidence = company.enrichment.msp_likelihood_confidence || 'low';
      const computedAt = company.enrichment.msp_likelihood_computed_at;
      
      const confidenceColor = confidence === 'high' ? chalk.green : 
                              confidence === 'medium' ? chalk.yellow : chalk.red;
      const scoreColor = score >= 70 ? chalk.green : 
                        score >= 40 ? chalk.yellow : chalk.red;
      
      console.log(chalk.bold.white('┌─ MSP LIKELIHOOD ANALYSIS ─────────────────────────────────┐'));
      console.log(chalk.white('│'));
      console.log(chalk.white('│  ') + chalk.bold.white('MSP Likelihood Score:') + ` ${scoreColor(score)} / 100`);
      console.log(chalk.white('│  ') + chalk.bold.white('Confidence:') + ` ${confidenceColor(confidence.toUpperCase())}`);
      if (computedAt) {
        const date = new Date(computedAt).toLocaleDateString();
        console.log(chalk.white('│  ') + chalk.bold.white('Computed:') + ` ${chalk.dim(date)}`);
      }
      console.log(chalk.white('│'));
      console.log(chalk.white('└──────────────────────────────────────────────────────────────┘'));
      console.log('');
    } else if (company.enrichment.business_keywords || company.enrichment.services || company.enrichment.tech_stack) {
      // Fallback: compute on the fly if score not stored (for backwards compatibility)
      const mspAnalysis = analyzeMSPLikelihood(company);
      const confidenceColor = mspAnalysis.confidence === 'high' ? chalk.green : 
                              mspAnalysis.confidence === 'medium' ? chalk.yellow : chalk.red;
      const scoreColor = mspAnalysis.score >= 70 ? chalk.green : 
                        mspAnalysis.score >= 40 ? chalk.yellow : chalk.red;
      
      console.log(chalk.bold.white('┌─ MSP LIKELIHOOD ANALYSIS ─────────────────────────────────┐'));
      console.log(chalk.white('│'));
      console.log(chalk.white('│  ') + chalk.bold.white('MSP Likelihood Score:') + ` ${scoreColor(mspAnalysis.score)} / 100`);
      console.log(chalk.white('│  ') + chalk.bold.white('Confidence:') + ` ${confidenceColor(mspAnalysis.confidence.toUpperCase())}`);
      console.log(chalk.white('│  ') + chalk.dim('(Computed on the fly - run recompute script to store)'));
      console.log(chalk.white('│'));
      mspAnalysis.indicators.forEach(indicator => {
        const status = indicator.found ? chalk.green('✓') : chalk.yellow('○');
        const evidenceText = indicator.evidence.length > 0 
          ? `: ${indicator.evidence.join(', ')}`
          : '';
        console.log(chalk.white(`│  ${status} ${indicator.category.padEnd(30)} ${chalk.dim(evidenceText)}`));
      });
      console.log(chalk.white('│'));
      console.log(chalk.white('└──────────────────────────────────────────────────────────────┘'));
      console.log('');
    }

    console.log('');

  } catch (error) {
    console.error(chalk.red('Error generating scorecard:'), error);
    process.exit(1);
  }
}

main();

