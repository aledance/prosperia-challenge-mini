import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfModule = require('pdf-parse');

console.log('Type of module:', typeof pdfModule);
console.log('Module keys:', Object.keys(pdfModule));
console.log('Module export:', pdfModule);
