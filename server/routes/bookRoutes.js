const express = require('express');
const router = express.Router();
const {
  getBooks,
  getBookById,
  createManualBook,
  uploadBookFile,
  searchGoogleBooksApi,
  importGoogleBook,
  updateBookChapters,
  updateBook,
  deleteBook,
} = require('../controllers/bookController');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', authenticate, getBooks);
router.get('/google-search', authenticate, searchGoogleBooksApi);
router.get('/:id', authenticate, getBookById);
router.put('/:id', authenticate, updateBook);
router.post('/manual', authenticate, createManualBook);
router.post('/upload', authenticate, upload.single('document'), uploadBookFile);
router.post('/google-import', authenticate, importGoogleBook);
router.put('/:id/chapters', authenticate, updateBookChapters);
router.delete('/:id', authenticate, deleteBook);

module.exports = router;
