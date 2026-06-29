import crypto from 'node:crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Buffer the raw body from the stream — needed for HMAC verification.
  // Must happen before any attempt to read req.body.
  const rawBody = await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end',  () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (secret) {
    if (!verifySignature(rawBody, req.headers, secret)) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const rawType = body?.type ?? '';
  if (!rawType.startsWith('email.')) {
    return res.status(200).json({ ok: true, skipped: true });
  }

  const eventType = rawType.replace('email.', '');
  const emailId   = body?.data?.email_id;
  const toField   = body?.data?.to;
  const recipient = Array.isArray(toField) ? toField[0] : toField;

  const tags   = body?.data?.tags;
  const noteId = tags?.note_id
    ?? (Array.isArray(tags) ? tags.find(t => t.name === 'note_id')?.value : undefined);

  if (!emailId || !recipient || !noteId) {
    return res.status(200).json({ ok: true, skipped: true });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  const dbRes = await fetch(`${supabaseUrl}/rest/v1/email_events`, {
    method: 'POST',
    headers: {
      apikey:          supabaseKey,
      Authorization:  `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
      Prefer:         'return=minimal',
    },
    body: JSON.stringify({ message_id: emailId, note_id: noteId, recipient, event_type: eventType }),
  });

  if (!dbRes.ok) {
    const text = await dbRes.text();
    console.error('Supabase insert failed:', text);
    return res.status(502).json({ error: text });
  }

  return res.status(200).json({ ok: true });
}

// Svix HMAC-SHA256 verification.
// Signed content: "{svix-id}.{svix-timestamp}.{raw-body}"
// Secret format:  "whsec_{base64}"
function verifySignature(rawBody, headers, secret) {
  const msgId        = headers['svix-id'];
  const msgTimestamp = headers['svix-timestamp'];
  const msgSig       = headers['svix-signature'];

  if (!msgId || !msgTimestamp || !msgSig) return false;

  // Reject replays older than 5 minutes
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(msgTimestamp));
  if (ageSeconds > 300) return false;

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const toSign      = `${msgId}.${msgTimestamp}.${rawBody}`;
  const expected    = crypto.createHmac('sha256', secretBytes).update(toSign).digest('base64');

  // Header may carry multiple space-separated "v1,<sig>" candidates
  return msgSig.split(' ').some(candidate => {
    const sig = candidate.replace(/^v1,/, '');
    try {
      return crypto.timingSafeEqual(Buffer.from(sig, 'base64'), Buffer.from(expected, 'base64'));
    } catch {
      return false;
    }
  });
}
