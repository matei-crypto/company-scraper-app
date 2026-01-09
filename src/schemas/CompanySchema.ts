import { z } from 'zod';
import {
  MILLISECONDS_PER_YEAR,
  MIN_EBITDA,
  MAX_EBITDA,
  MIN_REVENUE,
  MAX_REVENUE,
  MIN_EMPLOYEES,
  MAX_EMPLOYEES,
  TARGET_SIC_CODES,
} from '../config/constants.js';
import { calculateYearsActive } from '../utils/dateHelpers.js';
import { getDistanceFromLondon, calculateLocationScore } from '../utils/geocoding.js';

/**
 * Address schema for structured addresses
 */
const AddressSchema = z.object({
  address_line_1: z.string().optional(),
  address_line_2: z.string().optional(),
  care_of: z.string().optional(),
  country: z.string().optional(),
  locality: z.string().optional(),
  po_box: z.string().optional(),
  postal_code: z.string().optional(),
  premises: z.string().optional(),
  region: z.string().optional(),
});

/**
 * Single Year Financial Data
 * Represents one accounting period (typically one year)
 * Extracted from account documents using LLM vision
 */
export const AnnualFinancialDataSchema = z.object({
  // Period Information
  period_start: z.string(), // YYYY-MM-DD - Start of accounting period
  period_end: z.string(),   // YYYY-MM-DD - End of accounting period
  period_duration_months: z.number().optional(), // Usually 12, but can vary
  accounting_reference_date: z.string().optional(), // YYYY-MM-DD
  
  // P&L Data
  revenue: z.number().nullish(),
  cost_of_sales: z.number().nullish(),
  gross_profit: z.number().nullish(),
  operating_expenses: z.object({
    staff_costs: z.number().nullish(),
    rent_premises: z.number().nullish(),
    it_software: z.number().nullish(),
    marketing: z.number().nullish(),
    professional_fees: z.number().nullish(),
    depreciation: z.number().nullish(),
    amortization: z.number().nullish(),
    other: z.number().nullish(),
    total: z.number().nullish(),
  }).optional(),
  operating_profit: z.number().nullish(),
  ebitda: z.number().nullish(), // Calculated or stated
  profit_before_tax: z.number().nullish(),
  tax: z.number().nullish(),
  profit_after_tax: z.number().nullish(),
  
  // Balance Sheet Data
  total_assets: z.number().nullish(),
  current_assets: z.number().nullish(),
  fixed_assets: z.number().nullish(),
  total_liabilities: z.number().nullish(),
  current_liabilities: z.number().nullish(),
  long_term_liabilities: z.number().nullish(),
  net_assets: z.number().nullish(),
  shareholders_equity: z.number().nullish(),

  // Cash Flow Data
  operating_cash_flow: z.number().nullish(),
  investing_cash_flow: z.number().nullish(),
  financing_cash_flow: z.number().nullish(),
  net_cash_flow: z.number().nullish(),
  
  // Revenue Breakdown (CRITICAL for thesis)
  revenue_breakdown: z.object({
    recurring_revenue: z.number().nullish(),
    recurring_revenue_percentage: z.number().nullish(), // % of total
    one_time_revenue: z.number().nullish(),
    service_revenue: z.object({
      managed_services: z.number().nullish(),
      cloud_services: z.number().nullish(),
      software_licensing: z.number().nullish(),
      professional_services: z.number().nullish(),
      hardware_sales: z.number().nullish(),
      other: z.number().nullish(),
    }).optional(),
  }).optional(),
  
  // Client Data
  client_data: z.object({
    total_clients: z.number().nullish(),
    top_client_revenue_percentage: z.number().nullish(),
    top_3_clients_revenue_percentage: z.number().nullish(),
    top_10_clients_revenue_percentage: z.number().nullish(),
    average_revenue_per_client: z.number().nullish(),
  }).optional(),

  // Employee Data
  employees: z.object({
    average_count: z.number().nullish(),
    total_costs: z.number().nullish(),
    average_cost_per_employee: z.number().nullish(),
    breakdown: z.object({
      technical: z.number().nullish(),
      sales_marketing: z.number().nullish(),
      administrative: z.number().nullish(),
      management: z.number().nullish(),
    }).optional(),
  }).optional(),

  // Technology Indicators
  technology_costs: z.object({
    it_software_total: z.number().nullish(),
    cloud_services: z.number().nullish(),
    software_licenses: z.number().nullish(),
    hardware: z.number().nullish(),
    mentions: z.array(z.string()).optional(), // Technology mentions
  }).optional(),
  
  // Financial Ratios (calculated for this year)
  ratios: z.object({
    gross_margin: z.number().nullish(),
    operating_margin: z.number().nullish(),
    net_margin: z.number().nullish(),
    ebitda_margin: z.number().nullish(),
    current_ratio: z.number().nullish(),
    quick_ratio: z.number().nullish(),
    debt_to_equity: z.number().nullish(),
  }).optional(),
  
  // Directors' Report Insights (year-specific)
  strategic_insights: z.object({
    business_description: z.string().nullish(),
    market_position: z.string().nullish(),
    key_contracts: z.array(z.string()).optional(),
    technology_mentions: z.array(z.string()).optional(),
    future_plans: z.string().nullish(),
    risks_challenges: z.array(z.string()).optional(),
  }).optional(),
  
  // Commitments (as of period end)
  commitments: z.object({
    operating_leases: z.number().nullish(),
    capital_commitments: z.number().nullish(),
    loan_commitments: z.number().nullish(),
    pension_commitments: z.number().nullish(),
  }).optional(),
  
  // Metadata
  extracted_at: z.string().optional(), // ISO timestamp
  extraction_method: z.string().optional(), // "llm_vision", etc.
  document_source: z.string().optional(), // Transaction ID of source document
  confidence_score: z.number().optional(), // 0-1 confidence in extraction
});

