import fs from 'fs/promises';
import path from 'path';
import { PDFParse } from 'pdf-parse';

const pdfPath = path.resolve('./samples/PDF-TEST.pdf');

console.log(`Testing pdf-parse v2 with: ${pdfPath}`);

async function run() {
  try {
    const dataBuffer = await fs.readFile(pdfPath);
    // Guessing API for buffer. If not documented in snippet, I might need to try 'data' or param directly?
    // Let's try passing buffer directly or inside object.
    
    // Trying heuristic from common libs:
    // new PDFParse(dataBuffer) ?? 
    // new PDFParse({ data: dataBuffer }) ??
    // Let's reading the README further if possible or just try.
    // The README showed { url: ... }. 
    
    console.log('Attempting to parse...');
    // Trying object with 'buffer' or 'source'
    const parser = new PDFParse(dataBuffer); 
    const data = await parser.getText();
    
    console.log('--- EXTRACTED TEXT START ---');
    console.log(data); // data might be object with .text or just text? 
    // Example says: await parser.getText() -> result.text
    console.log('--- EXTRACTED TEXT END ---');
  } catch (error) {
    console.error('Error:', error);
  }
}

run();
