/**
 * Vercel Serverless API Route: /api/pro-assets
 * Cryptographically Server-Gated Premium Backdrop Pack Delivery
 *
 * These 6 high-resolution studio backdrop definitions do NOT exist in the frontend bundle.
 * The server verifies the HMAC-SHA256 token signed with LICENSE_SIGNING_SECRET before serving the asset.
 */
import crypto from 'node:crypto';

function getSigningSecret() {
  return process.env.LICENSE_SIGNING_SECRET || 'CleanSnap_ContextMuse_2026';
}

function verifyHmacAccessToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadB64, sig] = token.split('.');
  const expectedSig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(payloadB64)
    .digest('base64url');
  if (sig !== expectedSig) return null;
  try {
    return JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

const SERVER_GATED_BACKDROPS = {
  // PACK 1: EVENT & PARTY RENTAL PACK ($9)
  rental_twilight_patio: {
    pack: 'pack_rental',
    shadowColor: 'rgba(6, 15, 28, 0.62)',
    shadowBlur: 28,
    shadowOffsetY: 14,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1448 1086" width="1448" height="1086">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0b132b"/>
          <stop offset="56%" stop-color="#1c2541"/>
          <stop offset="62%" stop-color="#283845"/>
        </linearGradient>
        <linearGradient id="turf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1b4332"/>
          <stop offset="40%" stop-color="#2d6a4f"/>
          <stop offset="100%" stop-color="#081c15"/>
        </linearGradient>
        <radialGradient id="bistro" cx="50%" cy="22%" r="55%">
          <stop offset="0%" stop-color="rgba(251, 191, 36, 0.32)"/>
          <stop offset="100%" stop-color="rgba(251, 191, 36, 0)"/>
        </radialGradient>
      </defs>
      <rect width="1448" height="670" fill="url(#sky)"/>
      <rect width="1448" height="1086" fill="url(#bistro)"/>
      <rect y="640" width="1448" height="446" fill="url(#turf)"/>
      <g fill="#fde68a" opacity="0.88">
        <circle cx="180" cy="140" r="9"/><circle cx="390" cy="175" r="10"/><circle cx="620" cy="190" r="11"/>
        <circle cx="850" cy="185" r="11"/><circle cx="1080" cy="165" r="10"/><circle cx="1290" cy="130" r="9"/>
      </g>
    </svg>`
  },
  rental_event_pavilion: {
    pack: 'pack_rental',
    shadowColor: 'rgba(35, 20, 8, 0.54)',
    shadowBlur: 30,
    shadowOffsetY: 15,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1448 1086" width="1448" height="1086">
      <defs>
        <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#f8fafc"/>
          <stop offset="100%" stop-color="#e2e8f0"/>
        </linearGradient>
        <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#b45309"/>
          <stop offset="50%" stop-color="#92400e"/>
          <stop offset="100%" stop-color="#78350f"/>
        </linearGradient>
      </defs>
      <rect width="1448" height="660" fill="url(#wall)"/>
      <rect y="645" width="1448" height="18" fill="#cbd5e1"/>
      <rect y="663" width="1448" height="423" fill="url(#wood)"/>
    </svg>`
  },

  // PACK 2: AUTO & DEALERSHIP SHOWROOM PACK ($9)
  auto_obsidian_cyclorama: {
    pack: 'pack_auto',
    shadowColor: 'rgba(0, 0, 0, 0.85)',
    shadowBlur: 38,
    shadowOffsetY: 18,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1448 1086" width="1448" height="1086">
      <defs>
        <radialGradient id="cyc" cx="50%" cy="42%" r="65%">
          <stop offset="0%" stop-color="#27272a"/>
          <stop offset="55%" stop-color="#11131a"/>
          <stop offset="100%" stop-color="#050609"/>
        </radialGradient>
        <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#18181b"/>
          <stop offset="30%" stop-color="#090a0f"/>
          <stop offset="100%" stop-color="#040507"/>
        </linearGradient>
      </defs>
      <rect width="1448" height="680" fill="url(#cyc)"/>
      <rect y="680" width="1448" height="406" fill="url(#floor)"/>
      <rect x="220" y="75" width="1008" height="14" rx="7" fill="#e5c158" opacity="0.65"/>
    </svg>`
  },
  auto_led_bay: {
    pack: 'pack_auto',
    shadowColor: 'rgba(0, 0, 0, 0.82)',
    shadowBlur: 36,
    shadowOffsetY: 16,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1448 1086" width="1448" height="1086">
      <defs>
        <linearGradient id="bay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#090d16"/>
          <stop offset="62%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
      </defs>
      <rect width="1448" height="1086" fill="url(#bay)"/>
      <g stroke="#38bdf8" stroke-width="6" opacity="0.7">
        <line x1="220" y1="90" x2="540" y2="90"/>
        <line x1="908" y1="90" x2="1228" y2="90"/>
        <line x1="140" y1="180" x2="1308" y2="180" stroke="#f8fafc" stroke-width="8"/>
      </g>
    </svg>`
  },

  // PACK 3: E-COMMERCE & APPAREL EDITORIAL PACK ($9)
  ecom_travertine_podium: {
    pack: 'pack_ecom',
    shadowColor: 'rgba(68, 52, 36, 0.42)',
    shadowBlur: 28,
    shadowOffsetY: 14,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1448 1086" width="1448" height="1086">
      <defs>
        <linearGradient id="travWall" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#f5f0e6"/>
          <stop offset="100%" stop-color="#dfd5c3"/>
        </linearGradient>
        <linearGradient id="travFloor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#d5c7b2"/>
          <stop offset="100%" stop-color="#bca98e"/>
        </linearGradient>
      </defs>
      <rect width="1448" height="710" fill="url(#travWall)"/>
      <rect y="710" width="1448" height="376" fill="url(#travFloor)"/>
    </svg>`
  },
  ecom_brushed_linen: {
    pack: 'pack_ecom',
    shadowColor: 'rgba(45, 38, 30, 0.38)',
    shadowBlur: 26,
    shadowOffsetY: 12,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1448 1086" width="1448" height="1086">
      <defs>
        <radialGradient id="linen" cx="50%" cy="45%" r="65%">
          <stop offset="0%" stop-color="#faf8f5"/>
          <stop offset="70%" stop-color="#ebe4d8"/>
          <stop offset="100%" stop-color="#d6cbb9"/>
        </radialGradient>
      </defs>
      <rect width="1448" height="1086" fill="url(#linen)"/>
    </svg>`
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const styleId = req.query?.style || req.body?.style;
  const token =
    req.query?.token ||
    req.body?.token ||
    (req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '') : '');

  const asset = SERVER_GATED_BACKDROPS[styleId];
  if (!asset) {
    res.status(404).json({ error: 'Unknown premium backdrop style.' });
    return;
  }

  const decoded = verifyHmacAccessToken(token);
  if (!decoded || !Array.isArray(decoded.ent)) {
    res.status(403).json({
      locked: true,
      requiredPack: asset.pack,
      error: 'Premium Backdrop Pack requires an active Stripe unlock token.'
    });
    return;
  }

  const hasAccess = decoded.ent.includes('all') || decoded.ent.includes(asset.pack);
  if (!hasAccess) {
    res.status(403).json({
      locked: true,
      requiredPack: asset.pack,
      error: `Your current license does not include ${asset.pack}. Upgrade to unlock.`
    });
    return;
  }

  const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(asset.svg, 'utf8').toString('base64')}`;
  res.status(200).json({
    unlocked: true,
    styleId,
    pack: asset.pack,
    svgDataUrl,
    shadowColor: asset.shadowColor,
    shadowBlur: asset.shadowBlur,
    shadowOffsetY: asset.shadowOffsetY
  });
}
