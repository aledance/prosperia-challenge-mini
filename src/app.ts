import express, { Express } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './config/logger.js';
import { config } from './config/env.js';
import healthRoutes from './routes/health.routes.js';
import receiptsRoutes from './routes/receipts.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Express = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public folder
app.use(express.static(path.join(__dirname, '../public')));

app.use((req, res, next) => {
  logger.info(`[${req.method}] ${req.path}`);
  next();
});

// Routes
app.use('/', healthRoutes);
app.use('/', receiptsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(`[Error] ${err}`);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

export default app;
