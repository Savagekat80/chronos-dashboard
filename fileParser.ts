import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import MSGReader from 'msgreader';
import JSZip from 'jszip';
import pako from 'pako';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface ParsedFile {
  name: string;
  content: string;
  size: number;
  type: string;
  hash: string;
  pageCount?: number;
}

export async function generateHash(file: File | Blob): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export async function parseFile(file: File | Blob, fileName: string, deepMetadata?: boolean): Promise<ParsedFile[]> {
  const extension = fileName.split('.').pop()?.toLowerCase();
  const hash = await generateHash(file);

  switch (extension) {
    case 'pdf':
      const pdfData = await parsePDF(file, deepMetadata);
      return [{ 
        name: fileName, 
        content: pdfData.text, 
        size: file.size, 
        type: 'pdf', 
        hash,
        pageCount: pdfData.pageCount 
      }];
    case 'docx':
      return [{ name: fileName, content: await parseDocx(file), size: file.size, type: 'docx', hash }];
    case 'xlsx':
    case 'xls':
    case 'csv':
      return [{ name: fileName, content: await parseExcel(file), size: file.size, type: extension, hash }];
    case 'msg':
      return [{ name: fileName, content: await parseMSG(file), size: file.size, type: 'msg', hash }];
    case 'txt':
    case 'eml':
    case 'js':
    case 'json':
      return [{ name: fileName, content: await (file as any).text(), size: file.size, type: extension, hash }];
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'tiff':
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      return [{ name: fileName, content, size: file.size, type: extension, hash }];
    case 'zip':
      return parseZip(file, deepMetadata);
    case 'gz':
      if (fileName.endsWith('.tar.gz')) {
        return parseTarGz(file, deepMetadata);
      }
      return [{ name: fileName, content: await (file as any).text(), size: file.size, type: 'gz', hash }];
    case 'doc':
    case 'odt':
    case 'ott':
    case 'odf':
      const text = await (file as any).text();
      if (text.includes('PK\x03\x04')) {
        throw new Error(`The format .${extension} is a compressed format and requires a specialized parser not currently available. Please convert to .docx or .pdf.`);
      }
      return [{ name: fileName, content: text, size: file.size, type: extension, hash }];
    default:
      throw new Error(`Unsupported file type: .${extension}`);
  }
}

async function parseZip(file: File | Blob, deepMetadata?: boolean): Promise<ParsedFile[]> {
  const zip = await JSZip.loadAsync(file);
  const results: ParsedFile[] = [];

  for (const [path, zipEntry] of Object.entries(zip.files)) {
    if (!zipEntry.dir) {
      const blob = await zipEntry.async('blob');
      try {
        const parsed = await parseFile(blob, zipEntry.name, deepMetadata);
        results.push(...parsed);
      } catch (e) {
        console.warn(`Failed to parse file ${zipEntry.name} inside zip:`, e);
      }
    }
  }
  return results;
}

async function parseTarGz(file: File | Blob, deepMetadata?: boolean): Promise<ParsedFile[]> {
  const arrayBuffer = await file.arrayBuffer();
  const decompressed = pako.ungzip(new Uint8Array(arrayBuffer));
  return parseTar(decompressed.buffer, deepMetadata);
}

async function parseTar(buffer: ArrayBuffer, deepMetadata?: boolean): Promise<ParsedFile[]> {
  const results: ParsedFile[] = [];
  const view = new DataView(buffer);
  let offset = 0;

  while (offset < buffer.byteLength - 512) {
    const header = new Uint8Array(buffer, offset, 512);
    // Check if header is empty (end of archive)
    if (header[0] === 0) break;

    const name = getString(header, 0, 100);
    const size = parseInt(getString(header, 124, 12), 8);
    const typeFlag = String.fromCharCode(header[156]);

    offset += 512;

    if (typeFlag === '0' || typeFlag === '\0') {
      // Regular file
      const fileData = buffer.slice(offset, offset + size);
      const blob = new Blob([fileData]);
      try {
        const parsed = await parseFile(blob, name, deepMetadata);
        results.push(...parsed);
      } catch (e) {
        console.warn(`Failed to parse file ${name} inside tar:`, e);
      }
    }

    offset += Math.ceil(size / 512) * 512;
  }

  return results;
}

function getString(view: Uint8Array, offset: number, length: number): string {
  let str = '';
  for (let i = 0; i < length; i++) {
    if (view[offset + i] === 0) break;
    str += String.fromCharCode(view[offset + i]);
  }
  return str.trim();
}

async function parseMSG(file: File | Blob): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const msgReader = new MSGReader(arrayBuffer);
  const fileData = msgReader.getFileData();
  
  if (!fileData) {
    throw new Error("Failed to parse .msg file");
  }

  let content = `Subject: ${fileData.subject}\n`;
  content += `From: ${fileData.senderName} <${fileData.senderEmail}>\n`;
  content += `To: ${fileData.recipients?.map(r => `${r.name} <${r.email}>`).join(', ')}\n`;
  content += `Date: ${fileData.creationTime}\n\n`;
  content += `Body:\n${fileData.body}`;
  
  return content;
}

async function parsePDF(file: File | Blob, deepMetadata?: boolean): Promise<{ text: string; pageCount: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  const pageCount = pdf.numPages;

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

  return { text: fullText, pageCount };
}

async function parseDocx(file: File | Blob): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function parseExcel(file: File | Blob): Promise<string> {
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
