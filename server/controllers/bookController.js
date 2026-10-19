const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();
const Storage = require('../config/storage');
const { extractTextFromFile, detectChaptersFromText } = require('../services/parserService');
const { searchGoogleBooks } = require('../services/googleBooksService');

// Never expose server filesystem paths to clients.
const sanitizeBook = (book) => {
  if (!book) return book;
  const { filePath, ...safe } = book;
  return safe;
};

const getBooks = async (req, res) => {
  try {
    const { className, subject, search } = req.query;
    let books = await Storage.find('books');

    // All distributed/public books are available to all educators
    books = books.filter((b) => b.isPublic !== false || b.createdBy === req.user.id || req.user.role === 'admin');

    if (className) {
      books = books.filter((b) => b.className === className);
    }
    if (subject) {
      books = books.filter((b) => b.subject.toLowerCase() === subject.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      books = books.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          (b.author && b.author.toLowerCase().includes(q)) ||
          (b.boardName && b.boardName.toLowerCase().includes(q))
      );
    }

    res.json({ success: true, count: books.length, books: books.map(sanitizeBook) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getBookById = async (req, res) => {
  try {
    const book = await Storage.findById('books', req.params.id);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found.' });
    }
    if (book.isPublic === false && book.createdBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(404).json({ success: false, message: 'Book not found.' });
    }
    res.json({ success: true, book: sanitizeBook(book) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createManualBook = async (req, res) => {
  try {
    const { title, author, publisher, boardId, boardName, className, subject, edition, language, description, chapters } = req.body;

    if (!title || !className || !subject) {
      return res.status(400).json({ success: false, message: 'Title, Class, and Subject are required fields.' });
    }

    const formattedChapters = (chapters || []).map((ch, idx) => ({
      id: ch.id || uuidv4(),
      chapterNumber: ch.chapterNumber || idx + 1,
      title: ch.title || `Chapter ${idx + 1}`,
      pages: ch.pages || 'N/A',
      topics: Array.isArray(ch.topics) ? ch.topics : (ch.topics || '').split('\n').map((t) => t.trim()).filter(Boolean),
      summary: ch.summary || `Curriculum topics and core competencies for Chapter ${idx + 1}.`,
      isExcluded: !!ch.isExcluded,
    }));

    const newBook = await Storage.create('books', {
      title: title.trim(),
      author: author ? author.trim() : 'Curriculum Committee',
      publisher: publisher ? publisher.trim() : 'Educational Board',
      boardId: boardId || 'custom-board',
      boardName: boardName || 'Custom / Independent Board',
      className: className.trim(),
      subject: subject.trim(),
      edition: edition || 'Latest Edition',
      language: language || 'English',
      description: description || 'Textbook registered by teacher.',
      sourceType: 'manual_curriculum',
      createdBy: req.user.id,
      isPublic: req.body.isPublic !== undefined ? Boolean(req.body.isPublic) : true,
      pageCount: formattedChapters.length * 15,
      chapters: formattedChapters,
    });

    res.status(201).json({ success: true, message: 'Book created successfully.', book: sanitizeBook(newBook) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const uploadBookFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No document file uploaded. Please provide a PDF or TXT file.' });
    }

    const { title, author, className, subject, boardName } = req.body;
    const filePath = req.file.path;
    const mimeType = req.file.mimetype;

    console.log(`[Parser] Processing uploaded file: ${req.file.originalname} (${req.file.size} bytes)`);

    // Extract text from file
    const parsedData = await extractTextFromFile(filePath, mimeType);
    console.log(`[Parser] Extracted ${parsedData.text.length} characters from ${parsedData.pageCount} pages.`);

    // Automatically detect chapters and topics
    const detectedChapters = detectChaptersFromText(parsedData.text);
    console.log(`[Parser] Detected ${detectedChapters.length} chapters.`);

    const fallbackTitle = path.basename(req.file.originalname, path.extname(req.file.originalname)).replace(/[-_]/g, ' ');

    const newBook = await Storage.create('books', {
      title: (title || fallbackTitle).trim(),
      author: (author || 'Extracted from Document').trim(),
      boardName: boardName || 'Uploaded Textbook / Syllabus',
      className: className || 'Class 9',
      subject: subject || 'General Science',
      sourceType: 'uploaded_document',
      originalFilename: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      pageCount: parsedData.pageCount,
      extractedCharCount: parsedData.text.length,
      chapters: detectedChapters,
      createdBy: req.user.id,
      isPublic: req.body.isPublic !== undefined ? Boolean(req.body.isPublic) : true,
      description: `Uploaded document parsed with ${detectedChapters.length} chapters and ${parsedData.pageCount} pages.`,
    });

    res.status(201).json({
      success: true,
      message: `Successfully parsed "${req.file.originalname}" into ${detectedChapters.length} syllabus chapters.`,
      book: sanitizeBook(newBook),
    });
  } catch (err) {
    console.error('[Parser] Upload error:', err);
    res.status(500).json({ success: false, message: `Failed to parse file: ${err.message}` });
  }
};

const searchGoogleBooksApi = async (req, res) => {
  try {
    const { q, maxResults } = req.query;
    if (!q) {
      return res.status(400).json({ success: false, message: 'Search query parameter "q" is required.' });
    }

    const books = await searchGoogleBooks(q, maxResults ? parseInt(maxResults, 10) : 10);
    res.json({ success: true, count: books.length, books });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const importGoogleBook = async (req, res) => {
  try {
    const { googleBook, className, subject, boardName } = req.body;
    if (!googleBook || !googleBook.title) {
      return res.status(400).json({ success: false, message: 'Invalid Google Book metadata provided.' });
    }

    // Since Google Books API does not expose full textbook content by default due to copyright,
    // we generate a structured curriculum framework of syllabus units based on description & page count,
    // and prompt the teacher to supply full text or custom notes if detailed page-level extraction is needed.
    const estChapters = Math.max(4, Math.min(12, Math.round((googleBook.pageCount || 150) / 25)));
    const initialChapters = [];
    for (let i = 1; i <= estChapters; i++) {
      initialChapters.push({
        id: uuidv4(),
        chapterNumber: i,
        title: `Unit ${i}: Curriculum Competencies & Key Concepts`,
        pages: `pp. ${(i - 1) * 20 + 1}-${i * 20}`,
        topics: ['Core Definitions & Foundational Theories', 'Analytical Mechanisms', 'Review Questions & Applications'],
        summary: `Standard curriculum coverage for Unit ${i}.`,
      });
    }

    const newBook = await Storage.create('books', {
      title: googleBook.title,
      author: (googleBook.authors || []).join(', ') || 'Various Authors',
      publisher: googleBook.publisher || 'Commercial Education Publisher',
      thumbnail: googleBook.thumbnail,
      googleBooksId: googleBook.googleBooksId,
      previewLink: googleBook.previewLink,
      isbn: googleBook.isbn,
      boardName: boardName || 'Standard Board',
      className: className || 'Class 9',
      subject: subject || (googleBook.categories?.[0] || 'General Education'),
      sourceType: 'google_books_metadata',
      pageCount: googleBook.pageCount || 160,
      description: googleBook.description,
      chapters: initialChapters,
      createdBy: req.user.id,
      isPublic: req.body.isPublic !== undefined ? Boolean(req.body.isPublic) : true,
    });

    res.status(201).json({
      success: true,
      message: `Book "${newBook.title}" imported from Google Books. Chapters can now be customized or mapped.`,
      book: sanitizeBook(newBook),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateBookChapters = async (req, res) => {
  try {
    const book = await Storage.findById('books', req.params.id);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found.' });
    }

    if (book.createdBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You do not have permission to modify this book.' });
    }

    const { chapters } = req.body;
    if (!Array.isArray(chapters)) {
      return res.status(400).json({ success: false, message: 'Chapters must be an array.' });
    }

    const updated = await Storage.update('books', req.params.id, { chapters });
    res.json({ success: true, message: 'Chapters updated successfully.', book: sanitizeBook(updated) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteBook = async (req, res) => {
  try {
    const book = await Storage.findById('books', req.params.id);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found.' });
    }

    if (book.createdBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You do not have permission to delete this book.' });
    }

    if (book.filePath && fs.existsSync(book.filePath)) {
      try {
        fs.unlinkSync(book.filePath);
      } catch (e) {
        console.warn('Could not remove file on disk:', e.message);
      }
    }

    await Storage.delete('books', req.params.id);
    res.json({ success: true, message: 'Book removed from library.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateBook = async (req, res) => {
  try {
    const book = await Storage.findById('books', req.params.id);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found.' });
    }

    if (book.createdBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You do not have permission to update this book.' });
    }

    const updated = await Storage.update('books', req.params.id, req.body);
    res.json({ success: true, message: 'Book updated successfully.', book: sanitizeBook(updated) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getBooks,
  getBookById,
  createManualBook,
  uploadBookFile,
  searchGoogleBooksApi,
  importGoogleBook,
  updateBookChapters,
  updateBook,
  deleteBook,
};
