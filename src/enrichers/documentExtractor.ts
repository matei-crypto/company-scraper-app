#!/usr/bin/env node

import 'dotenv/config';
import axios, { AxiosInstance } from 'axios';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { readCompany, writeCompany, getCompanyDocumentsDir, listCompanyDocuments } from '../utils/fileSystem.js';
import { filterAccountDocuments } from '../utils/documentHelpers.js';
import { CompanySchema, type Company, AnnualFinancialDataSchema } from '../schemas/CompanySchema.js';
import type { z } from 'zod';

type AnnualFinancialData = z.infer<typeof AnnualFinancialDataSchema>;

/**
 * Mistral OCR Document Extractor
 * Extracts financial data from company account documents using Mistral OCR API (mistral-ocr-2512 model)
 */
class DocumentExtractor {
  private api: AxiosInstance;
  private apiKey: string;
  private useOcrService: boolean;

  constructor() {
    // Support both MISTRAL_API_KEY (for Mistral AI) and MISTRAL_OCR_API_KEY (for Mistral OCR service)
    this.apiKey = process.env.MISTRAL_API_KEY || process.env.MISTRAL_OCR_API_KEY || '';
    
    if (!this.apiKey) {
      throw new Error(
        'MISTRAL_API_KEY or MISTRAL_OCR_API_KEY environment variable is required.\n' +
        'For Mistral AI: Get your API key at: https://console.mistral.ai/\n' +
        'For Mistral OCR: Get your API key at: https://www.mistralocr.app/'
      );
    }

    // Determine which service to use based on available key
    this.useOcrService = !!process.env.MISTRAL_OCR_API_KEY;
    
    this.api = axios.create({
      baseURL: this.useOcrService 
        ? 'https://www.mistralocr.app/api' // Mistral OCR service
        : 'https://api.mistral.ai/v1',     // Mistral AI API
      headers: this.useOcrService
        ? {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json',
          }
        : {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
    });
  }

  /**
   * Convert PDF to base64 for API upload
   */
  private async pdfToBase64(filePath: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath);
    return fileBuffer.toString('base64');
  }

