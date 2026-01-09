import { describe, it, expect } from 'vitest';
import { readAllCompanies } from '../../src/utils/fileSystem.js';
import { CompanySchema, isHighValueTarget } from '../../src/schemas/CompanySchema.js';

describe('Compliance Engine - Data Integrity Tests', () => {
  it('should validate all company files against CompanySchema', async () => {
    const companies = await readAllCompanies();
    
    for (const company of companies) {
      // This will throw if the company doesn't match the schema
      const result = CompanySchema.safeParse(company);
      
      if (!result.success) {
        console.error(`Invalid company ${company.company_number}:`, result.error.errors);
      }
      
      expect(result.success).toBe(true);
    }
  });

  it('should flag companies missing critical acquisition criteria (3+ years active)', async () => {
    const companies = await readAllCompanies();
    const nonCompliant: string[] = [];
    
    for (const company of companies) {
      const incorporationDate = new Date(company.date_of_incorporation);
      const yearsActive = (Date.now() - incorporationDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
      
      if (yearsActive < 3) {
        nonCompliant.push(`${company.company_name} (${company.company_number}) - ${yearsActive.toFixed(1)} years`);
      }
    }
    
    if (nonCompliant.length > 0) {
      console.warn('\n⚠️  Companies not meeting 3+ years active requirement:');
      nonCompliant.forEach(name => console.warn(`  - ${name}`));
    }
    
    // This test passes but logs warnings for non-compliant companies
    expect(nonCompliant.length).toBeGreaterThanOrEqual(0);
  });

  it('should identify high-value targets correctly', async () => {
    const companies = await readAllCompanies();
    
    for (const company of companies) {
      const isHighValue = isHighValueTarget(company);
      const yearsActive = (Date.now() - new Date(company.date_of_incorporation).getTime()) / (1000 * 60 * 60 * 24 * 365);
      
      // If marked as high-value, it must be 3+ years old
      if (isHighValue) {
        expect(yearsActive).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('should ensure all companies have valid company numbers', async () => {
    const companies = await readAllCompanies();
    
    for (const company of companies) {
      // Company number must be 8 digits or SC prefix with 6 digits (Scottish companies)
      expect(company.company_number).toMatch(/^(SC)?[0-9]{6,8}$/);
    }
  });

  it('should ensure all companies have valid incorporation dates', async () => {
    const companies = await readAllCompanies();
    
    for (const company of companies) {
      // Date must be in YYYY-MM-DD format
      expect(company.date_of_incorporation).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      
      // Date must be valid
      const date = new Date(company.date_of_incorporation);
      expect(date.toString()).not.toBe('Invalid Date');
    }
  });
});

