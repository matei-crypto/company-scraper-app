import fs from 'fs-extra';
import path from 'path';
import { Company, CompanySchema, analyzeMSPLikelihood } from '../schemas/CompanySchema.js';

const COMPANIES_DIR = path.join(process.cwd(), 'data', 'companies');

// Document functions
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

// Company data functions
export async function readCompany(companyNumber: string): Promise<Company | null> {
  const filePath = path.join(COMPANIES_DIR, `${companyNumber}.json`);
  if (!(await fs.pathExists(filePath))) {
    return null;
  }
  const data = await fs.readJson(filePath);
  return CompanySchema.parse(data);
}

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
  
  const filePath = path.join(COMPANIES_DIR, `${validated.company_number}.json`);
  await fs.ensureDir(COMPANIES_DIR);
  await fs.writeJson(filePath, validated, { spaces: 2 });
}

export async function listAllCompanies(): Promise<string[]> {
  await fs.ensureDir(COMPANIES_DIR);
  const files = await fs.readdir(COMPANIES_DIR);
  return files.filter(file => file.endsWith('.json')).map(file => file.replace('.json', ''));
}

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

export async function deleteCompany(companyNumber: string): Promise<void> {
  const filePath = path.join(COMPANIES_DIR, `${companyNumber}.json`);
  if (await fs.pathExists(filePath)) {
    await fs.remove(filePath);
  }
}