/**
 * Extracted Financials - Multi-Year Trend Data
 * Stores financial data for each accounting period separately
 * Enables trend analysis and year-over-year comparisons
 */
export const ExtractedFinancialsSchema = z.object({
  // Array of annual financial data, ordered by period_end (most recent first)
  annual_data: z.array(AnnualFinancialDataSchema).default([]),
  
  // Computed trend metrics (derived from annual_data)
  trends: z.object({
    // Growth rates (calculated from annual_data)
    revenue_growth_1y: z.number().optional(), // % change vs previous year
    revenue_growth_3y_cagr: z.number().optional(), // 3-year CAGR if available
    profit_growth_1y: z.number().optional(),
    profit_growth_3y_cagr: z.number().optional(),
    ebitda_growth_1y: z.number().optional(),
    employee_growth_1y: z.number().optional(),
    
    // Trend direction indicators
    revenue_trend: z.enum(['growing', 'stable', 'declining']).optional(),
    profit_trend: z.enum(['growing', 'stable', 'declining']).optional(),
    margin_trend: z.enum(['improving', 'stable', 'declining']).optional(),
    
    // Multi-year averages (for comparison)
    average_revenue_3y: z.number().optional(),
    average_profit_3y: z.number().optional(),
    average_ebitda_3y: z.number().optional(),
    average_ebitda_margin_3y: z.number().optional(),
    average_recurring_revenue_pct_3y: z.number().optional(),
  }).optional(),
  
  // Latest year summary (for quick access)
  latest_year: z.object({
    period_end: z.string().optional(),
    revenue: z.number().optional(),
    profit: z.number().optional(),
    ebitda: z.number().optional(),
    recurring_revenue_percentage: z.number().optional(),
    employees: z.number().optional(),
  }).optional(),
  
  // Metadata
  first_extracted_at: z.string().optional(), // ISO timestamp of first extraction
  last_extracted_at: z.string().optional(), // ISO timestamp of most recent extraction
  total_years_available: z.number().optional(), // Count of annual_data entries
});

/**
 * Financial data schema for company financials
 */
const FinancialsSchema = z.object({
  latest_accounts_date: z.string().optional(),
  latest_accounts_type: z.string().optional(),
  revenue: z.number().optional(),
  profit: z.number().optional(),
  ebitda: z.number().optional(), // EBITDA from external sources (e.g., CSV)
  assets: z.number().optional(),
  liabilities: z.number().optional(),
  employees: z.number().optional(),
  // Extracted financials from account documents (multi-year trend data)
  extracted: ExtractedFinancialsSchema.optional(),
});

/**
 * Accounts information from Companies House
 */
const AccountsInfoSchema = z.object({
  next_accounts_due_on: z.string().optional(),
  next_accounts_period_end_on: z.string().optional(),
  next_accounts_period_start_on: z.string().optional(),
  next_accounts_overdue: z.boolean().optional(),
  last_accounts_made_up_to: z.string().optional(),
  last_accounts_type: z.string().optional(),
  accounting_reference_date_day: z.number().optional(),
  accounting_reference_date_month: z.number().optional(),
});

/**
 * Confirmation statement information
 */
const ConfirmationStatementSchema = z.object({
  next_due: z.string().optional(),
  last_made_up_to: z.string().optional(),
  next_made_up_to: z.string().optional(),
});

/**
 * Officer schema (directors, secretaries)
 */
