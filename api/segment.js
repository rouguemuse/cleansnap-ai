/**
 * Vercel Serverless API Route: /api/segment
 * Primary Commercial Engine: BRIA RMBG-2.0 Commercial API (100% Commercially Licensed + IP Indemnity)
 * Set BRIA_API_KEY in Vercel Environment Variables to enable server-side BRIA RMBG-2.0 inference.
 * When BRIA_API_KEY is not set, returns 501 so the client falls back cleanly to the MIT onnxruntime-web engine.
 */
export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const briaApiKey = process.env.BRIA_API_KEY;
  if (!briaApiKey) {
    res.status(501).json({
      error: 'BRIA_API_KEY not configured; falling back to permissive MIT ONNX engine.'
    });
    return;
  }

  try {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const rawBody = Buffer.concat(chunks);

    const briaResp = await fetch('https://engine.prod.bria-api.com/v1/background/remove', {
      method: 'POST',
      headers: {
        api_token: briaApiKey,
        'Content-Type': req.headers['content-type']
      },
      body: rawBody
    });

    if (!briaResp.ok) {
      const errText = await briaResp.text();
      res.status(briaResp.status).json({ error: errText });
      return;
    }

    const data = await briaResp.json();
    if (data.result_url) {
      const imgResp = await fetch(data.result_url);
      const arrayBuf = await imgResp.arrayBuffer();
      res.setHeader('Content-Type', 'image/png');
      res.status(200).send(Buffer.from(arrayBuf));
      return;
    }

    res.status(500).json({ error: 'Unexpected response from BRIA API' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Segmentation failed' });
  }
}
