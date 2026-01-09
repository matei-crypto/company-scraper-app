import fs from 'fs-extra';
import path from 'path';
import { Company, CompanySchema, analyzeMSPLikelihood } from '../schemas/CompanySchema.js';

// Use Blob Storage adapter in Vercel, filesystem locally
const isVercel = !!process.env.BLOB_READ_WRITE_TOKEN;

// Re-export from blob adapter if in Vercel, otherwise use local implementation
if (isVercel) {
  // In Vercel, use Blob Storage
  export {
    readCompany,
    writeCompany,
    listAllCompanies,
    readAllCompanies,
    deleteCompany,
    getCompanyDocumentsDir,
    ensureCompanyDocumentsDir,
    getDocumentFilePath,
    saveDocument,
    documentExists,
    listCompanyDocuments,
  } from './fileSystemBlob.js';
} else {
  // Local filesystem implementation
  const COMPANIES_DIR = path.join(process.cwd(), 'data', 'companies');

/**
 * Get the documents directory for a company
 */
export function getCompanyDocumentsDir(companyNumber: string): string {
  return path.join(COMPANIES_DIR, companyNumber, 'documents');
}

/**
 * Ensure the documents directory exists for a company
 */
export async function ensureCompanyDocumentsDir(companyNumber: string): Promise<void> {
  const documentsDir = getCompanyDocumentsDir(companyNumber);
  await fs.ensureDir(documentsDir);
}

/**
 * Get the file path for a document
 */
export function getDocumentFilePath(companyNumber: string, transactionId: string, extension: string = 'pdf'): string {
  const documentsDir = getCompanyDocumentsDir(companyNumber);
  return path.join(documentsDir, `${transactionId}.${extension}`);
}

/**
 * Save a document to disk
 */
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

/**
 * Check if a document exists
 */
export async function documentExists(companyNumber: string, transactionId: string, extension: string = 'pdf'): Promise<boolean> {
  const filePath = getDocumentFilePath(companyNumber, transactionId, extension);
  return await fs.pathExists(filePath);
}

/**
 * List all documents for a company
 */
export async function listCompanyDocuments(companyNumber: string): Promise<string[]> {
  const documentsDir = getCompanyDocumentsDir(companyNumber);
  if (!(await fs.pathExists(documentsDir))) {
    return [];
  }
  const files = await fs.readdir(documentsDir);
  return files.filter(file => file.endsWith('.pdf') || file.endsWith('.json'));
}

/**
 * Ensure the companies directory exists
 */
export async function ensureCompaniesDir(): Promise<void> {
  await fs.ensureDir(COMPANIES_DIR);
}

/**
 * Get the file path for a company
 */
export function getCompanyFilePath(companyNumber: string): string {
  return path.join(COMPANIES_DIR, `${companyNumber}.json`);
}

/**
 * Read a company from the database
 */
export async function readCompany(companyNumber: string): Promise<Company | null> {
  const filePath = getCompanyFilePath(companyNumber);
  
  if (!(await fs.pathExists(filePath))) {
    return null;
  }
  
  const data = await fs.readJson(filePath);
  return CompanySchema.parse(data);
}

/**
 * Write a company to the database with validation
 * Automatically recomputes MSP likelihood score if enrichment data is present
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
  
  const filePath = getCompanyFilePath(validated.company_number);
  await ensureCompaniesDir();
  await fs.writeJson(filePath, validated, { spaces: 2 });
}

/**
 * List all company files
 */
export async function listAllCompanies(): Promise<string[]> {
  await ensureCompaniesDir();
  const files = await fs.readdir(COMPANIES_DIR);
  return files.filter(file => file.endsWith('.json')).map(file => file.replace('.json', ''));
}

/**
 * Read all companies from the database
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

// Export local filesystem functions
export {
  getCompanyDocumentsDir,
  ensureCompanyDocumentsDir,
  getDocumentFilePath,
  saveDocument,
  documentExists,
  listCompanyDocuments,
};
}
