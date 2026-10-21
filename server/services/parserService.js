const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const uuidv4 = () => crypto.randomUUID();

const MAX_CHAPTER_CHARS = 200000;
const MAX_TOTAL_STORED_CHARS = 7000000;
const MAX_FRONT_MATTER_CHARS = 20000;
const MIN_TEXT_CHARS = 40;
const SCANNED_CHARS_PER_PAGE = 40;

const cleanText = (value, maxLength = 5000) =>
  typeof value === 'string'
    ? value.replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim().slice(0, maxLength)
    : '';

const collapseWhitespace = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const normalizeHeading = (value) =>
  collapseWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const ROMAN_VALUES = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
const WORD_NUMBERS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
};

const romanToInt = (value) => {
  const roman = String(value || '').toLowerCase();
  if (!roman || ![...roman].every((character) => ROMAN_VALUES[character])) return null;
  let total = 0;
  let previous = 0;
  for (let index = roman.length - 1; index >= 0; index--) {
    const current = ROMAN_VALUES[roman[index]];
    if (current < previous) total -= current;
    else {
      total += current;
      previous = current;
    }
  }
  return total || null;
};

const parseChapterNumber = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (/^\d+$/.test(raw)) {
    const parsed = parseInt(raw, 10);
    return parsed > 0 ? parsed : null;
  }
  if (WORD_NUMBERS[raw]) return WORD_NUMBERS[raw];
  return romanToInt(raw);
};

const HEADING_REGEX =
  /^(chapter|unit|lesson|module|part)\s+(\d{1,3}|[ivxlcdm]{1,8}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b\s*[:.\-–—]?\s*(.*)$/i;

const DOT_LEADER_REGEX = /(?:\.{2,}|…{2,}|·{2,}|\u2026{1,})\s*(\d{1,4})\s*$/;
const TRAILING_PAGE_NUMBER_REGEX = /\s{2,}(\d{1,4})\s*$/;

const parseHeadingLine = (line) => {
  const trimmed = collapseWhitespace(line).replace(/[._\-–—]+$/, '').trim();
  if (!trimmed || trimmed.length > 180) return null;

  const match = trimmed.match(HEADING_REGEX);
  if (!match) return null;

  const chapterNumber = parseChapterNumber(match[2]);
  if (!chapterNumber) return null;

  const title = collapseWhitespace(match[3]).replace(DOT_LEADER_REGEX, '').trim();
  if (!title || title.length < 2) return null;

  return { chapterNumber, title, raw: trimmed };
};

const isTocPage = (pageText) => {
  const lines = String(pageText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 80);
  if (lines.length === 0) return false;

  const header = collapseWhitespace(lines.slice(0, 6).join(' ')).toLowerCase();
  const dotLeaderLines = lines.filter((line) => DOT_LEADER_REGEX.test(line)).length;
  const headingLines = lines.filter((line) => parseHeadingLine(line)).length;

  if (/^(table of )?contents\b/.test(header) && (dotLeaderLines >= 1 || headingLines >= 2)) return true;
  return dotLeaderLines >= 3 && headingLines >= 2;
};

const parseTocEntries = (pageTexts) => {
  const entries = [];
  const seen = new Set();

  for (const page of pageTexts) {
    for (const rawLine of page.text.split(/\r?\n/)) {
      let line = collapseWhitespace(rawLine);
      if (!line || line.length > 220) continue;

      let printedPage = null;
      const dotMatch = line.match(DOT_LEADER_REGEX);
      if (dotMatch) {
        printedPage = parseInt(dotMatch[1], 10);
        line = line.replace(DOT_LEADER_REGEX, '').trim();
      } else {
        const trailingMatch = line.match(TRAILING_PAGE_NUMBER_REGEX);
        if (trailingMatch) {
          printedPage = parseInt(trailingMatch[1], 10);
          line = line.slice(0, trailingMatch.index).trim();
        }
      }

      if (!printedPage || printedPage < 1) continue;

      const heading = parseHeadingLine(line);
      let chapterNumber = heading?.chapterNumber || null;
      let title = heading?.title || collapseWhitespace(line).replace(/^[\d.\-–—)\s]+/, '').trim();

      if (!chapterNumber) {
        const numbered = line.match(/^(\d{1,3})[.)]\s+(.{3,160})$/);
        if (numbered) {
          chapterNumber = parseInt(numbered[1], 10) || null;
          title = collapseWhitespace(numbered[2]);
        }
      }

      title = title.replace(DOT_LEADER_REGEX, '').replace(/[._\-–—]+$/, '').trim();
      if (!title || title.length < 2) continue;

      const key = `${chapterNumber || ''}:${normalizeHeading(title)}:${printedPage}`;
      if (seen.has(key)) continue;
      seen.add(key);

      entries.push({
        chapterNumber: chapterNumber || entries.length + 1,
        title: title.slice(0, 180),
        printedPage,
      });
    }
  }

  return entries;
};