  /**
   * Extract financial data from a single PDF document using Mistral OCR 3
   */
  async extractFromDocument(
    filePath: string,
    transactionId: string
  ): Promise<AnnualFinancialData | null> {
    try {
      console.log(chalk.dim(`    Extracting from ${path.basename(filePath)}...`));

      // Convert PDF to base64
      const base64Data = await this.pdfToBase64(filePath);

      // Prepare extraction prompt
      const extractionPrompt = `Extract financial and business data from this UK company account document.

IMPORTANT: Extract data for the SPECIFIC ACCOUNTING PERIOD shown in this document.
Do NOT average or combine data from multiple years. Each document represents ONE year.

Focus on:
1. Financial statements (P&L, Balance Sheet, Cash Flow) for THIS PERIOD
2. Revenue breakdown - CRITICAL: Identify recurring vs one-time revenue for THIS YEAR
3. EBITDA calculation or components for THIS PERIOD
4. Employee data and costs for THIS PERIOD
5. Technology mentions (especially Microsoft products) mentioned in THIS YEAR's report
6. Client concentration data for THIS PERIOD
7. Directors' report insights from THIS YEAR

For each value:
- Extract the exact number for THIS ACCOUNTING PERIOD
- Note the currency (should be GBP/£)
- Extract the period_start and period_end dates (YYYY-MM-DD format)
- If a value is not stated, mark as null
- Do NOT calculate averages or combine with other years

Return structured JSON matching this schema:
{
  "period_start": "YYYY-MM-DD",
  "period_end": "YYYY-MM-DD",
  "revenue": number,
  "cost_of_sales": number,
  "gross_profit": number,
  "operating_expenses": {
    "staff_costs": number,
    "rent_premises": number,
    "it_software": number,
    "marketing": number,
    "professional_fees": number,
    "depreciation": number,
    "amortization": number,
    "other": number,
    "total": number
  },
  "operating_profit": number,
  "ebitda": number,
  "profit_before_tax": number,
  "tax": number,
  "profit_after_tax": number,
  "total_assets": number,
  "current_assets": number,
  "fixed_assets": number,
  "total_liabilities": number,
  "current_liabilities": number,
  "long_term_liabilities": number,
  "net_assets": number,
  "shareholders_equity": number,
  "operating_cash_flow": number,
  "revenue_breakdown": {
    "recurring_revenue": number,
    "recurring_revenue_percentage": number,
    "one_time_revenue": number,
    "service_revenue": {
      "managed_services": number,
      "cloud_services": number,
      "software_licensing": number,
      "professional_services": number,
      "hardware_sales": number
    }
  },
  "client_data": {
    "total_clients": number,
    "top_client_revenue_percentage": number,
    "top_3_clients_revenue_percentage": number
  },
  "employees": {
    "average_count": number,
    "total_costs": number
  },
  "technology_costs": {
    "it_software_total": number,
    "cloud_services": number,
    "mentions": ["string"]
  },
  "ratios": {
    "gross_margin": number,
    "operating_margin": number,
    "ebitda_margin": number
  },
  "strategic_insights": {
    "business_description": "string",
    "technology_mentions": ["string"]
  }
}

Return ONLY valid JSON, no additional text.`;

      let extractedText: string;

      if (this.useOcrService) {
        // Mistral OCR service API
        const response = await this.api.post('/ocr/process', {
          image: base64Data,
          options: {
            format: 'json',
            prompt: extractionPrompt, // Custom prompt for extraction
          },
        });

        if (!response.data.success) {
          throw new Error(`OCR API error: ${JSON.stringify(response.data)}`);
        }

        // Mistral OCR returns extracted text - we'll need to send it to an LLM for structured extraction
        // For now, assume it returns JSON directly or we'll parse the text
        const ocrText = response.data.extractedText || response.data.text || '';
        
        // If OCR returns plain text, we need to send it to an LLM for structured extraction
        // For now, try to parse as JSON first
        try {
          extractedText = JSON.parse(ocrText);
        } catch {
          // If not JSON, we'd need to call an LLM here to structure it
          // For now, throw an error suggesting to use Mistral AI API instead
          throw new Error('Mistral OCR returned unstructured text. Use MISTRAL_API_KEY with mistral-ocr-2512 model for structured extraction.');
        }
      } else {
        // Mistral AI OCR API (mistral-ocr-2512 model)
        // Using the dedicated /v1/ocr endpoint per documentation: https://docs.mistral.ai/api/endpoint/ocr
        // The API requires file uploads via multipart/form-data
        // First, upload the file using the Files API with FormData
        const fileBuffer = await fs.readFile(filePath);
        const FormData = (await import('form-data')).default;
        const formData = new FormData();
        formData.append('file', fileBuffer, {
          filename: path.basename(filePath),
          contentType: 'application/pdf',
        });
        formData.append('purpose', 'ocr');

        // Upload file using Files API with multipart/form-data
        const uploadResponse = await this.api.post('/files', formData, {
          headers: {
            ...formData.getHeaders(),
          },
        });

        const fileId = uploadResponse.data.id;
        
        // Now use the file_id in the OCR request
        // Note: document_annotation_format only works for documents with ≤8 pages
        // For larger documents, we'll get markdown and structure it with chat completions
        let useAnnotationFormat = true;
        let response: any;
        
        try {
          // Try with document_annotation_format first (works for ≤8 pages)
          response = await this.api.post('/ocr', {
            model: 'mistral-ocr-2512',
            document: {
              type: 'file',
              file_id: fileId,
            },
            document_annotation_format: {
              type: 'json_schema',
              json_schema: {
                name: 'AnnualFinancialData',
                description: 'Financial data extracted from UK company account document for a single accounting period',
                schema: {
                  type: 'object',
                  properties: {
                    period_start: { type: 'string', description: 'Start date of accounting period (YYYY-MM-DD)' },
                    period_end: { type: 'string', description: 'End date of accounting period (YYYY-MM-DD)' },
                    revenue: { type: 'number', description: 'Total revenue for the period' },
                    cost_of_sales: { type: 'number' },
                    gross_profit: { type: 'number' },
                    operating_expenses: {
                      type: 'object',
                      properties: {
                        staff_costs: { type: 'number' },
                        rent_premises: { type: 'number' },
                        it_software: { type: 'number' },
                        marketing: { type: 'number' },
                        professional_fees: { type: 'number' },
                        depreciation: { type: 'number' },
                        amortization: { type: 'number' },
                        other: { type: 'number' },
                        total: { type: 'number' },
                      },
                    },
                    operating_profit: { type: 'number' },
                    ebitda: { type: 'number' },
                    profit_before_tax: { type: 'number' },
                    tax: { type: 'number' },
                    profit_after_tax: { type: 'number' },
                    total_assets: { type: 'number' },
                    current_assets: { type: 'number' },
                    fixed_assets: { type: 'number' },
                    total_liabilities: { type: 'number' },
                    current_liabilities: { type: 'number' },
                    long_term_liabilities: { type: 'number' },
                    net_assets: { type: 'number' },
                    shareholders_equity: { type: 'number' },
                    operating_cash_flow: { type: 'number' },
                    revenue_breakdown: {
                      type: 'object',
                      properties: {
                        recurring_revenue: { type: 'number' },
                        recurring_revenue_percentage: { type: 'number' },
                        one_time_revenue: { type: 'number' },
                        service_revenue: {
                          type: 'object',
                          properties: {
                            managed_services: { type: 'number' },
                            cloud_services: { type: 'number' },
                            software_licensing: { type: 'number' },
                            professional_services: { type: 'number' },
                            hardware_sales: { type: 'number' },
                          },
                        },
                      },
                    },
                    client_data: {
                      type: 'object',
                      properties: {
                        total_clients: { type: 'number' },
                        top_client_revenue_percentage: { type: 'number' },
                        top_3_clients_revenue_percentage: { type: 'number' },
                      },
                    },
                    employees: {
                      type: 'object',
                      properties: {
                        average_count: { type: 'number' },
                        total_costs: { type: 'number' },
                      },
                    },
                    technology_costs: {
                      type: 'object',
                      properties: {
                        it_software_total: { type: 'number' },
                        cloud_services: { type: 'number' },
                        mentions: { type: 'array', items: { type: 'string' } },
                      },
                    },
                    ratios: {
                      type: 'object',
                      properties: {
                        gross_margin: { type: 'number' },
                        operating_margin: { type: 'number' },
                        ebitda_margin: { type: 'number' },
                      },
                    },
                    strategic_insights: {
                      type: 'object',
                      properties: {
                        business_description: { type: 'string' },
                        technology_mentions: { type: 'array', items: { type: 'string' } },
                      },
                    },
                  },
                  required: ['period_start', 'period_end'],
                },
              },
            },
          });
        } catch (annotationError: any) {
          // If document has >8 pages, fall back to markdown extraction
          if (annotationError.response?.data?.code === '3730' || 
              annotationError.response?.data?.message?.includes('maximum allowed of 8')) {
            console.log(chalk.dim(`    ⚠ Document has >8 pages, using markdown extraction...`));
            useAnnotationFormat = false;
            
            // Retry without document_annotation_format
            response = await this.api.post('/ocr', {
              model: 'mistral-ocr-2512',
              document: {
                type: 'file',
                file_id: fileId,
              },
            });
          } else {
            throw annotationError;
          }
        }

        // The OCR API returns pages array with markdown content
        // We need to extract the structured data from the response
        if (response.data && response.data.pages && response.data.pages.length > 0) {
          // Combine all pages' markdown content
          const allMarkdown = response.data.pages
            .map((page: any) => page.markdown || '')
            .join('\n\n');

          // If document_annotation is provided, use it (structured JSON)
          if (useAnnotationFormat && response.data.document_annotation) {
            try {
              extractedText = typeof response.data.document_annotation === 'string'
                ? response.data.document_annotation
                : JSON.stringify(response.data.document_annotation);
            } catch {
              extractedText = allMarkdown;
            }
          } else {
            // If no structured annotation, we need to send the markdown to chat completions
            // to structure it according to our schema
            console.log(chalk.dim(`    Structuring OCR output with chat completions...`));
            
            const structureResponse = await this.api.post('/chat/completions', {
              model: 'mistral-large-latest', // Use a chat model to structure the OCR output
              messages: [
                {
                  role: 'system',
                  content: 'You are a financial data extraction assistant. Extract structured JSON from OCR text.',
                },
                {
                  role: 'user',
                  content: `${extractionPrompt}\n\nOCR Text:\n${allMarkdown.substring(0, 50000)}`, // Limit to avoid token limits
                },
              ],
              response_format: { type: 'json_object' },
              temperature: 0.1,
            });

            extractedText = structureResponse.data.choices[0]?.message?.content || '';
          }
        } else {
          throw new Error('OCR API returned no pages');
        }
      }
      if (!extractedText) {
        console.log(chalk.yellow(`    ⚠ ${transactionId}: No content extracted`));
        return null;
      }

      // Parse JSON response
      let extractedData: any;
      try {
        // Try to extract JSON from markdown code blocks if present
        const jsonMatch = extractedText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[1]);
        } else {
          extractedData = JSON.parse(extractedText);
        }
      } catch (parseError: any) {
        console.log(chalk.red(`    ✗ ${transactionId}: Failed to parse JSON - ${parseError.message}`));
        console.log(chalk.dim(`    Response preview: ${extractedText.substring(0, 200)}...`));
        return null;
      }

