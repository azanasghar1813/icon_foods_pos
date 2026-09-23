import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import config from './config/index.js';
import { notFoundHandler } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import apiRoutes from './routes/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { globalLimiter } from './middleware/rateLimiter.js';

const app = express();

// Trust proxy if running behind reverse proxy (e.g. Nginx, Heroku)
app.set('trust proxy', 1);

// Apply global rate limiter
app.use(globalLimiter);

// --- GLOBAL MIDDLEWARE ---

// Security Headers
app.use(helmet({ 
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false   // LAN-only kiosk app — CSP was blocking cross-device fetch/socket calls
}));

// Cross-Origin Resource Sharing
app.use(cors({
  origin: '*',
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  // Reflect requested headers. A whitelist dropped x-manager-pin and the
  // browser then blocked DELETE /orders/:id as a "Network Error".
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Idempotency-Key',
    'x-user-id',
    'x-cashier-session-id',
    'x-terminal-id',
    'x-device-name',
    'x-device-secret',
    'x-branch-id',
    'x-manager-pin'
  ]
}));

// Request Logging
app.use(morgan(config.app.isDev ? 'dev' : 'combined'));

// Payload Compression
app.use(compression());

// Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global device tracking
global.activeDevices = new Map();

// Device Tracking Middleware
app.use((req, res, next) => {
  const terminalId = req.headers['x-terminal-id'];
  const deviceName = req.headers['x-device-name'];
  
  if (terminalId && deviceName) {
    let ip = req.ip || req.socket?.remoteAddress || 'Unknown IP';
    // Clean IPv6 to IPv4 format if it's loopback
    if (ip === '::1') ip = '127.0.0.1';
    if (ip.startsWith('::ffff:')) ip = ip.substring(7);

    global.activeDevices.set(terminalId, {
      id: terminalId,
      name: deviceName,
      ip: ip,
      role: "Counter Terminal", 
      lastSeen: Date.now(),
      status: 'Online'
    });
  }
  next();
});

// Serve product/category/user images only — never the live database or backups
app.use('/storage/images', express.static(path.join(config.paths.root, 'images')));
app.use('/storage/templates', express.static(path.join(config.paths.root, 'templates')));

// --- ROUTES ---

// Mount API Routes
app.use(config.server.apiPrefix, apiRoutes);

// --- ERROR HANDLING ---

// 404 Route Not Found for API
app.use(config.server.apiPrefix, notFoundHandler);

// Serve the React frontend for LAN tablets (always enabled)
const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));

// Catch-all route to serve index.html for React Router
app.use((req, res, next) => {
  // Only serve index.html if it's not an API request
  if (!req.path.startsWith(config.server.apiPrefix)) {
    res.sendFile(path.join(frontendPath, 'index.html'));
  } else {
    next();
  }
});

// Global Error Handler
app.use(errorHandler);

export default app;
