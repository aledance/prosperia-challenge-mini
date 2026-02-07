import Tesseract from 'tesseract.js';
import { PDFParse } from 'pdf-parse';
import fs from 'fs/promises';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import { logger } from '../config/logger.js';

const execAsync = util.promisify(exec);

export interface OcrProvider {
  extractText(imagePath: string, mimeType?: string): Promise<string>;
}

export class TesseractOcr implements OcrProvider {
  /**
   * Extrae texto de una imagen o PDF.
   * Utiliza una estrategia híbrida para PDFs:
   * 1. Extracción Nativa (pdf-parse) -> Rápido y preciso para facturas digitales.
   * 2. Fallback a Ghostscript + Tesseract -> Robusto para facturas escaneadas (imágenes).
   * 
   * @param imagePath Ruta absoluta al archivo
   * @param mimeType (Opcional) Tipo MIME para identificar PDFs
   */
  async extractText(imagePath: string, mimeType?: string): Promise<string> {
    logger.info(`[OCR] Extrayendo texto de ${imagePath} usando Tesseract...`);

    try {
      // Verificar si el archivo es un PDF (por extensión o tipo mime)
      const isPdf = imagePath.toLowerCase().endsWith('.pdf') || mimeType === 'application/pdf';

      if (isPdf) {
        logger.info('[OCR] PDF detectado. Estrategia: 1. Intento nativo. 2. Fallback a Ghostscript.');
        
        // --- Estrategia 1: Extracción Nativa (Rápida) ---
        // Ideal para: Archivos PDF generados digitalmente (facturas electrónicas)
        // Ventaja: Ejecución en milisegundos, precisión del 100% en caracteres.
        try {
            const dataBuffer = await fs.readFile(imagePath);
            const uint8Array = new Uint8Array(dataBuffer); // pdf-parse maneja mejor Uint8Array que Buffer
            const parser = new PDFParse(uint8Array);
            const data = await parser.getText();
            
            // Heurística: Si obtenemos texto razonable (>50 caracteres), probablemente es digital.
            // Si son <50 caracteres, probablemente sea un escaneo (PDF que solo contiene una imagen).
            if (data.text && data.text.trim().length > 50) {
                logger.info('[OCR] Extracción nativa de PDF exitosa.');
                return data.text;
            }
            logger.warn('[OCR] La extracción nativa devolvió texto vacío o muy corto. Intentando fallback con Ghostscript...');
        } catch (e) {
            logger.warn(`[OCR] Falló la extracción nativa: ${e}. Intentando fallback...`);
        }

        // --- Estrategia 2: Ghostscript -> Imagen -> Tesseract (Lenta pero robusta) ---
        // Ideal para: Recibos escaneados (Fotos pegadas en un PDF)
        // Proceso: Convierte las páginas del PDF a imágenes PNG y luego aplica OCR.
        return await this.processPdfWithGhostscript(imagePath);
      }

      // --- OCR Estándar para Imágenes (JPG/PNG) ---
      const result = await Tesseract.recognize(imagePath, 'eng+spa');
      return result.data.text;
    } catch (error) {
      logger.error(`[OCR] Error extrayendo texto: ${error}`);
      throw error;
    }
  }

  /**
   * Maneja PDFs escaneados convirtiendo las páginas a imágenes usando Ghostscript,
   * luego ejecutando Tesseract en cada imagen de página.
   */
  private async processPdfWithGhostscript(pdfPath: string): Promise<string> {
    const outputPrefix = `${pdfPath}_gs`;
    // Desglose del comando Ghostscript:
    // -dSAFER -dBATCH -dNOPAUSE: Flags estándar de producción
    // -sDEVICE=png16m: Salida como PNG de 24-bits (mejor para OCR)
    // -r300: Resolución de 300 DPI (Óptima para precisión de Tesseract)
    const cmd = `gs -dSAFER -dBATCH -dNOPAUSE -sDEVICE=png16m -r300 -o "${outputPrefix}_%d.png" "${pdfPath}"`;
    
    try {
        logger.info('[OCR] Ejecutando conversión con Ghostscript...');
        await execAsync(cmd);
        
        // Buscar las imágenes generadas
        const dir = path.dirname(pdfPath);
        const files = await fs.readdir(dir);
        const pageImages = files
            .filter(f => f.startsWith(path.basename(outputPrefix)) && f.endsWith('.png'))
            .sort() // Asegurar orden de páginas
            .map(f => path.join(dir, f));

        logger.info(`[OCR] PDF convertido a ${pageImages.length} imágenes.`);
        
        const texts: string[] = [];
        for (const imgPath of pageImages) {
            logger.info(`[OCR] Procesando imagen de página: ${imgPath}`);
            const result = await Tesseract.recognize(imgPath, 'eng+spa');
            texts.push(result.data.text);
            
            // Limpiar imagen temporal inmediatamente después del uso
            await fs.unlink(imgPath).catch(() => {});
        }
        
        return texts.join('\n\n--- SALTO DE PÁGINA ---\n\n');
    } catch (error) {
        logger.error(`[OCR] Falló la conversión de Ghostscript: ${error}`);
        throw new Error('Fallo al procesar PDF escaneado.');
    }
  }
}

export class MockOcr implements OcrProvider {
  async extractText(_imagePath: string, _mimeType?: string): Promise<string> {
    logger.info('[OCR] Using mock OCR provider');
    // Return sample receipt text for testing
    return `SUPERMARKET ABC
    123 Main Street
    Invoice #INV-2024-001
    Date: 2024-01-15
    
    Item 1: $50.00
    Item 2: $30.00
    ─────────────────
    Subtotal: $80.00
    Tax (10%): $8.00
    ─────────────────
    TOTAL: $88.00
    
    Thank you for your purchase!`;
  }
}

export function getOcrProvider(provider: string): OcrProvider {
  if (provider === 'tesseract') {
    return new TesseractOcr();
  }
  return new MockOcr();
}
