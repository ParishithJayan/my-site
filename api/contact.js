const fetch = require('node-fetch');

module.exports = async function contactHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const { name, email, message, automate } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email and message are required.' });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId   = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return res.status(500).json({ error: 'Telegram not configured.' });
  }

  const text = [
    `📩 *New enquiry from CfCE website*`,
    ``,
    `👤 *Name:* ${name}`,
    `📧 *Email:* ${email}`,
    ``,
    `💬 *Message:*`,
    message,
    automate ? `\n🔧 *Wants to automate:* ${automate}` : '',
  ].filter(l => l !== undefined).join('\n');

  try {
    const tgRes = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
        }),
      }
    );

    const tgData = await tgRes.json();

    if (!tgData.ok) {
      console.error('Telegram error:', tgData);
      return res.status(500).json({ error: 'Failed to send message.' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Contact handler error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
