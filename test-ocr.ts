import { TesseractOcr } from './src/services/ocr.service';
import path from 'path';

const ocr = new TesseractOcr();
const pdfPath = path.resolve('./samples/PDF-TEST.pdf');

console.log(`Testing OCR with: ${pdfPath}`);

ocr.extractText(pdfPath)
  .then(text => console.log('Success:', text))
  .catch(err => console.error('Error:', err));
