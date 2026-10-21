const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();
const Storage = require('../config/storage');
const { extractDocument, detectChaptersFromDocument } = require('../services/parserService');
const { searchGoogleBooks } = require('../services/googleBooksService');
const { saveUploadedFile, deleteStoredFile, openDownloadStream } = require('../services/fileStorageService');

const MAX_CHAPTERS = 200;
const MAX_TEXT_FIELD = 5000;
const MAX_TOPICS = 20;
const MAX_TOPIC_LENGTH = 160;
const JOB_CONCURRENCY = 2;

const activeJobs = new Set();
const queuedJobs = [];

const cleanText = (value, maxLength = MAX_TEXT_FIELD) =>
  typeof value === 'string'
    ? value
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength)
    : '';

const cleanMultiline = (value, maxLength = MAX_TEXT_FIELD) =>
  typeof value === 'string'
    ? value.replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim().slice(0, maxLength)
    : '';

const makeError = (status, code, message) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

const parsePositiveInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const parseBoolean = (value, fallback = true) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  return fallback;
};

const safeUrl = (value) => {
  const raw = cleanText(value, 2000);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
};

const hashValue = (...parts) =>
  crypto
    .createHash('sha256')
    .update(parts.map((part) => cleanText(String(part || ''), 500).toLowerCase()).join('|'))
    .digest('hex');

const publicChapter = (chapter) => {
  if (!chapter) return chapter;
  const content = typeof chapter.rawContent === 'string' ? chapter.rawContent : '';
  const contentLength = Number.isFinite(Number(chapter.contentLength))
    ? Number(chapter.contentLength)
    : content.length;
  const contentPreview =
    chapter.contentPreview || cleanText(content, 600);
  const {
    rawContent,
    contentLength: _contentLength,
    contentPreview: _contentPreview,
    ...safe
  } = chapter;

  return {
    ...safe,
    contentLength,
    contentPreview: contentPreview || '',
  };
};

const publicBook = (book) => {
  if (!book) return book;
  const {
    filePath,
    fileId,
    fileStorage,
    fileHash,
    fileMimeType,
    frontMatterText,
    ...safe
  } = book;
  return {
    ...safe,
    chapters: Array.isArray(book.chapters) ? book.chapters.map(publicChapter) : [],
    hasDocument: Boolean(filePath || fileId),
    frontMatterLength: typeof frontMatterText === 'string' ? frontMatterText.length : 0,
  };
};

const publicJob = (job, book = null) => {
  if (!job) return job;
  const { file, userId, ...safe } = job;
  return {
    ...safe,
    book: book ? publicBook(book) : null,
  };
};

const validateMetadata = (body = {}, options = {}) => {
  const { requireTitle = false, requireClassSubject = true } = options;
  const title = cleanText(body.title, 180);
  const className = cleanText(body.className, 60);
  const subject = cleanText(body.subject, 80);
  const author = cleanText(body.author, 120);
  const publisher = cleanText(body.publisher, 120);
  const boardName = cleanText(body.boardName, 120);
  const edition = cleanText(body.edition, 80);
  const language = cleanText(body.language, 40);
  const description = cleanMultiline(body.description, 1000);

  if (requireTitle && !title) throw makeError(400, 'TITLE_REQUIRED', 'Book title is required.');
  if (requireClassSubject && !className) {
    throw makeError(400, 'CLASS_REQUIRED', 'Class / grade is required.');
  }
  if (requireClassSubject && !subject) {
    throw makeError(400, 'SUBJECT_REQUIRED', 'Subject is required.');
  }

  return {
    title,
    className,
    subject,
    author,
    publisher,
    boardName,
    edition,
    language,
    description,
    isPublic: parseBoolean(body.isPublic, true),
  };
};

const normalizeTopics = (topics) => {
  const list = Array.isArray(topics)
    ? topics
    : typeof topics === 'string'
    ? topics.split(/\r?\n|;/)
    : [];

  const cleaned = [];
  const seen = new Set();
  for (const topic of list) {
    const value = cleanText(topic, MAX_TOPIC_LENGTH);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cleaned.push(value);
    if (cleaned.length >= MAX_TOPICS) break;
  }
  return cleaned;
};

