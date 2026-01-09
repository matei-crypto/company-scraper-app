#!/usr/bin/env node

import 'dotenv/config';
import chalk from 'chalk';
import { CompaniesHouseScraper } from '../scrapers/companiesHouse.js';
import { readCompany, writeCompany, saveDocument, documentExists, listCompanyDocuments } from './fileSystem.js';
import { filterAccountDocuments } from './documentHelpers.js';
import { RATE_LIMIT_DELAY_DOWNLOAD_MS, MAX_FILING_HISTORY_LIMIT } from '../config/constants.js';
import path from 'path';

/**
 * Download account documents for a company
 * Filters filing history for account documents (category: "accounts", type: "AA")
 */
export async function downloadAccountDocuments(
  companyNumber: string,
  options: {
    force?: boolean; // Force re-download even if document exists
    maxDocuments?: number; // Maximum number of documents to download
  } = {}
): Promise<{ downloaded: number; skipped: number; errors: number }> {
  const scraper = new CompaniesHouseScraper();
  let downloaded = 0;
  let skipped = 0;
  let errors = 0;

  console.log(chalk.cyan(`\nDownloading account documents for: ${companyNumber}`));
  console.log(chalk.dim('─'.repeat(60)));

  try {
    // Read company data
    const company = await readCompany(companyNumber);
    if (!company) {
      console.log(chalk.red(`  ✗ Company ${companyNumber} not found in database`));
      return { downloaded: 0, skipped: 0, errors: 1 };
    }

    // Get filing history
    const filingHistory = await scraper.getCompanyFilingHistory(companyNumber, MAX_FILING_HISTORY_LIMIT);
    if (!filingHistory || !filingHistory.items) {
      console.log(chalk.yellow(`  ⚠ No filing history available`));
      return { downloaded: 0, skipped: 0, errors: 0 };
    }

    // Filter for account documents using shared utility
    const accountFilings = filterAccountDocuments(filingHistory.items);

    if (accountFilings.length === 0) {
      console.log(chalk.yellow(`  ⚠ No account documents found in filing history`));
      return { downloaded: 0, skipped: 0, errors: 0 };
    }

    console.log(chalk.dim(`  Found ${accountFilings.length} account document(s)`));

    // Limit number of documents if specified
    const filingsToDownload = options.maxDocuments 
      ? accountFilings.slice(0, options.maxDocuments)
      : accountFilings;

    // Download each document
    for (const filing of filingsToDownload) {
      const transactionId = filing.transaction_id;
      const date = filing.date || 'unknown';
      const description = filing.description || 'account document';

      // Check if document already exists
      if (!options.force && await documentExists(companyNumber, transactionId)) {
        console.log(chalk.dim(`    ○ ${transactionId} (${date}): Already downloaded`));
        skipped++;
        continue;
      }

      try {
        console.log(chalk.dim(`    Downloading ${transactionId} (${date}): ${description}...`));
        
        // Download document
        const documentBuffer = await scraper.downloadFilingHistoryDocument(companyNumber, transactionId);
        
        if (!documentBuffer) {
          console.log(chalk.yellow(`    ⚠ ${transactionId}: Document not available`));
          skipped++;
          continue;
        }

        // Determine file extension (default to PDF)
        const extension = 'pdf'; // Companies House documents are typically PDFs

        // Save document
        const filePath = await saveDocument(companyNumber, transactionId, documentBuffer, extension);
        console.log(chalk.green(`    ✓ ${transactionId}: Saved to ${path.relative(process.cwd(), filePath)}`));

        // Update company record to mark document as downloaded
        if (company.filing_history?.filing_history) {
          const filingIndex = company.filing_history.filing_history.findIndex(
            (f: any) => f.transaction_id === transactionId
          );
          if (filingIndex >= 0) {
            // Update existing entry
            company.filing_history.filing_history[filingIndex] = {
              ...company.filing_history.filing_history[filingIndex],
              document_downloaded: true,
              document_path: filePath,
              document_downloaded_at: new Date().toISOString(),
            };
          } else {
            // Add new entry if it doesn't exist in filing_history
            // This happens when the scraper only stored 25 items but there are more account documents
            company.filing_history.filing_history.push({
              category: filing.category,
              date: filing.date,
              description: filing.description,
              type: filing.type,
              pages: filing.pages,
              barcode: filing.barcode,
              transaction_id: transactionId,
              document_downloaded: true,
              document_path: filePath,
              document_downloaded_at: new Date().toISOString(),
            });
          }
        } else {
          // Initialize filing_history if it doesn't exist
          company.filing_history = {
            filing_history: [{
              category: filing.category,
              date: filing.date,
              description: filing.description,
              type: filing.type,
              pages: filing.pages,
              barcode: filing.barcode,
              transaction_id: transactionId,
              document_downloaded: true,
              document_path: filePath,
              document_downloaded_at: new Date().toISOString(),
            }],
            total_count: 1,
          };
        }

              downloaded++;

              // Rate limiting: delay between downloads
              await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_DOWNLOAD_MS));

      } catch (error: any) {
        console.log(chalk.red(`    ✗ ${transactionId}: ${error.message}`));
        errors++;
      }
    }

    // Save updated company record
    if (downloaded > 0) {
      await writeCompany(company);
    }

    console.log(chalk.bold.cyan(`\n  Summary:`));
    console.log(chalk.green(`    ✓ Downloaded: ${downloaded}`));
    console.log(chalk.yellow(`    ○ Skipped: ${skipped}`));
    console.log(chalk.red(`    ✗ Errors: ${errors}`));

    return { downloaded, skipped, errors };

  } catch (error: any) {
    console.log(chalk.red(`  ✗ Error: ${error.message}`));
    return { downloaded: 0, skipped: 0, errors: 1 };
  }
}

