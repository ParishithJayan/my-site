require('dotenv').config();
const express = require('express');
const path    = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Clean URL routes — serve pages without .html extension
const pages = ['enroll', 'thank-you', 'curriculum', 'privacy-policy', 'terms-and-conditions', 'refund-policy'];
pages.forEach(page => {
  app.get(`/${page}`, (req, res) => res.sendFile(path.join(__dirname, `${page}.html`)));
});

// Route all /api/* requests to handler files in api/
app.post('/api/chat', require('./api/chat'));
app.post('/api/generate-proposal', require('./api/generate-proposal'));
app.post('/api/contact', require('./api/contact'));
app.post('/api/create-order', require('./api/create-order'));
app.post('/api/payment-notify', require('./api/payment-notify'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  CfCE dev server running at http://localhost:${PORT}\n`);
});