const normalizeChapters = (rawChapters, existingChapters = [], options = {}) => {
  const { requireTitles = true } = options;
  if (!Array.isArray(rawChapters)) {
    throw makeError(400, 'INVALID_CHAPTERS', 'Chapters must be provided as an array.');
  }
  if (rawChapters.length > MAX_CHAPTERS) {
    throw makeError(400, 'TOO_MANY_CHAPTERS', `A book cannot have more than ${MAX_CHAPTERS} chapters.`);
  }

  const existingById = new Map();
  const existingByNumber = new Map();
  for (const chapter of existingChapters) {
    if (chapter?.id) existingById.set(String(chapter.id), chapter);
    if (chapter?.chapterNumber) existingByNumber.set(String(chapter.chapterNumber), chapter);
  }

  const usedNumbers = new Set();
  const normalized = [];

  for (let index = 0; index < rawChapters.length; index++) {
    const raw = rawChapters[index];
    if (!raw || typeof raw !== 'object') continue;

    const existing =
      (raw.id && existingById.get(String(raw.id))) ||
      (raw.chapterNumber && existingByNumber.get(String(raw.chapterNumber))) ||
      null;

    const title = cleanText(raw.title ?? existing?.title, 180);
    if (!title) {
      if (requireTitles) continue;
      continue;
    }

    let chapterNumber = parsePositiveInt(raw.chapterNumber) || parsePositiveInt(existing?.chapterNumber) || index + 1;
    while (usedNumbers.has(chapterNumber)) chapterNumber++;
    usedNumbers.add(chapterNumber);

    const topics =
      Object.prototype.hasOwnProperty.call(raw, 'topics') ? normalizeTopics(raw.topics) : normalizeTopics(existing?.topics);
    const summary =
      Object.prototype.hasOwnProperty.call(raw, 'summary')
        ? cleanText(raw.summary, 600)
        : cleanText(existing?.summary, 600);
    const pages = cleanText(raw.pages, 60) || cleanText(existing?.pages, 60) || 'N/A';

    normalized.push({
      id: existing?.id || uuidv4(),
      chapterNumber,
      title,
      pages,
      startPage:
        existing?.startPage !== undefined && existing?.startPage !== null && Number.isFinite(Number(existing.startPage))
          ? Number(existing.startPage)
          : null,
      endPage:
        existing?.endPage !== undefined && existing?.endPage !== null && Number.isFinite(Number(existing.endPage))
          ? Number(existing.endPage)
          : null,
      topics,
      summary,
      isExcluded: raw.isExcluded === undefined ? Boolean(existing?.isExcluded) : parseBoolean(raw.isExcluded, false),
      rawContent: typeof existing?.rawContent === 'string' ? existing.rawContent : '',
      contentPreview: cleanText(existing?.contentPreview, 600),
      contentLength: Number.isFinite(Number(existing?.contentLength))
        ? Number(existing.contentLength)
        : typeof existing?.rawContent === 'string'
        ? existing.rawContent.length
        : 0,
      contentTruncated: Boolean(existing?.contentTruncated),
    });
  }

  return normalized;
};

const contentStatusForChapters = (chapters) => {
  if (!chapters || chapters.length === 0) return 'metadata_only';
  return chapters.some((chapter) => chapter.rawContent && chapter.rawContent.trim()) ? 'extracted' : 'outline_only';
};

const canAccessBook = (book, user) => {
  if (!book || !user) return false;
  return book.isPublic !== false || String(book.createdBy) === String(user.id) || user.role === 'admin';
};

const canModifyBook = (book, user) =>
  Boolean(book && user && (String(book.createdBy) === String(user.id) || user.role === 'admin'));