      // Add metadata
      extractedData.extracted_at = new Date().toISOString();
      extractedData.extraction_method = 'mistral_ocr_3';
      extractedData.document_source = transactionId;

      // Validate against schema (using Zod)
      const validationResult = AnnualFinancialDataSchema.safeParse(extractedData);
      
      if (!validationResult.success) {
        console.log(chalk.yellow(`    ⚠ ${transactionId}: Validation warnings`));
        const firstError = validationResult.error.errors[0];
        console.log(chalk.dim(`      ${firstError?.path?.join('.')}: ${firstError?.message}`));
        // Continue anyway - partial data is better than no data
      }

      console.log(chalk.green(`    ✓ ${transactionId}: Extracted data for period ${extractedData.period_end || 'unknown'}`));
      return extractedData as AnnualFinancialData;

      } catch (error: any) {
        if (error.response) {
          console.log(chalk.red(`    ✗ ${transactionId}: API error ${error.response.status} - ${error.response.statusText}`));
          if (error.response.data) {
            const errorData = typeof error.response.data === 'string' 
              ? error.response.data 
              : JSON.stringify(error.response.data, null, 2);
            console.log(chalk.dim(`      ${errorData.substring(0, 500)}`));
          }
        } else {
          console.log(chalk.red(`    ✗ ${transactionId}: ${error.message}`));
        }
        return null;
      }
  }

  /**
   * Calculate trends from annual data
   */
  private calculateTrends(annualData: AnnualFinancialData[]): any {
    if (annualData.length < 1) {
      return {};
    }

    const trends: any = {};

    // Sort by period_end (most recent first)
    const sorted = [...annualData].sort((a, b) => 
      new Date(b.period_end).getTime() - new Date(a.period_end).getTime()
    );

    // Calculate 1-year growth rates
    if (sorted.length >= 2) {
      const latest = sorted[0];
      const previous = sorted[1];

      if (latest.revenue && previous.revenue) {
        trends.revenue_growth_1y = ((latest.revenue - previous.revenue) / previous.revenue) * 100;
      }
      if (latest.profit_after_tax && previous.profit_after_tax) {
        trends.profit_growth_1y = ((latest.profit_after_tax - previous.profit_after_tax) / previous.profit_after_tax) * 100;
      }
      if (latest.ebitda && previous.ebitda) {
        trends.ebitda_growth_1y = ((latest.ebitda - previous.ebitda) / previous.ebitda) * 100;
      }
      if (latest.employees?.average_count && previous.employees?.average_count) {
        trends.employee_growth_1y = ((latest.employees.average_count - previous.employees.average_count) / previous.employees.average_count) * 100;
      }

      // Determine trend directions
      if (trends.revenue_growth_1y !== undefined) {
        trends.revenue_trend = trends.revenue_growth_1y > 5 ? 'growing' : 
                               trends.revenue_growth_1y < -5 ? 'declining' : 'stable';
      }
      if (trends.profit_growth_1y !== undefined) {
        trends.profit_trend = trends.profit_growth_1y > 5 ? 'growing' : 
                              trends.profit_growth_1y < -5 ? 'declining' : 'stable';
      }
      if (latest.ratios?.ebitda_margin && previous.ratios?.ebitda_margin) {
        const marginChange = latest.ratios.ebitda_margin - previous.ratios.ebitda_margin;
        trends.margin_trend = marginChange > 1 ? 'improving' : 
                             marginChange < -1 ? 'declining' : 'stable';
      }
    }

    // Calculate 3-year CAGR if available
    if (sorted.length >= 3) {
      const latest = sorted[0];
      const threeYearsAgo = sorted[2];
      const years = 3;

      if (latest.revenue && threeYearsAgo.revenue) {
        trends.revenue_growth_3y_cagr = (Math.pow(latest.revenue / threeYearsAgo.revenue, 1 / years) - 1) * 100;
      }
      if (latest.profit_after_tax && threeYearsAgo.profit_after_tax) {
        trends.profit_growth_3y_cagr = (Math.pow(latest.profit_after_tax / threeYearsAgo.profit_after_tax, 1 / years) - 1) * 100;
      }
    }

    // Calculate 3-year averages
    const last3Years = sorted.slice(0, 3);
    if (last3Years.length > 0) {
      const revenues = last3Years.map(d => d.revenue).filter((v): v is number => v !== undefined);
      const profits = last3Years.map(d => d.profit_after_tax).filter((v): v is number => v !== undefined);
      const ebitdas = last3Years.map(d => d.ebitda).filter((v): v is number => v !== undefined);
      const margins = last3Years.map(d => d.ratios?.ebitda_margin).filter((v): v is number => v !== undefined);
      const recurringPcts = last3Years.map(d => d.revenue_breakdown?.recurring_revenue_percentage).filter((v): v is number => v !== undefined);

      if (revenues.length > 0) {
        trends.average_revenue_3y = revenues.reduce((a, b) => a + b, 0) / revenues.length;
      }
      if (profits.length > 0) {
        trends.average_profit_3y = profits.reduce((a, b) => a + b, 0) / profits.length;
      }
      if (ebitdas.length > 0) {
        trends.average_ebitda_3y = ebitdas.reduce((a, b) => a + b, 0) / ebitdas.length;
      }
      if (margins.length > 0) {
        trends.average_ebitda_margin_3y = margins.reduce((a, b) => a + b, 0) / margins.length;
      }
      if (recurringPcts.length > 0) {
        trends.average_recurring_revenue_pct_3y = recurringPcts.reduce((a, b) => a + b, 0) / recurringPcts.length;
      }
    }

    return trends;
  }

  /**
   * Extract financial data from all account documents for a company
   */
  async extractFromCompany(
    companyNumber: string,
    options: {
      force?: boolean; // Re-extract even if already extracted
      maxDocuments?: number; // Limit number of documents to process
    } = {}
  ): Promise<{ extracted: number; skipped: number; errors: number }> {
    console.log(chalk.cyan(`\nExtracting financial data for: ${companyNumber}`));
    console.log(chalk.dim('─'.repeat(60)));

    let extracted = 0;
    let skipped = 0;
    let errors = 0;

    try {
      // Read company data
      const company = await readCompany(companyNumber);
      if (!company) {
        console.log(chalk.red(`  ✗ Company ${companyNumber} not found in database`));
        return { extracted: 0, skipped: 0, errors: 1 };
      }

      // Get list of PDF documents
      const documentsDir = getCompanyDocumentsDir(companyNumber);
      if (!(await fs.pathExists(documentsDir))) {
        console.log(chalk.yellow(`  ⚠ No documents directory found`));
        return { extracted: 0, skipped: 0, errors: 0 };
      }

      const pdfFiles = await listCompanyDocuments(companyNumber);
      const accountPdfs = pdfFiles.filter(f => f.endsWith('.pdf'));

      if (accountPdfs.length === 0) {
        console.log(chalk.yellow(`  ⚠ No PDF documents found`));
        return { extracted: 0, skipped: 0, errors: 0 };
      }

      console.log(chalk.dim(`  Found ${accountPdfs.length} PDF document(s)`));

      // Initialize extracted financials if needed
      if (!company.financials.extracted) {
        company.financials.extracted = {
          annual_data: [],
          trends: {},
          latest_year: {},
        };
      }

      const existingPeriods = new Set(
        company.financials.extracted.annual_data.map(d => d.period_end)
      );

      // Limit documents if specified
      const pdfsToProcess = options.maxDocuments
        ? accountPdfs.slice(0, options.maxDocuments)
        : accountPdfs;

      // Extract from each document
      for (const pdfFile of pdfsToProcess) {
        const transactionId = path.basename(pdfFile, '.pdf');
        const filePath = path.join(documentsDir, pdfFile);

        // Check if already extracted (unless force)
        if (!options.force) {
          const existing = company.financials.extracted.annual_data.find(
            d => d.document_source === transactionId
          );
          if (existing) {
            console.log(chalk.dim(`    ○ ${transactionId}: Already extracted`));
            skipped++;
            continue;
          }
        }

        try {
          const extractedData = await this.extractFromDocument(filePath, transactionId);

          if (!extractedData) {
            errors++;
            continue;
          }

          // Check for duplicate period
          if (existingPeriods.has(extractedData.period_end) && !options.force) {
            console.log(chalk.yellow(`    ⚠ ${transactionId}: Period ${extractedData.period_end} already exists, skipping`));
            skipped++;
            continue;
          }

          // Add to annual_data
          company.financials.extracted.annual_data.push(extractedData);
          existingPeriods.add(extractedData.period_end);

          // Update metadata
          company.financials.extracted.last_extracted_at = new Date().toISOString();
          if (!company.financials.extracted.first_extracted_at) {
            company.financials.extracted.first_extracted_at = new Date().toISOString();
          }
          company.financials.extracted.total_years_available = company.financials.extracted.annual_data.length;

          extracted++;

          // Small delay to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error: any) {
          console.log(chalk.red(`    ✗ ${transactionId}: ${error.message}`));
          errors++;
        }
      }

      // Sort annual_data by period_end (most recent first)
      company.financials.extracted.annual_data.sort((a, b) => 
        new Date(b.period_end).getTime() - new Date(a.period_end).getTime()
      );

      // Calculate trends
      company.financials.extracted.trends = this.calculateTrends(company.financials.extracted.annual_data);

      // Update latest_year summary
      if (company.financials.extracted.annual_data.length > 0) {
        const latest = company.financials.extracted.annual_data[0];
        company.financials.extracted.latest_year = {
          period_end: latest.period_end,
          revenue: latest.revenue,
          profit: latest.profit_after_tax,
          ebitda: latest.ebitda,
          recurring_revenue_percentage: latest.revenue_breakdown?.recurring_revenue_percentage,
          employees: latest.employees?.average_count,
        };
      }

      // Update basic financials from latest year
      if (company.financials.extracted.latest_year?.revenue) {
        company.financials.revenue = company.financials.extracted.latest_year.revenue;
      }
      if (company.financials.extracted.latest_year?.profit) {
        company.financials.profit = company.financials.extracted.latest_year.profit;
      }
      if (company.financials.extracted.latest_year?.employees) {
        company.financials.employees = company.financials.extracted.latest_year.employees;
      }

      // Aggregate technology mentions from all years
      const allTechMentions = new Set<string>();
      company.financials.extracted.annual_data.forEach(year => {
        year.technology_costs?.mentions?.forEach(tech => allTechMentions.add(tech));
        year.strategic_insights?.technology_mentions?.forEach(tech => allTechMentions.add(tech));
      });
      if (allTechMentions.size > 0) {
        company.enrichment.tech_stack = Array.from(allTechMentions);
      }

      // Save updated company record
      await writeCompany(company);

      console.log(chalk.bold.cyan(`\n  Summary:`));
      console.log(chalk.green(`    ✓ Extracted: ${extracted}`));
      console.log(chalk.yellow(`    ○ Skipped: ${skipped}`));
      console.log(chalk.red(`    ✗ Errors: ${errors}`));
      if (company.financials.extracted.annual_data.length > 0) {
        console.log(chalk.cyan(`    📊 Total years available: ${company.financials.extracted.annual_data.length}`));
      }

      return { extracted, skipped, errors };

    } catch (error: any) {
      console.log(chalk.red(`  ✗ Error: ${error.message}`));
      return { extracted: 0, skipped: 0, errors: 1 };
    }
  }

  /**
   * Extract from multiple companies
   */
  async extractFromCompanies(
    companyNumbers: string[],
    options: {
      force?: boolean;
      maxDocuments?: number;
    } = {}
  ): Promise<void> {
    console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║        EXTRACTING FINANCIAL DATA FROM DOCUMENTS              ║'));
    console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));

    let totalExtracted = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    for (const companyNumber of companyNumbers) {
      const result = await this.extractFromCompany(companyNumber, options);
      totalExtracted += result.extracted;
      totalSkipped += result.skipped;
      totalErrors += result.errors;
    }

    console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║                      FINAL SUMMARY                          ║'));
    console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));

    console.log(chalk.green(`✓ Total Extracted: ${totalExtracted}`));
    console.log(chalk.yellow(`○ Total Skipped: ${totalSkipped}`));
    console.log(chalk.red(`✗ Total Errors: ${totalErrors}`));
    console.log('');
  }
}

