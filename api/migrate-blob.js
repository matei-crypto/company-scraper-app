// API endpoint to trigger migration from local files to Blob Storage
// This should be run once before using the app in Vercel

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { migrateToBlob } = await import('../src/utils/migrateToBlob.js');
    await migrateToBlob();
    
    return res.status(200).json({
      success: true,
      message: 'Migration completed successfully'
    });
  } catch (error) {
    console.error('Migration error:', error);
    return res.status(500).json({
      error: 'Migration failed',
      message: error.message
    });
  }
}
