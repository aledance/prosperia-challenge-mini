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
 * 
 * Flujo:
 * 1. Valida la subida del archivo (Multer).
 * 2. Extrae texto usando el servicio de OCR (Tesseract / Ghostscript).
 * 3. Analiza el texto extraído (Parser) para obtener datos estructurados.
 * 4. Almacena el resultado en memoria.
 * 5. Retorna los datos parseados.
 */
router.post('/api/receipts', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      throw new AppError(400, 'No se ha subido ningún archivo');
    }

    // 1. Generar ID único para el recibo
    const id = uuidv4();
    const filePath = req.file.path;

    // 2. Obtener proveedor OCR (configurado en env)
    const ocrProvider = getOcrProvider(config.ocrProvider);

    // 3. Extraer texto del archivo subido
    // El OCR detectará automáticamente si es imagen o PDF (y qué tipo de PDF)
    const rawText = await ocrProvider.extractText(filePath, req.file.mimetype);

    // 4. Parsear el texto para obtener datos del recibo
    const parser = new ReceiptParser();
    const parsedData = parser.parse(rawText);

    // 5. Almacenar el resultado en el mapa en memoria
    const receiptResult: ReceiptResult = {
      id,
      filename: req.file.originalname,
      uploadedAt: new Date().toISOString(),
      data: parsedData,
    };
    receipts.set(id, receiptResult);

    // Limpieza de archivo temporal
    // await fs.unlink(filePath); // Opcional: Limpiar inmediatamente o via cron

    // 6. Retornar el resultado
    res.json(receiptResult);
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