const getBooks = async (req, res) => {
  try {
    const { className, subject, search, sourceType } = req.query;
    let books = await Storage.find('books');

    books = books.filter((book) => canAccessBook(book, req.user));

    if (className) books = books.filter((book) => book.className === className);
    if (subject) {
      const normalizedSubject = String(subject).toLowerCase();
      books = books.filter((book) => String(book.subject || '').toLowerCase() === normalizedSubject);
    }
    if (sourceType) books = books.filter((book) => book.sourceType === sourceType);
    if (search) {
      const query = String(search).toLowerCase();
      books = books.filter(
        (book) =>
          String(book.title || '').toLowerCase().includes(query) ||
          String(book.author || '').toLowerCase().includes(query) ||
          String(book.boardName || '').toLowerCase().includes(query) ||
          String(book.subject || '').toLowerCase().includes(query)
      );
    }

    books.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    res.json({ success: true, count: books.length, books: books.map(publicBook) });
  } catch (error) {
    handleControllerError(res, error, 'Could not load the book library.');
  }
};

const getBookById = async (req, res) => {
  try {
    const book = await Storage.findById('books', req.params.id);
    if (!book || !canAccessBook(book, req.user)) {
      return res.status(404).json({ success: false, message: 'Book not found.' });
    }
    res.json({ success: true, book: publicBook(book) });
  } catch (error) {
    handleControllerError(res, error, 'Could not load the book.');
  }
};

const createManualBook = async (req, res) => {
  try {
    const metadata = validateMetadata(req.body, { requireTitle: true, requireClassSubject: true });
    const chapters = normalizeChapters(req.body.chapters || [], [], { requireTitles: true });

    const dedupeKey = hashValue(
      'manual',
      req.user.id,
      metadata.title,
      metadata.className,
      metadata.subject,
      metadata.boardName
    );

    const existing = await Storage.findOne('books', { createdBy: req.user.id, dedupeKey });
    if (existing) {
      return res.status(200).json({
        success: true,
        duplicate: true,
        message: 'A book with the same title, class, subject, and board already exists.',
        book: publicBook(existing),
      });
    }

    const newBook = await Storage.create('books', {
      ...metadata,
      author: metadata.author || 'Curriculum Committee',
      publisher: metadata.publisher || '',
      boardId: cleanText(req.body.boardId, 80) || 'custom-board',
      boardName: metadata.boardName || 'Custom / Independent Board',
      edition: metadata.edition || 'Latest Edition',
      language: metadata.language || 'English',
      description: metadata.description || 'Textbook outline registered by a teacher.',
      sourceType: 'manual_curriculum',
      contentStatus: contentStatusForChapters(chapters),
      chapterDetection: chapters.length > 0 ? 'manual' : 'none',
      chapters,
      pageCount: 0,
      dedupeKey,
      createdBy: req.user.id,
    });

    res.status(201).json({ success: true, message: 'Book created successfully.', book: publicBook(newBook) });
  } catch (error) {
    handleControllerError(res, error, 'Could not create the book.');
  }
};

