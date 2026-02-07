import { ReceiptParser } from '../src/services/parser.service';

describe('ReceiptParser', () => {
    let parser: ReceiptParser;

    beforeEach(() => {
        parser = new ReceiptParser();
    });

    it('should extract vendor name correctly', () => {
        const text = "Supermercado XYZ\nFecha: 12/12/2023\nTotal: 100.00";
        const result = parser.parse(text);
        expect(result.vendorName).toBe('Supermercado XYZ');
    });

    it('should extract total amount correctly', () => {
        const text = "TOTAL $45.50\nGracias por su compra";
        const result = parser.parse(text);
        expect(result.amount).toBe(45.50);
    });

    it('should extract date correctly (DD/MM/YYYY)', () => {
        const text = "Fecha: 25/01/2024\nTotal: 200";
        const result = parser.parse(text);
        expect(result.date).toBe('25/01/2024');
    });

    it('should extract tax amount correctly', () => {
        const text = "Subtotal: 100\nIVA: 16.00\nTotal: 116.00";
        const result = parser.parse(text);
        expect(result.taxAmount).toBe(16.00);
    });

    it('should extract invoice number', () => {
        const text = "Invoice #123456\nTotal: 10";
        const result = parser.parse(text);
        expect(result.invoiceNumber).toBe('123456');
    });
    
    it('should extract payment method (cash)', () => {
        const text = "Pago en EFECTIVO\nTotal: 10";
        const result = parser.parse(text);
        expect(result.paymentMethod).toBe('CASH');
    });

    it('should extract cashier name', () => {
        const text = "Cajero: Juan Perez\nTotal: 10";
        const result = parser.parse(text);
        expect(result.cashierName).toBe('Juan Perez');
    });
});
