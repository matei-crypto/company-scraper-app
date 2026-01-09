#!/usr/bin/env node

import 'dotenv/config';
import axios, { AxiosInstance } from 'axios';
import chalk from 'chalk';
import * as cheerio from 'cheerio';
import { readCompany, writeCompany, listAllCompanies } from '../utils/fileSystem.js';
import { CompanySchema, type Company, analyzeMSPLikelihood, calculateInvestmentScore } from '../schemas/CompanySchema.js';
import { z } from 'zod';

/**
 * Schema for website analysis results
 */
const WebsiteAnalysisSchema = z.object({
  business_keywords: z.array(z.string()).describe('Keywords that describe the nature of the business. MUST include vendor names, products, and technologies the company works with or services (e.g., "MSP", "Microsoft 365", "Azure", "Cisco", "VMware", "cloud services", "IT consultancy")'),
  services: z.array(z.string()).describe('Specific services provided by the company'),
  customer_segments: z.array(z.string()).describe('Types of customers or market segments served (e.g., "SMEs", "enterprise", "healthcare", "legal firms")'),
  business_description: z.string().describe('Brief 2-3 sentence description of what the company does'),
  tech_stack: z.array(z.string()).optional().describe('Technology vendors, products, and platforms the company works with or services (e.g., "Microsoft 365", "Azure", "Cisco", "VMware", "AWS", "Google Workspace")'),
});

type WebsiteAnalysis = z.infer<typeof WebsiteAnalysisSchema>;

/**
 * Website Analyzer using LLM
 * Extracts business information from company websites
 */
class WebsiteAnalyzer {
  private api: AxiosInstance;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.MISTRAL_API_KEY || '';
    
    if (!this.apiKey) {
      throw new Error(
        'MISTRAL_API_KEY environment variable is required.\n' +
        'Get your API key at: https://console.mistral.ai/'
      );
    }

