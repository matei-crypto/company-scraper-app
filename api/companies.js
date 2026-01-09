// API endpoint to query companies (read-only)
// Reads from the data files included in the deployment

export default async function handler(req, res) {
  try {
    const { readAllCompanies } = await import('../src/utils/fileSystem.js');
    const { calculateInvestmentScore } = await import('../src/schemas/CompanySchema.js');
    
    const companies = await readAllCompanies();
    
    // Get query parameters
    const { limit = 20, minScore, mspConfidence, sortBy = 'score' } = req.query;
    
    // Calculate scores and filter
    const companiesWithScores = await Promise.all(
      companies.map(async (company) => {
        const score = company.investment_score?.score 
          ? company.investment_score.score 
          : (await calculateInvestmentScore(company)).score;
        
        return {
          company_number: company.company_number,
          company_name: company.company_name,
          company_status: company.company_status,
          date_of_incorporation: company.date_of_incorporation,
          sic_codes: company.sic_codes,
          investment_score: { score },
          enrichment: {
            website: company.enrichment?.website,
            headcount: company.enrichment?.headcount,
            msp_likelihood_score: company.enrichment?.msp_likelihood_score,
            msp_likelihood_confidence: company.enrichment?.msp_likelihood_confidence,
            tech_stack: company.enrichment?.tech_stack,
          }
        };
      })
    );
    
    // Filter by MSP confidence if specified
    let filtered = companiesWithScores;
    if (mspConfidence) {
      filtered = filtered.filter(c => 
        c.enrichment?.msp_likelihood_confidence === mspConfidence
      );
    }
    
    // Filter by minimum score if specified
    if (minScore) {
      filtered = filtered.filter(c => 
        c.investment_score?.score >= parseFloat(minScore)
      );
    }
    
    // Sort
    if (sortBy === 'score') {
      filtered.sort((a, b) => 
        (b.investment_score?.score || 0) - (a.investment_score?.score || 0)
      );
    }
    
    // Limit results
    const limited = filtered.slice(0, parseInt(limit));
    
    res.status(200).json({
      total: filtered.length,
      limit: parseInt(limit),
      companies: limited
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
}