const OfficerSchema = z.object({
  name: z.string(),
  officer_role: z.string().optional(),
  appointed_on: z.string().optional(),
  resigned_on: z.string().optional(),
  date_of_birth_month: z.number().optional(),
  date_of_birth_year: z.number().optional(),
  nationality: z.string().optional(),
  occupation: z.string().optional(),
  country_of_residence: z.string().optional(),
  address: AddressSchema.optional(),
});

/**
 * Officers data
 */
const OfficersSchema = z.object({
  directors: z.array(OfficerSchema).default([]),
  secretaries: z.array(OfficerSchema).default([]),
  total_count: z.number().optional(),
});

/**
 * Person with Significant Control schema
 */
const PSCSchema = z.object({
  name: z.string().optional(),
  kind: z.string().optional(), // individual, corporate-entity, etc.
  natures_of_control: z.array(z.string()).optional(),
  notified_on: z.string().optional(),
  ceased_on: z.string().optional(),
  date_of_birth_month: z.number().optional(),
  date_of_birth_year: z.number().optional(),
  nationality: z.string().optional(),
  country_of_residence: z.string().optional(),
  address: AddressSchema.optional(),
  identification: z.any().optional(),
});

/**
 * Persons with Significant Control data
 */
const PSCsSchema = z.object({
  persons_with_significant_control: z.array(PSCSchema).default([]),
  total_count: z.number().optional(),
});

/**
 * Charge/Mortgage schema
 */
const ChargeSchema = z.object({
  charge_code: z.string().optional(),
  charge_number: z.number().optional(),
  classification: z.array(z.any()).optional(),
  created_on: z.string().optional(),
  delivered_on: z.string().optional(),
  particulars: z.any().optional(),
  persons_entitled: z.array(z.any()).optional(),
  satisfied_on: z.string().optional(),
  secured_details: z.union([z.string(), z.any()]).optional(), // Can be string or object
  status: z.string().optional(),
});

/**
 * Charges data
 */
const ChargesSchema = z.object({
  charges: z.array(ChargeSchema).default([]),
  total_count: z.number().optional(),
  unsatisfied_count: z.number().optional(),
  satisfied_count: z.number().optional(),
  part_satisfied_count: z.number().optional(),
});

/**
 * Insolvency case schema
 */
const InsolvencyCaseSchema = z.object({
  case_number: z.string().optional(),
  case_type: z.string().optional(),
  dates: z.array(z.any()).optional(),
  notes: z.array(z.string()).optional(),
  practitioners: z.array(z.any()).optional(),
});

/**
 * Insolvency data
 */
const InsolvencySchema = z.object({
  cases: z.array(InsolvencyCaseSchema).default([]),
  has_insolvency_history: z.boolean().optional(),
});

/**
 * Filing history item schema
 */
const FilingHistoryItemSchema = z.object({
  category: z.string().optional(),
  date: z.string().optional(),
  description: z.string().optional(),
  type: z.string().optional(),
  pages: z.number().optional(),
  barcode: z.string().optional(),
  transaction_id: z.string().optional(),
  document_downloaded: z.boolean().optional(), // Track if document has been downloaded
  document_path: z.string().optional(), // Path to stored document
  document_downloaded_at: z.string().optional(), // When document was downloaded
});

/**
 * Filing history summary
 */
const FilingHistorySchema = z.object({
  filing_history: z.array(FilingHistoryItemSchema).default([]),
  total_count: z.number().optional(),
  recent_filings_count: z.number().optional(), // Last 12 months
});

/**
 * Previous company name schema
 */
const PreviousNameSchema = z.object({
  name: z.string(),
  ceased_on: z.string().optional(),
  effective_from: z.string().optional(),
});

/**
 * Enrichment data schema for external signals
 */
const EnrichmentSchema = z.object({
  website: z.string().url().optional(),
  linkedin_url: z.string().url().optional(),
  headcount: z.number().optional(),
  tech_stack: z.array(z.string()).optional(),
  funding_stage: z.string().optional(),
  last_funding_amount: z.number().optional(),
  last_funding_date: z.string().optional(),
  // Website analysis keywords
  business_keywords: z.array(z.string()).optional(), // Keywords describing nature of business
  services: z.array(z.string()).optional(), // Services provided
  customer_segments: z.array(z.string()).optional(), // Target customer types/segments
  business_description: z.string().optional(), // Brief description of business nature
  website_analyzed_at: z.string().optional(), // When website was analyzed
  // MSP Likelihood Analysis (computed from enrichment data)
  msp_likelihood_score: z.number().min(0).max(100).optional(), // 0-100 score
  msp_likelihood_confidence: z.enum(['high', 'medium', 'low']).optional(),
  msp_likelihood_computed_at: z.string().optional(), // When score was computed
  enrichment_status: z.enum(['pending', 'completed', 'failed']).default('pending'),
  enrichment_errors: z.array(z.string()).optional(),
  enriched_at: z.string().optional(),
});

