/**
 * Vercel Serverless API Route: /api/verify-stripe
 * 100% Stripe-Native Checkout Session Creator wired directly to the 5 official
 * ContextMuse Living Systems Products & Prices (with Product Image thumbnails),
 * Email Purchase Restore & Server-Signed HMAC Access Token Issuer.
 */
import crypto from 'node:crypto';

const MASTER_KEYS = new Set([
  'CSPRO-MUSE-VIP-2026',
  'CSPRO-WILDER-OWNER-2026'
]);

const TIER_CATALOG = {
  pack_rental: {
    productId: 'prod_VfXrT1MkibbEhD',
    priceId: 'price_1UeClsBfbNYsdzMhq8yKstse',
    priceCents: '900',
    name: 'CleanSnap Studio — Event & Party Rental Backdrop Pack',
    description:
      'Unlocks 06 Twilight String-Lit Patio Turf & 07 Grand Hardwood Event Pavilion studio backdrops.',
    image: 'https://bold-oppenheimer.vercel.app/products/02_CleanSnap_Event_Party_Rental_Pack_1080x1080.png',
    entitlements: ['pack_rental']
  },
  pack_auto: {
    productId: 'prod_VfXrrRH3c9XCbz',
    priceId: 'price_1UeClsBfbNYsdzMhi6h2HYmj',
    priceCents: '900',
    name: 'CleanSnap Studio — Auto & Dealership Showroom Backdrop Pack',
    description:
      'Unlocks 08 Wet Obsidian Studio Cyclorama & 09 Architectural LED Dealership Bay studio backdrops.',
    image: 'https://bold-oppenheimer.vercel.app/products/03_CleanSnap_Auto_Showroom_Pack_1080x1080.png',
    entitlements: ['pack_auto']
  },
  pack_ecom: {
    productId: 'prod_VfXr1ckoKwvMZf',
    priceId: 'price_1UeCltBfbNYsdzMhHgs81pvF',
    priceCents: '900',
    name: 'CleanSnap Studio — E-Commerce & Apparel Editorial Backdrop Pack',
    description:
      'Unlocks 10 Warm Travertine Limestone Podium & 11 Editorial Sand Linen studio backdrops.',
    image: 'https://bold-oppenheimer.vercel.app/products/04_CleanSnap_ECommerce_Apparel_Pack_1080x1080.png',
    entitlements: ['pack_ecom']
  },
  pro: {
    productId: 'prod_VfXrfpOqOvVA6D',
    priceId: 'price_1UeClsBfbNYsdzMhUuEAYTJS',
    priceCents: '1900',
    name: 'CleanSnap Studio Pro — All-Access Lifetime Bundle (All Backdrop Packs + Batch .SVG .ZIP)',
    description:
      'Unlocks all 11 studio backdrops (Rental, Auto & E-Commerce packs), unlimited batch folder uploads, Marching-Squares vector .SVG cutlines, batch .ZIP exports, and custom brand watermarks.',
    image: 'https://bold-oppenheimer.vercel.app/products/01_CleanSnap_AllAccess_Pro_Bundle_1080x1080.png',
    entitlements: ['all', 'pack_rental', 'pack_auto', 'pack_ecom']
  },
  b2b: {
    productId: 'prod_VfXrN7Lvph7noH',
    priceId: 'price_1UeCltBfbNYsdzMhq3A8VqxN',
    priceCents: '14900',
    name: 'CleanSnap Studio — Done-For-You 200-Photo Bulk Catalog Batch',
    description:
      'White-glove commercial catalog cleanup (up to 200 photos), custom brand backdrops, watermarked web previews, die-cut .SVG/.PNG master archive, plus complimentary All-Access Studio Pro key.',
    image: 'https://bold-oppenheimer.vercel.app/products/05_CleanSnap_B2B_200Photo_Bulk_Catalog_1080x1080.png',
    entitlements: ['all', 'pack_rental', 'pack_auto', 'pack_ecom', 'b2b_order']
  }
};

