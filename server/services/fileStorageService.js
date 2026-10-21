const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { pipeline } = require('stream/promises');
const Storage = require('../config/storage');

const BUCKET_NAME = 'bookFiles';

const isMongoReady = () => Storage.isMongo() && mongoose.connection?.db;

const getBucket = () => {
  if (!isMongoReady()) return null;
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET_NAME });
};

const saveUploadedFile = async (filePath, metadata = {}) => {
  if (!fs.existsSync(filePath)) {
    const error = new Error('The uploaded file is no longer available on the server.');
    error.code = 'FILE_MISSING';
    error.status = 400;
    throw error;
  }

  const bucket = getBucket();
  if (!bucket) {
    return {
      storage: 'local',
      filePath,
      fileSize: fs.statSync(filePath).size,
    };
  }

  const filename = metadata.filename || path.basename(filePath);
  const uploadStream = bucket.openUploadStream(filename, {
    contentType: metadata.contentType || 'application/octet-stream',
    metadata: {
      originalFilename: metadata.originalFilename || filename,
      uploadedBy: metadata.uploadedBy || null,
      bookId: metadata.bookId || null,
    },
  });

  await pipeline(fs.createReadStream(filePath), uploadStream);

  return {
    storage: 'gridfs',
    fileId: String(uploadStream.id),
    fileSize: uploadStream.length || fs.statSync(filePath).size,
  };
};

const deleteStoredFile = async (book) => {
  if (!book) return;

  if (book.fileStorage === 'gridfs' && book.fileId) {
    const bucket = getBucket();
    if (bucket) {
      try {
        await bucket.delete(new mongoose.Types.ObjectId(book.fileId));
      } catch (error) {
        if (error.code !== 'ENOENT' && !/FileNotFound/i.test(error.message)) {
          console.warn('[FileStorage] Could not delete GridFS file:', error.message);
        }
      }
    }
    return;
  }

  if (book.filePath && fs.existsSync(book.filePath)) {
    try {
      await fs.promises.unlink(book.filePath);
    } catch (error) {
      console.warn('[FileStorage] Could not delete local file:', error.message);
    }
  }
};

const openDownloadStream = async (fileId) => {
  const bucket = getBucket();
  if (!bucket) {
    const error = new Error('Persistent file storage is not available.');
    error.code = 'FILE_STORAGE_UNAVAILABLE';
    error.status = 503;
    throw error;
  }

  let objectId;
  try {
    objectId = new mongoose.Types.ObjectId(fileId);
  } catch {
    const error = new Error('The stored file reference is invalid.');
    error.code = 'FILE_INVALID';
    error.status = 422;
    throw error;
  }

  const [file] = await bucket.find({ _id: objectId }).limit(1).toArray();
  if (!file) {
    const error = new Error('The stored file could not be found.');
    error.code = 'FILE_NOT_FOUND';
    error.status = 404;
    throw error;
  }

  return {
    file,
    stream: bucket.openDownloadStream(objectId),
  };
};

module.exports = {
  saveUploadedFile,
  deleteStoredFile,
  openDownloadStream,
  isPersistentStorage: () => Boolean(getBucket()),
};
