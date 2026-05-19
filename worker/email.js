// Resend client + email templates.
// Docs: https://resend.com/docs/api-reference/emails/send-email

const RESEND_URL = 'https://api.resend.com/emails';

// Send a magic-link sign-in email.
//   env.RESEND_API_KEY  — bearer token from Resend
//   env.EMAIL_FROM      — verified sender (e.g. 'onboarding@resend.dev' or your own domain)
export async function sendMagicLink(env, { to, magicUrl }) {
  if (!env?.RESEND_API_KEY) throw new Error('RESEND_API_KEY not set.');
  const from = env.EMAIL_FROM || 'onboarding@resend.dev';

  const { subject, html, text } = magicLinkTemplate({ magicUrl });

  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ from, to, subject, html, text })
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`Resend ${res.status}: ${detail}`);
  }
  return res.json();
}

// ---------- templates ----------
function magicLinkTemplate({ magicUrl }) {
  const subject = "Your sign-in link for Biba's Playground";
  const text = [
    "Welcome back to Biba's Playground.",
    "",
    "Click here to sign in (link is good for 10 minutes):",
    magicUrl,
    "",
    "If you didn't ask for this email, ignore it — no account is created until you click.",
    "",
    "— Biba's Playground"
  ].join('\n');

  // Plain, warm, on-brand. Inline styles only so it survives email clients.
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escape(subject)}</title></head>
<body style="margin:0; padding:0; background:#F2ECDE; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#141414;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2ECDE;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; background:#fff; border:2px solid #141414; border-radius:8px;">
        <tr><td style="padding:32px 32px 8px;">
          <p style="margin:0; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; color:#1F4E8C; font-family:'JetBrains Mono',monospace;">Biba's Playground</p>
          <h1 style="margin:8px 0 16px; font-family:Georgia,serif; font-size:28px; line-height:1.15;">Welcome back<span style="color:#D42A1F;">.</span></h1>
          <p style="margin:0 0 16px; font-size:16px; line-height:1.5; color:#4a4a4a;">Click below to sign in. The link is good for 10 minutes.</p>
        </td></tr>
        <tr><td style="padding:0 32px 24px;">
          <a href="${escape(magicUrl)}" style="display:inline-block; background:#141414; color:#F2ECDE; text-decoration:none; padding:14px 22px; border-radius:6px; font-weight:600; font-size:16px;">Sign me in →</a>
        </td></tr>
        <tr><td style="padding:0 32px 32px;">
          <p style="margin:0; font-size:13px; line-height:1.5; color:#6a6a6a;">If the button doesn't work, paste this URL into your browser:<br><span style="word-break:break-all; color:#1F4E8C;">${escape(magicUrl)}</span></p>
          <p style="margin:16px 0 0; font-size:12px; color:#9a9a9a; font-style:italic;">If you didn't ask for this email, you can ignore it. No account is created until you click.</p>
        </td></tr>
      </table>
      <p style="margin:16px 0 0; font-size:11px; color:#9a9a9a;">© 2026 Second 9 Labs · Built with care for human flourishing.</p>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html, text };
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
