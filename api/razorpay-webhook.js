/* ───────────────────────────────────────────────────────────
   RAZORPAY WEBHOOK  —  automatic welcome email to the buyer.

   Why a webhook and not a browser callback:
   api/payment-notify.js is fired by the buyer's browser once
   checkout succeeds. Close the tab a second too early and that
   call never happens. Razorpay calls THIS endpoint server to
   server and retries on failure — so the welcome email goes out
   at 3 AM with nobody watching.

   Owner alerts (Telegram + email to Parishith) stay in
   payment-notify.js. This file only ever emails the BUYER, so
   the two paths can never double up on each other.

   Dashboard → Settings → Webhooks:
     URL     https://www.codingforcivilengineers.com/api/razorpay-webhook
     Secret  → same value as RAZORPAY_WEBHOOK_SECRET
     Event   payment.captured   ← subscribe to this one only

   Use the www host. The apex 307-redirects to www and Razorpay does not
   reliably follow redirects, so the apex URL fails silently.

   Env vars: RAZORPAY_WEBHOOK_SECRET, RESEND_API_KEY,
             WHATSAPP_GROUP_URL, FROM_EMAIL (optional)
   ─────────────────────────────────────────────────────────── */

const crypto = require('crypto');
const fetch  = require('node-fetch');
const COHORT = require('../cohort-config.js');

// Resend refuses to deliver to third parties from the shared onboarding@resend.dev
// sender, so this must be an address on a domain verified in Resend. The verified
// domain is the send. subdomain, not the root — sending reputation stays isolated
// from codingforcivilengineers.com. Recipients see the "Parishith — CfCE" display
// name, and replies go to supportEmail via reply_to below.
const FROM_EMAIL = process.env.FROM_EMAIL || 'Parishith — CfCE <welcome@send.codingforcivilengineers.com>';

/* ── Raw body ──────────────────────────────────────────────
   Razorpay signs the exact bytes it sent. Re-serialising a parsed
   object can change them, so read the stream BEFORE touching
   req.body — on Vercel req.body is populated lazily and reading it
   first would drain the stream out from under us.               */
async function readRawBody(req) {
  const drained = typeof req.readableEnded === 'boolean' ? req.readableEnded : !req.readable;

  if (!drained) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (chunks.length) return Buffer.concat(chunks).toString('utf8');
  }

  // Already consumed. The dev server mounts express.raw() on this route, so
  // req.body is the untouched Buffer.
  const body = req.body;
  if (Buffer.isBuffer(body)) return body.toString('utf8');
  if (typeof body === 'string')  return body;
  if (body && typeof body === 'object') {
    console.warn('razorpay-webhook: body was pre-parsed; re-serialising, signature may not match.');
    return JSON.stringify(body);
  }
  return '';
}

function signatureValid(rawBody, signature, secret) {
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(signature), 'utf8');
  if (a.length !== b.length) return false;          // timingSafeEqual throws on length mismatch
  return crypto.timingSafeEqual(a, b);
}

/* ── Idempotency ───────────────────────────────────────────
   Razorpay retries anything we do not answer with a 2xx. A payment
   is recorded only once its email has actually gone out, so a retry
   after a failed send still delivers, while a retry after a
   successful one does not send twice.

   This lives in instance memory, so a cold start forgets it. That is
   an acceptable duplicate-email risk, not a correctness one — the
   send only happens on a signed payment.captured for that id.   */
const emailed = new Set();
function alreadyEmailed(id) { return id && emailed.has(id); }
function rememberEmailed(id) {
  if (!id) return;
  emailed.add(id);
  if (emailed.size > 500) emailed.delete(emailed.values().next().value);
}

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function firstName(full) {
  const part = String(full || '').trim().split(/\s+/)[0] || '';
  return part ? part.charAt(0).toUpperCase() + part.slice(1) : '';
}

