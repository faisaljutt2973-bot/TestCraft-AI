const fs = require('fs');
const pdfParse = require('pdf-parse');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();

/**
 * Extracts raw text from an uploaded file (PDF, TXT, etc.)
 */
const extractTextFromFile = async (filePath, mimeType) => {
  if (!fs.existsSync(filePath)) {
    throw new Error('File not found on server.');
  }

  const buffer = fs.readFileSync(filePath);

  if (mimeType === 'application/pdf' || filePath.toLowerCase().endsWith('.pdf')) {
    const data = await pdfParse(buffer);
    return {
      text: data.text,
      pageCount: data.numpages || 1,
      info: data.info || {},
    };
  }

  // Plain text / Markdown / CSV / etc.
  const text = buffer.toString('utf-8');
  return {
    text,
    pageCount: Math.max(1, Math.ceil(text.length / 3000)),
    info: {},
  };
};

/**
 * Intelligent Table of Contents (TOC) and Chapter Detection
 * Scans extracted text for curriculum structural markers:
 * "Chapter 1: ...", "Unit 2 ...", "Lesson 3 ...", or numbered topics
 */
const detectChaptersFromText = (rawText) => {
  if (!rawText || !rawText.trim()) {
    return [];
  }

  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const chapters = [];
  const chapterRegex = /^(?:chapter|unit|lesson|module|part)\s+(\d+|[ivxlcdm]+)[:.\s\-]+(.+)/i;
  const numberedSectionRegex = /^(\d{1,2})\.\s+([A-Z][A-Za-z0-9\s,\-–—]{4,70})$/;

  let currentChapter = null;
  let currentContent = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    let match = line.match(chapterRegex);
    let chapterNum = null;
    let chapterTitle = null;

    if (match) {
      chapterNum = parseInt(match[1], 10) || chapters.length + 1;
      chapterTitle = match[2].trim();
    } else if (line.length < 80 && line.match(numberedSectionRegex)) {
      const numMatch = line.match(numberedSectionRegex);
      const parsedNum = parseInt(numMatch[1], 10);
      // Only treat as chapter if progressive or realistic (e.g. 1 to 20)
      if (parsedNum > 0 && parsedNum <= 25 && (!currentChapter || parsedNum >= currentChapter.chapterNumber)) {
        chapterNum = parsedNum;
        chapterTitle = numMatch[2].trim();
      }
    }

    if (chapterTitle && chapterNum !== null) {
      if (currentChapter) {
        currentChapter.rawContent = currentContent.join('\n').slice(0, 25000); // ground sample
        currentChapter.topics = extractTopicsFromChapterText(currentChapter.rawContent);
        currentChapter.summary = generateChapterSummary(currentChapter.title, currentChapter.topics);
        chapters.push(currentChapter);
      }

      currentChapter = {
        id: uuidv4(),
        chapterNumber: chapterNum,
        title: chapterTitle.replace(/[._\-]+$/, '').trim(),
        pages: `Approx. p.${Math.floor(i / 40) + 1}`,
        topics: [],
        rawContent: '',
        summary: '',
      };
      currentContent = [];
    } else {
      if (currentChapter) {
        currentContent.push(line);
      }
    }
  }

  // Push final chapter
  if (currentChapter) {
    currentChapter.rawContent = currentContent.join('\n').slice(0, 25000);
    currentChapter.topics = extractTopicsFromChapterText(currentChapter.rawContent);
    currentChapter.summary = generateChapterSummary(currentChapter.title, currentChapter.topics);
    chapters.push(currentChapter);
  }

  // If no explicit chapters detected (e.g. single short text or unconventional document),
  // split into logical curriculum modules
  if (chapters.length === 0) {
    const chunkSize = 4000;
    const totalChunks = Math.min(6, Math.max(1, Math.ceil(rawText.length / chunkSize)));
    for (let c = 0; c < totalChunks; c++) {
      const chunkText = rawText.slice(c * chunkSize, (c + 1) * chunkSize);
      const firstLine = chunkText.split(/\r?\n/).find((l) => l.trim().length > 5) || `Module ${c + 1}`;
      chapters.push({
        id: uuidv4(),
        chapterNumber: c + 1,
        title: firstLine.slice(0, 60).replace(/[#*]/g, '').trim(),
        pages: `Section ${c + 1}`,
        topics: extractTopicsFromChapterText(chunkText),
        rawContent: chunkText,
        summary: `Covers essential syllabus competencies and core concepts from Section ${c + 1}.`,
      });
    }
  }

  return chapters;
};

/**
 * Extracts subtopics or key concepts from chapter body
 */
const extractTopicsFromChapterText = (content) => {
  if (!content) return ['Core Concepts & Overview', 'Key Principles & Analysis', 'Practical Applications'];
  const lines = content.split(/\r?\n/).map((l) => l.trim());
  const topicCandidates = [];

  const topicRegex = /^(?:\d+\.\d+|\d+\)|\([a-z]\)|[A-Z]\.)\s+([A-Za-z0-9\s,\-]{4,60})/i;
  const boldMarkdownRegex = /^\*\*([A-Za-z0-9\s,\-]{4,60})\*\*/;

  for (const line of lines) {
    if (line.match(topicRegex)) {
      const match = line.match(topicRegex);
      topicCandidates.push(match[1].trim());
    } else if (line.match(boldMarkdownRegex)) {
      const match = line.match(boldMarkdownRegex);
      topicCandidates.push(match[1].trim());
    } else if (line.length > 5 && line.length < 50 && /^[A-Z][A-Za-z\s]+$/.test(line) && !line.includes('.')) {
      topicCandidates.push(line);
    }
    if (topicCandidates.length >= 6) break;
  }

  if (topicCandidates.length === 0) {
    return ['Fundamentals and Key Terminology', 'Principles & Structural Mechanisms', 'Evaluation & Applications'];
  }

  // Deduplicate
  return [...new Set(topicCandidates)].slice(0, 8);
};

const generateChapterSummary = (title, topics) => {
  if (topics && topics.length > 0) {
    return `In-depth syllabus chapter on ${title}, focusing on: ${topics.slice(0, 3).join(', ')}.`;
  }
  return `Comprehensive textbook material covering ${title} with essential theoretical and practical competencies.`;
};

module.exports = {
  extractTextFromFile,
  detectChaptersFromText,
  extractTopicsFromChapterText,
};
