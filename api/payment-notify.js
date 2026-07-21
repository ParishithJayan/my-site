const fetch = require('node-fetch');

module.exports = async function paymentNotifyHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { name, email, phone, company, payment_id, order_id, status, amount } = req.body;
  const amountStr = amount ? (amount / 100).toLocaleString('en-IN') : '15,000';

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId   = process.env.TELEGRAM_USER_ID;

  const cancelled = status === 'cancelled';

  const lines = cancelled
    ? [
        `❌ *Payment Cancelled — CfCE*`,
        ``,
        `👤 *Name:* ${name}`,
        `📧 *Email:* ${email}`,
        `📱 *Phone/WhatsApp:* ${phone}`,
        company ? `🏢 *Company:* ${company}` : null,
        ``,
        `📦 *Order ID:* \`${order_id}\``,
        `ℹ️ The user opened Razorpay but did not complete payment.`,
      ]
    : [
        `🎉 *New Bootcamp Enrollment — CfCE*`,
        ``,
        `👤 *Name:* ${name}`,
        `📧 *Email:* ${email}`,
        `📱 *Phone/WhatsApp:* ${phone}`,
        company ? `🏢 *Company:* ${company}` : null,
        ``,
        `💳 *Payment ID:* \`${payment_id}\``,
        `📦 *Order ID:* \`${order_id}\``,
        `💰 *Amount Paid:* ₹${amountStr}`,
      ];

  const text = lines.filter(l => l !== null).join('\n');

  // Plain-text version of the same details for email — strip Telegram Markdown
  // (asterisks for bold, backticks for monospace).
  const emailBody = text.replace(/[*`]/g, '');
  const emailSubject = cancelled
    ? 'Payment Cancelled — CfCE Bootcamp'
    : 'New Bootcamp Enrollment — CfCE';

  // ── Telegram (best-effort) ──────────────────────────────────────────────
  // Telegram is banned in India until 22 June 2026, so it may fail silently.
  // We never let a Telegram failure block the email notification.
  async function notifyTelegram() {
    if (!botToken || !chatId) {
      console.error('Telegram not configured — skipping.');
      return false;
    }
    try {
      const tgRes = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
        }
      );
      const tgData = await tgRes.json();
      if (!tgData.ok) {
        console.error('Telegram error:', tgData);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Telegram send failed:', err);
      return false;
    }
  }

  // ── Email via Resend (same details as the Telegram message) ─────────────
  async function notifyEmail() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('RESEND_API_KEY not configured — skipping email.');
      return false;
    }
    try {
      const mailRes = await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          // Keep onboarding@resend.dev on Resend free tier; upgrade to custom domain when ready
          from:    'Parishith — CfCE <onboarding@resend.dev>',
          to:      'jparishith@gmail.com',
          subject: emailSubject,
          text:    emailBody,
        }),
      });
      if (!mailRes.ok) {
        const err = await mailRes.text();
        console.error('Resend error:', err);
        return false;
      }
      return true;
    } catch (err) {
      console.error('Email send failed:', err);
      return false;
    }
  }

  const [telegramSent, emailSent] = await Promise.all([notifyTelegram(), notifyEmail()]);

  // Succeed if at least one channel delivered the notification.
  if (telegramSent || emailSent) {
    return res.json({ success: true, telegram: telegramSent, email: emailSent });
  }
  console.error('Payment notify error: all notification channels failed.');
  return res.status(500).json({ error: 'Notification failed.' });
};
