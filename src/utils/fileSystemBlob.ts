import { put, get, del, list, head } from '@vercel/blob';
import fs from 'fs-extra';
import path from 'path';
import { Company, CompanySchema, analyzeMSPLikelihood } from '../schemas/CompanySchema.js';

const COMPANIES_DIR = path.join(process.cwd(), 'data', 'companies');

// Check if we're in Vercel environment
const isVercel = !!process.env.BLOB_READ_WRITE_TOKEN;
const BLOB_PREFIX = 'companies/';

/**
 * Get the blob path for a company file
 */
function getCompanyBlobPath(companyNumber: string): string {
  return `${BLOB_PREFIX}${companyNumber}.json`;
}

/**
 * Read a company from storage (Blob or filesystem)
 */
export async function readCompany(companyNumber: string): Promise<Company | null> {
  if (isVercel) {
    // Use Vercel Blob Storage
    try {
      const blobPath = getCompanyBlobPath(companyNumber);
      const blob = await get(blobPath);
      const text = await blob.text();
      const data = JSON.parse(text);
      return CompanySchema.parse(data);
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  } else {
    // Use local filesystem
    const filePath = path.join(COMPANIES_DIR, `${companyNumber}.json`);
    if (!(await fs.pathExists(filePath))) {
      return null;
    }
    const data = await fs.readJson(filePath);
    return CompanySchema.parse(data);
  }
}

/**
 * Write a company to storage (Blob or filesystem)
 */
export async function writeCompany(company: Company): Promise<void> {
  // Validate before writing
  const validated = CompanySchema.parse(company);
  
  // Add/update metadata
  validated.updated_at = new Date().toISOString();
  if (!validated.scraped_at) {
    validated.scraped_at = new Date().toISOString();
  }
  
  // Automatically recompute MSP likelihood score if enrichment data is present
  if (validated.enrichment && (
    (validated.enrichment.business_keywords && validated.enrichment.business_keywords.length > 0) ||
    (validated.enrichment.services && validated.enrichment.services.length > 0) ||
    (validated.enrichment.tech_stack && validated.enrichment.tech_stack.length > 0) ||
    validated.enrichment.business_description
  )) {
    const mspAnalysis = analyzeMSPLikelihood(validated);
    validated.enrichment.msp_likelihood_score = mspAnalysis.score;
    validated.enrichment.msp_likelihood_confidence = mspAnalysis.confidence;
    validated.enrichment.msp_likelihood_computed_at = new Date().toISOString();
  }
  
  const jsonContent = JSON.stringify(validated, null, 2);
  
  if (isVercel) {
    // Use Vercel Blob Storage
    const blobPath = getCompanyBlobPath(validated.company_number);
    await put(blobPath, jsonContent, {
      contentType: 'application/json',
      addRandomSuffix: false,
      access: 'public',
    });
  } else {
    // Use local filesystem
    await fs.ensureDir(COMPANIES_DIR);
    const filePath = path.join(COMPANIES_DIR, `${validated.company_number}.json`);
    await fs.writeJson(filePath, validated, { spaces: 2 });
  }
}

/**
 * List all company numbers
 */
export async function listAllCompanies(): Promise<string[]> {
  if (isVercel) {
    // List all blobs with the companies prefix
    const { blobs } = await list({ prefix: BLOB_PREFIX });
    return blobs
      .map(blob => blob.pathname.replace(BLOB_PREFIX, '').replace('.json', ''))
      .filter(name => name.length > 0);
  } else {
    // Use local filesystem
    await fs.ensureDir(COMPANIES_DIR);
    const files = await fs.readdir(COMPANIES_DIR);
    return files.filter(file => file.endsWith('.json')).map(file => file.replace('.json', ''));
  }
}

/**
 * Read all companies from storage
 */
export async function readAllCompanies(): Promise<Company[]> {
  const companyNumbers = await listAllCompanies();
  const companies: Company[] = [];
  
  for (const companyNumber of companyNumbers) {
    try {
      const company = await readCompany(companyNumber);
      if (company) {
        companies.push(company);
      }
    } catch (error) {
      console.error(`Error reading company ${companyNumber}:`, error);
    }
  }
  
  return companies;
}

/**
 * Delete a company (if needed)
 */
export async function deleteCompany(companyNumber: string): Promise<void> {
  if (isVercel) {
    const blobPath = getCompanyBlobPath(companyNumber);
    await del(blobPath);
  } else {
    const filePath = path.join(COMPANIES_DIR, `${companyNumber}.json`);
    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath);
    }
  }
}

// Re-export document functions (these can still use filesystem for now, or migrate later)
export function getCompanyDocumentsDir(companyNumber: string): string {
  return path.join(COMPANIES_DIR, companyNumber, 'documents');
}

export async function ensureCompanyDocumentsDir(companyNumber: string): Promise<void> {
  const documentsDir = getCompanyDocumentsDir(companyNumber);
  await fs.ensureDir(documentsDir);
}

export function getDocumentFilePath(companyNumber: string, transactionId: string, extension: string = 'pdf'): string {
  const documentsDir = getCompanyDocumentsDir(companyNumber);
  return path.join(documentsDir, `${transactionId}.${extension}`);
}

export async function saveDocument(
  companyNumber: string,
  transactionId: string,
  documentBuffer: Buffer,
  extension: string = 'pdf'
): Promise<string> {
  await ensureCompanyDocumentsDir(companyNumber);
  const filePath = getDocumentFilePath(companyNumber, transactionId, extension);
  await fs.writeFile(filePath, documentBuffer);
  return filePath;
}

export async function documentExists(companyNumber: string, transactionId: string, extension: string = 'pdf'): Promise<boolean> {
  const filePath = getDocumentFilePath(companyNumber, transactionId, extension);
  return await fs.pathExists(filePath);
}

export async function listCompanyDocuments(companyNumber: string): Promise<string[]> {
  const documentsDir = getCompanyDocumentsDir(companyNumber);
  if (!(await fs.pathExists(documentsDir))) {
    return [];
  }
  const files = await fs.readdir(documentsDir);
  return files.filter(file => file.endsWith('.pdf') || file.endsWith('.json'));
}