function formatDate(unixSeconds) {
  const ms = unixSeconds ? unixSeconds * 1000 : Date.now();
  return new Date(ms).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
  });
}

/* ── Email content ─────────────────────────────────────────── */
function buildEmail(details) {
  const { name, amount, paymentId, paidOn, whatsappUrl, backfill } = details;

  // backfill: true is for students who paid before this automation existed.
  // "Payment received" reads oddly a week after the fact, so the opening
  // points forward instead. Everything else is identical.
  const opener  = backfill ? 'Now let us get you ready.' : 'Payment received.';
  const leadIn  = backfill ? '' : 'Payment received. ';

  const hi       = name ? `, ${name}` : '';
  const amountIn = '₹' + Number(amount || 0).toLocaleString('en-IN');
  const support  = COHORT.supportEmail;

  // Without a group link configured the email still has to make sense, so the
  // WhatsApp step degrades to the promise Parishith used to send by hand.
  const hasLink = Boolean(whatsappUrl);

  const text = [
    `Your seat is confirmed${hi}. ${opener}`,
    ``,
    `You are in the ${COHORT.courseName} — ${COHORT.sessionCount} live sessions starting ${COHORT.startDate}, ${COHORT.sessionTime}.`,
    `You will write C# from scratch and finish having built automations that run on your own models.`,
    ``,
    `RECEIPT`,
    `Amount paid: ${amountIn}`,
    `Payment ID: ${paymentId}`,
    `Date: ${paidOn}`,
    ``,
    hasLink
      ? `FIRST THING — JOIN THE WHATSAPP GROUP\n${whatsappUrl}\n\nSession links, recordings, code files and the fastest way to reach me when you get stuck all live in that group. Do join now so you do not miss the joining link.`
      : `FIRST THING — WHATSAPP GROUP\nI will add you to the cohort WhatsApp group shortly. Session links, recordings and code files all go out there.`,
    ``,
    `WHAT HAPPENS NEXT`,
    hasLink
      ? `1. Join the WhatsApp group using the link above. Do this now.`
      : `1. Watch for the WhatsApp group invite coming to your number.`,
    `2. Install STAAD.Pro and Visual Studio Community before Day 1. The setup guide goes out in the group.`,
    `3. Turn up on ${COHORT.startDate}. Bring a model you are tired of touching by hand.`,
    ``,
    `No programming background? That is exactly who this cohort is built for. Trust me — most engineers who came before you started at exactly the same place, and they walked out with working tools.`,
    ``,
    `Any question before we start, just reply to this email. It comes straight to me.`,
    ``,
    `Parishith Jayan`,
    `Coding for Civil Engineers`,
    `${support}`,
  ].join('\n');

  const whatsappBlock = hasLink
    ? `
              <tr>
                <td style="padding:0 32px 8px;">
                  <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1E2D40;"><strong>First thing — join the WhatsApp group.</strong> Session links, recordings, code files and the fastest way to reach me when you get stuck all live there.</p>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:0 32px 8px;">
                  <a href="${esc(whatsappUrl)}" style="display:inline-block;background:#1D9E75;color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:15px 38px;border-radius:6px;">Join the cohort WhatsApp group →</a>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding:12px 32px 0;">
                  <p style="margin:0;font-size:13px;line-height:1.5;color:#6b7785;">Do join now — that is where your joining link goes out.</p>
                </td>
              </tr>`
    : `
              <tr>
                <td style="padding:0 32px;">
                  <p style="margin:0;font-size:16px;line-height:1.6;color:#1E2D40;"><strong>WhatsApp group:</strong> I will add you to the cohort group shortly. Session links, recordings and code files all go out there.</p>
                </td>
              </tr>`;

  const stepOne = hasLink
    ? 'Join the WhatsApp group using the button above. Do this now.'
    : 'Watch for the WhatsApp group invite coming to your number.';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your seat is confirmed</title>
</head>
<body style="margin:0;padding:0;background:#F4F6F8;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your seat in the ${esc(COHORT.courseName)} is confirmed — here is how to join the group and what to do before Day 1.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F6F8;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">

          <tr>
            <td style="background:#1E2D40;padding:22px 32px;">
              <p style="margin:0;font-size:17px;font-weight:700;color:#ffffff;letter-spacing:0.3px;">Coding for Civil Engineers</p>
            </td>
          </tr>

          <tr>
            <td style="padding:34px 32px 0;">
              <span style="display:inline-block;background:#E1F5EE;color:#12704F;font-size:12px;font-weight:700;letter-spacing:0.7px;text-transform:uppercase;padding:7px 13px;border-radius:20px;">Seat confirmed</span>
              <h1 style="margin:18px 0 0;font-size:27px;line-height:1.3;color:#1E2D40;">You are in${esc(hi)}.</h1>
              <p style="margin:14px 0 0;font-size:16px;line-height:1.6;color:#41505f;">${leadIn}You have a seat in the <strong style="color:#1E2D40;">${esc(COHORT.courseName)}</strong> — ${esc(COHORT.sessionCount)} live sessions starting <strong style="color:#1E2D40;">${esc(COHORT.startDate)}</strong>, ${esc(COHORT.sessionTime)}.</p>
              <p style="margin:14px 0 26px;font-size:16px;line-height:1.6;color:#41505f;">You will write C# from scratch and finish having built automations that run on your own models.</p>
            </td>
          </tr>
${whatsappBlock}

          <tr>
            <td style="padding:28px 32px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F6F8;border-radius:8px;">
                <tr><td style="padding:18px 20px;">
                  <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.9px;text-transform:uppercase;color:#6b7785;">Receipt</p>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;color:#41505f;">
                    <tr>
                      <td style="padding:3px 0;">Amount paid</td>
                      <td align="right" style="padding:3px 0;font-weight:700;color:#1E2D40;">${esc(amountIn)}</td>
                    </tr>
                    <tr>
                      <td style="padding:3px 0;">Payment ID</td>
                      <td align="right" style="padding:3px 0;font-family:Consolas,Monaco,monospace;font-size:13px;color:#1E2D40;">${esc(paymentId)}</td>
                    </tr>
                    <tr>
                      <td style="padding:3px 0;">Date</td>
                      <td align="right" style="padding:3px 0;color:#1E2D40;">${esc(paidOn)}</td>
                    </tr>
                  </table>
                </td></tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:30px 32px 0;">
              <h2 style="margin:0 0 14px;font-size:17px;color:#1E2D40;">What happens next</h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:15px;line-height:1.6;color:#41505f;">
                <tr>
                  <td width="26" valign="top" style="padding:0 0 12px;font-weight:700;color:#1D9E75;">1.</td>
                  <td style="padding:0 0 12px;">${esc(stepOne)}</td>
                </tr>
                <tr>
                  <td width="26" valign="top" style="padding:0 0 12px;font-weight:700;color:#1D9E75;">2.</td>
                  <td style="padding:0 0 12px;">Install STAAD.Pro and Visual Studio Community before Day 1. The setup guide goes out in the group.</td>
                </tr>
                <tr>
                  <td width="26" valign="top" style="font-weight:700;color:#1D9E75;">3.</td>
                  <td>Turn up on ${esc(COHORT.startDate)}. Bring a model you are tired of touching by hand.</td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:26px 32px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#E1F5EE;border-radius:8px;">
                <tr><td style="padding:16px 20px;">
                  <p style="margin:0;font-size:15px;line-height:1.6;color:#1E2D40;">No programming background? That is exactly who this cohort is built for. Trust me — most engineers who came before you started at exactly the same place, and they walked out with working tools.</p>
                </td></tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:26px 32px 34px;">
              <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#41505f;">Any question before we start, just reply to this email. It comes straight to me.</p>
              <p style="margin:0;font-size:15px;line-height:1.6;color:#1E2D40;"><strong>Parishith Jayan</strong><br><span style="color:#6b7785;">Coding for Civil Engineers</span></p>
            </td>
          </tr>

          <tr>
            <td style="background:#F4F6F8;padding:18px 32px;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#8b95a1;">You are receiving this because you enrolled at codingforcivilengineers.com. Questions? <a href="mailto:${esc(support)}" style="color:#1D9E75;">${esc(support)}</a></p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject: name
      ? `${name}, your seat is confirmed — ${COHORT.courseName}`
      : `Your seat is confirmed — ${COHORT.courseName}`,
    text,
    html,
  };
}

