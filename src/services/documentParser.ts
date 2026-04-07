import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export interface ParsedDocument {
  id: string;
  name: string;
  text: string;
  pages: string[];
  pageCount: number;
  size: number;
  uploadDate: string;
}

export async function parseFile(file: File): Promise<ParsedDocument> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  let text = '';
  let pages: string[] = [];

  if (ext === 'pdf') {
    const result = await parsePDF(file);
    text = result.text;
    pages = result.pages;
  } else if (ext === 'docx' || ext === 'doc') {
    text = await parseDOCX(file);
    pages = splitIntoPages(text, 3000);
  } else if (ext === 'txt') {
    text = await parseTXT(file);
    pages = splitIntoPages(text, 3000);
  } else if (ext === 'pptx' || ext === 'ppt') {
    text = await parseTXT(file);
    pages = splitIntoPages(text, 3000);
  } else {
    throw new Error(`Unsupported file type: .${ext}`);
  }

  return {
    id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    text,
    pages,
    pageCount: pages.length,
    size: file.size,
    uploadDate: new Date().toISOString().split('T')[0],
  };
}

async function parsePDF(file: File): Promise<{ text: string; pages: string[] }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pages.push(pageText);
  }

  return { text: pages.join('\n\n'), pages };
}

async function parseDOCX(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

async function parseTXT(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read text file'));
    reader.readAsText(file);
  });
}

function splitIntoPages(text: string, charsPerPage: number): string[] {
  const pages: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let currentPage = '';

  for (const para of paragraphs) {
    if (currentPage.length + para.length > charsPerPage && currentPage.length > 0) {
      pages.push(currentPage.trim());
      currentPage = '';
    }
    currentPage += para + '\n\n';
  }
  if (currentPage.trim()) pages.push(currentPage.trim());
  if (pages.length === 0) pages.push(text);
  return pages;
}