const importGoogleBook = async (req, res) => {
  try {
    const source = req.body?.googleBook;
    if (!source || typeof source !== 'object') {
      return res.status(400).json({ success: false, message: 'Google Book metadata is required.' });
    }

    const metadata = validateMetadata(req.body, { requireClassSubject: true });
    const googleBooksId = cleanText(source.googleBooksId, 80);
    const isbn = cleanText(source.isbn, 40);
    const title = cleanText(source.title, 240);
    if (!title) {
      return res.status(400).json({ success: false, message: 'Google Book title is required.' });
    }
    if (!googleBooksId && !isbn) {
      return res.status(400).json({
        success: false,
        message: 'A Google Books volume ID or ISBN is required to import this book.',
      });
    }

    const dedupeKey = hashValue('google', req.user.id, googleBooksId || isbn, title);
    const existing = await Storage.findOne('books', { createdBy: req.user.id, dedupeKey });
    if (existing) {
      return res.status(200).json({
        success: true,
        duplicate: true,
        message: 'This Google Books record is already in your library.',
        book: publicBook(existing),
      });
    }

    const authors = Array.isArray(source.authors)
      ? source.authors.map((author) => cleanText(author, 120)).filter(Boolean).slice(0, 10)
      : [];

    const newBook = await Storage.create('books', {
      ...metadata,
      title,
      subtitle: cleanText(source.subtitle, 240),
      author: authors.join(', ') || 'Various Authors',
      publisher: cleanText(source.publisher, 160),
      publishedDate: cleanText(source.publishedDate, 40),
      thumbnail: safeUrl(source.thumbnail),
      googleBooksId,
      previewLink: safeUrl(source.previewLink),
      infoLink: safeUrl(source.infoLink),
      isbn,
      categories: Array.isArray(source.categories)
        ? source.categories.map((category) => cleanText(category, 100)).filter(Boolean).slice(0, 8)
        : [],
      boardName: metadata.boardName || 'Standard Board',
      className: metadata.className,
      subject: metadata.subject || cleanText(source.categories?.[0], 80) || 'General Education',
      sourceType: 'google_books_metadata',
      contentStatus: 'metadata_only',
      chapterDetection: 'none',
      chapters: [],
      pageCount: Math.max(0, Number.parseInt(source.pageCount, 10) || 0),
      description: metadata.description || cleanText(source.description, 5000),
      dedupeKey,
      createdBy: req.user.id,
    });

    res.status(201).json({
      success: true,
      message:
        'Book metadata imported from Google Books. Upload the book PDF to extract chapters before generating tests.',
      book: publicBook(newBook),
    });
  } catch (error) {
    handleControllerError(res, error, 'Could not import the Google Books record.');
  }
};

const searchGoogleBooksApi = async (req, res) => {
  try {
    const query = cleanText(req.query.q, 200);
    if (!query) {
      return res.status(400).json({ success: false, message: 'A search query is required.' });
    }

    const settings = await Storage.getSettings();
    const books = await searchGoogleBooks(query, req.query.maxResults, {
      apiKey: settings.googleBooksApiKey,
    });

    res.json({ success: true, count: books.length, books, source: 'google_books' });
  } catch (error) {
    console.error('[Google Books] Search failed:', error.message);
    const status = [400, 429, 502, 504].includes(error.status) ? error.status : 502;
    res.status(status).json({
      success: false,
      code: error.code || 'GOOGLE_BOOKS_ERROR',
      message: error.message || 'Google Books search failed. Please try again.',
    });
  }
};

const uploadBookFile = async (req, res) => {
  const tempPath = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No document file was uploaded.' });
    }

    if (!req.file.size) {
      await removeTempFile(tempPath);
      return res.status(422).json({ success: false, code: 'EMPTY_FILE', message: 'The uploaded file is empty.' });
    }

    const targetBookId = req.params.id || null;
    let targetBook = null;
    if (targetBookId) {
      targetBook = await Storage.findById('books', targetBookId);
      if (!targetBook || !canAccessBook(targetBook, req.user)) {
        await removeTempFile(tempPath);
        return res.status(404).json({ success: false, message: 'Book not found.' });
      }
      if (!canModifyBook(targetBook, req.user)) {
        await removeTempFile(tempPath);
        return res.status(403).json({ success: false, message: 'You do not have permission to attach a file to this book.' });
      }
    }

    const metadata = targetBook
      ? {}
      : validateMetadata(req.body, { requireClassSubject: true });

    const fileHash = await hashFile(tempPath);
    if (!targetBookId) {
      const existing = await Storage.findOne('books', { createdBy: req.user.id, fileHash });
      if (existing) {
        await removeTempFile(tempPath);
        return res.status(200).json({
          success: true,
          duplicate: true,
          message: 'This exact file has already been uploaded.',
          book: publicBook(existing),
        });
      }
    }

    const fallbackTitle = path
      .basename(req.file.originalname, path.extname(req.file.originalname))
      .replace(/[-_]+/g, ' ')
      .trim();

    const job = await Storage.create('bookJobs', {
      status: 'queued',
      progress: 0,
      stage: 'Queued',
      message: 'Waiting to process the uploaded document.',
      userId: req.user.id,
      targetBookId,
      metadata: {
        ...metadata,
        title: metadata.title || fallbackTitle || 'Uploaded textbook',
      },
      file: {
        path: tempPath,
        originalname: cleanText(req.file.originalname, 255),
        mimetype: cleanText(req.file.mimetype, 120),
        size: req.file.size,
      },
      fileHash,
    });

    scheduleJob(job.id);

    return res.status(202).json({
      success: true,
      jobId: job.id,
      status: 'queued',
      progress: 0,
      message: 'Document uploaded. Extracting text and detecting chapters.',
    });
  } catch (error) {
    await removeTempFile(tempPath);
    handleControllerError(res, error, 'Could not start processing the uploaded document.');
  }
};

