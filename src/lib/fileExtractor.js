import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';

// Use ?url import so Vite resolves the worker path at compile time.
// The old `new URL(specifier, import.meta.url)` pattern broke because pdfjs-dist's
// fake worker fallback does `import(url)` with @vite-ignore, bypassing Vite's
// module resolution and causing the browser to fetch a non-existent CDN URL.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

export const ACCEPTED_EXTENSIONS = ['pdf', 'docx', 'txt', 'csv', 'md'];

export function getFileExtension(filename) {
  return filename.split('.').pop().toLowerCase();
}

export function isAcceptedFile(filename) {
  return ACCEPTED_EXTENSIONS.includes(getFileExtension(filename));
}

export async function extractTextFromFile(file) {
  const extension = getFileExtension(file.name);

  switch (extension) {
    case 'txt':
    case 'md':
    case 'csv':
      return await file.text();

    case 'pdf':
      return await extractPdfText(file);

    case 'docx':
      return await extractDocxText(file);

    default:
      throw new Error(`Unsupported file type: .${extension}`);
  }
}

async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item) => item.str).join(' ') + '\n';
  }
  return text;
}

async function extractDocxText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}
