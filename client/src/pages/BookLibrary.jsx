import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  UploadCloud,
  Globe,
  FileText,
  CheckCircle,
  Trash2,
  Layers,
  ChevronRight,
  Sparkles,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  X,
} from 'lucide-react';
import { api } from '../services/api';
import { Modal } from '../components/Modal';

const MAX_UPLOAD_MB = 50;
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md', '.markdown'];

const SOURCE_META = {
  uploaded_document: {
    label: 'PDF / Document',
    className: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  google_books_metadata: {
    label: 'Google Books',
    className: 'bg-violet-50 text-violet-700 border-violet-200',
  },
  manual_curriculum: {
    label: 'Manual',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
};

const sourceMeta = (book) =>
  SOURCE_META[book?.sourceType] || {
    label: 'Textbook',
    className: 'bg-slate-50 text-slate-600 border-slate-200',
  };

const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const validateFile = (file) => {
  if (!file) return 'Choose a PDF, DOCX, TXT, or Markdown file first.';
  const extension = `.${String(file.name || '').split('.').pop().toLowerCase()}`;
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return 'Unsupported file type. Choose a PDF, DOCX, TXT, or Markdown file.';
  }
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    return `The file is too large. The maximum size is ${MAX_UPLOAD_MB} MB.`;
  }
  if (file.size === 0) return 'The selected file is empty.';
  return '';
};

const emptyManualChapter = () => ({
  title: '',
  pages: '',
  topicsText: '',
});