function getSigningSecret() {
  return process.env.LICENSE_SIGNING_SECRET || 'CleanSnap_ContextMuse_2026';
}

function computeBlockChecksum(partA, partB) {
  const digest = crypto
    .createHmac('sha256', getSigningSecret())
    .update(`${partA}-${partB}`)
    .digest('hex')
    .toUpperCase();
  return digest.slice(0, 4);
}

export function generateSignedLicenseKey(seedStr) {
  const hash = crypto.createHash('sha256').update(String(seedStr)).digest('hex').toUpperCase();
  const partA = hash.slice(0, 4);
  const partB = hash.slice(4, 8);
  const check = computeBlockChecksum(partA, partB);
  return `CSPRO-${partA}-${partB}-${check}`;
}

export function verifySignedLicenseKey(rawKey) {
  if (!rawKey) return false;
  const clean = String(rawKey).trim().toUpperCase();
  if (MASTER_KEYS.has(clean)) return true;
  const match = clean.match(/^CSPRO-([A-F0-9]{4})-([A-F0-9]{4})-([A-F0-9]{4})$/);
  if (!match) return false;
  const [, partA, partB, check] = match;
  return computeBlockChecksum(partA, partB) === check;
}

export function issueHmacAccessToken(licenseKey, entitlements = ['all'], email = null) {
  const payload = {
    sub: licenseKey,
    ent: entitlements,
    email,
    iat: Date.now()
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSigningSecret())
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${sig}`;
}

export function verifyHmacAccessToken(token) {
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const stripeSecret = process.env.STRIPE_SECRET_KEY;

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const action = body.action || req.query?.action || 'verify';

    // 1. CREATE STRIPE CHECKOUT SESSION WIRED TO CATALOG PRODUCT & PRICE ID
    if (action === 'create_checkout') {
      const tierKey = TIER_CATALOG[body.tier] ? body.tier : 'pro';
      const tierInfo = TIER_CATALOG[tierKey];
      const origin = body.origin || 'https://bold-oppenheimer.vercel.app';

      if (!stripeSecret) {
        res.status(200).json({
          url: null,
          setupRequired: true,
          message:
            'Add STRIPE_SECRET_KEY in your Vercel Environment Variables tab to activate live Stripe Checkout, or enter your license key below.'
        });
        return;
      }

      // First attempt using the official ContextMuse Living Systems catalog Price ID (includes attached Stripe product image)
      const catalogParams = new URLSearchParams();
      catalogParams.append('mode', 'payment');
      catalogParams.append(
        'success_url',
        `${origin}/?stripe_session={CHECKOUT_SESSION_ID}&tier=${tierKey}`
      );
      catalogParams.append('cancel_url', `${origin}/`);
      catalogParams.append('allow_promotion_codes', 'true');
      catalogParams.append('metadata[tier]', tierKey);
      catalogParams.append('metadata[product_id]', tierInfo.productId);
      catalogParams.append('line_items[0][price]', tierInfo.priceId);
      catalogParams.append('line_items[0][quantity]', '1');

      let stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeSecret}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: catalogParams.toString()
      });

      // Fallback if key is switched to another Stripe mode/account where priceId doesn't exist yet
      if (!stripeRes.ok) {
        const fallbackParams = new URLSearchParams();
        fallbackParams.append('mode', 'payment');
        fallbackParams.append(
          'success_url',
          `${origin}/?stripe_session={CHECKOUT_SESSION_ID}&tier=${tierKey}`
        );
        fallbackParams.append('cancel_url', `${origin}/`);
        fallbackParams.append('allow_promotion_codes', 'true');
        fallbackParams.append('metadata[tier]', tierKey);
        fallbackParams.append('line_items[0][price_data][currency]', 'usd');
        fallbackParams.append('line_items[0][price_data][unit_amount]', tierInfo.priceCents);
        fallbackParams.append('line_items[0][price_data][product_data][name]', tierInfo.name);
        fallbackParams.append(
          'line_items[0][price_data][product_data][description]',
          tierInfo.description
        );
        fallbackParams.append(
          'line_items[0][price_data][product_data][images][0]',
          tierInfo.image
        );
        fallbackParams.append('line_items[0][quantity]', '1');

        stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${stripeSecret}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: fallbackParams.toString()
        });
      }

      const sessionData = await stripeRes.json();
      if (!stripeRes.ok) {
        res.status(stripeRes.status).json({
          error: sessionData.error?.message || 'Stripe Checkout creation failed.'
        });
        return;
      }

      res.status(200).json({
        url: sessionData.url,
        sessionId: sessionData.id,
        tier: tierKey,
        productId: tierInfo.productId,
        priceId: tierInfo.priceId
      });
      return;
    }

    // 2. VERIFY LICENSE KEY, STRIPE SESSION ID, OR CUSTOMER EMAIL & ISSUE SERVER-SIGNED HMAC TOKEN
    const { sessionId, email, licenseKey } = body;

    if (licenseKey && verifySignedLicenseKey(licenseKey)) {
      const cleanKey = String(licenseKey).trim().toUpperCase();
      const entitlements = ['all', 'pack_rental', 'pack_auto', 'pack_ecom'];
      const accessToken = issueHmacAccessToken(cleanKey, entitlements, null);
      res.status(200).json({
        valid: true,
        licenseKey: cleanKey,
        accessToken,
        entitlements,
        tier: 'Studio Pro All-Access',
        method: 'license_key'
      });
      return;
    }

    if (sessionId && stripeSecret) {
      const sRes = await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
        {
          headers: { Authorization: `Bearer ${stripeSecret}` }
        }
      );
      const sData = await sRes.json();
      if (sRes.ok && sData.payment_status === 'paid') {
        const tierKey = sData.metadata?.tier || body.tier || 'pro';
        const tierInfo = TIER_CATALOG[tierKey] || TIER_CATALOG.pro;
        const custEmail = sData.customer_details?.email || null;
        const generatedKey = generateSignedLicenseKey(`${custEmail || sData.id}:${tierKey}`);
        const accessToken = issueHmacAccessToken(generatedKey, tierInfo.entitlements, custEmail);
        res.status(200).json({
          valid: true,
          licenseKey: generatedKey,
          accessToken,
          entitlements: tierInfo.entitlements,
          email: custEmail,
          tier: tierKey,
          isB2bOrder: tierKey === 'b2b',
          method: 'stripe_session'
        });
        return;
      }
    }

    if (email && stripeSecret) {
      const cleanEmail = String(email).trim().toLowerCase();
      const listRes = await fetch(`https://api.stripe.com/v1/checkout/sessions?limit=40`, {
        headers: { Authorization: `Bearer ${stripeSecret}` }
      });
      const listData = await listRes.json();
      if (listRes.ok && Array.isArray(listData.data)) {
        const paidSessions = listData.data.filter(
          (s) =>
            s.payment_status === 'paid' &&
            s.customer_details?.email?.toLowerCase() === cleanEmail
        );
        if (paidSessions.length > 0) {
          const mergedSet = new Set();
          for (const s of paidSessions) {
            const tKey = s.metadata?.tier || 'pro';
            const tInfo = TIER_CATALOG[tKey] || TIER_CATALOG.pro;
            tInfo.entitlements.forEach((e) => mergedSet.add(e));
          }
          const entitlements = Array.from(mergedSet);
          const generatedKey = generateSignedLicenseKey(cleanEmail);
          const accessToken = issueHmacAccessToken(generatedKey, entitlements, cleanEmail);
          res.status(200).json({
            valid: true,
            licenseKey: generatedKey,
            accessToken,
            entitlements,
            email: cleanEmail,
            tier: entitlements.includes('all') ? 'Studio Pro All-Access' : 'Backdrop Pack License',
            method: 'stripe_email_restore'
          });
          return;
        }
      }
    }

    res.status(400).json({
      valid: false,
      error:
        'Could not verify an active purchase for that key or email. Please check your key or complete checkout via Stripe.'
    });
  } catch (err) {
    res.status(500).json({ valid: false, error: err.message || 'Stripe verification failed.' });
  }
}