const extractTopicsFromChapterText = (content) => {
  if (!content) return [];
  const lines = content.split(/\r?\n/).map((line) => line.trim());
  const topics = [];
  const seen = new Set();

  const subHeadingRegex = /^(?:\d+\.\d+|\d+\)|\([a-z]\)|[A-Z]\.)\s+(.{3,90})$/;
  const titleCaseRegex = /^[A-Z][A-Za-z0-9\s,&/'\-–—]{3,80}$/;

  for (const line of lines) {
    if (!line || line.length > 100) continue;
    if (/^\d{1,4}$/.test(line)) continue;
    if (/^(page|figure|table|fig\.|ex\.)\s*\d+/i.test(line)) continue;

    let topic = '';
    const subHeading = line.match(subHeadingRegex);
    if (subHeading) topic = subHeading[1].trim();
    else if (titleCaseRegex.test(line) && line.split(/\s+/).length <= 12 && !/[.!?]$/.test(line)) {
      topic = line;
    }

    if (!topic) continue;
    const normalized = normalizeHeading(topic);
    if (!normalized || normalized.length < 4 || seen.has(normalized)) continue;
    if (normalized === 'table of contents' || normalized === 'contents') continue;

    seen.add(normalized);
    topics.push(topic.slice(0, 120));
    if (topics.length >= 12) break;
  }

  return topics;
};

const generateChapterSummary = (title, content) => {
  const plain = collapseWhitespace(content);
  if (!plain) return '';

  const sentences = plain.match(/[^.!?]+[.!?]+/g) || [];
  let summary = collapseWhitespace(sentences.slice(0, 2).join(' '));
  if (!summary) summary = plain;
  if (summary.length > 320) summary = `${summary.slice(0, 317).trim()}…`;
  return summary || `Text extracted for ${title}.`;
};

const formatPageRange = (startPage, endPage, syntheticPages) => {
  if (syntheticPages) return 'Text document';
  if (!startPage) return 'N/A';
  if (!endPage || endPage === startPage) return `p. ${startPage}`;
  return `pp. ${startPage}–${endPage}`;
};

const buildChapter = ({
  title,
  chapterNumber,
  startPage,
  endPage,
  lines,
  syntheticPages,
  remainingBudget,
}) => {
  let rawContent = lines.join('\n').replace(/\n{4,}/g, '\n\n\n').trim();
  let contentTruncated = false;

  if (rawContent.length > MAX_CHAPTER_CHARS) {
    rawContent = rawContent.slice(0, MAX_CHAPTER_CHARS);
    contentTruncated = true;
  }
  if (remainingBudget <= 0 && rawContent) {
    rawContent = '';
    contentTruncated = true;
  } else if (rawContent.length > remainingBudget) {
    rawContent = rawContent.slice(0, remainingBudget);
    contentTruncated = true;
  }

  const topics = extractTopicsFromChapterText(rawContent);

  return {
    id: uuidv4(),
    chapterNumber,
    title: title.slice(0, 180),
    pages: formatPageRange(startPage, endPage, syntheticPages),
    startPage: syntheticPages ? null : startPage,
    endPage: syntheticPages ? null : endPage,
    topics,
    summary: generateChapterSummary(title, rawContent),
    contentPreview: collapseWhitespace(rawContent).slice(0, 600),
    contentLength: rawContent.length,
    contentTruncated,
    isExcluded: false,
    rawContent,
  };
};