/**
 * Download account documents for multiple companies
 */
export async function downloadAccountDocumentsForCompanies(
  companyNumbers: string[],
  options: {
    force?: boolean;
    maxDocuments?: number;
  } = {}
): Promise<void> {
  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║        DOWNLOADING ACCOUNT DOCUMENTS                        ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));

  let totalDownloaded = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const companyNumber of companyNumbers) {
    const result = await downloadAccountDocuments(companyNumber, options);
    totalDownloaded += result.downloaded;
    totalSkipped += result.skipped;
    totalErrors += result.errors;
  }

  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║                      FINAL SUMMARY                          ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));

  console.log(chalk.green(`✓ Total Downloaded: ${totalDownloaded}`));
  console.log(chalk.yellow(`○ Total Skipped: ${totalSkipped}`));
  console.log(chalk.red(`✗ Total Errors: ${totalErrors}`));
  console.log('');
}

// CLI entry point
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('downloadDocuments')) {
  const args = process.argv.slice(2);
  
  // Check for --all flag
  if (args.includes('--all')) {
    // Import listAllCompanies
    const { listAllCompanies } = await import('./fileSystem.js');
    const allCompanyNumbers = await listAllCompanies();
    
    if (allCompanyNumbers.length === 0) {
      console.error(chalk.red('No companies found in database'));
      process.exit(1);
    }

    console.log(chalk.cyan(`Found ${allCompanyNumbers.length} companies. Starting download...\n`));
    
    const force = args.includes('--force');
    const maxDocsArg = args.find(arg => arg.startsWith('--max-docs='));
    const maxDocuments = maxDocsArg ? parseInt(maxDocsArg.split('=')[1], 10) : undefined;

    downloadAccountDocumentsForCompanies(allCompanyNumbers, { force, maxDocuments })
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(chalk.red('\n✗ Fatal error:'), error);
        process.exit(1);
      });
  } else {
    const companyNumbers = args.filter(arg => !arg.startsWith('--'));
    
    if (companyNumbers.length === 0) {
      console.error(chalk.red('Usage: tsx src/utils/downloadDocuments.ts <company_number> [company_number...] | --all'));
      console.error(chalk.yellow('Example: tsx src/utils/downloadDocuments.ts 07019261 04298949'));
      console.error(chalk.yellow('Example: tsx src/utils/downloadDocuments.ts --all'));
      console.error(chalk.dim('\nOptions:'));
      console.error(chalk.dim('  --all: Download documents for all companies in database'));
      console.error(chalk.dim('  --force: Re-download even if document exists'));
      console.error(chalk.dim('  --max-docs=N: Maximum number of documents per company'));
      process.exit(1);
    }

    const force = args.includes('--force');
    const maxDocsArg = args.find(arg => arg.startsWith('--max-docs='));
    const maxDocuments = maxDocsArg ? parseInt(maxDocsArg.split('=')[1], 10) : undefined;

    downloadAccountDocumentsForCompanies(companyNumbers, { force, maxDocuments })
      .then(() => process.exit(0))
      .catch((error) => {
        console.error(chalk.red('\n✗ Fatal error:'), error);
        process.exit(1);
      });
  }
}

