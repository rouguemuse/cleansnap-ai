/**
 * Vercel Serverless API Route: /api/b2b-intake
 * Handles post-checkout VIP B2B Bulk Catalog Batch submissions (100-500 photos folder link,
 * custom brand watermark, target backdrop pack, and generates a ready-to-run batch job spec).
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const {
      businessName,
      contactEmail,
      folderUrl,
      watermarkText,
      backdropPack,
      photoCountEstimate,
      notes
    } = body;

    if (!contactEmail || !folderUrl) {
      res.status(400).json({
        error: 'Please provide your contact email and a link to your photo folder (Google Drive, Dropbox, OneDrive, or WeTransfer).'
      });
      return;
    }

    const orderId = `B2B-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random()
      .toString(36)
      .slice(2, 7)
      .toUpperCase()}`;

    const jobSpec = {
      orderId,
      submittedAt: new Date().toISOString(),
      businessName: businessName || 'B2B Studio Client',
      contactEmail,
      folderUrl,
      watermarkText: watermarkText || 'NONE',
      backdropPack: backdropPack || 'All 5 Studio Backdrops + Alpha .PNG + Vector .SVG',
      photoCountEstimate: photoCountEstimate || '100-200',
      notes: notes || '',
      cliCommand: `python -m backend.batch --input-url "${folderUrl}" --watermark "${
        watermarkText || ''
      }" --pack "${backdropPack || 'all'}"`
    };

    console.log('NEW B2B BULK CATALOG ORDER:', JSON.stringify(jobSpec));

    res.status(200).json({
      ok: true,
      orderId,
      message: `Order ${orderId} received! Our studio pipeline will process your folder (${photoCountEstimate || '100-200'} photos) and deliver your master .PNG + .SVG archive to ${contactEmail}.`,
      jobSpec
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to submit B2B intake form.' });
  }
}