    this.api = axios.create({
      baseURL: 'https://api.mistral.ai/v1',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Fetch and extract text content from a website using web search fallback
   */
  private async fetchWebsiteContent(url: string, companyName?: string): Promise<{ content: string; source: 'direct' | 'fallback' }> {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        maxRedirects: 5,
        validateStatus: (status) => status < 500, // Don't throw on 403/404, handle it
      });

      // Check if we got blocked or got an error page
      if (response.status === 403 || response.status === 401) {
        console.log(chalk.yellow(`  ⚠ Direct fetch blocked (${response.status}), using fallback...`));
        return await this.fetchWebsiteContentFallback(url, companyName);
      }

      // Check if response is actually HTML
      const contentType = response.headers['content-type'] || '';
      if (!contentType.includes('text/html')) {
        console.log(chalk.yellow(`  ⚠ Non-HTML response, using fallback...`));
        return await this.fetchWebsiteContentFallback(url, companyName);
      }

      const $ = cheerio.load(response.data);
      
      // Remove script and style elements
      $('script, style, nav, footer, header').remove();
      
      // Extract text from main content areas
      const textContent: string[] = [];
      
      // Get title
      const title = $('title').text().trim();
      if (title) textContent.push(`Title: ${title}`);
      
      // Get meta description
      const metaDesc = $('meta[name="description"]').attr('content');
      if (metaDesc) textContent.push(`Description: ${metaDesc}`);
      
      // Get main content from common semantic elements
      const mainContent = $('main, article, [role="main"], .content, #content, .main-content').first();
      if (mainContent.length > 0) {
        textContent.push(mainContent.text().trim());
      } else {
        // Fallback to body text
        textContent.push($('body').text().trim());
      }
      
      // Get headings for structure
      const headings = $('h1, h2, h3').slice(0, 10).map((_, el) => $(el).text().trim()).get();
      if (headings.length > 0) {
        textContent.push(`\nKey Headings: ${headings.join(' | ')}`);
      }

      const combined = textContent.join('\n\n').replace(/\s+/g, ' ').trim();
      
      // If we got very little content, try fallback
      if (combined.length < 100) {
        console.log(chalk.yellow(`  ⚠ Minimal content extracted (${combined.length} chars), using fallback...`));
        return await this.fetchWebsiteContentFallback(url, companyName);
      }
      
      // Limit to reasonable size (about 8000 chars for LLM context)
      const finalContent = combined.length > 8000 ? combined.substring(0, 8000) + '...' : combined;
      return { content: finalContent, source: 'direct' };
    } catch (error: any) {
      // Network errors, timeouts, etc. - use fallback
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND' || 
          error.response?.status === 403 || error.response?.status === 401) {
        console.log(chalk.yellow(`  ⚠ Fetch failed (${error.message}), using fallback...`));
        return await this.fetchWebsiteContentFallback(url, companyName);
      }
      throw new Error(`Failed to fetch website: ${error.message}`);
    }
  }

  /**
   * Fallback method: Use web search to get website content when direct fetch fails
   */
  private async fetchWebsiteContentFallback(
    url: string, 
    companyName?: string
  ): Promise<{ content: string; source: 'fallback' }> {
    // Try web search to get actual website content
    const searchContent = await this.fetchViaWebSearch(url, companyName);
    if (searchContent && searchContent.length > 200) {
      return { content: searchContent, source: 'fallback' };
    }

    // If web search fails, throw error (no LLM inference fallback)
    throw new Error('Web search fallback failed to retrieve content');
  }

  /**
   * Fetch website content via DuckDuckGo web search
   */
  private async fetchViaWebSearch(url: string, companyName?: string): Promise<string | null> {
    try {
      // Use DuckDuckGo HTML search (no API key required)
      const searchQuery = companyName 
        ? `site:${new URL(url).hostname} ${companyName}`
        : `site:${new URL(url).hostname}`;
      
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
      
      const response = await axios.get(searchUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      const $ = cheerio.load(response.data);
      
      // Extract snippets from search results
      const snippets: string[] = [];
      $('.result__snippet').each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 50) {
          snippets.push(text);
        }
      });

      // Also try to get the actual page content via search result links
      // DuckDuckGo sometimes provides cached/preview content
      const resultLinks = $('.result__a');
      if (resultLinks.length > 0) {
        const firstResultUrl = resultLinks.first().attr('href');
        if (firstResultUrl && firstResultUrl.includes(new URL(url).hostname)) {
          // Try to fetch the actual page with a different approach
          try {
            const pageResponse = await axios.get(url, {
              timeout: 8000,
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.google.com/',
              },
              maxRedirects: 5,
            });

            const $page = cheerio.load(pageResponse.data);
            $page('script, style, nav, footer, header').remove();
            
            const pageContent: string[] = [];
            const title = $page('title').text().trim();
            if (title) pageContent.push(`Title: ${title}`);
            
            const metaDesc = $page('meta[name="description"]').attr('content');
            if (metaDesc) pageContent.push(`Description: ${metaDesc}`);
            
            const mainContent = $page('main, article, [role="main"], .content, #content').first();
            if (mainContent.length > 0) {
              pageContent.push(mainContent.text().trim());
            } else {
              pageContent.push($page('body').text().trim());
            }

            const headings = $page('h1, h2, h3').slice(0, 10).map((_, el) => $page(el).text().trim()).get();
            if (headings.length > 0) {
              pageContent.push(`\nKey Headings: ${headings.join(' | ')}`);
            }

            const combined = pageContent.join('\n\n').replace(/\s+/g, ' ').trim();
            if (combined.length > 200) {
              return combined.length > 8000 ? combined.substring(0, 8000) + '...' : combined;
            }
          } catch (pageError: any) {
            // If direct fetch still fails, continue with search snippets
          }
        }
      }

      // Combine search snippets
      if (snippets.length > 0) {
        const combined = snippets.join('\n\n').replace(/\s+/g, ' ').trim();
        return combined.length > 8000 ? combined.substring(0, 8000) + '...' : combined;
      }

      return null;
    } catch (error: any) {
      return null;
    }
  }


  /**
   * Analyze website content using LLM
   */
  private async analyzeWebsiteContent(content: string, companyName: string): Promise<WebsiteAnalysis> {
    const prompt = `Analyze the following website content for ${companyName} and extract key business information based ONLY on what is actually stated or clearly implied in the content.

Website Content:
${content}

Extract the following information based strictly on the website content provided:

1. **Business Keywords**: 10-15 keywords that describe the nature of the business as stated on the website. Include vendor names, products, and technologies ONLY if they are explicitly mentioned or clearly referenced in the content.

2. **Services**: List of specific services provided as described on the website. Only include services that are actually mentioned or clearly described.

3. **Customer Segments**: Types of customers or market segments served as indicated in the content. Only include segments that are explicitly mentioned or clearly implied.

4. **Tech Stack**: Technology vendors, products, and platforms the company works with or services, but ONLY if mentioned in the website content. Include both vendor names and specific product names when they appear.

5. **Business Description**: A brief 2-3 sentence description of what the company does based on the website content.

CRITICAL INSTRUCTIONS:
- Extract information ONLY from what is provided in the website content
- Do NOT infer or assume information that is not present
- Do NOT add examples or common industry terms unless they are actually mentioned
- If a technology vendor or product is mentioned, include both the vendor name and product name when appropriate
- If information is not available in the content, use empty arrays or omit fields rather than guessing
- Be accurate and faithful to what the website actually says

Return structured JSON matching this schema:
{
  "business_keywords": ["keyword1", "keyword2", ...],
  "services": ["service1", "service2", ...],
  "customer_segments": ["segment1", "segment2", ...],
  "tech_stack": ["vendor1 product1", "vendor2 product2", ...],
  "business_description": "Brief description based on website content..."
}

Return ONLY valid JSON, no additional text.`;

    try {
      const response = await this.api.post('/chat/completions', {
        model: 'mistral-large-latest',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const content = response.data.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in LLM response');
      }

      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return WebsiteAnalysisSchema.parse(parsed);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        throw new Error(`Schema validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`);
      }
      throw new Error(`LLM analysis failed: ${error.message}`);
    }
  }

  /**
   * Analyze a single company's website
   */
  async analyzeCompany(companyNumber: string): Promise<{
    success: boolean;
    analysis?: WebsiteAnalysis;
    error?: string;
  }> {
    try {
      const company = await readCompany(companyNumber);
      if (!company) {
        return { success: false, error: 'Company not found' };
      }

      if (!company.enrichment?.website) {
        return { success: false, error: 'No website URL found' };
      }

      const website = company.enrichment.website;
      console.log(chalk.cyan(`  Fetching: ${website}`));
      
      const fetchResult = await this.fetchWebsiteContent(
        website, 
        company.company_name
      );
      
      if (fetchResult.source === 'fallback') {
        console.log(chalk.yellow(`  ⚠ Using fallback analysis (direct fetch unavailable)`));
      }
      
      console.log(chalk.dim(`  Content extracted: ${fetchResult.content.length} characters (${fetchResult.source})`));
      
      console.log(chalk.dim(`  Analyzing with LLM...`));
      const analysis = await this.analyzeWebsiteContent(fetchResult.content, company.company_name);
      
      return { success: true, analysis };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Analyze websites for multiple companies
   */
  async analyzeCompanies(options: {
    companyNumbers?: string[];
    skipExisting?: boolean;
    limit?: number;
  } = {}): Promise<{ analyzed: number; skipped: number; errors: number }> {
    console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║           WEBSITE ANALYSIS - LLM EXTRACTION                 ║'));
    console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));

    let companyNumbers: string[];
    
    if (options.companyNumbers) {
      companyNumbers = options.companyNumbers;
    } else {
      const allCompanies = await listAllCompanies();
      companyNumbers = allCompanies;
    }

    // Apply limit if specified
    if (options.limit && options.limit > 0) {
      companyNumbers = companyNumbers.slice(0, options.limit);
      console.log(chalk.yellow(`⚠ Limited to first ${options.limit} companies\n`));
    }

    let analyzed = 0;
    let skipped = 0;
    let errors = 0;

    for (const companyNumber of companyNumbers) {
      console.log(chalk.cyan(`\nProcessing: ${companyNumber}`));
      console.log(chalk.dim('─'.repeat(60)));

      try {
        const company = await readCompany(companyNumber);
        if (!company) {
          console.log(chalk.red(`  ✗ Company not found`));
          errors++;
          continue;
        }

        if (!company.enrichment?.website) {
          console.log(chalk.yellow(`  ○ No website URL - skipping`));
          skipped++;
          continue;
        }

        // Skip if already analyzed and skipExisting is true
        if (options.skipExisting && company.enrichment.business_keywords && company.enrichment.business_keywords.length > 0) {
          console.log(chalk.dim(`  ○ Already analyzed - skipping`));
          skipped++;
          continue;
        }

        const result = await this.analyzeCompany(companyNumber);
        
        if (!result.success || !result.analysis) {
          console.log(chalk.red(`  ✗ Error: ${result.error}`));
          errors++;
          
          // Update enrichment status
          if (company.enrichment) {
            company.enrichment.enrichment_status = 'failed';
            if (!company.enrichment.enrichment_errors) {
              company.enrichment.enrichment_errors = [];
            }
            company.enrichment.enrichment_errors.push(result.error || 'Unknown error');
            await writeCompany(company);
          }
          continue;
        }

        // Update company with analysis results
        if (!company.enrichment) {
          company.enrichment = { enrichment_status: 'pending' };
        }

        company.enrichment.business_keywords = result.analysis.business_keywords;
        company.enrichment.services = result.analysis.services;
        company.enrichment.customer_segments = result.analysis.customer_segments;
        company.enrichment.business_description = result.analysis.business_description;
        
        // Update tech_stack if provided and not already set, or merge with existing
        if (result.analysis.tech_stack && result.analysis.tech_stack.length > 0) {
          const existingTechStack = company.enrichment.tech_stack || [];
          const mergedTechStack = [...new Set([...existingTechStack, ...result.analysis.tech_stack])];
          company.enrichment.tech_stack = mergedTechStack;
        }
        
        company.enrichment.website_analyzed_at = new Date().toISOString();
        company.enrichment.enrichment_status = 'completed';

        // Compute and store MSP likelihood score
        const mspAnalysis = analyzeMSPLikelihood(company);
        company.enrichment.msp_likelihood_score = mspAnalysis.score;
        company.enrichment.msp_likelihood_confidence = mspAnalysis.confidence;
        company.enrichment.msp_likelihood_computed_at = new Date().toISOString();

        // Compute and store investment scorecard
        try {
          const scoreResult = await calculateInvestmentScore(company);
          
          // Extract location distance if available from factors
          const locationFactor = scoreResult.factors.find(f => f.factor.includes('Location') || f.factor.includes('distance'));
          const locationDistance = locationFactor && locationFactor.value > 0 ? locationFactor.value : undefined;
          
          company.investment_score = {
            score: scoreResult.score,
            factors: scoreResult.factors,
            computed_at: new Date().toISOString(),
            location_distance_km: locationDistance,
          };
        } catch (error: any) {
          // If score calculation fails (e.g., geocoding error), continue without it
          // Don't block the enrichment process
          console.log(chalk.dim(`  ⚠ Could not compute investment score: ${error.message}`));
        }

        await writeCompany(company);

        console.log(chalk.green(`  ✓ Analysis complete`));
        console.log(chalk.dim(`    Keywords: ${result.analysis.business_keywords.slice(0, 5).join(', ')}${result.analysis.business_keywords.length > 5 ? '...' : ''}`));
        console.log(chalk.dim(`    Services: ${result.analysis.services.slice(0, 3).join(', ')}${result.analysis.services.length > 3 ? '...' : ''}`));
        if (result.analysis.tech_stack && result.analysis.tech_stack.length > 0) {
          console.log(chalk.dim(`    Tech Stack: ${result.analysis.tech_stack.slice(0, 5).join(', ')}${result.analysis.tech_stack.length > 5 ? '...' : ''}`));
        }
        analyzed++;

        // Rate limiting - 5 requests per second (200ms delay)
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error: any) {
        console.log(chalk.red(`  ✗ Error: ${error.message}`));
        errors++;
      }
    }

    // Summary
    console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║                      ANALYSIS SUMMARY                      ║'));
    console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));

    console.log(chalk.green(`✓ Analyzed: ${analyzed} companies`));
    console.log(chalk.yellow(`○ Skipped: ${skipped} companies`));
    console.log(chalk.red(`✗ Errors: ${errors} companies`));
    console.log('');

    return { analyzed, skipped, errors };
  }
}

// CLI entry point
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('websiteAnalyzer')) {
  const companyNumbers = process.argv.slice(2).filter(arg => !arg.startsWith('--'));
  const skipExisting = process.argv.includes('--skip-existing');
  const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

  const analyzer = new WebsiteAnalyzer();
  
  analyzer.analyzeCompanies({
    companyNumbers: companyNumbers.length > 0 ? companyNumbers : undefined,
    skipExisting,
    limit,
  }).then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error(chalk.red('\n✗ Fatal error:'), error);
    process.exit(1);
  });
}

export { WebsiteAnalyzer };