const fallbackPageChapters = (pages, syntheticPages) => {
  const usablePages = pages.filter((page) => page.text && page.text.trim());
  if (usablePages.length === 0) return [];

  const targetCharsPerChapter = 6000;
  const groups = [];
  let current = { pages: [], chars: 0 };

  for (const page of usablePages) {
    const pageChars = page.text.trim().length;
    if (current.pages.length > 0 && current.chars + pageChars > targetCharsPerChapter && groups.length < 59) {
      groups.push(current);
      current = { pages: [], chars: 0 };
    }
    current.pages.push(page);
    current.chars += pageChars;
  }
  if (current.pages.length > 0) groups.push(current);

  let remainingBudget = MAX_TOTAL_STORED_CHARS;
  return groups.map((group, index) => {
    const lines = group.pages.flatMap((page) => page.text.split(/\r?\n/));
    const firstMeaningful = lines
      .map((line) => collapseWhitespace(line))
      .find((line) => line.length >= 8 && !/^\d{1,4}$/.test(line));
    const title = firstMeaningful
      ? firstMeaningful.replace(/^[#*\s]+/, '').slice(0, 80)
      : `Document section ${index + 1}`;
    const chapter = buildChapter({
      title,
      chapterNumber: index + 1,
      startPage: group.pages[0].pageNumber,
      endPage: group.pages[group.pages.length - 1].pageNumber,
      lines,
      syntheticPages,
      remainingBudget,
    });
    remainingBudget -= chapter.rawContent.length;
    return chapter;
  });
};

const chaptersFromToc = (tocEntries, pages, syntheticPages) => {
  if (tocEntries.length === 0) return [];
  const ordered = [...tocEntries].sort((a, b) => a.printedPage - b.printedPage);
  const firstEntry = ordered[0];

  let offset = 0;
  const normalizedFirstTitle = normalizeHeading(firstEntry.title);
  if (normalizedFirstTitle.length >= 4) {
    for (const page of pages) {
      if (normalizeHeading(page.text).includes(normalizedFirstTitle)) {
        offset = page.pageNumber - firstEntry.printedPage;
        break;
      }
    }
  }

  let remainingBudget = MAX_TOTAL_STORED_CHARS;
  const chapters = [];
  const usedNumbers = new Set();

  for (let index = 0; index < ordered.length; index++) {
    const entry = ordered[index];
    const nextEntry = ordered[index + 1];
    const startPage = Math.max(1, entry.printedPage + offset);
    const endPage = nextEntry
      ? Math.max(startPage, Math.min(pages.length, nextEntry.printedPage + offset - 1))
      : pages.length;

    const pageTexts = pages
      .filter((page) => page.pageNumber >= startPage && page.pageNumber <= endPage)
      .map((page) => page.text);

    if (pageTexts.join('').trim().length === 0) continue;

    let chapterNumber = entry.chapterNumber;
    if (!chapterNumber || usedNumbers.has(chapterNumber)) {
      chapterNumber = chapters.length + 1;
      while (usedNumbers.has(chapterNumber)) chapterNumber++;
    }
    usedNumbers.add(chapterNumber);

    const chapter = buildChapter({
      title: entry.title,
      chapterNumber,
      startPage,
      endPage,
      lines: pageTexts.flatMap((text) => text.split(/\r?\n/)),
      syntheticPages,
      remainingBudget,
    });
    remainingBudget -= chapter.rawContent.length;
    chapters.push(chapter);
  }

  return chapters;
};

const detectChaptersFromDocument = (parsed) => {
  const pages = parsed?.pages || [];
  const syntheticPages = !!parsed?.syntheticPages;
  const warnings = [...(parsed?.warnings || [])];

  if (!pages.length) {
    return {
      chapters: [],
      frontMatterText: '',
      detectionMode: 'none',
      warnings: ['No readable pages were found in the uploaded document.'],
    };
  }

  const nonEmptyPages = pages.filter((page) => page.text && page.text.trim());
  const totalChars = nonEmptyPages.reduce((sum, page) => sum + page.text.trim().length, 0);
  const averageChars = totalChars / Math.max(1, pages.length);

  if (totalChars === 0) {
    warnings.push(
      'No selectable text was found. This PDF may be scanned or image-only; OCR is not configured on this server.'
    );
    return { chapters: [], frontMatterText: '', detectionMode: 'none', warnings };
  }
  if (averageChars < SCANNED_CHARS_PER_PAGE) {
    warnings.push(
      'Very little selectable text was extracted. The PDF may be partially scanned; OCR is not configured, so image-only pages cannot be read.'
    );
  }

  const tocPageNumbers = new Set();
  const tocPageTexts = [];
  for (const page of pages) {
    if (isTocPage(page.text)) {
      tocPageNumbers.add(page.pageNumber);
      tocPageTexts.push(page);
    }
  }
  const tocEntries = parseTocEntries(tocPageTexts.length > 0 ? tocPageTexts : []);

  const frontMatterLines = [];
  const chapterDrafts = [];
  let current = null;
  let remainingBudget = MAX_TOTAL_STORED_CHARS;

  const finalizeCurrent = () => {
    if (!current) return;
    const chapter = buildChapter({
      title: current.title,
      chapterNumber: current.chapterNumber,
      startPage: current.startPage,
      endPage: current.endPage || current.startPage,
      lines: current.lines,
      syntheticPages,
      remainingBudget,
    });
    remainingBudget -= chapter.rawContent.length;
    chapterDrafts.push(chapter);
    current = null;
  };

  for (const page of pages) {
    if (tocPageNumbers.has(page.pageNumber)) {
      frontMatterLines.push(...page.text.split(/\r?\n/));
      continue;
    }

    const lines = page.text.split(/\r?\n/);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const heading = parseHeadingLine(line);

      if (heading) {
        const sameAsCurrent =
          current &&
          current.chapterNumber === heading.chapterNumber &&
          normalizeHeading(current.title) === normalizeHeading(heading.title);

        if (sameAsCurrent) {
          // Repeated running header at the top of a page - do not start a new chapter.
          if (lineIndex <= 4) continue;
          continue;
        }

        finalizeCurrent();
        current = {
          chapterNumber: heading.chapterNumber,
          title: heading.title,
          startPage: page.pageNumber,
          endPage: page.pageNumber,
          lines: [],
        };
        continue;
      }

      if (current) {
        current.lines.push(line);
        current.endPage = page.pageNumber;
      } else {
        frontMatterLines.push(line);
      }
    }
  }
  finalizeCurrent();

  let chapters = chapterDrafts;
  let detectionMode = 'headings';

  if (chapters.length === 0 && tocEntries.length > 0) {
    chapters = chaptersFromToc(tocEntries, pages, syntheticPages);
    if (chapters.length > 0) {
      detectionMode = 'toc';
      warnings.push('Chapter ranges were reconstructed from the table of contents because no body headings were detected.');
    }
  }

  if (chapters.length === 0) {
    chapters = fallbackPageChapters(pages, syntheticPages);
    detectionMode = 'pages';
    if (chapters.length > 1) {
      warnings.push(
        'No explicit chapter headings were found. The document was split into readable sections by page range.'
      );
    }
  }

  const usedNumbers = new Set();
  chapters = chapters.map((chapter, index) => {
    if (!chapter.chapterNumber || usedNumbers.has(chapter.chapterNumber)) {
      let nextNumber = index + 1;
      while (usedNumbers.has(nextNumber)) nextNumber++;
      chapter.chapterNumber = nextNumber;
    }
    usedNumbers.add(chapter.chapterNumber);
    return chapter;
  });

  if (chapters.some((chapter) => chapter.contentTruncated)) {
    warnings.push(
      'Some extracted text was truncated to keep the book record within storage limits. The first part of each affected chapter is preserved for question generation.'
    );
  }

  const frontMatterText = cleanText(frontMatterLines.join('\n'), MAX_FRONT_MATTER_CHARS);

  return {
    chapters,
    frontMatterText,
    detectionMode,
    warnings: [...new Set(warnings)],
  };
};

const extractPdfPages = async (buffer) => {
  const capturedPages = [];
  const data = await pdfParse(buffer, {
    pagerender: (pageData) =>
      pageData.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false }).then((textContent) => {
        let text = '';
        let lastY;
        for (const item of textContent.items) {
          if (lastY === item.transform?.[5] || !lastY) text += item.str;
          else text += `\n${item.str}`;
          lastY = item.transform?.[5];
        }
        const pageNumber = Number(pageData.pageNumber) || capturedPages.length + 1;
        capturedPages.push({ pageNumber, text });
        return text;
      }),
  });

  capturedPages.sort((a, b) => a.pageNumber - b.pageNumber);
  if (capturedPages.length === 0 && data.text) {
    capturedPages.push({ pageNumber: 1, text: data.text });
  }

  return { data, pages: capturedPages };
};