async function sendWelcomeEmail(to, details) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('razorpay-webhook: RESEND_API_KEY not configured — cannot send welcome email.');
    return false;
  }

  const { subject, text, html } = buildEmail(details);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:     FROM_EMAIL,
        to,
        reply_to: COHORT.supportEmail,
        subject,
        text,
        html,
      }),
    });
    if (!res.ok) {
      console.error('razorpay-webhook: Resend error', res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('razorpay-webhook: welcome email failed to send:', err);
    return false;
  }
}

/* ── Handler ───────────────────────────────────────────────── */
module.exports = async function razorpayWebhookHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('razorpay-webhook: RAZORPAY_WEBHOOK_SECRET not configured — rejecting.');
    return res.status(500).json({ error: 'Webhook not configured.' });
  }

  const rawBody = await readRawBody(req);
  if (!signatureValid(rawBody, req.headers['x-razorpay-signature'], secret)) {
    console.error('razorpay-webhook: signature verification failed — ignoring request.');
    return res.status(401).json({ error: 'Invalid signature.' });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (err) {
    console.error('razorpay-webhook: payload was not valid JSON:', err);
    return res.status(400).json({ error: 'Malformed payload.' });
  }

  // Anything we are not subscribed to is acknowledged so Razorpay stops retrying.
  if (event.event !== 'payment.captured') {
    return res.json({ ok: true, ignored: event.event });
  }

  const payment = (event.payload && event.payload.payment && event.payload.payment.entity) || {};
  const notes   = payment.notes || {};

  // payment.captured fires for every payment on the account. A payment tagged
  // for some other product is skipped; an untagged one is treated as a cohort
  // sale, so nothing silently stops sending if the tag ever goes missing.
  if (notes.product && notes.product !== 'openstaad-bootcamp') {
    return res.json({ ok: true, emailed: false, reason: 'different product: ' + notes.product });
  }

  const paymentId = payment.id;
  const to        = payment.email || notes.email;

  if (!to) {
    console.error('razorpay-webhook: no buyer email on payment', paymentId, '— nothing to send.');
    return res.json({ ok: true, emailed: false, reason: 'no buyer email' });
  }

  if (alreadyEmailed(paymentId)) {
    return res.json({ ok: true, emailed: false, reason: 'already sent' });
  }

  const sent = await sendWelcomeEmail(to, {
    name:        firstName(notes.name),
    amount:      (payment.amount || 0) / 100,
    paymentId:   paymentId,
    paidOn:      formatDate(payment.created_at),
    whatsappUrl: process.env.WHATSAPP_GROUP_URL || '',
  });

  if (!sent) {
    // Non-2xx so Razorpay retries — nothing was recorded, so the retry delivers.
    return res.status(500).json({ error: 'Welcome email failed to send.' });
  }

  rememberEmailed(paymentId);
  console.log('razorpay-webhook: welcome email sent to', to, 'for', paymentId);
  return res.json({ ok: true, emailed: true });
};

// Exposed so a one-off backfill can reuse this exact template rather than
// keeping a second copy that drifts out of step.
module.exports.buildEmail      = buildEmail;
module.exports.sendWelcomeEmail = sendWelcomeEmail;
