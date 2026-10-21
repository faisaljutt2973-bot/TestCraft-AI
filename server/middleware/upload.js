const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOADS_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.txt', '.md', '.markdown']);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'application/octet-stream',
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${file.fieldname}-${Date.now()}-${crypto.randomUUID()}${extension}`);
  },
});

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname || '').toLowerCase();
  const mimeType = String(file.mimetype || '').toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return cb(
      Object.assign(
        new Error('Unsupported file type. Upload a PDF, DOCX, TXT, or Markdown file.'),
        { code: 'UNSUPPORTED_FILE_TYPE', status: 415 }
      )
    );
  }

  if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) {
    return cb(
      Object.assign(
        new Error('The uploaded file has an unexpected content type. Please upload the original PDF, DOCX, TXT, or Markdown file.'),
        { code: 'UNSUPPORTED_MIME_TYPE', status: 415 }
      )
    );
  }

  return cb(null, true);
};

const maxMb = Math.min(Math.max(parseInt(process.env.UPLOAD_MAX_SIZE_MB, 10) || 50, 1), 200);

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxMb * 1024 * 1024,
    files: 1,
    fields: 20,
    fieldSize: 100 * 1024,
  },
});

upload.ALLOWED_EXTENSIONS = ALLOWED_EXTENSIONS;
upload.MAX_FILE_BYTES = maxMb * 1024 * 1024;

module.exports = upload;
