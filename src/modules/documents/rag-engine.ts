/**
 * LearnMate AI — Document Extraction, Chunking, Retrieval & Prompt-Injection Sandbox
 * Implements SRS Section 4.9 (FR-DOC-005..011), Section 4.13 (FR-AI-008), and ADR-005.
 */

import type { DocumentFormat } from '../../types/domain.ts';

export interface ExtractedChunkDraft {
  chunkIndex: number;
  pageNumber: number;
  sectionHeading?: string;
  content: string;
  tokenEstimate: number;
  keywords: string[];
}

export interface RetrievableChunk {
  id: string;
  materialId: string;
  userId: string;
  chunkIndex: number;
  pageNumber?: number;
  sectionHeading?: string;
  content: string;
  tokenEstimate: number;
  keywords: string[];
  embedding?: number[];
}

export interface RankedChunkCitation {
  chunkId: string;
  chunkIndex: number;
  pageNumber: number;
  sectionHeading?: string;
  score: number;
  excerpt: string;
}

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'are',
  'was',
  'were',
  'have',
  'has',
  'had',
  'what',
  'when',
  'where',
  'which',
  'who',
  'how',
  'why',
  'into',
  'about',
  'can',
  'will',
]);

export function tokenizeKeywords(text: string): string[] {
  const matches = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
  return Array.from(new Set(matches)).slice(0, 40);
}

/**
 * Extracts readable academic text from TXT, PDF, or DOCX inputs (FR-DOC-005).
 */
export function extractReadableTextFromDocument(
  format: DocumentFormat,
  rawContent: string,
): { text: string; pageCount: number } {
  let cleaned = rawContent.trim();

  if (format === 'docx') {
    // If raw DOCX XML (<w:t>...</w:t>) is present, extract text nodes
    const xmlMatches = Array.from(cleaned.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g));
    if (xmlMatches.length > 0) {
      cleaned = xmlMatches.map((m) => m[1]?.trim() ?? '').join(' ');
    }
  } else if (format === 'pdf') {
    // If raw PDF literal strings ((...) Tj) are present, extract them while preserving page markers
    const pdfTjMatches = Array.from(cleaned.matchAll(/\(([^()]+)\)\s*Tj/g));
    if (pdfTjMatches.length > 0) {
      cleaned = pdfTjMatches.map((m) => m[1]?.trim() ?? '').join(' ');
    }
  }

  // Normalize control characters except newlines and form-feed (\f) page breaks
  cleaned = cleaned
    .replace(/\r\n/g, '\n')
    .replace(/[\x00-\x08\x0B\x0E-\x1F]/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  const explicitPageMarkers = cleaned.match(/(\[Page\s+\d+\]|\f)/gi);
  const estimatedPages = Math.max(1, Math.ceil(cleaned.length / 1800));
  const pageCount = explicitPageMarkers
    ? Math.max(explicitPageMarkers.length, estimatedPages)
    : estimatedPages;

  return {
    text: cleaned,
    pageCount,
  };
}

/**
 * Splits extracted document text into searchable, page-annotated chunks (FR-DOC-006, FR-DOC-009).
 */