/**
 * Company Schema - The Source of Truth
 * All company records must conform to this schema
 */
export const CompanySchema = z.object({
  // Core Companies House data
  company_name: z.string().min(1, 'Company name is required'),
  company_number: z.string().regex(/^(SC)?[0-9]{6,8}$/, 'Company number must be 8 digits or SC prefix with 6 digits'),
  company_status: z.string().optional(),
  company_status_detail: z.string().optional(),
  company_type: z.string().optional(),
  date_of_incorporation: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  date_of_cessation: z.string().optional(), // Dissolution date
  jurisdiction: z.string().optional(),
  country_of_origin: z.string().optional(),
  
  // Registered address (both formatted string and structured)
  registered_address: z.string().optional(),
  registered_address_structured: AddressSchema.optional(),
  
  // SIC codes (Standard Industrial Classification)
  sic_codes: z.array(z.string()).default([]),
  
  // Previous company names
  previous_company_names: z.array(PreviousNameSchema).default([]),
  
  // Flags from Companies House
  has_been_liquidated: z.boolean().optional(),
  has_insolvency_history: z.boolean().optional(),
  has_charges: z.boolean().optional(),
  has_super_secure_pscs: z.boolean().optional(),
  
  // Accounts information
  accounts: AccountsInfoSchema.optional(),
  
  // Confirmation statement
  confirmation_statement: ConfirmationStatementSchema.optional(),
  
  // Officers (directors, secretaries)
  officers: OfficersSchema.optional(),
  
  // Persons with Significant Control
  persons_with_significant_control: PSCsSchema.optional(),
  
  // Charges/Mortgages
  charges: ChargesSchema.optional(),
  
  // Insolvency information
  insolvency: InsolvencySchema.optional(),
  
  // Filing history summary
  filing_history: FilingHistorySchema.optional(),
  
  // Financial data (from external sources, not API)
  financials: FinancialsSchema.default({}),
  
  // External enrichment data
  enrichment: EnrichmentSchema.default({}),
  
  // Investment Scorecard (computed and cached)
  investment_score: z.object({
    score: z.number().min(0).max(100).optional(), // Overall investment score 0-100
    factors: z.array(z.object({
      factor: z.string(),
      value: z.number(),
      weight: z.number(),
    })).optional(), // Component factors that make up the score
    computed_at: z.string().optional(), // When score was computed
    location_distance_km: z.number().optional(), // Distance from London in km (if calculated)
  }).optional(),
  
  // Metadata
  scraped_at: z.string().optional(),
  updated_at: z.string().optional(),
  version: z.number().default(1),
});

export type Company = z.infer<typeof CompanySchema>;

/**
 * Investment Logic: Calculate acquisition score based on company data
 * Aligned with AI-Enabled MSP Platform investment thesis
 */
