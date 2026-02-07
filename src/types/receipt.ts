export interface ReceiptData {
  rawText: string;
  amount?: number;
  subtotalAmount?: number;
  taxAmount?: number;
  taxPercentage?: number;
  vendorName?: string;
  invoiceNumber?: string;
  date?: string;
  paymentMethod?: string;
  cashierName?: string;
  time?: string;
}

export interface ReceiptResult {
  id: string;
  filename: string;
  uploadedAt: string;
  data: ReceiptData;
}