export function splitDocumentIntoChunks(
  text: string,
  targetChars = 700,
  overlapChars = 100,
): ExtractedChunkDraft[] {
  const normalized = text.trim();
  if (!normalized) return [];

  // Split by explicit [Page N] or form-feed markers if present
  const pageSegments = normalized.split(/(?=\[Page\s+\d+\]|\f)/i);
  const chunks: ExtractedChunkDraft[] = [];
  let chunkIndex = 0;
  let currentPage = 1;
  let lastHeading: string | undefined;

  for (const rawSegment of pageSegments) {
    let segment = rawSegment.replace(/^\f+/, '').trim();
    if (!segment) continue;

    const pageMatch = segment.match(/^\[Page\s+(\d+)\]/i);
    if (pageMatch?.[1]) {
      currentPage = Math.max(1, Number(pageMatch[1]));
      segment = segment.replace(/^\[Page\s+\d+\]\s*/i, '').trim();
    }

    const paragraphs = segment.split(/\n{2,}/);
    let buffer = '';

    for (const para of paragraphs) {
      const trimmedPara = para.trim();
      if (!trimmedPara) continue;

      // Detect markdown or numbered section headings
      const headingMatch = trimmedPara.match(/^(?:#{1,4}\s+|(?:\d+\.)+\s+)([^\n]{3,90})/);
      if (headingMatch?.[1]) {
        lastHeading = headingMatch[1].trim();
      }

      if (buffer.length + trimmedPara.length + 2 <= targetChars) {
        buffer = buffer ? `${buffer}\n\n${trimmedPara}` : trimmedPara;
      } else {
        if (buffer) {
          chunks.push({
            chunkIndex,
            pageNumber: currentPage,
            sectionHeading: lastHeading,
            content: buffer,
            tokenEstimate: Math.max(1, Math.ceil(buffer.length / 4)),
            keywords: tokenizeKeywords(buffer),
          });
          chunkIndex += 1;
          const tail = buffer.slice(Math.max(0, buffer.length - overlapChars));
          buffer = `${tail}\n${trimmedPara}`.trim();
        } else {
          // Single paragraph longer than targetChars: slice into windows
          let offset = 0;
          while (offset < trimmedPara.length) {
            const slice = trimmedPara.slice(offset, offset + targetChars).trim();
            if (slice) {
              chunks.push({
                chunkIndex,
                pageNumber:
                  currentPage + Math.floor((chunkIndex * targetChars) / 1800),
                sectionHeading: lastHeading,
                content: slice,
                tokenEstimate: Math.max(1, Math.ceil(slice.length / 4)),
                keywords: tokenizeKeywords(slice),
              });
              chunkIndex += 1;
            }
            if (offset + targetChars >= trimmedPara.length) break;
            offset += Math.max(1, targetChars - overlapChars);
          }
          buffer = '';
        }
      }
    }

    if (buffer) {
      chunks.push({
        chunkIndex,
        pageNumber: currentPage,
        sectionHeading: lastHeading,
        content: buffer,
        tokenEstimate: Math.max(1, Math.ceil(buffer.length / 4)),
        keywords: tokenizeKeywords(buffer),
      });
      chunkIndex += 1;
    }

    currentPage += 1;
  }

  return chunks;
}

/**
 * Reports active retrieval mode honestly per FR-DOC-011:
 * never claims semantic/vector retrieval is active unless both embedding model
 * and Atlas Vector Search index configuration are present.
 */
export function getActiveRetrievalMode(): 'keyword' | 'vector_hybrid' {
  const hasEmbeddingModel = Boolean(process.env.OPENROUTER_EMBEDDING_MODEL?.trim());
  const hasVectorIndex = Boolean(process.env.ATLAS_VECTOR_INDEX_NAME?.trim());
  return hasEmbeddingModel && hasVectorIndex ? 'vector_hybrid' : 'keyword';
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    const va = a[i]!;
    const vb = b[i]!;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

/**
 * Ranks user-scoped chunks by keyword TF/phrase overlap (and vector similarity if available).
 */
export function rankAndRetrieveChunks(
  chunks: RetrievableChunk[],
  query: string,
  topK = 4,
  queryEmbedding?: number[],
): Array<{ chunk: RetrievableChunk; score: number }> {
  if (chunks.length === 0) return [];
  const queryTerms = tokenizeKeywords(query);
  const lowerQuery = query.toLowerCase().trim();

  const scored = chunks.map((chunk) => {
    const lowerContent = chunk.content.toLowerCase();
    const keywordSet = new Set(chunk.keywords);
    let score = 0;

    for (const term of queryTerms) {
      if (keywordSet.has(term)) {
        score += 2.0;
      } else if (lowerContent.includes(term)) {
        score += 1.0;
      }
    }

    if (lowerQuery.length >= 4 && lowerContent.includes(lowerQuery)) {
      score += 3.5;
    }

    if (
      chunk.sectionHeading &&
      queryTerms.some((t) => chunk.sectionHeading!.toLowerCase().includes(t))
    ) {
      score += 1.5;
    }

    if (queryEmbedding && chunk.embedding && chunk.embedding.length === queryEmbedding.length) {
      score += cosineSimilarity(queryEmbedding, chunk.embedding) * 5.0;
    }

    // Small baseline so top chunks are still returned when a user asks "Summarize this document"
    if (score === 0) {
      score = Math.max(0.1, 1 / (chunk.chunkIndex + 2));
    }

    return {
      chunk,
      score: Number(score.toFixed(3)),
    };
  });

  scored.sort((a, b) => b.score - a.score || a.chunk.chunkIndex - b.chunk.chunkIndex);
  return scored.slice(0, Math.max(1, topK));
}

/**
 * Neutralizes closing XML tags and prompt-override patterns inside untrusted document text (FR-AI-008).
 */
export function sanitizeUntrustedChunkText(raw: string): string {
  return raw
    .replace(/<\/?untrusted_document_chunk[^>]*>/gi, '[escaped_tag]')
    .replace(
      /\b(ignore\s+(?:all\s+)?(?:previous|prior|system)\s+instructions?|system\s+override|you\s+are\s+now\s+in\s+developer\s+mode)/gi,
      '[neutralized_directive]',
    );
}

/**
 * Wraps retrieved document chunks in <untrusted_document_chunk> tags with page & section metadata.
 */
export function formatSandboxedDocumentContext(
  ranked: Array<{ chunk: RetrievableChunk; score: number }>,
): {
  contextXml: string;
  citations: RankedChunkCitation[];
} {
  const citations: RankedChunkCitation[] = [];
  const xmlBlocks: string[] = [];

  for (const { chunk, score } of ranked) {
    const pageNum = chunk.pageNumber ?? 1;
    const safeSection = chunk.sectionHeading
      ? chunk.sectionHeading.replace(/"/g, "'")
      : 'Body';
    const safeContent = sanitizeUntrustedChunkText(chunk.content);

    xmlBlocks.push(
      `<untrusted_document_chunk index="${chunk.chunkIndex}" page="${pageNum}" section="${safeSection}">\n${safeContent}\n</untrusted_document_chunk>`,
    );

    citations.push({
      chunkId: chunk.id,
      chunkIndex: chunk.chunkIndex,
      pageNumber: pageNum,
      sectionHeading: chunk.sectionHeading,
      score,
      excerpt: safeContent.slice(0, 200),
    });
  }

  return {
    contextXml: xmlBlocks.join('\n\n'),
    citations,
  };
}
