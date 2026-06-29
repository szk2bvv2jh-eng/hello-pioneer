export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { recipient, noteTitle, noteContent, noteId, appUrl } = req.body;

  if (!recipient || !noteTitle) {
    return res.status(400).json({ error: 'recipient and noteTitle are required' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Email service not configured' });
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(noteTitle)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#111827;padding:24px 32px;">
            <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">Pioneer Notes</p>
            <p style="margin:6px 0 0;color:#9ca3af;font-size:13px;">Someone shared a note with you</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px;font-size:22px;color:#111827;font-weight:700;">${escHtml(noteTitle)}</h1>
            <div style="background:#f9fafb;border-left:3px solid #111827;border-radius:0 4px 4px 0;padding:16px 20px;margin-bottom:28px;">
              <p style="margin:0;color:#374151;font-size:15px;line-height:1.7;white-space:pre-wrap;">${escHtml(noteContent || '(no content)')}</p>
            </div>
            ${appUrl ? `<a href="${escHtml(appUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:6px;font-size:14px;font-weight:600;">View all notes →</a>` : ''}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">Sent via Pioneer Notes · <a href="${escHtml(appUrl || '#')}" style="color:#6b7280;text-decoration:underline;">Open app</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Pioneer Notes <onboarding@resend.dev>',
        to: [recipient],
        subject: `Note shared with you: ${noteTitle}`,
        html,
        ...(noteId ? { tags: [{ name: 'note_id', value: String(noteId) }] } : {}),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(502).json({ error: data.message || 'Failed to send email' });
    }

    return res.status(200).json({ ok: true, id: data.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
