const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/bookController');
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/', authenticate, getBooks);
router.get('/google-search', authenticate, searchGoogleBooksApi);
router.get('/jobs/:jobId', authenticate, getUploadJob);

router.post('/manual', authenticate, createManualBook);
router.post('/upload', authenticate, upload.single('document'), uploadBookFile);
router.post('/google-import', authenticate, importGoogleBook);

router.get('/:id/file', authenticate, getBookFile);
router.post('/:id/upload', authenticate, upload.single('document'), uploadBookFile);
router.put('/:id/chapters', authenticate, updateBookChapters);
router.get('/:id', authenticate, getBookById);
router.put('/:id', authenticate, updateBook);
router.delete('/:id', authenticate, deleteBook);

module.exports = router;
