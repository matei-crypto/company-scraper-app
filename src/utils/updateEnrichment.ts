#!/usr/bin/env node

import 'dotenv/config';
import { readCompany, writeCompany } from './fileSystem.js';
import { analyzeMSPLikelihood } from '../schemas/CompanySchema.js';

/**
 * Update enrichment data for a company with manual data
 */
async function updateEnrichment(companyNumber: string, enrichmentData: {
  business_keywords?: string[];
  services?: string[];
  customer_segments?: string[];
  business_description?: string;
  tech_stack?: string[];
}) {
  const company = await readCompany(companyNumber);
  if (!company) {
    throw new Error(`Company ${companyNumber} not found`);
  }

  if (!company.enrichment) {
    company.enrichment = { enrichment_status: 'pending' };
  }

  // Update enrichment fields
  if (enrichmentData.business_keywords) {
    company.enrichment.business_keywords = enrichmentData.business_keywords;
  }
  if (enrichmentData.services) {
    company.enrichment.services = enrichmentData.services;
  }
  if (enrichmentData.customer_segments) {
    company.enrichment.customer_segments = enrichmentData.customer_segments;
  }
  if (enrichmentData.business_description) {
    company.enrichment.business_description = enrichmentData.business_description;
  }
  if (enrichmentData.tech_stack) {
    company.enrichment.tech_stack = enrichmentData.tech_stack;
  }

  company.enrichment.website_analyzed_at = new Date().toISOString();
  company.enrichment.enrichment_status = 'completed';
  
  // Remove 403 errors
  if (company.enrichment.enrichment_errors) {
    company.enrichment.enrichment_errors = company.enrichment.enrichment_errors.filter(
      (e: string) => !e.includes('403')
    );
  }

  // Compute and store MSP likelihood score
  const mspAnalysis = analyzeMSPLikelihood(company);
  company.enrichment.msp_likelihood_score = mspAnalysis.score;
  company.enrichment.msp_likelihood_confidence = mspAnalysis.confidence;
  company.enrichment.msp_likelihood_computed_at = new Date().toISOString();

  await writeCompany(company);

  console.log(`✓ Enrichment updated for ${company.company_name}`);
  console.log(`  MSP Likelihood Score: ${mspAnalysis.score} / 100`);
  console.log(`  Confidence: ${mspAnalysis.confidence.toUpperCase()}`);
}

// CLI entry point
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('updateEnrichment')) {
  const companyNumber = process.argv[2];
  
  if (!companyNumber) {
    console.error('Usage: tsx src/utils/updateEnrichment.ts <company_number>');
    process.exit(1);
  }

  // For DIGITALK LIMITED (03030801) - based on actual website content
  if (companyNumber === '03030801') {
    updateEnrichment(companyNumber, {
      business_keywords: [
        'telecommunications',
        'cloud solutions',
        'CSP',
        'Communications Service Providers',
        'MVNE',
        'Mobile Virtual Network Enabler',
        'MVNO',
        'Mobile Virtual Network Operator',
        'wholesale voice',
        'carrier cloud',
        'mobile cloud',
        'real-time services',
        'voice routing',
        'billing platform',
        'margin management',
        'revenue assurance',
        'telecom platform',
        'cloud-based platform',
        'service delivery platform'
      ],
      services: [
        'Mobile Cloud MVNE as a Service',
        'MVNE platform for mobile operators and MVNOs',
        'Carrier Cloud wholesale voice platform',
        'Real-time voice routing',
        'Wholesale voice billing and margin management',
        'Revenue assurance and OBR handling',
        'Cloud-hosted voice platform for carriers',
        'Mobile network infrastructure services'
      ],
      customer_segments: [
        'Mobile Network Operators (MNOs)',
        'Mobile Virtual Network Operators (MVNOs)',
        'Wholesale voice carriers',
        'Communications Service Providers (CSPs)',
        'Telecom operators',
        'Brands launching mobile services'
      ],
      business_description: 'Digitalk provides real-time cloud solutions for Communications Service Providers (CSPs), offering Mobile Cloud MVNE as a Service for mobile operators and MVNOs, and Carrier Cloud for wholesale voice carriers. The company delivers high availability, unlimited capacity cloud-based platforms for real-time service delivery, voice routing, billing, and margin management.',
      tech_stack: [
        'Cloud platforms',
        'Real-time systems',
        'Voice routing technology',
        'Billing systems',
        'Margin management systems',
        'Revenue assurance platforms'
      ]
    }).then(() => {
      process.exit(0);
    }).catch((error) => {
      console.error('Error:', error);
      process.exit(1);
    });
  } else {
    console.error('Manual enrichment data not defined for this company');
    process.exit(1);
  }
}

export { updateEnrichment };

