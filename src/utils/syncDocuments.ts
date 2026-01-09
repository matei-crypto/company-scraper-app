#!/usr/bin/env node

import 'dotenv/config';
import chalk from 'chalk';
import { CompaniesHouseScraper } from '../scrapers/companiesHouse.js';
import { readCompany, writeCompany, listAllCompanies, listCompanyDocuments } from './fileSystem.js';
import { filterAccountDocuments } from './documentHelpers.js';
import { RATE_LIMIT_DELAY_MS, MAX_FILING_HISTORY_LIMIT } from '../config/constants.js';
import path from 'path';

/**
 * Sync document tracking in JSON with actual PDFs on disk
 * This fixes the issue where PDFs were downloaded but not all were tracked in JSON
 */
async function syncDocumentsForCompany(companyNumber: string): Promise<{
  added: number;
  updated: number;
  errors: number;
}> {
  const scraper = new CompaniesHouseScraper();
  let added = 0;
  let updated = 0;
  let errors = 0;

  try {
    // Read company data
    const company = await readCompany(companyNumber);
    if (!company) {
      console.log(chalk.red(`  ✗ Company ${companyNumber} not found in database`));
      return { added: 0, updated: 0, errors: 1 };
    }

    // Get list of PDFs on disk
    const pdfFiles = await listCompanyDocuments(companyNumber);
    const pdfTransactionIds = new Set(
      pdfFiles
        .filter(f => f.endsWith('.pdf'))
        .map(f => path.basename(f, '.pdf'))
    );

    if (pdfTransactionIds.size === 0) {
      // No PDFs, nothing to sync
      return { added: 0, updated: 0, errors: 0 };
    }

    // Get full filing history from API
    const filingHistory = await scraper.getCompanyFilingHistory(companyNumber, MAX_FILING_HISTORY_LIMIT);
    if (!filingHistory || !filingHistory.items) {
      console.log(chalk.yellow(`  ⚠ No filing history available for ${companyNumber}`));
      return { added: 0, updated: 0, errors: 0 };
    }

    // Filter for account documents using shared utility
    const accountFilings = filterAccountDocuments(filingHistory.items);

    // Ensure filing_history exists
    if (!company.filing_history) {
      company.filing_history = {
        filing_history: [],
        total_count: filingHistory.total_count,
      };
    }
    if (!company.filing_history.filing_history) {
      company.filing_history.filing_history = [];
    }

    const existingFilingMap = new Map(
      company.filing_history.filing_history.map((f: any) => [f.transaction_id, f])
    );

    // Process each account document
    for (const filing of accountFilings) {
      const transactionId = filing.transaction_id;
      const hasPdf = pdfTransactionIds.has(transactionId);

      if (!hasPdf) {
        // PDF doesn't exist, skip
        continue;
      }

      const existingFiling = existingFilingMap.get(transactionId);
      const documentPath = `data/companies/${companyNumber}/documents/${transactionId}.pdf`;

      if (existingFiling) {
        // Update existing entry
        if (!existingFiling.document_downloaded || existingFiling.document_path !== documentPath) {
          existingFiling.document_downloaded = true;
          existingFiling.document_path = documentPath;
          existingFiling.document_downloaded_at = existingFiling.document_downloaded_at || new Date().toISOString();
          updated++;
        }
      } else {
        // Add new entry
        company.filing_history.filing_history.push({
          category: filing.category,
          date: filing.date,
          description: filing.description,
          type: filing.type,
          pages: filing.pages,
          barcode: filing.barcode,
          transaction_id: transactionId,
          document_downloaded: true,
          document_path: documentPath,
          document_downloaded_at: new Date().toISOString(),
        });
        added++;
      }
    }

    // Update total_count if needed
    if (company.filing_history.total_count !== filingHistory.total_count) {
      company.filing_history.total_count = filingHistory.total_count;
    }

    // Save updated company record
    if (added > 0 || updated > 0) {
      await writeCompany(company);
    }

    return { added, updated, errors };

  } catch (error: any) {
    console.log(chalk.red(`  ✗ Error syncing ${companyNumber}: ${error.message}`));
    return { added: 0, updated: 0, errors: 1 };
  }
}

/**
 * Sync documents for all companies
 */
async function syncAllDocuments(): Promise<void> {
  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║        SYNCING DOCUMENT TRACKING WITH PDFs                 ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));

  const allCompanyNumbers = await listAllCompanies();
  
  if (allCompanyNumbers.length === 0) {
    console.log(chalk.yellow('No companies found in database'));
    return;
  }

  console.log(chalk.cyan(`Found ${allCompanyNumbers.length} companies. Syncing document tracking...\n`));

  let totalAdded = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  for (const companyNumber of allCompanyNumbers) {
    console.log(chalk.dim(`Syncing ${companyNumber}...`));
    
    const result = await syncDocumentsForCompany(companyNumber);
    
    if (result.added > 0 || result.updated > 0) {
      console.log(
        chalk.green(`  ✓ ${companyNumber}: `) +
        (result.added > 0 ? chalk.cyan(`+${result.added} entries`) : '') +
        (result.added > 0 && result.updated > 0 ? ', ' : '') +
        (result.updated > 0 ? chalk.yellow(`~${result.updated} updated`) : '')
      );
    }
    
    totalAdded += result.added;
    totalUpdated += result.updated;
    totalErrors += result.errors;

    // Rate limiting delay
    await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));
  }

  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║                      SYNC SUMMARY                           ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));

  console.log(chalk.green(`✓ Entries Added:   ${totalAdded}`));
  console.log(chalk.yellow(`○ Entries Updated: ${totalUpdated}`));
  console.log(chalk.red(`✗ Errors:          ${totalErrors}`));
  console.log('');
}

// CLI entry point
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('syncDocuments')) {
  syncAllDocuments()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(chalk.red('\n✗ Fatal error:'), error);
      process.exit(1);
    });
}

export { syncDocumentsForCompany, syncAllDocuments };