export const BookLibrary = ({ onSelectBook, isAddModalOpen, setIsAddModalOpen }) => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [booksError, setBooksError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [modalTab, setModalTab] = useState('upload');

  const [googleQuery, setGoogleQuery] = useState('');
  const [googleResults, setGoogleResults] = useState([]);
  const [searchingGoogle, setSearchingGoogle] = useState(false);
  const [googleSearched, setGoogleSearched] = useState(false);
  const [googleError, setGoogleError] = useState('');
  const [importingId, setImportingId] = useState(null);

  const [uploadFile, setUploadFile] = useState(null);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    author: '',
    className: 'Class 9',
    subject: 'Biology',
    boardName: 'Punjab Curriculum and Textbook Board (PCTB)',
  });
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);

  const [manualForm, setManualForm] = useState({
    title: '',
    author: '',
    className: 'Class 9',
    subject: 'Biology',
    boardName: 'Punjab Curriculum and Textbook Board (PCTB)',
    edition: '2025-2026 Academic Edition',
  });
  const [manualChapters, setManualChapters] = useState([emptyManualChapter()]);
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const [formError, setFormError] = useState('');
  const pollTimer = useRef(null);

  const fetchBooks = async () => {
    try {
      setLoading(true);
      setBooksError('');
      const res = await api.getBooks({
        search: searchQuery,
        className: filterClass,
        subject: filterSubject,
      });
      if (res.success) setBooks(res.books || []);
    } catch (err) {
      setBooksError(err.message || 'Could not load the book library.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, [searchQuery, filterClass, filterSubject]);

  useEffect(
    () => () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    },
    []
  );

  const resetFormMessages = () => {
    setFormError('');
    setSuccessMessage('');
  };

  const closeModal = () => {
    if (uploading) return;
    setIsAddModalOpen(false);
    resetFormMessages();
  };

  const pollUploadJob = (jobId) => {
    const startedAt = Date.now();

    const tick = async () => {
      try {
        const res = await api.getBookUploadJob(jobId);
        const job = res.job;
        if (!job) throw new Error('The upload status could not be found.');

        setUploadProgress({
          status: job.status,
          progress: Number(job.progress) || 0,
          stage: job.stage || 'Processing',
          message: job.message || '',
        });

        if (job.status === 'completed') {
          setUploading(false);
          setSuccessMessage(job.message || 'Book added to your library.');
          setIsAddModalOpen(false);
          await fetchBooks();
          if (job.book?.id) onSelectBook(job.book.id);
          return;
        }

        if (job.status === 'failed') {
          setUploading(false);
          setFormError(job.errorMessage || job.message || 'The document could not be processed.');
          return;
        }

        if (Date.now() - startedAt > 5 * 60 * 1000) {
          setUploading(false);
          setFormError('Processing is taking longer than expected. Check the book library, then try again if the book was not created.');
          return;
        }

        pollTimer.current = setTimeout(tick, 1000);
      } catch (err) {
        setUploading(false);
        setFormError(err.message || 'Could not check the upload status.');
      }
    };

    tick();
  };

  const handleSearchGoogle = async (e) => {
    e.preventDefault();
    if (!googleQuery.trim() || searchingGoogle) return;
    try {
      setSearchingGoogle(true);
      setGoogleError('');
      setGoogleSearched(true);
      const res = await api.searchGoogleBooks(googleQuery);
      setGoogleResults(res.books || []);
    } catch (err) {
      setGoogleResults([]);
      setGoogleError(err.message || 'Google Books search failed.');
    } finally {
      setSearchingGoogle(false);
    }
  };

  const handleImportGoogleBook = async (gBook) => {
    if (importingId) return;
    try {
      setImportingId(gBook.googleBooksId);
      setGoogleError('');
      const res = await api.importGoogleBook({
        googleBook: gBook,
        className: uploadForm.className,
        subject: uploadForm.subject,
        boardName: uploadForm.boardName,
      });

      if (res.success && res.book) {
        setSuccessMessage(res.message || 'Google Books record imported.');
        setIsAddModalOpen(false);
        await fetchBooks();
        onSelectBook(res.book.id);
      }
    } catch (err) {
      setGoogleError(err.message || 'Import failed.');
    } finally {
      setImportingId(null);
    }
  };

  const handleFileSelection = (file) => {
    setFormError('');
    const validationError = file ? validateFile(file) : '';
    if (validationError) {
      setFormError(validationError);
      setUploadFile(null);
      return;
    }
    setUploadFile(file || null);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (uploading) return;

    setFormError('');
    const validationError = validateFile(uploadFile);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    try {
      setUploading(true);
      setUploadProgress({ status: 'queued', progress: 0, stage: 'Uploading', message: 'Sending the document to the server.' });

      const formData = new FormData();
      formData.append('document', uploadFile);
      formData.append('title', uploadForm.title);
      formData.append('author', uploadForm.author);
      formData.append('className', uploadForm.className);
      formData.append('subject', uploadForm.subject);
      formData.append('boardName', uploadForm.boardName);

      const res = await api.uploadBookFile(formData);

      if (res.duplicate && res.book?.id) {
        setUploading(false);
        setSuccessMessage(res.message || 'This file is already in your library.');
        setIsAddModalOpen(false);
        await fetchBooks();
        onSelectBook(res.book.id);
        return;
      }

      if (!res.jobId) {
        setUploading(false);
        setFormError(res.message || 'The server did not start an upload job.');
        return;
      }

      pollUploadJob(res.jobId);
    } catch (err) {
      setUploading(false);
      setFormError(err.message || 'Upload failed.');
    }
  };

  const updateManualChapter = (index, field, value) => {
    setManualChapters((chapters) =>
      chapters.map((chapter, chapterIndex) =>
        chapterIndex === index ? { ...chapter, [field]: value } : chapter
      )
    );
  };

  const addManualChapter = () => {
    setManualChapters((chapters) => [...chapters, emptyManualChapter()]);
  };

  const removeManualChapter = (index) => {
    setManualChapters((chapters) => {
      const next = chapters.filter((_, chapterIndex) => chapterIndex !== index);
      return next.length > 0 ? next : [emptyManualChapter()];
    });
  };

  const moveManualChapter = (index, direction) => {
    setManualChapters((chapters) => {
      const target = index + direction;
      if (target < 0 || target >= chapters.length) return chapters;
      const next = [...chapters];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (manualSubmitting) return;

    setFormError('');
    if (!manualForm.title.trim() || !manualForm.className.trim() || !manualForm.subject.trim()) {
      setFormError('Title, class, and subject are required.');
      return;
    }

    const chaptersList = manualChapters
      .filter((chapter) => chapter.title.trim())
      .map((chapter, index) => ({
        chapterNumber: index + 1,
        title: chapter.title.trim(),
        pages: chapter.pages.trim() || 'N/A',
        topics: chapter.topicsText
          .split('\n')
          .map((topic) => topic.trim())
          .filter(Boolean),
      }));

    try {
      setManualSubmitting(true);
      const res = await api.createManualBook({
        title: manualForm.title,
        author: manualForm.author,
        className: manualForm.className,
        subject: manualForm.subject,
        boardName: manualForm.boardName,
        edition: manualForm.edition,
        chapters: chaptersList,
      });

      if (res.success && res.book) {
        setSuccessMessage(res.message || 'Book created successfully.');
        setIsAddModalOpen(false);
        await fetchBooks();
        onSelectBook(res.book.id);
      }
    } catch (err) {
      setFormError(err.message || 'Creation failed.');
    } finally {
      setManualSubmitting(false);
    }
  };

  const handleDeleteBook = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to remove this book from your library?')) return;
    try {
      const res = await api.deleteBook(id);
      if (res.success) {
        setSuccessMessage('Book removed from your library.');
        fetchBooks();
      }
    } catch (err) {
      setBooksError(err.message || 'Delete failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-1 items-center gap-3 max-w-md bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search textbooks by title, author, or board..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 text-slate-700 px-3 py-2 rounded-xl focus:outline-none"
          >
            <option value="">All Classes</option>
            <option value="Class 9">Class 9</option>
            <option value="Class 10">Class 10</option>
            <option value="Cambridge O-Level">Cambridge O-Level</option>
          </select>

          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 text-slate-700 px-3 py-2 rounded-xl focus:outline-none"
          >
            <option value="">All Subjects</option>
            <option value="Biology">Biology</option>
            <option value="Physics">Physics</option>
            <option value="Mathematics">Mathematics</option>
            <option value="Chemistry">Chemistry</option>
          </select>

          <button
            onClick={() => {
              resetFormMessages();
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Textbook</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start justify-between gap-3 text-xs text-emerald-800">
          <span className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            {successMessage}
          </span>
          <button onClick={() => setSuccessMessage('')} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {booksError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs text-rose-800">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {booksError}
          </span>
          <button onClick={fetchBooks} className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">Loading library...</div>
      ) : books.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No textbooks found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Add your course textbooks by searching Google Books, uploading course PDFs, or selecting board curricula.
          </p>
          <button
            onClick={() => {
              resetFormMessages();
              setIsAddModalOpen(true);
            }}
            className="mt-4 px-4 py-2 text-xs font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700"
          >
            Add Your First Textbook
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {books.map((book) => {
            const meta = sourceMeta(book);
            const chapterCount = (book.chapters || []).length;
            const metadataOnly = book.contentStatus === 'metadata_only' || chapterCount === 0;
            const outlineOnly = book.contentStatus === 'outline_only';

            return (
              <div
                key={book.id}
                onClick={() => onSelectBook(book.id)}
                className="group cursor-pointer bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-brand-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-500 mb-2">
                    <span className={`px-2 py-0.5 rounded-full border font-bold ${meta.className}`}>{meta.label}</span>
                    <span className="truncate max-w-[150px]">{book.boardName}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-bold text-[11px]">
                      {book.className}
                    </span>
                    <span className="text-[11px] font-medium text-slate-500">{book.subject}</span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 group-hover:text-brand-600 transition-colors line-clamp-2">
                    {book.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">Author: {book.author || 'Curriculum Board'}</p>

                  <p className="text-xs text-slate-600 mt-3 line-clamp-2 leading-relaxed">
                    {book.description || 'Textbook registered in your library.'}
                  </p>

                  {metadataOnly && (
                    <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
                      <AlertTriangle className="w-3 h-3" />
                      Metadata only — upload a PDF to unlock chapters
                    </p>
                  )}
                  {!metadataOnly && outlineOnly && (
                    <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-1 rounded-lg">
                      <FileText className="w-3 h-3" />
                      Chapter outline only — no extracted text yet
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1 font-medium">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      {chapterCount} {chapterCount === 1 ? 'Chapter' : 'Chapters'}
                    </span>
                    {book.pageCount > 0 && <span>• {book.pageCount} pgs</span>}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleDeleteBook(book.id, e)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete book"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-bold text-brand-600 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      <span>Manage</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={isAddModalOpen}
        onClose={closeModal}
        title="Add Textbook to Library"
        subtitle="Upload a document, search Google Books, or create a book manually"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-5">
          <div className="flex overflow-x-auto border-b border-slate-200">
            {[
              { id: 'upload', label: 'Upload Book', icon: UploadCloud },
              { id: 'search', label: 'Google Books', icon: Globe },
              { id: 'manual', label: 'Manual Entry', icon: FileText },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setModalTab(tab.id);
                    resetFormMessages();
                  }}
                  className={`flex items-center gap-2 py-2.5 px-4 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
                    modalTab === tab.id
                      ? 'border-brand-600 text-brand-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {modalTab === 'upload' && (
            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!uploading) setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  if (!uploading) handleFileSelection(e.dataTransfer.files?.[0]);
                }}
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors ${
                  dragging ? 'border-brand-500 bg-brand-50/60' : 'border-slate-300 bg-slate-50/50'
                }`}
              >
                <UploadCloud className="w-10 h-10 text-brand-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-800">
                  {uploadFile ? uploadFile.name : 'Drag and drop a textbook file here, or choose a file'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Supported: PDF, DOCX, TXT, MD. Maximum {MAX_UPLOAD_MB} MB. PDFs with selectable text produce the most
                  reliable chapter detection.
                </p>
                {uploadFile && (
                  <p className="text-[11px] text-slate-600 mt-1">
                    {formatBytes(uploadFile.size)} selected
                    {!uploading && (
                      <button
                        type="button"
                        onClick={() => setUploadFile(null)}
                        className="ml-2 font-bold text-rose-600 hover:text-rose-700"
                      >
                        Remove
                      </button>
                    )}
                  </p>
                )}
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.markdown"
                  disabled={uploading}
                  onChange={(e) => handleFileSelection(e.target.files?.[0])}
                  className="mt-3 text-xs text-slate-600 mx-auto block max-w-full"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Book Title (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Class 9 Biology Textbook"
                    value={uploadForm.title}
                    onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                    disabled={uploading}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Author / Publisher</label>
                  <input
                    type="text"
                    placeholder="e.g. Punjab Curriculum & Textbook Board"
                    value={uploadForm.author}
                    onChange={(e) => setUploadForm({ ...uploadForm, author: e.target.value })}
                    disabled={uploading}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Class / Grade *</label>
                  <select
                    value={uploadForm.className}
                    onChange={(e) => setUploadForm({ ...uploadForm, className: e.target.value })}
                    disabled={uploading}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none disabled:bg-slate-50"
                  >
                    <option value="Class 9">Class 9</option>
                    <option value="Class 10">Class 10</option>
                    <option value="Class 11">Class 11</option>
                    <option value="Class 12">Class 12</option>
                    <option value="Cambridge O-Level">Cambridge O-Level</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Subject *</label>
                  <input
                    type="text"
                    placeholder="e.g. Biology, Physics, Mathematics"
                    value={uploadForm.subject}
                    onChange={(e) => setUploadForm({ ...uploadForm, subject: e.target.value })}
                    disabled={uploading}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none disabled:bg-slate-50"
                  />
                </div>
              </div>

              {uploadProgress && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="font-bold text-slate-700">{uploadProgress.stage}</span>
                    <span className="text-slate-500">{uploadProgress.progress}%</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        uploadProgress.status === 'failed' ? 'bg-rose-500' : 'bg-brand-600'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(3, uploadProgress.progress))}%` }}
                    />
                  </div>
                  {uploadProgress.message && (
                    <p className="text-[11px] text-slate-500">{uploadProgress.message}</p>
                  )}
                </div>
              )}

              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={uploading}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-xl flex items-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                      <span>Processing…</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Upload & Detect Chapters</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {modalTab === 'search' && (
            <div className="space-y-4">
              <form onSubmit={handleSearchGoogle} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search by title, author, or ISBN (e.g. Campbell Biology)"
                  value={googleQuery}
                  onChange={(e) => setGoogleQuery(e.target.value)}
                  className="flex-1 min-w-0 text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={searchingGoogle || !googleQuery.trim()}
                  className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-xl flex items-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{searchingGoogle ? 'Searching…' : 'Search'}</span>
                </button>
              </form>

              <p className="text-[11px] text-slate-500">
                Google Books supplies metadata only. Imported books appear immediately; upload the PDF afterward to
                extract chapters for test generation.
              </p>

              {googleError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{googleError}</span>
                </div>
              )}

              <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
                {searchingGoogle && (
                  <div className="p-6 text-center text-xs text-slate-500">Searching Google Books…</div>
                )}

                {!searchingGoogle && googleSearched && googleResults.length === 0 && !googleError && (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No books matched that search. Try a different title, author, or ISBN.
                  </div>
                )}

                {googleResults.map((gb) => (
                  <div
                    key={gb.googleBooksId}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start justify-between gap-3 hover:border-brand-400 transition-colors"
                  >
                    <div className="flex gap-3 min-w-0">
                      {gb.thumbnail ? (
                        <img
                          src={gb.thumbnail}
                          alt={gb.title}
                          className="w-12 h-16 object-cover rounded shadow-sm border border-slate-200 flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-16 bg-slate-200 rounded flex items-center justify-center text-slate-400 flex-shrink-0">
                          <BookOpen className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-900">{gb.title}</h4>
                        <p className="text-[11px] text-slate-500">
                          {(gb.authors || []).join(', ') || 'Unknown author'}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">
                          {[gb.publisher, gb.publishedDate, gb.language?.toUpperCase()].filter(Boolean).join(' • ')}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                          {gb.description || 'No description supplied by the publisher.'}
                        </p>
                        <span className="inline-block mt-1 text-[10px] font-semibold text-slate-500 bg-white border px-1.5 py-0.5 rounded">
                          {gb.pageCount ? `${gb.pageCount} pages` : 'Page count unknown'}
                          {gb.isbn ? ` • ISBN ${gb.isbn}` : ''}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleImportGoogleBook(gb)}
                      disabled={!!importingId}
                      className="px-3 py-1.5 text-xs font-bold text-brand-600 hover:bg-brand-100/60 bg-white border border-brand-300 rounded-lg whitespace-nowrap flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {importingId === gb.googleBooksId ? (
                        <>
                          <Sparkles className="w-3.5 h-3.5 animate-spin" />
                          <span>Adding…</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Import</span>
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {modalTab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Book Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mathematics Class 9"
                    value={manualForm.title}
                    onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })}
                    disabled={manualSubmitting}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Author / Publisher</label>
                  <input
                    type="text"
                    placeholder="e.g. National Curriculum Authority"
                    value={manualForm.author}
                    onChange={(e) => setManualForm({ ...manualForm, author: e.target.value })}
                    disabled={manualSubmitting}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Class / Grade *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Class 9, Class 10"
                    value={manualForm.className}
                    onChange={(e) => setManualForm({ ...manualForm, className: e.target.value })}
                    disabled={manualSubmitting}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Subject *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Biology, Chemistry"
                    value={manualForm.subject}
                    onChange={(e) => setManualForm({ ...manualForm, subject: e.target.value })}
                    disabled={manualSubmitting}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none disabled:bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Chapters (optional — add, edit, remove, or reorder)
                  </label>
                  <button
                    type="button"
                    onClick={addManualChapter}
                    disabled={manualSubmitting}
                    className="text-[11px] font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1 disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Chapter
                  </button>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {manualChapters.map((chapter, index) => (
                    <div key={index} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-white border border-slate-200 text-[10px] font-bold text-slate-600 flex items-center justify-center flex-shrink-0">
                          {index + 1}
                        </span>
                        <input
                          type="text"
                          placeholder="Chapter title"
                          value={chapter.title}
                          onChange={(e) => updateManualChapter(index, 'title', e.target.value)}
                          disabled={manualSubmitting}
                          className="flex-1 min-w-0 text-xs p-2 border border-slate-300 rounded-lg focus:border-brand-500 focus:outline-none disabled:bg-white"
                        />
                        <input
                          type="text"
                          placeholder="Pages"
                          value={chapter.pages}
                          onChange={(e) => updateManualChapter(index, 'pages', e.target.value)}
                          disabled={manualSubmitting}
                          className="w-20 text-xs p-2 border border-slate-300 rounded-lg focus:border-brand-500 focus:outline-none disabled:bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => moveManualChapter(index, -1)}
                          disabled={index === 0 || manualSubmitting}
                          className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                          title="Move chapter up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveManualChapter(index, 1)}
                          disabled={index === manualChapters.length - 1 || manualSubmitting}
                          className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                          title="Move chapter down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeManualChapter(index)}
                          disabled={manualSubmitting}
                          className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30"
                          title="Remove chapter"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        placeholder="Topics (optional, one per line)"
                        value={chapter.topicsText}
                        onChange={(e) => updateManualChapter(index, 'topicsText', e.target.value)}
                        disabled={manualSubmitting}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:border-brand-500 focus:outline-none disabled:bg-white"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  You can save a book with no chapters and add them later, or upload the PDF for automatic extraction.
                </p>
              </div>

              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={manualSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={manualSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-xl flex items-center gap-2"
                >
                  {manualSubmitting ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving…</span>
                    </>
                  ) : (
                    <span>Save Book</span>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </Modal>
    </div>
  );
};
