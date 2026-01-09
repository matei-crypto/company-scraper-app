#!/usr/bin/env node

import chalk from 'chalk';
import { readCompany } from './fileSystem.js';
import { analyzeMSPLikelihood } from '../schemas/CompanySchema.js';

async function main() {
  const companyNumber = process.argv[2];

  if (!companyNumber) {
    console.error(chalk.red('Usage: tsx src/utils/showMSPBreakdown.ts <company_number>'));
    process.exit(1);
  }

  try {
    const company = await readCompany(companyNumber);

    if (!company) {
      console.error(chalk.red(`Company ${companyNumber} not found in database`));
      process.exit(1);
    }

    const analysis = analyzeMSPLikelihood(company);

    console.log(chalk.bold.cyan('\n╔════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.cyan('║        MSP LIKELIHOOD SCORE BREAKDOWN                     ║'));
    console.log(chalk.bold.cyan('╚════════════════════════════════════════════════════════════╝\n'));

    console.log(chalk.bold.white(`Company: ${company.company_name}`));
    console.log(chalk.bold.white(`Company Number: ${company.company_number}\n`));

    const scoreColor = analysis.score >= 70 ? chalk.green : 
                      analysis.score >= 40 ? chalk.yellow : chalk.red;
    const confidenceColor = analysis.confidence === 'high' ? chalk.green : 
                            analysis.confidence === 'medium' ? chalk.yellow : chalk.red;

    console.log(chalk.bold.white('Overall Score: ') + scoreColor(`${analysis.score} / 100`));
    console.log(chalk.bold.white('Confidence: ') + confidenceColor(analysis.confidence.toUpperCase()));
    console.log('');

    console.log(chalk.bold.white('Component Breakdown:'));
    console.log(chalk.dim('─'.repeat(60)));
    console.log('');

    // Calculate points for each category
    let totalCalculated = 0;
    analysis.indicators.forEach((indicator, index) => {
      let maxPoints = 0;
      let calculatedPoints = 0;

      if (indicator.category === 'MSP Keywords') {
        maxPoints = 30;
        // Calculate based on evidence found
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
        calculatedPoints = Math.min(30, (foundMspKeywords.length / mspKeywords.length) * 30);
        totalCalculated += calculatedPoints;
      } else if (indicator.category === 'MSP Services') {
        maxPoints = 25;
        const enrichment = company.enrichment || {};
        const services = enrichment.services || [];
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
        calculatedPoints = Math.min(25, (foundServices.length / Math.max(1, services.length)) * 25);
        totalCalculated += calculatedPoints;
      } else if (indicator.category === 'IT Infrastructure Technology') {
        maxPoints = 20;
        const enrichment = company.enrichment || {};
        const techStack = enrichment.tech_stack || [];
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
        calculatedPoints = Math.min(20, (foundInfraTech.length / Math.max(1, techStack.length)) * 20);
        totalCalculated += calculatedPoints;
      } else if (indicator.category === 'Business Description') {
        maxPoints = 15;
        const enrichment = company.enrichment || {};
        const description = enrichment.business_description || '';
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
        calculatedPoints = Math.min(15, (descriptionMatches / mspDescriptionPatterns.length) * 15);
        totalCalculated += calculatedPoints;
      } else if (indicator.category === 'SIC Code (IT Services)') {
        maxPoints = 10;
        const hasItSic = (company.sic_codes || []).some(code => 
          code.includes('62020') || code.includes('62090')
        );
        calculatedPoints = hasItSic ? 10 : 0;
        totalCalculated += calculatedPoints;
      }

      const status = indicator.found ? chalk.green('✓') : chalk.yellow('○');
      const pointsColor = calculatedPoints > 0 ? chalk.green : chalk.dim;
      
      console.log(chalk.white(`${index + 1}. ${indicator.category}`));
      console.log(chalk.white(`   Max Points: ${maxPoints}`));
      console.log(chalk.white(`   Points Earned: ${pointsColor(calculatedPoints.toFixed(1))} / ${maxPoints}`));
      console.log(chalk.white(`   Status: ${status} ${indicator.found ? 'FOUND' : 'NOT FOUND'}`));
      
      if (indicator.evidence && indicator.evidence.length > 0) {
        console.log(chalk.dim(`   Evidence:`));
        indicator.evidence.slice(0, 8).forEach(evidence => {
          console.log(chalk.dim(`     • ${evidence}`));
        });
        if (indicator.evidence.length > 8) {
          console.log(chalk.dim(`     ... and ${indicator.evidence.length - 8} more`));
        }
      } else {
        console.log(chalk.dim(`   Evidence: None`));
      }
      console.log('');
    });

    console.log(chalk.dim('─'.repeat(60)));
    console.log(chalk.bold.white(`Total Score: ${analysis.score} / 100`));
    console.log('');

  } catch (error) {
    console.error(chalk.red('Error:'), error);
    process.exit(1);
  }
}

main();

