import 'dotenv/config';
import axios, { AxiosInstance } from 'axios';
import chalk from 'chalk';
import { Company, CompanySchema } from '../schemas/CompanySchema.js';
import { writeCompany, readCompany } from '../utils/fileSystem.js';
import { objectValuesToArray, toArray } from '../utils/arrayHelpers.js';
import {
  TARGET_SIC_CODES,
  DEFAULT_PAGE_SIZE,
  RATE_LIMIT_DELAY_MS,
  DEFAULT_FILING_HISTORY_LIMIT,
  ACTIVE_COMPANY_STATUS,
} from '../config/constants.js';

/**
 * Companies House API Client
 * 
 * API Documentation: https://developer.company-information.service.gov.uk/
 * 
 * Note: Requires a Companies House API key. Set COMPANIES_HOUSE_API_KEY environment variable.
 */
export class CompaniesHouseScraper {
  private api: AxiosInstance;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.COMPANIES_HOUSE_API_KEY || '';
    
    if (!this.apiKey) {
      throw new Error(
        'COMPANIES_HOUSE_API_KEY environment variable is required.\n' +
        'Get your API key at: https://developer.company-information.service.gov.uk/'
      );
    }

    this.api = axios.create({
      baseURL: 'https://api.company-information.service.gov.uk',
      auth: {
        username: this.apiKey,
        password: '', // Companies House uses API key as username
      },
      headers: {
        'Accept': 'application/json',
      },
    });
  }

  /**
   * Advanced search for companies with filtering capabilities
   * Uses the Advanced Company Search endpoint which supports:
   * - SIC code filtering
   * - Company status filtering
   * - Date range filtering
   * - Location filtering
   * - Company name filtering
   * 
   * API Documentation: https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/reference/search/advanced-company-search
   * 
   * @param options Search options
   * @param options.sicCodes Array of SIC codes to filter by (e.g., ['62020', '62090'])
   * @param options.companyStatus Array of company statuses to filter by (e.g., ['active'])
   * @param options.companyNameIncludes Company name includes filter
   * @param options.incorporatedFrom Date filter: incorporated from (YYYY-MM-DD)
   * @param options.incorporatedTo Date filter: incorporated to (YYYY-MM-DD)
   * @param options.location Location filter
   * @param options.size Maximum number of results (1-5000, default: 100)
   * @param options.startIndex Starting index for pagination
   */
  async advancedSearchCompanies(options: {
    sicCodes?: string[];
    companyStatus?: string[];
    companyNameIncludes?: string;
    companyNameExcludes?: string;
    incorporatedFrom?: string;
    incorporatedTo?: string;
    location?: string;
    size?: number;
    startIndex?: number;
  }): Promise<{
    items: any[];
    total_results: number;
    start_index: number;
    items_per_page: number;
  }> {
    try {
      const params: Record<string, any> = {
        size: options.size || DEFAULT_PAGE_SIZE,
        start_index: options.startIndex || 0,
      };

      // Add SIC codes filter (comma-delimited format)
      if (options.sicCodes && options.sicCodes.length > 0) {
        params.sic_codes = options.sicCodes.join(',');
      }

      // Add company status filter (comma-delimited format)
      if (options.companyStatus && options.companyStatus.length > 0) {
        params.company_status = options.companyStatus.join(',');
      }

      // Add optional filters
      if (options.companyNameIncludes) {
        params.company_name_includes = options.companyNameIncludes;
      }
      if (options.companyNameExcludes) {
        params.company_name_excludes = options.companyNameExcludes;
      }
      if (options.incorporatedFrom) {
        params.incorporated_from = options.incorporatedFrom;
      }
      if (options.incorporatedTo) {
        params.incorporated_to = options.incorporatedTo;
      }
      if (options.location) {
        params.location = options.location;
      }

      const response = await this.api.get('/advanced-search/companies', {
        params,
      });

      // Transform response to match expected format
      // Note: Advanced search may return total_results at root or in a hits object
      const data = response.data;
      const items = data.items || data.hits?.items || [];
      const totalResults = data.total_results || data.hits?.total || data.hits?.total_results || 0;
      
      return {
        items,
        total_results: totalResults,
        start_index: data.start_index || 0,
        items_per_page: items.length,
      };
    } catch (error: any) {
      if (error.response) {
        throw new Error(
          `Companies House API error: ${error.response.status} - ${error.response.statusText}`
        );
      }
      throw error;
    }
  }

  /**
   * Legacy search method (kept for backward compatibility)
   * @deprecated Use advancedSearchCompanies instead
   */
  async searchCompanies(
    searchQuery: string = '*',
    itemsPerPage: number = DEFAULT_PAGE_SIZE,
    startIndex: number = 0
  ): Promise<{
    items: any[];
    total_results: number;
    start_index: number;
    items_per_page: number;
  }> {
    // Map to advanced search with company name filter
    return this.advancedSearchCompanies({
      companyNameIncludes: searchQuery !== '*' ? searchQuery : undefined,
      size: itemsPerPage,
      startIndex,
    });
  }

  /**
   * Get detailed company information
   */
  async getCompanyProfile(companyNumber: string): Promise<any> {
    try {
      const response = await this.api.get(`/company/${companyNumber}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      if (error.response) {
        throw new Error(
          `Companies House API error: ${error.response.status} - ${error.response.statusText}`
        );
      }
      throw error;
    }
  }

  /**
   * Get company officers (directors, secretaries)
   */
  async getCompanyOfficers(companyNumber: string): Promise<any> {
    try {
      const response = await this.api.get(`/company/${companyNumber}/officers`);
      return response.data;
    } catch (error: any) {
      // Officers are optional, don't fail if unavailable
      return null;
    }
  }

  /**
   * Get persons with significant control
   */
  async getCompanyPSCs(companyNumber: string): Promise<any> {
    try {
      const response = await this.api.get(`/company/${companyNumber}/persons-with-significant-control`);
      return response.data;
    } catch (error: any) {
      // PSCs are optional, don't fail if unavailable
      return null;
    }
  }

  /**
   * Get company charges/mortgages
   */
  async getCompanyCharges(companyNumber: string): Promise<any> {
    try {
      const response = await this.api.get(`/company/${companyNumber}/charges`);
      return response.data;
    } catch (error: any) {
      // Charges are optional, don't fail if unavailable
      return null;
    }
  }

  /**
   * Get company insolvency information
   */
  async getCompanyInsolvency(companyNumber: string): Promise<any> {
    try {
      const response = await this.api.get(`/company/${companyNumber}/insolvency`);
      return response.data;
    } catch (error: any) {
      // Insolvency is optional, don't fail if unavailable
      return null;
    }
  }

  /**
   * Get company filing history
   */
  async getCompanyFilingHistory(companyNumber: string, itemsPerPage: number = 25): Promise<any> {
    try {
      const response = await this.api.get(`/company/${companyNumber}/filing-history`, {
        params: {
          items_per_page: itemsPerPage,
        },
      });
      return response.data;
    } catch (error: any) {
      // Filing history is optional, don't fail if unavailable
      return null;
    }
  }

  /**
   * Get document metadata for a specific filing history transaction
   * This includes the document download link
   * @param companyNumber Company number
   * @param transactionId Transaction ID from filing history
   * @returns Document metadata or null if not available
   */
  async getFilingHistoryDocumentMetadata(companyNumber: string, transactionId: string): Promise<any> {
    try {
      const response = await this.api.get(`/company/${companyNumber}/filing-history/${transactionId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Download a document from filing history
   * First gets metadata to find the document link, then downloads it
   * @param companyNumber Company number
   * @param transactionId Transaction ID from filing history
   * @returns Document buffer or null if not available
   */
  async downloadFilingHistoryDocument(companyNumber: string, transactionId: string): Promise<Buffer | null> {
    try {
      // First get the filing history item metadata to find the document link
      const metadata = await this.getFilingHistoryDocumentMetadata(companyNumber, transactionId);
      if (!metadata || !metadata.links) {
        return null;
      }

      // Try different possible link formats
      let documentUrl: string | undefined;

      // Check for document_metadata link (newer API format)
      if (metadata.links.document_metadata) {
        // Extract document ID from the metadata URL or use it directly
        documentUrl = metadata.links.document_metadata;
        // If it's a metadata URL, we need to append /content or use the document_download link
        if (documentUrl.includes('/document/') && !documentUrl.endsWith('/content')) {
          // Try to get document_download link if available
          if (metadata.links.document_download) {
            documentUrl = metadata.links.document_download;
          } else {
            // Append /content to metadata URL
            documentUrl = documentUrl + '/content';
          }
        }
      } else if (metadata.links.document_download) {
        // Direct download link
        documentUrl = metadata.links.document_download;
      } else {
        // Fallback: try the standard endpoint
        documentUrl = `/company/${companyNumber}/filing-history/${transactionId}/document`;
      }

      // Download the document
      // If it's a full URL, use axios directly; if relative, use our API instance
      if (documentUrl.startsWith('http')) {
        const response = await axios.get(documentUrl, {
          responseType: 'arraybuffer',
          auth: {
            username: this.apiKey,
            password: '',
          },
        });
        return Buffer.from(response.data);
      } else {
        const response = await this.api.get(documentUrl, {
          responseType: 'arraybuffer',
        });
        return Buffer.from(response.data);
      }
    } catch (error: any) {
      if (error.response?.status === 404 || error.response?.status === 403) {
        // Document not available or access denied
        return null;
      }
      throw error;
    }
  }

  /**
   * Transform Companies House API response to our Company schema
   * Now includes all available API data
   */
  transformToCompany(
    apiData: any,
    officersData?: any,
    pscsData?: any,
    chargesData?: any,
    insolvencyData?: any,
    filingHistoryData?: any
  ): Partial<Company> {
    // Format date from Companies House format (YYYY-MM-DD)
    let incorporationDate = '';
    if (apiData.date_of_creation) {
      const date = new Date(apiData.date_of_creation);
      incorporationDate = date.toISOString().split('T')[0];
    }

    let cessationDate = '';
    if (apiData.date_of_cessation) {
      const date = new Date(apiData.date_of_cessation);
      cessationDate = date.toISOString().split('T')[0];
    }

    // Extract SIC codes - handle both array and object formats using utility
    const sicCodes = objectValuesToArray<string>(apiData.sic_codes);

    // Format registered address (both string and structured)
    let registeredAddress = '';
    if (apiData.registered_office_address) {
      const addr = apiData.registered_office_address;
      const parts = [
        addr.address_line_1,
        addr.address_line_2,
        addr.locality,
        addr.region,
        addr.postal_code,
        addr.country,
      ].filter(Boolean);
      registeredAddress = parts.join(', ');
    }

    // Transform accounts information
    // Convert day/month to numbers if they're strings
    const accountsInfo = apiData.accounts ? {
      next_accounts_due_on: apiData.accounts.next_accounts?.due_on,
      next_accounts_period_end_on: apiData.accounts.next_accounts?.period_end_on,
      next_accounts_period_start_on: apiData.accounts.next_accounts?.period_start_on,
      next_accounts_overdue: apiData.accounts.next_accounts?.overdue,
      last_accounts_made_up_to: apiData.accounts.last_accounts?.made_up_to,
      last_accounts_type: apiData.accounts.last_accounts?.type,
      accounting_reference_date_day: apiData.accounts.accounting_reference_date?.day 
        ? (typeof apiData.accounts.accounting_reference_date.day === 'string' 
           ? parseInt(apiData.accounts.accounting_reference_date.day, 10) 
           : apiData.accounts.accounting_reference_date.day)
        : undefined,
      accounting_reference_date_month: apiData.accounts.accounting_reference_date?.month
        ? (typeof apiData.accounts.accounting_reference_date.month === 'string'
           ? parseInt(apiData.accounts.accounting_reference_date.month, 10)
           : apiData.accounts.accounting_reference_date.month)
        : undefined,
    } : undefined;

    // Transform confirmation statement
    const confirmationStatement = apiData.confirmation_statement ? {
      next_due: apiData.confirmation_statement.next_due,
      last_made_up_to: apiData.confirmation_statement.last_made_up_to,
      next_made_up_to: apiData.confirmation_statement.next_made_up_to,
    } : undefined;

    // Transform officers - ensure items is always an array
    const officers = officersData ? {
      directors: toArray(officersData.items).filter((o: any) => 
        o.officer_role === 'director' || o.officer_role?.toLowerCase().includes('director')
      ).map((o: any) => ({
        name: o.name || '',
        officer_role: o.officer_role,
        appointed_on: o.appointed_on,
        resigned_on: o.resigned_on,
        date_of_birth_month: o.date_of_birth?.month,
        date_of_birth_year: o.date_of_birth?.year,
        nationality: o.nationality,
        occupation: o.occupation,
        country_of_residence: o.country_of_residence,
        address: o.address,
      })),
      secretaries: toArray(officersData.items).filter((o: any) => 
        o.officer_role === 'secretary' || o.officer_role?.toLowerCase().includes('secretary')
      ).map((o: any) => ({
        name: o.name || '',
        officer_role: o.officer_role,
        appointed_on: o.appointed_on,
        resigned_on: o.resigned_on,
        date_of_birth_month: o.date_of_birth?.month,
        date_of_birth_year: o.date_of_birth?.year,
        nationality: o.nationality,
        occupation: o.occupation,
        country_of_residence: o.country_of_residence,
        address: o.address,
      })),
      total_count: officersData.total_count,
    } : undefined;

    // Transform PSCs - ensure items is always an array and natures_of_control is array
    const pscs = pscsData?.items ? {
      persons_with_significant_control: toArray(pscsData.items).map((psc: any) => ({
        name: psc.name,
        kind: psc.kind,
        natures_of_control: toArray(psc.natures_of_control),
        notified_on: psc.notified_on,
        ceased_on: psc.ceased_on,
        date_of_birth_month: psc.date_of_birth?.month,
        date_of_birth_year: psc.date_of_birth?.year,
        nationality: psc.nationality,
        country_of_residence: psc.country_of_residence,
        address: psc.address,
        identification: psc.identification,
      })),
      total_count: pscsData.total_count,
    } : undefined;

    // Transform charges - ensure items is always an array
    const chargesItems = toArray(chargesData?.items);
    const charges = chargesData?.items ? {
      charges: chargesItems.map((charge: any) => ({
        charge_code: charge.charge_code,
        charge_number: charge.charge_number,
        classification: toArray(charge.classification),
        created_on: charge.created_on,
        delivered_on: charge.delivered_on,
        particulars: charge.particulars,
        persons_entitled: toArray(charge.persons_entitled),
        satisfied_on: charge.satisfied_on,
        // secured_details can be string or object - keep as-is (schema allows both)
        secured_details: charge.secured_details,
        status: charge.status,
      })),
      total_count: chargesData.total_count,
      unsatisfied_count: chargesItems.filter((c: any) => c.status === 'outstanding').length,
      satisfied_count: chargesItems.filter((c: any) => c.status === 'satisfied').length,
      part_satisfied_count: chargesItems.filter((c: any) => c.status === 'part-satisfied').length,
    } : undefined;

    // Transform insolvency - ensure cases is always an array
    const insolvencyCases = toArray(insolvencyData?.cases);
    const insolvency = insolvencyData?.cases ? {
      cases: insolvencyCases.map((case_: any) => ({
        case_number: case_.case_number,
        case_type: case_.case_type,
        dates: toArray(case_.dates),
        notes: toArray(case_.notes),
        practitioners: toArray(case_.practitioners),
      })),
      has_insolvency_history: apiData.has_insolvency_history || (insolvencyCases.length > 0),
    } : apiData.has_insolvency_history ? {
      cases: [],
      has_insolvency_history: true,
    } : undefined;

    // Transform filing history - ensure items is always an array
    const filingHistoryItems = toArray(filingHistoryData?.items);
    const filingHistory = filingHistoryData?.items ? {
      filing_history: filingHistoryItems.slice(0, DEFAULT_FILING_HISTORY_LIMIT).map((filing: any) => ({
        category: filing.category,
        date: filing.date,
        description: filing.description,
        type: filing.type,
        pages: filing.pages,
        barcode: filing.barcode,
        transaction_id: filing.transaction_id,
      })),
      total_count: filingHistoryData.total_count,
      recent_filings_count: filingHistoryItems.filter((f: any) => {
        if (!f.date) return false;
        const filingDate = new Date(f.date);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        return filingDate >= oneYearAgo;
      }).length,
    } : undefined;

    // Transform previous company names - handle both array and object formats
    const previousNamesArray = objectValuesToArray(apiData.previous_company_names);
    const previousNames = previousNamesArray.map((prev: any) => ({
      name: prev?.name || '',
      ceased_on: prev?.ceased_on,
      effective_from: prev?.effective_from,
    }));

    return {
      company_name: apiData.company_name || '',
      company_number: apiData.company_number || '',
      company_status: apiData.company_status || 'unknown',
      company_status_detail: apiData.company_status_detail,
      company_type: apiData.type || apiData.company_type || '',
      date_of_incorporation: incorporationDate,
      date_of_cessation: cessationDate || undefined,
      jurisdiction: apiData.jurisdiction,
      country_of_origin: apiData.country_of_origin,
      registered_address: registeredAddress,
      registered_address_structured: apiData.registered_office_address || undefined,
      sic_codes: sicCodes,
      previous_company_names: previousNames,
      has_been_liquidated: apiData.has_been_liquidated,
      has_insolvency_history: apiData.has_insolvency_history,
      has_charges: apiData.has_charges,
      has_super_secure_pscs: apiData.has_super_secure_pscs,
      accounts: accountsInfo,
      confirmation_statement: confirmationStatement,
      officers: officers,
      persons_with_significant_control: pscs,
      charges: charges,
      insolvency: insolvency,
      filing_history: filingHistory,
      financials: {},
      enrichment: {
        enrichment_status: 'pending',
      },
    };
  }

  /**
   * Check if company has target SIC codes (62020 or 62090)
   * Handles various formats: "62020", "62020 - Description", etc.
   */
  hasTargetSicCodes(sicCodes: string[]): boolean {
    return sicCodes.some(code => {
      // Extract numeric part (handles "62020" or "62020 - Description" formats)
      const numericCode = code.split(' ')[0].trim();
      return TARGET_SIC_CODES.includes(numericCode as typeof TARGET_SIC_CODES[number]) || 
             code.startsWith('62020') || 
             code.startsWith('62090');
    });
  }

  /**
   * Scrape companies with target SIC codes using Advanced Search
   * 
   * Now uses the Advanced Company Search endpoint which supports:
   * - Direct SIC code filtering (no need for keyword searches)
   * - Direct company status filtering (active only)
   * - More efficient API usage (fewer unnecessary API calls)
   * 
   * API Documentation: https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/reference/search/advanced-company-search
   * 
   * @param sicCodes Array of SIC codes to filter for (default: ['62020', '62090'])
   * @param maxCompanies Maximum number of companies to scrape (0 = unlimited)
   * @param companyNameIncludes Optional company name filter (e.g., 'MSP', 'managed services')
   * @param incorporatedFrom Optional: Filter companies incorporated from this date (YYYY-MM-DD)
   * @param incorporatedTo Optional: Filter companies incorporated to this date (YYYY-MM-DD)
   */
  async scrapeCompanies(
    sicCodes: string[] = [...TARGET_SIC_CODES],
    maxCompanies: number = 0,
    companyNameIncludes?: string,
    incorporatedFrom?: string,
    incorporatedTo?: string
  ): Promise<{ scraped: number; skipped: number; errors: number }> {
    console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║     COMPANIES HOUSE SCRAPER - ADVANCED SEARCH               ║'));
    console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));

    console.log(chalk.yellow(`Target SIC Codes: ${sicCodes.join(', ')}`));
    console.log(chalk.yellow(`Filter: Active companies only (via API)`));
    if (companyNameIncludes) {
      console.log(chalk.yellow(`Name Filter: "${companyNameIncludes}"`));
    }
    if (incorporatedFrom || incorporatedTo) {
      console.log(chalk.yellow(`Date Range: ${incorporatedFrom || 'any'} to ${incorporatedTo || 'any'}`));
    }
    console.log('');

    let totalScraped = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const seenCompanyNumbers = new Set<string>();
    const skipReasons: { [key: string]: number } = {
      'duplicate': 0,
      'not_active': 0,
      'wrong_sic_code': 0,
      'missing_fields': 0,
      'validation_failed': 0,
    };

    // Use Advanced Search with SIC code and status filters
    let startIndex = 0;
    const itemsPerPage = DEFAULT_PAGE_SIZE; // Max per page for advanced search
    let hasMore = true;
    let pageCount = 0;

    while (hasMore && (maxCompanies === 0 || totalScraped < maxCompanies)) {
      try {
        const searchResults = await this.advancedSearchCompanies({
          sicCodes,
          companyStatus: [ACTIVE_COMPANY_STATUS], // Filter active companies directly in API
          companyNameIncludes,
          incorporatedFrom,
          incorporatedTo,
          size: itemsPerPage,
          startIndex,
        });
        pageCount++;

        if (searchResults.items.length === 0) {
          hasMore = false;
          break;
        }

        console.log(
          chalk.cyan(
            `  Page ${pageCount}: Found ${searchResults.items.length} results ` +
            `(Total: ${searchResults.total_results})`
          )
        );

        // Process each company
        for (const companyResult of searchResults.items) {
          // Check if we've hit the limit
          if (maxCompanies > 0 && totalScraped >= maxCompanies) {
            hasMore = false;
            break;
          }

          const companyNumber = companyResult.company_number;

          // Skip if we've already processed this company
          if (seenCompanyNumbers.has(companyNumber)) {
            skipReasons['duplicate']++;
            continue;
          }
          seenCompanyNumbers.add(companyNumber);

          // Status is already filtered by API, but double-check for safety
          if (companyResult.company_status !== ACTIVE_COMPANY_STATUS) {
            totalSkipped++;
            skipReasons['not_active']++;
            continue;
          }

          try {
            // Get full company profile (SIC codes already filtered by API, but verify)
            const companyProfile = await this.getCompanyProfile(companyNumber);

            if (!companyProfile) {
              console.log(chalk.red(`  ✗ ${companyNumber}: Not found`));
              totalErrors++;
              continue;
            }

            // Double-check status from full profile
            if (companyProfile.company_status !== ACTIVE_COMPANY_STATUS) {
              totalSkipped++;
              skipReasons['not_active']++;
              continue;
            }

            // Verify SIC codes (API should have filtered, but verify for safety)
            const companySicCodes = objectValuesToArray<string>(companyProfile.sic_codes);
            
            // Verify SIC codes match (should already be filtered by API)
            if (!this.hasTargetSicCodes(companySicCodes)) {
              totalSkipped++;
              skipReasons['wrong_sic_code']++;
              const sicCodesStr = companySicCodes.length > 0 
                ? companySicCodes.join(', ') 
                : 'none';
              console.log(chalk.dim(`    ⚠ ${companyNumber}: Wrong SIC codes - ${sicCodesStr}`));
              continue;
            }

            // Fetch additional data in parallel (with error handling)
            console.log(chalk.dim(`    Fetching additional data for ${companyNumber}...`));
            
            const [officersData, pscsData, chargesData, insolvencyData, filingHistoryData] = await Promise.allSettled([
              this.getCompanyOfficers(companyNumber),
              this.getCompanyPSCs(companyNumber),
              this.getCompanyCharges(companyNumber),
              this.getCompanyInsolvency(companyNumber),
              this.getCompanyFilingHistory(companyNumber, DEFAULT_FILING_HISTORY_LIMIT),
            ]);

            // Extract data from settled promises
            const officers = officersData.status === 'fulfilled' ? officersData.value : null;
            const pscs = pscsData.status === 'fulfilled' ? pscsData.value : null;
            const charges = chargesData.status === 'fulfilled' ? chargesData.value : null;
            const insolvency = insolvencyData.status === 'fulfilled' ? insolvencyData.value : null;
            const filingHistory = filingHistoryData.status === 'fulfilled' ? filingHistoryData.value : null;

            // Transform to our schema with all data
            const companyData = this.transformToCompany(
              companyProfile,
              officers,
              pscs,
              charges,
              insolvency,
              filingHistory
            );

            // Validate required fields
            if (!companyData.company_name || !companyData.company_number || !companyData.date_of_incorporation) {
              console.log(chalk.yellow(`  ⚠ ${companyNumber}: Missing required fields`));
              totalSkipped++;
              skipReasons['missing_fields']++;
              continue;
            }

            // Validate against schema
            const validationResult = CompanySchema.safeParse(companyData);
            if (!validationResult.success) {
              const firstError = validationResult.error.errors[0];
              const errorPath = firstError?.path?.join('.') || 'unknown';
              const errorMessage = firstError?.message || 'Schema error';
              console.log(chalk.yellow(`  ⚠ ${companyNumber}: Validation failed at "${errorPath}" - ${errorMessage}`));
              totalSkipped++;
              skipReasons['validation_failed']++;
              continue;
            }

            // Check if company already exists
            const existing = await readCompany(companyNumber);
            if (existing) {
              // Update existing record with latest data (preserve enrichment)
              const updated: Company = {
                ...existing,
                ...validationResult.data,
                enrichment: existing.enrichment, // Preserve enrichment data
                version: existing.version,
              };
              await writeCompany(updated);
              console.log(chalk.green(`  ↻ ${companyNumber}: ${companyData.company_name} (updated)`));
            } else {
              // Create new record
              await writeCompany(validationResult.data);
              console.log(chalk.green(`  ✓ ${companyNumber}: ${companyData.company_name}`));
            }

            totalScraped++;

            // Rate limiting: Companies House allows 600 requests per 5 minutes
            // Rate limiting delay
            await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY_MS));

          } catch (error: any) {
            console.log(chalk.red(`  ✗ ${companyNumber}: ${error.message}`));
            totalErrors++;
          }
        }

        // Check if there are more results
        if (startIndex + itemsPerPage >= searchResults.total_results) {
          hasMore = false;
        } else {
          startIndex += itemsPerPage;
        }

      } catch (error: any) {
        console.log(chalk.red(`  ✗ Error in advanced search: ${error.message}`));
        totalErrors++;
        hasMore = false;
      }
    }

    // Summary
    console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║                      SCRAPING SUMMARY                      ║'));
    console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));

    console.log(chalk.green(`✓ Scraped:  ${totalScraped} companies`));
    console.log(chalk.yellow(`○ Skipped:  ${totalSkipped} companies`));
    console.log(chalk.red(`✗ Errors:   ${totalErrors} companies\n`));

    // Skip reasons breakdown
    if (totalSkipped > 0) {
      console.log(chalk.bold.white('┌─ SKIP REASONS BREAKDOWN ───────────────────────────────────┐'));
      console.log(chalk.white('│'));
      if (skipReasons['not_active'] > 0) {
        console.log(chalk.white(`│  Not Active:           ${skipReasons['not_active'].toString().padStart(6)}`));
      }
      if (skipReasons['wrong_sic_code'] > 0) {
        console.log(chalk.white(`│  Wrong SIC Code:       ${skipReasons['wrong_sic_code'].toString().padStart(6)}`));
      }
      if (skipReasons['missing_fields'] > 0) {
        console.log(chalk.white(`│  Missing Fields:      ${skipReasons['missing_fields'].toString().padStart(6)}`));
      }
      if (skipReasons['validation_failed'] > 0) {
        console.log(chalk.white(`│  Validation Failed:   ${skipReasons['validation_failed'].toString().padStart(6)}`));
      }
      if (skipReasons['duplicate'] > 0) {
        console.log(chalk.white(`│  Duplicate:           ${skipReasons['duplicate'].toString().padStart(6)}`));
      }
      console.log(chalk.white('│'));
      console.log(chalk.white('└──────────────────────────────────────────────────────────────┘'));
      console.log('');
    }

    return {
      scraped: totalScraped,
      skipped: totalSkipped,
      errors: totalErrors,
    };
  }
}

/**
 * Main scraper function
 */
export async function scrapeCompaniesHouse(
  sicCodes: string[] = [...TARGET_SIC_CODES],
  maxCompanies: number = 0,
  companyNameIncludes?: string,
  incorporatedFrom?: string,
  incorporatedTo?: string
): Promise<void> {
  try {
    const scraper = new CompaniesHouseScraper();
    await scraper.scrapeCompanies(sicCodes, maxCompanies, companyNameIncludes, incorporatedFrom, incorporatedTo);
  } catch (error: any) {
    console.error(chalk.red('\n✗ Scraper error:'), error.message);
    process.exit(1);
  }
}

// CLI entry point
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('companiesHouse')) {
  const sicCodes = process.argv[2] 
    ? process.argv[2].split(',').map(s => s.trim())
    : [...TARGET_SIC_CODES];
  
  const maxCompanies = process.argv[3] 
    ? parseInt(process.argv[3], 10)
    : 0;

  const companyNameIncludes = process.argv[4] || undefined;
  const incorporatedFrom = process.argv[5] || undefined;
  const incorporatedTo = process.argv[6] || undefined;

  scrapeCompaniesHouse(sicCodes, maxCompanies, companyNameIncludes, incorporatedFrom, incorporatedTo);
}