export async function calculateInvestmentScore(company: Company): Promise<{
  score: number;
  factors: { factor: string; value: number; weight: number }[];
}> {
  const factors: { factor: string; value: number; weight: number }[] = [];
  let score = 0;

  // Factor 1: Company Age (0-25 points)
  // Companies active for 3+ years are more valuable (thesis requirement)
  const yearsActive = calculateYearsActive(company.date_of_incorporation);
  const ageScore = Math.min(25, yearsActive * 8.33); // Max 25 points for 3+ years
  factors.push({ factor: 'Company Age (years)', value: yearsActive, weight: ageScore });
  score += ageScore;

  // Factor 2: Size (0-25 points)
  // One of: 15-40 employees, £3m-£6m revenue, or £500k-£1m EBITDA
  let sizeScore = 0;
  let sizeValue = 0;
  let sizeType = 'none';

  // Check employees first
  const headcount = company.financials.employees || company.enrichment.headcount;
  if (headcount && headcount >= MIN_EMPLOYEES && headcount <= MAX_EMPLOYEES) {
    // Within range: 25 points
    sizeScore = 25;
    sizeValue = headcount;
    sizeType = 'employees';
  } else {
    // Check revenue
    if (company.financials.revenue && company.financials.revenue >= MIN_REVENUE && company.financials.revenue <= MAX_REVENUE) {
      // Within range: 25 points
      sizeScore = 25;
      sizeValue = company.financials.revenue;
      sizeType = 'revenue';
    } else {
      // Check EBITDA
      if (company.financials.ebitda && company.financials.ebitda >= MIN_EBITDA && company.financials.ebitda <= MAX_EBITDA) {
        // Within range: 25 points
        sizeScore = 25;
        sizeValue = company.financials.ebitda;
        sizeType = 'ebitda';
      } else {
        // Partial credit for being close to range
        if (headcount) {
          if (headcount < MIN_EMPLOYEES) {
            sizeScore = Math.max(0, (headcount / MIN_EMPLOYEES) * 15); // Up to 15 points
            sizeValue = headcount;
            sizeType = 'employees';
          } else if (headcount > MAX_EMPLOYEES) {
            sizeScore = Math.max(0, 15 - ((headcount - MAX_EMPLOYEES) / MAX_EMPLOYEES) * 15); // Decreasing score
            sizeValue = headcount;
            sizeType = 'employees';
          }
        }
        if (sizeScore === 0 && company.financials.revenue) {
          if (company.financials.revenue < MIN_REVENUE) {
            sizeScore = Math.max(0, (company.financials.revenue / MIN_REVENUE) * 15);
            sizeValue = company.financials.revenue;
            sizeType = 'revenue';
          } else if (company.financials.revenue > MAX_REVENUE) {
            sizeScore = Math.max(0, 15 - ((company.financials.revenue - MAX_REVENUE) / MAX_REVENUE) * 15);
            sizeValue = company.financials.revenue;
            sizeType = 'revenue';
          }
        }
        if (sizeScore === 0 && company.financials.ebitda) {
          if (company.financials.ebitda < MIN_EBITDA) {
            sizeScore = Math.max(0, (company.financials.ebitda / MIN_EBITDA) * 15);
            sizeValue = company.financials.ebitda;
            sizeType = 'ebitda';
          } else if (company.financials.ebitda > MAX_EBITDA) {
            sizeScore = Math.max(0, 15 - ((company.financials.ebitda - MAX_EBITDA) / MAX_EBITDA) * 15);
            sizeValue = company.financials.ebitda;
            sizeType = 'ebitda';
          }
        }
      }
    }
  }

  const sizeLabel = sizeType === 'employees' ? 'Size (employees)' : 
                    sizeType === 'revenue' ? 'Size (revenue)' : 
                    sizeType === 'ebitda' ? 'Size (EBITDA)' : 'Size';
  factors.push({ factor: sizeLabel, value: sizeValue, weight: sizeScore });
  score += sizeScore;

  // Factor 3: Microsoft Stack Alignment (0-25 points)
  // Bonus for Microsoft-centric technology stacks (thesis requirement)
  let microsoftScore = 0;
  let microsoftCount = 0;
  if (company.enrichment.tech_stack && company.enrichment.tech_stack.length > 0) {
    const microsoftKeywords = ['microsoft', 'azure', 'office365', 'm365', 'sharepoint', 'teams', 'power', 'dynamics'];
    microsoftCount = company.enrichment.tech_stack.filter(tech => 
      microsoftKeywords.some(keyword => tech.toLowerCase().includes(keyword))
    ).length;
    if (microsoftCount > 0) {
      microsoftScore = Math.min(25, microsoftCount * 8.33); // Up to 25 points for Microsoft stack (3+ techs = max)
    }
  }
  factors.push({ factor: 'Microsoft Stack Alignment', value: microsoftCount, weight: microsoftScore });
  score += microsoftScore;

  // Factor 4: Location (0-25 points)
  // Proximity to Central London
  // Use stored distance if available, otherwise geocode
  let distance: number | null = null;
  if (company.investment_score?.location_distance_km !== undefined && company.investment_score.location_distance_km !== null) {
    // Use stored distance (fast - no API call)
    distance = company.investment_score.location_distance_km;
  } else {
    // Geocode if not stored (slow - API call)
    distance = await getDistanceFromLondon(
      company.registered_address,
      company.registered_address_structured
    );
  }
  const locationScore = calculateLocationScore(distance);
  factors.push({ 
    factor: 'Location (distance from London)', 
    value: distance !== null ? Math.round(distance * 10) / 10 : 0, // Distance in km, rounded to 1 decimal
    weight: locationScore 
  });
  score += locationScore;

  return {
    score: Math.round(score * 100) / 100, // Round to 2 decimal places
    factors,
  };
}

/**
 * Check if company meets high-value target criteria
 */
export function isHighValueTarget(company: Company): boolean {
  const yearsActive = calculateYearsActive(company.date_of_incorporation);
  
  // Must be active for 3+ years
  if (yearsActive < 3) return false;
  
  // Red flags: exclude companies with insolvency history
  if (company.insolvency?.has_insolvency_history || company.has_been_liquidated) {
    return false;
  }
  
  // Must have some financial data or enrichment
  const hasFinancials = !!(company.financials.revenue || company.financials.profit);
  const hasEnrichment = !!(company.enrichment.website || company.enrichment.headcount);
  
  return hasFinancials || hasEnrichment;
}

/**
 * Get red flags for a company
 */
