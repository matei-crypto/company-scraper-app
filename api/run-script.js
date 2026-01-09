// Vercel serverless function to run CLI scripts
// Scripts now use Vercel Blob Storage for persistence

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const { script, params = {} } = req.body;

  const scriptModules = {
    'scrape': () => import('../src/scrapers/companiesHouse.js'),
    'analyze-websites': () => import('../src/enrichers/websiteAnalyzer.js'),
    'compute-scores': () => import('../src/utils/computeAndStoreScores.js'),
    'recompute-msp-scores': () => import('../src/utils/recomputeMSPScores.js'),
    'extract-docs': () => import('../src/enrichers/documentExtractor.js'),
    'download-docs': () => import('../src/utils/downloadDocuments.js'),
    'sync-docs': () => import('../src/utils/syncDocuments.js'),
    'load-csv': () => import('../src/utils/loadFromCSV.js'),
    'dashboard': () => import('../src/dashboard.js'),
    'scorecard-all': () => import('../src/scorecardAll.js'),
    'top-companies': () => import('../src/top-companies.js')
  };

  if (!script || !scriptModules[script]) {
    return res.status(400).json({ 
      error: 'Invalid script',
      allowedScripts: Object.keys(scriptModules)
    });
  }

  try {
    // Import and execute the script
    const scriptModule = await scriptModules[script]();
    
    // Most scripts export a default function or have a main() function
    const result = await scriptModule.default?.() || await scriptModule.main?.();

    return res.status(200).json({
      success: true,
      script,
      message: 'Script executed successfully',
      result: result || 'Script completed'
    });
  } catch (error) {
    console.error(`Error running script ${script}:`, error);
    return res.status(500).json({
      error: 'Script execution failed',
      script,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
