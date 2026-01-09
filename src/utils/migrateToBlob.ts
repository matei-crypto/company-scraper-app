#!/usr/bin/env node

/**
 * Migration script to upload local company files to Vercel Blob Storage
 * Run this before deploying to Vercel to sync your local data
 */

import { put } from '@vercel/blob';
import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
// Import from the blob adapter directly to avoid circular dependency
import fs from 'fs-extra';
import path from 'path';
import { CompanySchema } from '../schemas/CompanySchema.js';

const COMPANIES_DIR = path.join(process.cwd(), 'data', 'companies');
const BLOB_PREFIX = 'companies/';

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error(chalk.red('Error: BLOB_READ_WRITE_TOKEN environment variable not set'));
    console.log(chalk.yellow('Get your token from: https://vercel.com/dashboard/stores'));
    process.exit(1);
  }

  console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║        MIGRATE TO VERCEL BLOB STORAGE                       ║'));
  console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));

  try {
    const files = await fs.readdir(COMPANIES_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    console.log(chalk.dim(`Found ${jsonFiles.length} company files to migrate...\n`));
    
    let uploaded = 0;
    let errors = 0;
    
    for (const file of jsonFiles) {
      const companyNumber = file.replace('.json', '');
      
      try {
        const filePath = path.join(COMPANIES_DIR, file);
        if (!(await fs.pathExists(filePath))) {
          continue;
        }
        
        const data = await fs.readJson(filePath);
        const company = CompanySchema.parse(data);
        
        const blobPath = `${BLOB_PREFIX}${companyNumber}.json`;
        const jsonContent = JSON.stringify(company, null, 2);
        
        await put(blobPath, jsonContent, {
          contentType: 'application/json',
          addRandomSuffix: false,
          access: 'public',
        });
        
        uploaded++;
        
        if (uploaded % 100 === 0) {
          console.log(chalk.dim(`  Uploaded ${uploaded} companies...`));
        }
      } catch (error: any) {
        console.error(chalk.red(`  ✗ Error uploading ${companyNumber}: ${error.message}`));
        errors++;
      }
    }
    
    console.log(chalk.bold.green('\n╔════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.green('║                      SUMMARY                              ║'));
    console.log(chalk.bold.green('╚════════════════════════════════════════════════════════════╝\n'));
    console.log(chalk.green(`✓ Uploaded: ${uploaded} companies`));
    if (errors > 0) {
      console.log(chalk.red(`✗ Errors: ${errors} companies`));
    }
    console.log('');
    
  } catch (error: any) {
    console.error(chalk.red(`\n✗ Fatal error: ${error.message}`));
    process.exit(1);
  }
}

main();