export function getRedFlags(company: Company): string[] {
  const flags: string[] = [];
  
  if (company.has_been_liquidated) {
    flags.push('Company has been liquidated');
  }
  
  if (company.insolvency?.has_insolvency_history) {
    flags.push('Has insolvency history');
  }
  
  if (company.insolvency?.cases && company.insolvency.cases.length > 0) {
    flags.push(`Has ${company.insolvency.cases.length} insolvency case(s)`);
  }
  
  if (company.charges?.unsatisfied_count && company.charges.unsatisfied_count > 0) {
    flags.push(`${company.charges.unsatisfied_count} unsatisfied charge(s)`);
  }
  
  if (company.accounts?.next_accounts_overdue) {
    flags.push('Accounts are overdue');
  }
  
  if (company.company_status !== 'active') {
    flags.push(`Company status: ${company.company_status}`);
  }
  
  return flags;
}

/**
 * Check if company matches AI-Enabled MSP Platform thesis criteria
 * Based on: docs/INVESTMENT_THESIS.md
 */
export function matchesThesisCriteria(company: Company): {
  matches: boolean;
  criteria: {
    name: string;
    met: boolean;
    details: string;
  }[];
} {
  const criteria: { name: string; met: boolean; details: string }[] = [];
  let matches = true;

  // Criteria 1: Company Age (3+ years)
  const yearsActive = calculateYearsActive(company.date_of_incorporation);
  const ageMet = yearsActive >= 3;
  criteria.push({
    name: 'Company Age (3+ years)',
    met: ageMet,
    details: `${yearsActive.toFixed(1)} years active`,
  });
  if (!ageMet) matches = false;

  // Criteria 2: Active Status
  const activeMet = company.company_status === 'active';
  criteria.push({
    name: 'Active Status',
    met: activeMet,
    details: company.company_status || 'unknown',
  });
  if (!activeMet) matches = false;

  // Criteria 3: No Insolvency History
  const noInsolvencyMet = !company.has_insolvency_history && !company.has_been_liquidated;
  criteria.push({
    name: 'No Insolvency History',
    met: noInsolvencyMet,
    details: noInsolvencyMet ? 'Clean' : 'Has insolvency/liquidation history',
  });
  if (!noInsolvencyMet) matches = false;

  // Criteria 4: SIC Code Match (62020 or 62090)
  const sicCodes = company.sic_codes || [];
  const hasTargetSic = sicCodes.some(code => {
    const numericCode = code.split(' ')[0].trim();
    return TARGET_SIC_CODES.includes(numericCode as typeof TARGET_SIC_CODES[number]) || 
           code.startsWith('62020') || code.startsWith('62090');
  });
  criteria.push({
    name: `SIC Code (${TARGET_SIC_CODES.join('/')})`,
    met: hasTargetSic,
    details: hasTargetSic ? sicCodes.join(', ') : 'No matching SIC codes',
  });
  if (!hasTargetSic) matches = false;

  // Criteria 5: Size Profile (meet at least one):
  // - £500k-£1m EBITDA OR
  // - £3m-£6m revenue OR
  // - 15-40 employees
  const ebitda = company.financials.ebitda || company.financials.profit || 0;
  const revenue = company.financials.revenue || 0;
  const employees = company.financials.employees || company.enrichment.headcount || 0;
  
  const ebitdaInRange = ebitda >= MIN_EBITDA && ebitda <= MAX_EBITDA;
  const revenueInRange = revenue >= MIN_REVENUE && revenue <= MAX_REVENUE;
  const employeesInRange = employees >= MIN_EMPLOYEES && employees <= MAX_EMPLOYEES;
  
  const sizeProfileMet = ebitdaInRange || revenueInRange || employeesInRange;
  
  // Add individual criteria for transparency
  criteria.push({
    name: 'EBITDA Range (£500k-£1m)',
    met: ebitdaInRange || ebitda === 0, // Don't fail if no data
    details: ebitda > 0 ? `£${ebitda.toLocaleString()}` : 'No EBITDA data',
  });
  
  criteria.push({
    name: 'Revenue Range (£3m-£6m)',
    met: revenueInRange || revenue === 0, // Don't fail if no data
    details: revenue > 0 ? `£${revenue.toLocaleString()}` : 'No revenue data',
  });
  
  criteria.push({
    name: 'Employee Range (15-40)',
    met: employeesInRange || employees === 0, // Don't fail if no data
    details: employees > 0 ? `${employees} employees` : 'No employee data',
  });
  
  // Overall size profile check (at least one must be met)
  // Only fail if we have data but none of the criteria are met
  const hasAnyData = ebitda > 0 || revenue > 0 || employees > 0;
  const sizeProfileMetOrNoData = sizeProfileMet || !hasAnyData;
  
  criteria.push({
    name: 'Size Profile (EBITDA OR Revenue OR Employees)',
    met: sizeProfileMetOrNoData,
    details: hasAnyData
      ? (sizeProfileMet 
          ? `Meets criteria: ${ebitdaInRange ? 'EBITDA ' : ''}${revenueInRange ? 'Revenue ' : ''}${employeesInRange ? 'Employees' : ''}`.trim()
          : `Outside range: EBITDA £${ebitda.toLocaleString()}, Revenue £${revenue.toLocaleString()}, Employees ${employees}`)
      : 'No size profile data available',
  });
  
  // Only fail if we have data but don't meet any criteria
  if (!sizeProfileMet && hasAnyData) {
    matches = false;
  }

  // Criteria 6: Microsoft Stack (preferred)
  const hasMicrosoftStack = company.enrichment.tech_stack?.some(tech => {
    const microsoftKeywords = ['microsoft', 'azure', 'office365', 'm365', 'sharepoint', 'teams', 'power', 'dynamics'];
    return microsoftKeywords.some(keyword => tech.toLowerCase().includes(keyword));
  }) || false;
  criteria.push({
    name: 'Microsoft Stack (Preferred)',
    met: hasMicrosoftStack,
    details: hasMicrosoftStack 
      ? `Microsoft technologies: ${company.enrichment.tech_stack?.filter(t => 
          ['microsoft', 'azure', 'office365', 'm365', 'sharepoint', 'teams', 'power', 'dynamics'].some(k => 
            t.toLowerCase().includes(k)
          )
        ).join(', ')}`
      : 'No Microsoft stack identified',
  });
  // Microsoft stack is preferred but not required, so don't fail on this

  return { matches, criteria };
}

