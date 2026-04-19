const Razorpay = require('razorpay');

module.exports = async function createOrderHandler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const keyId     = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return res.status(500).json({ error: 'Payment gateway not configured.' });
  }

  const { name, email, phone, company } = req.body;

  const instance = new Razorpay({ key_id: keyId, key_secret: keySecret });

  try {
    const order = await instance.orders.create({
      amount:   1200000, // ₹12,000 in paise
      currency: 'INR',
      receipt:  'cfce_' + Date.now(),
      notes: {
        name:    name    || '',
        email:   email   || '',
        phone:   phone   || '',
        company: company || '',
      },
    });

    res.json({ order_id: order.id, key_id: keyId, amount: order.amount });
  } catch (err) {
    console.error('Razorpay create order error:', err);
    res.status(500).json({ error: 'Failed to create payment order. Please try again.' });
  }
};