// CLI entry point
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('documentExtractor')) {
  const args = process.argv.slice(2);
  const options: { force?: boolean; maxDocuments?: number; all?: boolean } = {};
  let companyNumbers: string[] = [];

  for (const arg of args) {
    if (arg === '--all') {
      options.all = true;
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg.startsWith('--max-docs=')) {
      options.maxDocuments = parseInt(arg.split('=')[1], 10);
    } else {
      companyNumbers.push(arg);
    }
  }

  if (options.all) {
    const { listAllCompanies } = await import('../utils/fileSystem.js');
    companyNumbers = await listAllCompanies();
    console.log(chalk.cyan(`Found ${companyNumbers.length} companies. Starting extraction...`));
  }

  if (companyNumbers.length === 0) {
    console.error(chalk.red('Usage: tsx src/enrichers/documentExtractor.ts <company_number> [company_number...] | --all'));
    console.error(chalk.yellow('Example: tsx src/enrichers/documentExtractor.ts 07019261 04298949'));
    console.error(chalk.yellow('Example: tsx src/enrichers/documentExtractor.ts --all'));
    console.error(chalk.yellow('Options:'));
    console.error(chalk.yellow('  --all: Extract from all companies in database'));
    console.error(chalk.yellow('  --force: Re-extract even if already extracted'));
    console.error(chalk.yellow('  --max-docs=N: Maximum number of documents per company'));
    process.exit(1);
  }

  const extractor = new DocumentExtractor();
  extractor.extractFromCompanies(companyNumbers, options).then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error(chalk.red('\n✗ Fatal error:'), error);
    process.exit(1);
  });
}

export { DocumentExtractor };

