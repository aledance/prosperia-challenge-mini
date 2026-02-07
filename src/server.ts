import app from './app.js';
import { logger } from './config/logger.js';
import { config } from './config/env.js';
import fs from 'fs/promises';

const startServer = async () => {
  try {
    // Crear directorio de uploads si no existe
    await fs.mkdir(config.uploadDir, { recursive: true });

    app.listen(config.port, () => {
      logger.info(`[Server] 🚀 Servidor corriendo en http://localhost:${config.port}`);
      logger.info(`[Server] Proveedor OCR: ${config.ocrProvider}`);
      logger.info(`[Server] Ambiente: ${config.nodeEnv}`);
    });
  } catch (error) {
    logger.error(`[Server] Fallo al iniciar: ${error}`);
    process.exit(1);
  }
};

startServer();
