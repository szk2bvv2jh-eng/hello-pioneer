export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body;

  // Resend event shape: { type: "email.delivered", data: { email_id, to, tags } }
  const rawType = body?.type ?? '';
  if (!rawType.startsWith('email.')) {
    return res.status(200).json({ ok: true, skipped: true });
  }

  const eventType = rawType.replace('email.', '');
  const emailId   = body?.data?.email_id;
  const toField   = body?.data?.to;
  const recipient = Array.isArray(toField) ? toField[0] : toField;

  // Resend sends tags as an object { note_id: "..." } in webhook payloads
  const tags   = body?.data?.tags;
  const noteId = tags?.note_id ?? (Array.isArray(tags) ? tags.find(t => t.name === 'note_id')?.value : undefined);

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