const extractDocument = async (filePath, mimeType, originalFilename = '') => {
  if (!filePath || !fs.existsSync(filePath)) {
    const error = new Error('Uploaded file could not be found on the server.');
    error.code = 'FILE_MISSING';
    error.status = 400;
    throw error;
  }

  const extension = path.extname(originalFilename || filePath).toLowerCase();
  const buffer = await fs.promises.readFile(filePath);
  if (buffer.length === 0) {
    const error = new Error('The uploaded file is empty.');
    error.code = 'FILE_EMPTY';
    error.status = 400;
    throw error;
  }

  const isPdf = extension === '.pdf' || mimeType === 'application/pdf';
  if (isPdf) {
    try {
      const { data, pages } = await extractPdfPages(buffer);
      const text = pages
        .map((page) => page.text)
        .join('\n\n')
        .replace(/\u0000/g, '')
        .trim();

      const averageCharsPerPage = text.length / Math.max(1, pages.length);
      if (!text || text.length < MIN_TEXT_CHARS || averageCharsPerPage < SCANNED_CHARS_PER_PAGE) {
        const error = new Error(
          'No readable text could be extracted from this PDF. It may be scanned or image-only. OCR is not configured on this server.'
        );
        error.code = 'PDF_NO_TEXT';
        error.status = 422;
        throw error;
      }

      return {
        text,
        pages,
        pageCount: data.numpages || pages.length || 1,
        info: data.info || {},
        metadata: data.metadata || null,
        sourceFormat: 'pdf',
        syntheticPages: false,
        warnings: [],
      };
    } catch (error) {
      if (error.code) throw error;

      const message = String(error.message || '');
      if (/password|encrypted/i.test(message)) {
        const encrypted = new Error('This PDF is password protected. Remove the password and upload it again.');
        encrypted.code = 'PDF_ENCRYPTED';
        encrypted.status = 422;
        throw encrypted;
      }
      if (/invalid pdf|not a pdf|unexpected end|missing endstream|bad xref/i.test(message)) {
        const invalid = new Error('The PDF is corrupted or is not a valid PDF file.');
        invalid.code = 'PDF_INVALID';
        invalid.status = 422;
        throw invalid;
      }

      const failed = new Error(`The PDF could not be processed: ${message || 'unknown parser error'}`);
      failed.code = 'PDF_PARSE_FAILED';
      failed.status = 422;
      throw failed;
    }
  }

  if (extension === '.docx') {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const text = cleanText(result.value, Number.MAX_SAFE_INTEGER);
      if (!text || text.length < MIN_TEXT_CHARS) {
        const error = new Error('No readable text could be extracted from this DOCX file.');
        error.code = 'DOCX_NO_TEXT';
        error.status = 422;
        throw error;
      }
      return {
        text,
        pages: [{ pageNumber: 1, text }],
        pageCount: 1,
        info: {},
        metadata: null,
        sourceFormat: 'docx',
        syntheticPages: true,
        warnings: [
          'DOCX files do not contain reliable PDF page numbers. Chapters are detected from headings and text length.'
        ],
      };
    } catch (error) {
      if (error.code) throw error;
      const failed = new Error(`The DOCX file could not be processed: ${error.message}`);
      failed.code = 'DOCX_INVALID';
      failed.status = 422;
      throw failed;
    }
  }

  if (['.txt', '.md', '.markdown'].includes(extension) || /^text\//.test(mimeType || '')) {
    const text = cleanText(buffer.toString('utf8'), Number.MAX_SAFE_INTEGER);
    if (!text || text.length < MIN_TEXT_CHARS) {
      const error = new Error('The uploaded text file is empty or too short to analyse.');
      error.code = 'TEXT_NO_TEXT';
      error.status = 422;
      throw error;
    }
    return {
      text,
      pages: [{ pageNumber: 1, text }],
      pageCount: 1,
      info: {},
      metadata: null,
      sourceFormat: 'text',
      syntheticPages: true,
      warnings: ['Text documents do not contain page numbers. Chapter page ranges are not available.'],
    };
  }

  const unsupported = new Error('Unsupported file type. Upload a PDF, DOCX, TXT, or Markdown file.');
  unsupported.code = 'UNSUPPORTED_FILE';
  unsupported.status = 415;
  throw unsupported;
};

// Backwards-compatible wrappers for older callers.
const extractTextFromFile = async (filePath, mimeType) => {
  const parsed = await extractDocument(filePath, mimeType, filePath);
  return { text: parsed.text, pageCount: parsed.pageCount, info: parsed.info };
};

const detectChaptersFromText = (rawText) =>
  detectChaptersFromDocument({
    pages: [{ pageNumber: 1, text: String(rawText || '') }],
    syntheticPages: true,
  }).chapters;

module.exports = {
  extractDocument,
  extractTextFromFile,
  detectChaptersFromDocument,
  detectChaptersFromText,
  extractTopicsFromChapterText,
  MIN_TEXT_CHARS,
};