const getUploadJob = async (req, res) => {
  try {
    const job = await Storage.findById('bookJobs', req.params.jobId);
    if (!job || String(job.userId) !== String(req.user.id)) {
      return res.status(404).json({ success: false, message: 'Upload job not found.' });
    }

    let book = null;
    if (job.status === 'completed' && job.resultBookId) {
      book = await Storage.findById('books', job.resultBookId);
      if (book && !canAccessBook(book, req.user)) book = null;
    }

    res.json({ success: true, job: publicJob(job, book) });
  } catch (error) {
    handleControllerError(res, error, 'Could not read the upload status.');
  }
};

const getBookFile = async (req, res) => {
  try {
    const book = await Storage.findById('books', req.params.id);
    if (!book || !canAccessBook(book, req.user)) {
      return res.status(404).json({ success: false, message: 'Book not found.' });
    }

    const filename = cleanText(book.originalFilename, 200) || `${cleanText(book.title, 80) || 'book'}.pdf`;
    res.setHeader('Content-Type', book.fileMimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(filename)}`);

    if (book.fileStorage === 'gridfs' && book.fileId) {
      const { stream } = await openDownloadStream(book.fileId);
      stream.on('error', (error) => {
        console.error('[Book File] Stream error:', error.message);
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: 'Could not read the stored file.' });
        } else {
          res.end();
        }
      });
      return stream.pipe(res);
    }

    if (book.filePath && fs.existsSync(book.filePath)) {
      return fs.createReadStream(book.filePath).pipe(res);
    }

    return res.status(404).json({ success: false, message: 'No file is stored for this book.' });
  } catch (error) {
    handleControllerError(res, error, 'Could not download the stored book file.');
  }
};

const updateBookChapters = async (req, res) => {
  try {
    const book = await Storage.findById('books', req.params.id);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found.' });
    }
    if (!canModifyBook(book, req.user)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to modify this book.' });
    }

    const chapters = normalizeChapters(req.body.chapters, book.chapters || [], { requireTitles: true });
    const updated = await Storage.update('books', req.params.id, {
      chapters,
      contentStatus: contentStatusForChapters(chapters),
      chapterDetection: book.chapterDetection || (chapters.length > 0 ? 'manual' : 'none'),
    });

    res.json({ success: true, message: 'Chapters updated successfully.', book: publicBook(updated) });
  } catch (error) {
    handleControllerError(res, error, 'Could not update the chapters.');
  }
};

const updateBook = async (req, res) => {
  try {
    const book = await Storage.findById('books', req.params.id);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found.' });
    }
    if (!canModifyBook(book, req.user)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to update this book.' });
    }

    const allowedFields = [
      'title',
      'author',
      'publisher',
      'boardName',
      'className',
      'subject',
      'edition',
      'language',
      'description',
      'thumbnail',
    ];
    const updates = {};

    for (const field of allowedFields) {
      if (!Object.prototype.hasOwnProperty.call(req.body, field)) continue;
      const maxLength = field === 'description' ? 1000 : 240;
      updates[field] = field === 'description' ? cleanMultiline(req.body[field], maxLength) : cleanText(req.body[field], maxLength);
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'isPublic')) {
      updates.isPublic = parseBoolean(req.body.isPublic, book.isPublic !== false);
    }

    for (const required of ['title', 'className', 'subject']) {
      if (Object.prototype.hasOwnProperty.call(updates, required) && !updates[required]) {
        return res.status(400).json({ success: false, message: `${required === 'className' ? 'Class' : required[0].toUpperCase() + required.slice(1)} cannot be empty.` });
      }
    }

    const updated = await Storage.update('books', req.params.id, updates);
    res.json({ success: true, message: 'Book updated successfully.', book: publicBook(updated) });
  } catch (error) {
    handleControllerError(res, error, 'Could not update the book.');
  }
};

const deleteBook = async (req, res) => {
  try {
    const book = await Storage.findById('books', req.params.id);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found.' });
    }
    if (!canModifyBook(book, req.user)) {
      return res.status(403).json({ success: false, message: 'You do not have permission to delete this book.' });
    }

    await deleteStoredFile(book);
    await Storage.delete('books', req.params.id);
    res.json({ success: true, message: 'Book removed from library.' });
  } catch (error) {
    handleControllerError(res, error, 'Could not delete the book.');
  }
};

// ---------------------------------------------------------------------------
// Background upload processing
// ---------------------------------------------------------------------------
const scheduleJob = (jobId) => {
  queuedJobs.push(jobId);
  drainJobQueue();
};

const drainJobQueue = () => {
  while (activeJobs.size < JOB_CONCURRENCY && queuedJobs.length > 0) {
    const jobId = queuedJobs.shift();
    activeJobs.add(jobId);
    processUploadJob(jobId)
      .catch((error) => console.error('[Upload Job] Unhandled failure:', error))
      .finally(() => {
        activeJobs.delete(jobId);
        drainJobQueue();
      });
  }
};

const updateJob = async (jobId, updates) => {
  try {
    return await Storage.update('bookJobs', jobId, updates);
  } catch (error) {
    console.error('[Upload Job] Could not update job status:', error.message);
    return null;
  }
};

const processUploadJob = async (jobId) => {
  const job = await Storage.findById('bookJobs', jobId);
  if (!job || job.status !== 'queued') return;

  const filePath = job.file?.path;
  let storedFile = null;
  let keepTempFile = false;

  try {
    if (!filePath || !fs.existsSync(filePath)) {
      throw makeError(400, 'FILE_MISSING', 'The uploaded file is no longer available. Please upload it again.');
    }

    await updateJob(jobId, {
      status: 'processing',
      progress: 20,
      stage: 'Extracting text',
      message: 'Reading the document and extracting page text.',
    });

    const parsed = await extractDocument(filePath, job.file.mimetype, job.file.originalname);

    await updateJob(jobId, {
      status: 'processing',
      progress: 55,
      stage: 'Detecting chapters',
      message: 'Analysing headings, contents pages, and page ranges.',
    });

    const detection = detectChaptersFromDocument(parsed);
    if (!detection.chapters.length) {
      throw makeError(
        422,
        'NO_CHAPTERS',
        'No usable chapters could be detected in this document. Try a PDF with selectable text or add chapters manually.'
      );
    }

    await updateJob(jobId, {
      status: 'processing',
      progress: 78,
      stage: 'Saving book',
      message: `Saving ${detection.chapters.length} chapters and the source document.`,
    });

    storedFile = await saveUploadedFile(filePath, {
      filename: job.file.originalname,
      originalFilename: job.file.originalname,
      contentType: job.file.mimetype,
      uploadedBy: job.userId,
      bookId: job.targetBookId,
    });

    const contentFields = {
      chapters: detection.chapters,
      pageCount: parsed.pageCount,
      extractedCharCount: parsed.text.length,
      contentStatus: 'extracted',
      chapterDetection: detection.detectionMode,
      parserWarnings: detection.warnings,
      frontMatterText: detection.frontMatterText,
      originalFilename: job.file.originalname,
      fileStorage: storedFile.storage,
      fileId: storedFile.fileId || null,
      filePath: storedFile.storage === 'local' ? storedFile.filePath : null,
      fileMimeType: job.file.mimetype,
      fileSize: storedFile.fileSize || job.file.size,
      fileHash: job.fileHash,
      parsedAt: new Date().toISOString(),
    };

    let book = null;

    if (job.targetBookId) {
      const targetBook = await Storage.findById('books', job.targetBookId);
      if (!targetBook) {
        throw makeError(404, 'BOOK_NOT_FOUND', 'The book this file was attached to no longer exists.');
      }

      book = await Storage.update('books', job.targetBookId, contentFields);
      if (!book) throw makeError(404, 'BOOK_NOT_FOUND', 'The book this file was attached to no longer exists.');

      if (targetBook.fileStorage === 'gridfs' || targetBook.filePath) {
        await deleteStoredFile(targetBook);
      }
    } else {
      book = await Storage.create('books', {
        ...job.metadata,
        author: job.metadata.author || 'Extracted from Document',
        publisher: job.metadata.publisher || '',
        boardName: job.metadata.boardName || 'Uploaded Textbook / Syllabus',
        description:
          job.metadata.description ||
          `Uploaded document parsed into ${detection.chapters.length} chapters from ${parsed.pageCount} pages.`,
        sourceType: 'uploaded_document',
        ...contentFields,
        dedupeKey: hashValue('upload', job.userId, job.fileHash),
        createdBy: job.userId,
      });
    }

    // Only remove the temporary file after it has been safely stored in GridFS.
    keepTempFile = storedFile.storage === 'local';
    if (!keepTempFile) await removeTempFile(filePath);

    await updateJob(jobId, {
      status: 'completed',
      progress: 100,
      stage: 'Completed',
      message: job.targetBookId
        ? `Attached the document and extracted ${detection.chapters.length} chapters.`
        : `Successfully extracted ${detection.chapters.length} chapters from ${parsed.pageCount} pages.`,
      resultBookId: book.id,
      chapterCount: detection.chapters.length,
      warnings: detection.warnings,
    });
  } catch (error) {
    console.error('[Upload Job] Failed:', error.message);
    if (storedFile && storedFile.storage === 'gridfs') {
      await deleteStoredFile({ fileStorage: 'gridfs', fileId: storedFile.fileId });
    }
    if (!keepTempFile) await removeTempFile(filePath);
    await updateJob(jobId, {
      status: 'failed',
      progress: 100,
      stage: 'Failed',
      message: error.message || 'The document could not be processed.',
      errorCode: error.code || 'UPLOAD_FAILED',
      errorMessage: error.message || 'The document could not be processed.',
    });
  }
};

const removeTempFile = async (filePath) => {
  if (!filePath) return;
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('[Upload] Could not remove temporary file:', error.message);
  }
};

const hashFile = (filePath) =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });

const handleControllerError = (res, error, fallbackMessage) => {
  const message = String(error?.message || '');
  const databaseError = /buffering timed out|Mongo(?:DB|ose)?|topology|connection .*closed|ECONN|socket hang up/i.test(
    message
  );

  if (res.headersSent) {
    if (!res.writableEnded) res.end();
    return;
  }

  if (databaseError) {
    return res.status(503).json({
      success: false,
      code: 'DATABASE_UNAVAILABLE',
      message: 'The database is temporarily unavailable. Please try again in a moment.',
    });
  }

  if (error?.status && error.status < 500) {
    return res.status(error.status).json({
      success: false,
      code: error.code || 'REQUEST_ERROR',
      message: error.message,
    });
  }

  console.error('[Book API]', error);
  return res.status(500).json({
    success: false,
    code: error?.code || 'BOOK_API_ERROR',
    message: fallbackMessage || 'The request could not be completed.',
  });
};

module.exports = {
  getBooks,
  getBookById,
  createManualBook,
  uploadBookFile,
  getUploadJob,
  getBookFile,
  searchGoogleBooksApi,
  importGoogleBook,
  updateBookChapters,
  updateBook,
  deleteBook,
};
