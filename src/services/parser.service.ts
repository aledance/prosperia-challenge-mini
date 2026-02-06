import { ReceiptData } from '../types/receipt.js';
import { logger } from '../config/logger.js';

export class ReceiptParser {
  /**
   * Parse raw OCR text to extract receipt information
   * TODO: Implement basic parsing logic to extract:
   * - amount (total)
   * - subtotalAmount
   * - taxAmount
   * - taxPercentage
   * - vendorName
   * - invoiceNumber
   * - date
   * 
   * You can use:
   * 1. Regular expressions to find patterns (e.g., amounts with currency symbols)
   * 2. Keywords matching (e.g., "TOTAL", "SUBTOTAL", "TAX")
   * 3. Basic heuristics
   * 
   * Example: const totalMatch = rawText.match(/total[:\s]+[$]?([\d,]+\.?\d*)/i);
   */
  parse(rawText: string): ReceiptData {
    logger.info('[Parser] Parsing receipt data...');

    const data: ReceiptData = {
      rawText,
    };

    // Helper to clean and parse currency
    const parseCurrency = (str: string) => {
      const clean = str.replace(/[^0-9.]/g, '');
      return parseFloat(clean);
    };

    // 1. Vendor Name (Simple heuristic: First non-empty line)
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length > 0) {
      data.vendorName = lines[0];
    }

    // 2. Date
    // Matches DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
    const dateMatch = rawText.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/);
    if (dateMatch) {
      data.date = dateMatch[0];
    }

    // 3. Invoice / Receipt Number
    const invoiceMatch = rawText.match(/(?:invoice|factura|ticket|receipt)\s*#?[:.]?\s*([a-zA-Z0-9-]+)/i);
    if (invoiceMatch) {
      data.invoiceNumber = invoiceMatch[1];
    }

    // 4. Amounts (Total, Subtotal, Tax)
    // Find "TOTAL" followed by currency
    const totalMatch = rawText.match(/(?:TOTAL|AMOUNT DUE|PAGAR).*?[\$€£]?\s*([\d,]+\.?\d{2})/i);
    if (totalMatch) {
      data.amount = parseCurrency(totalMatch[1]);
    } else {
        // Fallback: Max number in text? Maybe risky. Let's stick to explicit label match for now.
    }

    const subtotalMatch = rawText.match(/(?:SUBTOTAL|SUB-TOTAL).*?[\$€£]?\s*([\d,]+\.?\d{2})/i);
    if (subtotalMatch) {
      data.subtotalAmount = parseCurrency(subtotalMatch[1]);
    }

    const taxMatch = rawText.match(/(?:TAX|IVA|IMPUESTO).*?[\$€£]?\s*([\d,]+\.?\d{2})/i);
    if (taxMatch) {
      data.taxAmount = parseCurrency(taxMatch[1]);
    }

    return data;
  }
}
