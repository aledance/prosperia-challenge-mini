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
  async extractText(imagePath: string, mimeType?: string): Promise<string> {
    logger.info(`[OCR] Extracting text from ${imagePath} using Tesseract...`);

    try {
      // Check if file is PDF (by extension or mimetype)
      const isPdf = imagePath.toLowerCase().endsWith('.pdf') || mimeType === 'application/pdf';

      if (isPdf) {
        logger.info('[OCR] Detected PDF. Strategy: 1. Try native extract. 2. Fallback to Ghostscript OCR.');
        
        // Strategy 1: Native Extraction (Fast)
        try {
            const dataBuffer = await fs.readFile(imagePath);
            const uint8Array = new Uint8Array(dataBuffer);
            const parser = new PDFParse(uint8Array);
            const data = await parser.getText();
            
            if (data.text && data.text.trim().length > 50) {
                logger.info('[OCR] Native PDF extraction successful.');
                return data.text;
            }
            logger.warn('[OCR] Native extraction yielded empty/short text. Trying Ghostscript fallback...');
        } catch (e) {
            logger.warn(`[OCR] Native extraction failed: ${e}. Trying fallback...`);
        }

        // Strategy 2: Ghostscript -> Image -> Tesseract (Slower but robust for scans)
        return await this.processPdfWithGhostscript(imagePath);
      }

      const result = await Tesseract.recognize(imagePath, 'eng+spa');
      return result.data.text;
    } catch (error) {
      logger.error(`[OCR] Error extracting text: ${error}`);
      throw error;
    }
  }

  private async processPdfWithGhostscript(pdfPath: string): Promise<string> {
    const outputPrefix = `${pdfPath}_gs`;
    // Use Ghostscript to convert PDF to PNG (300 DPI for better OCR)
    // -sDEVICE=pngalpha : PNG with transparency
    // -r300 : 300 DPI resolution
    // -o : Output filename pattern (%d for page number)
    const cmd = `gs -dSAFER -dBATCH -dNOPAUSE -sDEVICE=png16m -r300 -o "${outputPrefix}_%d.png" "${pdfPath}"`;
    
    try {
        logger.info('[OCR] Running Ghostscript conversion...');
        await execAsync(cmd);
        
        // Find generated images
        const dir = path.dirname(pdfPath);
        const files = await fs.readdir(dir);
        const pageImages = files
            .filter(f => f.startsWith(path.basename(outputPrefix)) && f.endsWith('.png'))
            .sort() // Ensure page order
            .map(f => path.join(dir, f));

        logger.info(`[OCR] Converted PDF to ${pageImages.length} images.`);
        
        const texts: string[] = [];
        for (const imgPath of pageImages) {
            logger.info(`[OCR] Processing page image: ${imgPath}`);
            const result = await Tesseract.recognize(imgPath, 'eng+spa');
            texts.push(result.data.text);
            
            // Cleanup image immediately
            await fs.unlink(imgPath).catch(() => {});
        }
        
        return texts.join('\n\n--- PAGE BREAK ---\n\n');
    } catch (error) {
        logger.error(`[OCR] Ghostscript conversion failed: ${error}`);
        throw new Error('Failed to process scanned PDF.');
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
