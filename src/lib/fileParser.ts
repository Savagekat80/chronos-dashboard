import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export async function parseFile(file: File, deepMetadata?: boolean): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'pdf':
      return parsePDF(file, deepMetadata);
    case 'docx':
      return parseDocx(file);
    case 'xlsx':
    case 'xls':
    case 'csv':
      return parseExcel(file);
    case 'txt':
    case 'eml':
      return file.text();
    default:
      throw new Error(`Unsupported file type: .${extension}`);
  }
}

async function parsePDF(file: File, deepMetadata?: boolean): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  if (deepMetadata) {
    try {
      const metadata = await pdf.getMetadata();
      fullText += `--- DEEP METADATA ANALYSIS DATA ---\n`;
      fullText += `[PDF_METADATA]: ${JSON.stringify(metadata, null, 2)}\n`;
      fullText += `[FINGERPRINT]: ${pdf.fingerprints.join(', ')}\n`;
      fullText += `-----------------------------------\n\n`;
    } catch (e) {
      fullText += `[METADATA_ERROR]: Could not extract technical metadata.\n\n`;
    }
  }

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}

async function parseDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function parseExcel(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer);
  let fullText = '';

  workbook.SheetNames.forEach(sheetName => {
    const worksheet = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    fullText += `Sheet: ${sheetName}\n`;
    fullText += json.map((row: any) => row.join('\t')).join('\n') + '\n\n';
  });

  return fullText;
}
