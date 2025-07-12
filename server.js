/* eslint-disable no-process-exit */
const express = require('express');
const prisma = require('./src/config/database');
const { PORT } = require('./src/config/constants');

const app = express();

// Middleware to capture raw body for webhook verification
app.use('/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json());

// Routes
app.use('/webhooks', require('./src/routes/webhook'));
app.use('/api', require('./src/routes/api'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(
    `Webhook endpoint: http://localhost:${PORT}/webhooks/orders/create`,
  );
  console.log('API endpoints:');
  console.log('  - GET /api/stats/daily');
  console.log('  - GET /api/stats/overall');
  console.log('  - GET /api/orders');
  console.log('  - GET /api/orders/:id');
  console.log('  - GET /api/products/analytics');
  console.log('  - GET /api/customers/analytics');
});

