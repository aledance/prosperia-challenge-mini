import express, { Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID as uuidv4 } from 'crypto';
import { logger } from '../config/logger.js';
import { config } from '../config/env.js';
import { getOcrProvider } from '../services/ocr.service.js';
import { ReceiptParser } from '../services/parser.service.js';
import { ReceiptResult } from '../types/receipt.js';
import { AppError } from '../utils/errors.js';

const router = express.Router();

// Setup multer for file uploads
const upload = multer({
  dest: config.uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(400, 'Only images and PDFs are allowed'));
    }
  },
});

// In-memory storage (for simplicity)
const receipts = new Map<string, ReceiptResult>();

/**
 * POST /api/receipts
 * Sube una imagen/PDF de recibo y extrae información.
 * Soporta múltiples archivos.
 */
router.post('/api/receipts', upload.array('files'), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      throw new AppError(400, 'No se ha subido ningún archivo');
    }

    const results: ReceiptResult[] = [];
    const errors: any[] = [];

    // Procesar cada archivo en paralelo
    await Promise.all(files.map(async (file) => {
      try {
        // 1. Generar ID único
        const id = uuidv4();
        const filePath = file.path;

        // 2. OCR
        const ocrProvider = getOcrProvider(config.ocrProvider);
        const rawText = await ocrProvider.extractText(filePath, file.mimetype);

        // 3. Parser
        const parser = new ReceiptParser();
        const parsedData = parser.parse(rawText);

        // 4. Guardar
        const receiptResult: ReceiptResult = {
          id,
          filename: file.originalname,
          uploadedAt: new Date().toISOString(),
          data: parsedData,
        };
        receipts.set(id, receiptResult);
        results.push(receiptResult);
        
        // Limpieza (opcional)
        // await fs.unlink(filePath);
      } catch (err) {
        logger.error(`[Receipt] Error processing file ${file.originalname}: ${err}`);
        errors.push({ filename: file.originalname, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }));

    if (results.length === 0 && errors.length > 0) {
        // Fallaron todos
        throw new AppError(500, `Failed to process files. Errors: ${JSON.stringify(errors)}`);
    }

    // Retornamos resultados exitosos y errores si los hubo (207 Multi-Status podría ser, pero 200 con detalles es más simple)
    res.json({ results, errors });
    
  } catch (error) {
    logger.error(`[Receipt] Error uploading receipt: ${error}`);
    const appError = error instanceof AppError ? error : new AppError(500, 'Failed to process receipt');
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

/**
 * GET /api/receipts/:id
 * Recupera un recibo procesado previamente por su ID.
 */
router.get('/api/receipts/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const receipt = receipts.get(id);

    if (!receipt) {
      throw new AppError(404, 'Recibo no encontrado');
    }

    res.json(receipt);
  } catch (error) {
    logger.error(`[Receipt] Error obteniendo recibo: ${error}`);
    const appError = error instanceof AppError ? error : new AppError(500, 'Fallo al obtener el recibo');
    res.status(appError.statusCode).json({ error: appError.message });
  }
});

/**
 * GET /api/receipts
 * List all processed receipts
 */
router.get('/api/receipts', (req: Request, res: Response) => {
  try {
    const receiptsList = Array.from(receipts.values());
    res.json(receiptsList);
  } catch (error) {
    logger.error(`[Receipt] Error listing receipts: ${error}`);
    res.status(500).json({ error: 'Failed to list receipts' });
  }
});

export default router;
