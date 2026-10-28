import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { runMigrations } from './db/migrate.js';
import { seedDatabase } from './db/seed.js';
import { BookingService } from './services/booking.service.js';

import authRoutes from './routes/auth.routes.js';
import discoveryRoutes from './routes/discovery.routes.js';
import holdsRoutes from './routes/holds.routes.js';
import bookingsRoutes from './routes/bookings.routes.js';
import paymentsRoutes from './routes/payments.routes.js';
import adminRoutes from './routes/admin.routes.js';
import featuresRoutes from './routes/features.routes.js';
import { errorHandler } from './middleware/error.middleware.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Middlewares
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());

// Request logger for troubleshooting
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`[HTTP] ${req.method} ${req.path}`);
  }
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api', discoveryRoutes);
app.use('/api/holds', holdsRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', featuresRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'UP',
    product: 'RailNova',
    tagline: 'Your journey, thoughtfully connected.',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend static files if built
const clientDistPath = path.resolve(process.cwd(), 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Centralized Error Handler
app.use(errorHandler);

// Background Worker for Auto-reaping Expired Seat Holds
setInterval(async () => {
  try {
    const expiredCount = await BookingService.reapExpiredHolds();
    if (expiredCount > 0) {
      console.log(`[RailNova Background Reaper] Released ${expiredCount} expired seat holds.`);
    }
  } catch (err) {
    console.error('[RailNova Background Reaper Error]', err);
  }
}, 30000);

// Initialize DB and Start Server
async function start() {
  try {
    await runMigrations();
    await seedDatabase();
    app.listen(Number(PORT), '0.0.0.0', () => {
      console.log(`=======================================================`);
      console.log(`🚆 RailNova API Server is running on http://0.0.0.0:${PORT}`);
      console.log(`   Local URL: http://localhost:${PORT}`);
      console.log(`   Tagline: "Your journey, thoughtfully connected."`);
      console.log(`   Health: http://localhost:${PORT}/api/health`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('[RailNova Startup Fatal Error]', err);
    process.exit(1);
  }
}

start();

export default app;
