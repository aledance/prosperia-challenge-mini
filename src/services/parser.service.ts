import { ReceiptData } from '../types/receipt.js';
import { logger } from '../config/logger.js';

export class ReceiptParser {
  /**
   * Analiza el texto crudo del OCR para extraer información estructurada del recibo.
   * Implementa lógica basada en Regex para identificar campos clave.
   * 
   * Campos a extraer:
   * - Monto total (amount)
   * - Subtotal (subtotalAmount)
   * - Impuestos (taxAmount)
   * - Nombre del Vendedor (vendorName)
   * - Número de Factura (invoiceNumber)
   * - Fecha (date)
   */
  parse(rawText: string): ReceiptData {
    logger.info('[Parser] Analizando datos del recibo...');

    const data: ReceiptData = {
      rawText,
    };

    // Función auxiliar para limpiar y parsear valores monetarios
    // Elimina caracteres no numéricos excepto el punto decimal
    const parseCurrency = (str: string) => {
      const clean = str.replace(/[^0-9.]/g, '');
      return parseFloat(clean);
    };

    // 1. Nombre del Vendedor 
    // Heurística simple: Asumimos que la primera línea no vacía es el nombre del comercio.
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length > 0) {
      data.vendorName = lines[0];
    }

    // 2. Fecha
    // Busca patrones comunes: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
    const dateMatch = rawText.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/);
    if (dateMatch) {
      data.date = dateMatch[0];
    }

    // 3. Número de Factura / Recibo
    // Busca palabras clave como "invoice", "factura", "ticket" seguidas de un identificador.
    const invoiceMatch = rawText.match(/(?:invoice|factura|ticket|receipt)\s*#?[:.]?\s*([a-zA-Z0-9-]+)/i);
    if (invoiceMatch) {
      data.invoiceNumber = invoiceMatch[1];
    }

    // 4. Montos (Total, Subtotal, Impuestos)
    // Busca "TOTAL" seguido de un posible símbolo de moneda y el monto.
    const totalMatch = rawText.match(/(?:TOTAL|AMOUNT DUE|PAGAR).*?[\$€£]?\s*([\d,]+\.?\d{2})/i);
    if (totalMatch) {
      data.amount = parseCurrency(totalMatch[1]);
    } else {
        // Fallback: ¿Tomar el número más alto? (Riesgoso, mantenemos solo match explícito por seguridad)
    }

    // Busca Subtotal
    const subtotalMatch = rawText.match(/(?:SUBTOTAL|SUB-TOTAL).*?[\$€£]?\s*([\d,]+\.?\d{2})/i);
    if (subtotalMatch) {
      data.subtotalAmount = parseCurrency(subtotalMatch[1]);
    }

    // Busca Impuestos (TAX / IVA)
    const taxMatch = rawText.match(/(?:TAX|IVA|IMPUESTO).*?[\$€£]?\s*([\d,]+\.?\d{2})/i);
    if (taxMatch) {
      data.taxAmount = parseCurrency(taxMatch[1]);
    }

    // 5. Hora
    // Busca patrones de hora HH:MM o HH:MM:SS
    const timeMatch = rawText.match(/(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:AM|PM)?/i);
    if (timeMatch) {
      data.time = timeMatch[0];
    }

    // 6. Método de Pago
    const paymentKeywords = {
      'CASH': ['efectivo', 'cash', 'contado'],
      'CREDIT_CARD': ['visa', 'mastercard', 'amex', 'tarjeta', 'credit', 'debito'],
    };

    for (const [method, keywords] of Object.entries(paymentKeywords)) {
      if (keywords.some(k => rawText.toLowerCase().includes(k))) {
        data.paymentMethod = method;
        break; 
      }
    }

    // 7. Nombre del Cajero
    // Busca "Cajero:" o "Cashier:" seguido de nombre (solo letras y espacios, no saltos de línea)
    const cashierMatch = rawText.match(/(?:cajero|cashier|atendido por|server)[\s:.]*([a-zA-Z ]{3,20})/i);
    if (cashierMatch) {
         data.cashierName = cashierMatch[1].trim();
    }

    return data;
  }
}
