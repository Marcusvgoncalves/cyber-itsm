import mammoth from 'mammoth';

/**
 * Utilitário universal de extração de conteúdo textual e estruturado de evidências/anexos.
 * Suporta: .pdf, .docx, .jpg, .png, .json, .xml, .txt
 */
export async function parseFileContent(
  fileBuffer: Buffer,
  fileName: string,
  mimeType?: string
): Promise<{ text: string; parsedType: string; originalSizeBytes: number }> {
  const originalSizeBytes = fileBuffer.byteLength;
  const ext = fileName.toLowerCase().split('.').pop() || '';

  try {
    // 1) Arquivos PDF
    if (ext === 'pdf' || mimeType === 'application/pdf') {
      // Dynamic require para compatibilidade CJS com Next.js Turbopack
      const pdfParse = require('pdf-parse');
      const pdfData = await pdfParse(fileBuffer);
      const extractedText = (pdfData?.text || '').trim();
      return {
        text: extractedText || `[PDF sem conteúdo textual extraível: ${fileName}]`,
        parsedType: 'pdf',
        originalSizeBytes,
      };
    }

    // 2) Arquivos Word (.docx)
    if (ext === 'docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      const extractedText = (result?.value || '').trim();
      return {
        text: extractedText || `[DOCX sem conteúdo textual extraível: ${fileName}]`,
        parsedType: 'docx',
        originalSizeBytes,
      };
    }

    // 3) Imagens (.jpg, .jpeg, .png)
    if (['jpg', 'jpeg', 'png'].includes(ext) || (mimeType && mimeType.startsWith('image/'))) {
      const base64Data = fileBuffer.toString('base64');
      const textRepresentation = `[ANEXO DE IMAGEM (${ext.toUpperCase()}): ${fileName}]\nSubmetido artefato visual de segurança. Conteúdo codificado em Base64 para análise do motor multiagente.\nData Header: data:image/${ext};base64,${base64Data.slice(0, 100)}...`;
      
      return {
        text: textRepresentation,
        parsedType: ext,
        originalSizeBytes,
      };
    }

    // 4) Texto puro / JSON / XML / TXT
    const textContent = fileBuffer.toString('utf-8').trim();
    return {
      text: textContent || `[Arquivo de texto vazio: ${fileName}]`,
      parsedType: ext || 'txt',
      originalSizeBytes,
    };
  } catch (err) {
    console.error(`[FileParser] Erro ao extrair conteúdo de '${fileName}':`, err);
    // Fallback defensivo: tenta decodificar como utf-8
    const fallbackText = fileBuffer.toString('utf-8').trim();
    return {
      text: fallbackText || `[Falha na extração de texto para ${fileName}]`,
      parsedType: ext || 'raw',
      originalSizeBytes,
    };
  }
}
