import * as pdf2img from 'pdf-img-convert';
import path from 'path';
import fs from 'fs/promises';

const pdfPath = path.resolve('./samples/PDF-TEST.pdf');

console.log(`Testing pdf conversion: ${pdfPath}`);

async function run() {
  try {
    const images = await pdf2img.convert(pdfPath);
    console.log(`Converted ${images.length} pages.`);
    console.log('First page type:', typeof images[0]);
    console.log('First page is buffer?', Buffer.isBuffer(images[0]));
    console.log('First page length:', images[0].length);
  } catch (error) {
    console.error('Conversion Failed:', error);
  }
}

run();