/**
 * Analyze enrichment data to determine likelihood that company is an IT MSP
 * Returns a score from 0-100 and detailed analysis
 */
export function analyzeMSPLikelihood(company: Company): {
  score: number; // 0-100, higher = more likely to be MSP
  confidence: 'high' | 'medium' | 'low';
  indicators: {
    category: string;
    found: boolean;
    evidence: string[];
  }[];
} {
  const indicators: { category: string; found: boolean; evidence: string[] }[] = [];
  let score = 0;
  const maxScore = 100;

  const enrichment = company.enrichment || {};
  const keywords = enrichment.business_keywords || [];
  const services = enrichment.services || [];
  const techStack = enrichment.tech_stack || [];
  const description = enrichment.business_description || '';
  const allText = [
    ...keywords,
    ...services,
    ...techStack,
    description,
    company.company_name,
  ].join(' ').toLowerCase();

  // Negative Keywords - indicate non-MSP businesses
  const negativeKeywords = [
    'software development', 'application development', 'engineering services',
    'custom software', 'software engineering', 'digital transformation',
    'digital solutions', 'digital commerce', 'ui/ux', 'mobility engineering',
    'audio visual', 'av systems', 'stage solutions', 'smart building',
    'systems integrator', 'master systems integrator', 'generative ai',
    'gen ai', 'ai/ml', 'machine learning'
  ];

  const foundNegativeKeywords = negativeKeywords.filter(keyword =>
    allText.includes(keyword.toLowerCase())
  );
  const contextPenalty = foundNegativeKeywords.length > 0 
    ? Math.max(0.3, 1 - (foundNegativeKeywords.length * 0.2))
    : 1.0;

  // Add indicator for negative keywords
  indicators.push({
    category: 'Negative Keywords (non-MSP indicators)',
    found: foundNegativeKeywords.length > 0,
    evidence: foundNegativeKeywords.slice(0, 5),
  });

  // MSP Keywords (30 points)
  const mspKeywords = [
    'msp', 'managed service provider', 'managed services',
    'it support', 'it services', 'it consultancy', 'it consulting',
    'managed it', 'managed it services', 'managed it support',
    'outsourced it', 'it outsourcing', 'it managed services',
    'helpdesk', 'service desk', 'it help desk',
    'network support', 'infrastructure support', 'cloud services',
    'cybersecurity', 'cyber security', 'it security',
    'remote monitoring', 'remote management', 'rmm',
    'professional services automation', 'psa',
    'endpoint management', 'device management',
  ];
  
  const foundMspKeywords = mspKeywords.filter(keyword => 
    allText.includes(keyword.toLowerCase())
  );
  
  const mspKeywordScore = Math.min(30, (foundMspKeywords.length / mspKeywords.length) * 30) * contextPenalty;
  score += mspKeywordScore;
  indicators.push({
    category: 'MSP Keywords',
    found: foundMspKeywords.length > 0,
    evidence: foundMspKeywords.slice(0, 5),
  });

  // MSP Services (25 points)
  const mspServices = [
    'managed services', 'it support', 'helpdesk', 'service desk',
    'network management', 'server management', 'cloud management',
    'security monitoring', 'backup', 'disaster recovery',
    'remote support', 'on-site support', 'it consultancy',
    'it consulting', 'infrastructure management', 'endpoint management',
    'patch management', 'antivirus management', 'email security',
    'firewall management', 'vpn', 'remote access',
  ];
  
  const foundServices = services.filter(service => 
    mspServices.some(mspService => 
      service.toLowerCase().includes(mspService.toLowerCase())
    )
  );
  
  const serviceScore = Math.min(25, (foundServices.length / Math.max(1, services.length)) * 25);
  score += serviceScore;
  indicators.push({
    category: 'MSP Services',
    found: foundServices.length > 0,
    evidence: foundServices.slice(0, 5),
  });

  // IT Infrastructure Tech Stack (20 points)
  const itInfrastructureTech = [
    'microsoft 365', 'office 365', 'azure', 'active directory',
    'windows server', 'exchange', 'sharepoint', 'teams',
    'vmware', 'hyper-v', 'virtualization', 'citrix',
    'cisco', 'fortinet', 'sonicwall', 'palo alto',
    'connectwise', 'kaseya', 'n-able', 'datto',
    'veeam', 'acronis', 'backup', 'disaster recovery',
    'sophos', 'symantec', 'mcafee', 'crowdstrike',
    'sentinelone', 'bitdefender', 'eset',
  ];
  
  const foundInfraTech = techStack.filter(tech => 
    itInfrastructureTech.some(infraTech => 
      tech.toLowerCase().includes(infraTech.toLowerCase())
    )
  );
  
  const techScore = Math.min(20, (foundInfraTech.length / Math.max(1, techStack.length)) * 20);
  score += techScore;
  indicators.push({
    category: 'IT Infrastructure Technology',
    found: foundInfraTech.length > 0,
    evidence: foundInfraTech.slice(0, 5),
  });

  // Business Description Analysis (15 points)
  const mspDescriptionPatterns = [
    /managed (it )?service/i,
    /it support/i,
    /helpdesk/i,
    /service desk/i,
    /remote (monitoring|management|support)/i,
    /outsourced it/i,
    /it outsourcing/i,
    /network (management|support)/i,
    /infrastructure (management|support)/i,
    /cloud (services|management)/i,
  ];
  
  const descriptionMatches = mspDescriptionPatterns.filter(pattern => 
    pattern.test(description)
  ).length;
  
  const descriptionScore = Math.min(15, (descriptionMatches / mspDescriptionPatterns.length) * 15);
  score += descriptionScore;
  indicators.push({
    category: 'Business Description',
    found: descriptionMatches > 0,
    evidence: descriptionMatches > 0 ? ['Contains MSP-related descriptions'] : [],
  });

  // SIC Code Alignment (10 points)
  const hasItSic = (company.sic_codes || []).some(code => 
    code.includes('62020') || code.includes('62090')
  );
  
  if (hasItSic) {
    score += 10;
  }
  indicators.push({
    category: 'SIC Code (IT Services)',
    found: hasItSic,
    evidence: hasItSic ? company.sic_codes?.filter(c => c.includes('62020') || c.includes('62090')) || [] : [],
  });

  // Specialized MSP Detection - backup-only, security-only, cloud-only
  const isSpecializedMSP = (
    (foundServices.some(s => s.toLowerCase().includes('backup')) && 
     !foundServices.some(s => s.toLowerCase().includes('it support') || s.toLowerCase().includes('helpdesk'))) ||
    (foundServices.some(s => s.toLowerCase().includes('security') || s.toLowerCase().includes('mdr')) && 
     !foundServices.some(s => s.toLowerCase().includes('infrastructure') || s.toLowerCase().includes('network management')))
  );

  indicators.push({
    category: 'Specialized MSP (not full-service)',
    found: isSpecializedMSP,
    evidence: isSpecializedMSP ? ['Detected as specialized MSP (backup/security only)'] : [],
  });

  // Determine confidence level
  // High: score >= 30, Medium: score >= 15, Low: score < 15
  // If negative keywords found, require higher context penalty for medium confidence
  const hasNegativeContext = foundNegativeKeywords.length > 0;
  const minContextPenaltyForMedium = hasNegativeContext ? 0.6 : 0.3;
  
  let confidence: 'high' | 'medium' | 'low';
  if (score >= 30) {
    confidence = 'high';
  } else if (score >= 15 && contextPenalty >= minContextPenaltyForMedium) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    score: Math.round(score),
    confidence,
    indicators,
  };
}

