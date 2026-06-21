const fetch = require('node-fetch');

module.exports = async function contactHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { name, email, phone, message, automate, source } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  const isWaitlist = source === 'waitlist';
  const heading = isWaitlist
    ? `🔔 *Waitlist signup — cohort registration closed*`
    : `📩 *New enquiry from CfCE website*`;
  const emailSubject = isWaitlist
    ? 'Waitlist signup — CfCE registration closed'
    : 'New enquiry — CfCE website';

  const text = [
    heading,
    ``,
    `👤 *Name:* ${name}`,
    `📧 *Email:* ${email}`,
    phone ? `📱 *Phone:* ${phone}` : null,
    message ? `\n💬 *Message:*\n${message}` : null,
    automate ? `\n🔧 *Wants to automate:* ${automate}` : null,
  ].filter(l => l !== null).join('\n');

  // Plain-text version for email — strip Telegram Markdown (bold asterisks).
  const emailBody = text.replace(/[*]/g, '');

  // ── Telegram (best-effort) ──────────────────────────────────────────────
  async function notifyTelegram() {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId   = process.env.TELEGRAM_USER_ID;
    if (!botToken || !chatId) {
      console.error('Telegram not configured — skipping.');
      return false;
    }
    try {
      const tgRes = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
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
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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

  if (telegramSent || emailSent) {
    return res.json({ success: true, telegram: telegramSent, email: emailSent });
  }
  console.error('Contact handler error: all notification channels failed.');
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
};
