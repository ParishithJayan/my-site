const fetch = require('node-fetch');

module.exports = async function paymentNotifyHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { name, email, phone, company, payment_id, order_id, status } = req.body;

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId   = process.env.TELEGRAM_USER_ID;

  if (!botToken || !chatId) {
    return res.status(500).json({ error: 'Telegram not configured.' });
  }

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
        `💰 *Amount Paid:* ₹12,000`,
      ];

  const text = lines.filter(l => l !== null).join('\n');

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
    if (!tgData.ok) console.error('Telegram error:', tgData);
    res.json({ success: true });
  } catch (err) {
    console.error('Payment notify error:', err);
    res.status(500).json({ error: 'Notification failed.' });
  }
};
