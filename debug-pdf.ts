import Tesseract from 'tesseract.js';
import path from 'path';

const pdfPath = path.resolve('./samples/PDF-TEST.pdf');

console.log(`Intentando leer: ${pdfPath}`);

async function run() {
  try {
    const result = await Tesseract.recognize(pdfPath, 'eng+spa');
    console.log('Texto extraído:', result.data.text.substring(0, 100));
  } catch (error) {
    console.error('Error detallado:', error);
  }
}

run();
