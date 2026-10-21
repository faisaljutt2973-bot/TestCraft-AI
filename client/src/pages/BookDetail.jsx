import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CheckSquare,
  Square,
  Sparkles,
  Edit2,
  Save,
  Layers,
  AlertTriangle,
  Tag,
  UploadCloud,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  FileText,
  CheckCircle,
  X,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const MAX_UPLOAD_MB = 50;
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md', '.markdown'];

const SOURCE_LABELS = {
  uploaded_document: 'PDF / Document',
  google_books_metadata: 'Google Books',
  manual_curriculum: 'Manual',
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

export const BookDetail = ({ bookId, onBack, onStartExamWithBook }) => {
  const { user } = useAuth();
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedChapters, setSelectedChapters] = useState([]);
  const [editingChapterId, setEditingChapterId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editTopics, setEditTopics] = useState('');
  const [savingChapters, setSavingChapters] = useState(false);
  const [chapterError, setChapterError] = useState('');
  const [previewChapterId, setPreviewChapterId] = useState(null);

  const [showAddChapter, setShowAddChapter] = useState(false);
  const [newChapter, setNewChapter] = useState({ title: '', pages: '', topicsText: '' });

  const [attachUploading, setAttachUploading] = useState(false);
  const [attachProgress, setAttachProgress] = useState(null);
  const [attachError, setAttachError] = useState('');
  const [attachSuccess, setAttachSuccess] = useState('');
  const attachInputRef = useRef(null);
  const attachPollTimer = useRef(null);

  const canEdit = Boolean(
    book && user && (String(book.createdBy) === String(user.id) || user.role === 'admin')
  );
  const chapters = book?.chapters || [];
  const chaptersWithContent = chapters.filter((chapter) => (chapter.contentLength || 0) > 0);
  const selectedWithContent = chapters.filter(
    (chapter) => selectedChapters.includes(chapter.chapterNumber) && (chapter.contentLength || 0) > 0
  );

  const selectableChapterNumbers = (source) =>
    (source?.chapters || []).filter((chapter) => !chapter.isExcluded).map((chapter) => chapter.chapterNumber);

  const fetchBook = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const res = await api.getBookById(bookId);
      if (res.success && res.book) {
        setBook(res.book);
        setSelectedChapters(selectableChapterNumbers(res.book));
      } else {
        setLoadError('Book could not be loaded.');
      }
    } catch (err) {
      setLoadError(err.message || 'Book could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBook();
  }, [bookId]);

  useEffect(
    () => () => {
      if (attachPollTimer.current) clearTimeout(attachPollTimer.current);
    },
    []
  );

  const handleToggleChapter = (chapterNumber) => {
    setSelectedChapters((selected) =>
      selected.includes(chapterNumber)
        ? selected.filter((number) => number !== chapterNumber)
        : [...selected, chapterNumber]
    );
  };

  const handleSelectAll = () => {
    setSelectedChapters(selectableChapterNumbers(book));
  };

  const handleDeselectAll = () => {
    setSelectedChapters([]);
  };

  const persistChapters = async (nextChapters, successMessage = '') => {
    if (!book || savingChapters) return false;
    try {
      setSavingChapters(true);
      setChapterError('');
      const res = await api.updateBookChapters(book.id, nextChapters);
      if (res.success && res.book) {
        setBook(res.book);
        const available = new Set((res.book.chapters || []).map((chapter) => chapter.chapterNumber));
        setSelectedChapters((selected) => selected.filter((number) => available.has(number)));
        if (successMessage) setAttachSuccess(successMessage);
        return true;
      }
      return false;
    } catch (err) {
      setChapterError(err.message || 'Could not save chapter changes.');
      return false;
    } finally {
      setSavingChapters(false);
    }
  };

  const handleStartEdit = (chapter) => {
    setEditingChapterId(chapter.id);
    setEditTitle(chapter.title);
    setEditTopics((chapter.topics || []).join('\n'));
    setChapterError('');
  };

  const handleSaveEdit = async (chapterId) => {
    if (!editTitle.trim()) {
      setChapterError('Chapter title cannot be empty.');
      return;
    }
    const updatedChapters = chapters.map((chapter) =>
      chapter.id === chapterId
        ? {
            ...chapter,
            title: editTitle.trim(),
            topics: editTopics
              .split('\n')
              .map((topic) => topic.trim())
              .filter(Boolean),
          }
        : chapter
    );

    const saved = await persistChapters(updatedChapters, 'Chapter updated.');
    if (saved) setEditingChapterId(null);
  };

  const handleToggleExclude = async (chapterId) => {
    const chapter = chapters.find((item) => item.id === chapterId);
    const updatedChapters = chapters.map((item) =>
      item.id === chapterId ? { ...item, isExcluded: !item.isExcluded } : item
    );
    const saved = await persistChapters(updatedChapters);
    if (saved && chapter && !chapter.isExcluded) {
      setSelectedChapters((selected) =>
        selected.filter((number) => number !== chapter.chapterNumber)
      );
    }
  };

  const handleMoveChapter = async (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= chapters.length) return;
    const next = [...chapters];
    [next[index], next[target]] = [next[target], next[index]];
    await persistChapters(next, 'Chapter order updated.');
  };

  const handleRemoveChapter = async (chapter) => {
    if (!confirm(`Remove "${chapter.title}" from this book?`)) return;
    const next = chapters.filter((item) => item.id !== chapter.id);
    const saved = await persistChapters(next, 'Chapter removed.');
    if (saved) {
      setSelectedChapters((selected) => selected.filter((number) => number !== chapter.chapterNumber));
      if (editingChapterId === chapter.id) setEditingChapterId(null);
    }
  };

  const handleAddChapter = async (e) => {
    e.preventDefault();
    if (!newChapter.title.trim()) {
      setChapterError('Enter a title for the new chapter.');
      return;
    }
    const next = [
      ...chapters,
      {
        title: newChapter.title.trim(),
        pages: newChapter.pages.trim() || 'N/A',
        topics: newChapter.topicsText
          .split('\n')
          .map((topic) => topic.trim())
          .filter(Boolean),
      },
    ];
    const saved = await persistChapters(next, 'Chapter added.');
    if (saved) {
      setNewChapter({ title: '', pages: '', topicsText: '' });
      setShowAddChapter(false);
    }
  };

  const pollAttachJob = (jobId) => {
    const startedAt = Date.now();

    const tick = async () => {
      try {
        const res = await api.getBookUploadJob(jobId);
        const job = res.job;
        if (!job) throw new Error('The processing status could not be found.');

        setAttachProgress({
          status: job.status,
          progress: Number(job.progress) || 0,
          stage: job.stage || 'Processing',
          message: job.message || '',
        });

        if (job.status === 'completed') {
          setAttachUploading(false);
          if (job.book) {
            setBook(job.book);
            setSelectedChapters(selectableChapterNumbers(job.book));
          } else {
            await fetchBook();
          }
          setAttachSuccess(job.message || 'Document attached and chapters extracted.');
          setAttachError('');
          return;
        }

        if (job.status === 'failed') {
          setAttachUploading(false);
          setAttachError(job.errorMessage || job.message || 'The document could not be processed.');
          return;
        }

        if (Date.now() - startedAt > 5 * 60 * 1000) {
          setAttachUploading(false);
          setAttachError('Processing is taking longer than expected. Refresh the page to check whether the chapters were saved.');
          return;
        }

        attachPollTimer.current = setTimeout(tick, 1000);
      } catch (err) {
        setAttachUploading(false);
        setAttachError(err.message || 'Could not check processing status.');
      }
    };

    tick();
  };

  const handleAttachFile = async (file) => {
    if (!file || attachUploading || !canEdit) return;
    const validationError = validateFile(file);
    if (validationError) {
      setAttachError(validationError);
      return;
    }

    try {
      setAttachUploading(true);
      setAttachError('');
      setAttachSuccess('');
      setAttachProgress({
        status: 'queued',
        progress: 0,
        stage: 'Uploading',
        message: 'Sending the document to the server.',
      });

      const formData = new FormData();
      formData.append('document', file);
      const res = await api.attachBookFile(book.id, formData);

      if (!res.jobId) {
        setAttachUploading(false);
        setAttachError(res.message || 'The server did not start an upload job.');
        return;
      }

      pollAttachJob(res.jobId);
    } catch (err) {
      setAttachUploading(false);
      setAttachError(err.message || 'Could not attach the document.');
    } finally {
      if (attachInputRef.current) attachInputRef.current.value = '';
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-xs text-slate-500">Loading textbook syllabus...</div>;
  }

  if (loadError || !book) {
    return (
      <div className="bg-white p-8 rounded-2xl text-center space-y-3">
        <p className="text-sm font-bold text-slate-800">{loadError || 'Book could not be found.'}</p>
        <div className="flex items-center justify-center gap-2">
          <button onClick={fetchBook} className="text-xs font-bold text-white bg-brand-600 px-3 py-1.5 rounded-lg">
            Retry
          </button>
          <button onClick={onBack} className="text-xs font-bold text-brand-600">
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  const sourceLabel = SOURCE_LABELS[book.sourceType] || 'Textbook';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Library</span>
        </button>

        <button
          onClick={() => onStartExamWithBook(book, selectedChapters)}
          disabled={selectedChapters.length === 0 || chapters.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-40 rounded-xl shadow-sm shadow-brand-600/20 transition-all hover:scale-[1.02]"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Generate Test ({selectedChapters.length} Selected)</span>
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-50 text-brand-700">
                {book.className}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
                {book.subject}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                {sourceLabel}
              </span>
              <span className="text-xs font-medium text-slate-500">{book.boardName}</span>
            </div>

            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{book.title}</h2>
            <p className="text-xs text-slate-500 mt-1">
              Author / Publisher: {book.author || 'Educational Authority'} • {book.edition || 'Current Edition'}
            </p>

            <p className="text-xs text-slate-600 mt-3 max-w-3xl leading-relaxed">
              {book.description || 'Textbook registered in your library.'}
            </p>
          </div>

          <div className="flex md:flex-col items-start md:items-end gap-2 text-xs text-slate-500">
            <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-700">
              {chapters.length} Total {chapters.length === 1 ? 'Chapter' : 'Chapters'}
            </span>
            {book.pageCount > 0 && <span>{book.pageCount} Pages</span>}
            {canEdit && (
              <>
                <input
                  ref={attachInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,.md,.markdown"
                  className="hidden"
                  onChange={(e) => handleAttachFile(e.target.files?.[0])}
                />
                <button
                  type="button"
                  onClick={() => attachInputRef.current?.click()}
                  disabled={attachUploading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-50 border border-brand-200 text-brand-700 font-bold hover:bg-brand-100 disabled:opacity-50"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>{attachUploading ? 'Processing…' : book.hasDocument ? 'Replace Document' : 'Attach Document'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {chapters.length === 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900">
          <span className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            This book has no chapters yet. Attach a PDF or DOCX to extract chapters automatically, or add chapters manually below.
          </span>
          {canEdit && (
            <button
              type="button"
              onClick={() => attachInputRef.current?.click()}
              disabled={attachUploading}
              className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold hover:bg-amber-700 disabled:opacity-50 whitespace-nowrap"
            >
              {attachUploading ? 'Processing…' : 'Upload Document'}
            </button>
          )}
        </div>
      )}

      {chapters.length > 0 && chaptersWithContent.length === 0 && (
        <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl flex items-start gap-2 text-xs text-sky-900">
          <FileText className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            This book has chapter outlines only. Tests can use the chapter titles and topics; attach a PDF or DOCX for
            questions grounded in the extracted text.
          </span>
        </div>
      )}

      {chaptersWithContent.length > 0 && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2 text-xs text-emerald-900">
          <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Extracted text is available for {chaptersWithContent.length} of {chapters.length} chapters
            {selectedWithContent.length > 0 ? ` (${selectedWithContent.length} selected)` : ''}.
          </span>
        </div>
      )}

      {attachProgress && attachUploading && (
        <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2">
          <div className="flex items-center justify-between gap-3 text-[11px]">
            <span className="font-bold text-slate-700">{attachProgress.stage}</span>
            <span className="text-slate-500">{attachProgress.progress}%</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-600 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(3, attachProgress.progress))}%` }}
            />
          </div>
          {attachProgress.message && <p className="text-[11px] text-slate-500">{attachProgress.message}</p>}
        </div>
      )}

      {attachError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start justify-between gap-2 text-xs text-rose-800">
          <span className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {attachError}
          </span>
          <button onClick={() => setAttachError('')} className="text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {attachSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start justify-between gap-2 text-xs text-emerald-800">
          <span className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {attachSuccess}
          </span>
          <button onClick={() => setAttachSuccess('')} className="text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {chapterError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start justify-between gap-2 text-xs text-rose-800">
          <span className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {chapterError}
          </span>
          <button onClick={() => setChapterError('')} className="text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800">
            Syllabus Mapping ({selectedChapters.length} of {chapters.length} Chapters Included)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSelectAll}
            className="text-xs font-semibold text-brand-600 hover:text-brand-800 px-2.5 py-1 rounded-lg hover:bg-brand-50 transition-colors"
          >
            Select All
          </button>
          <span className="text-slate-300">•</span>
          <button
            onClick={handleDeselectAll}
            className="text-xs font-semibold text-slate-600 hover:text-slate-800 px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Deselect All
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {chapters.map((chapter, index) => {
          const isSelected = selectedChapters.includes(chapter.chapterNumber);
          const isEditing = editingChapterId === chapter.id;
          const showPreview = previewChapterId === chapter.id;

          return (
            <div
              key={chapter.id}
              className={`bg-white rounded-2xl border transition-all ${
                isSelected
                  ? 'border-brand-200 shadow-sm'
                  : chapter.isExcluded
                  ? 'border-slate-200 bg-slate-50/60 opacity-60'
                  : 'border-slate-200 opacity-90'
              }`}
            >
              <div className="p-4 sm:p-5 flex items-start gap-3.5">
                <button
                  onClick={() => handleToggleChapter(chapter.chapterNumber)}
                  disabled={chapter.isExcluded}
                  className="mt-1 text-brand-600 hover:text-brand-700 transition-colors flex-shrink-0 disabled:opacity-40"
                  title={isSelected ? 'Deselect chapter' : 'Select chapter'}
                >
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 fill-brand-600 text-white" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-400" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">Chapter Title</label>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full text-xs p-2 border border-brand-400 rounded-lg focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Topics (one per line)
                        </label>
                        <textarea
                          rows={3}
                          value={editTopics}
                          onChange={(e) => setEditTopics(e.target.value)}
                          className="w-full text-xs p-2 border border-brand-400 rounded-lg focus:outline-none font-mono"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveEdit(chapter.id)}
                          disabled={savingChapters}
                          className="px-3 py-1.5 text-xs font-bold text-white bg-brand-600 rounded-lg flex items-center gap-1 disabled:opacity-50"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Save Changes</span>
                        </button>
                        <button
                          onClick={() => setEditingChapterId(null)}
                          disabled={savingChapters}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-extrabold text-brand-700 bg-brand-50 px-2 py-0.5 rounded">
                              Ch {chapter.chapterNumber}
                            </span>
                            <h4 className="text-sm font-bold text-slate-900 break-words">{chapter.title}</h4>
                            {chapter.pages && <span className="text-xs text-slate-400">({chapter.pages})</span>}
                            {chapter.contentLength > 0 ? (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                Text extracted
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                                Outline only
                              </span>
                            )}
                            {chapter.isExcluded && (
                              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                                Excluded from Exams
                              </span>
                            )}
                          </div>

                          {chapter.summary && <p className="text-xs text-slate-500 mt-1">{chapter.summary}</p>}

                          {chapter.topics && chapter.topics.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {chapter.topics.map((topic, topicIndex) => (
                                <span
                                  key={topicIndex}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700"
                                >
                                  <Tag className="w-2.5 h-2.5 text-slate-400" />
                                  <span>{topic}</span>
                                </span>
                              ))}
                            </div>
                          )}

                          {chapter.contentLength > 0 && (
                            <div className="mt-3">
                              <button
                                type="button"
                                onClick={() => setPreviewChapterId(showPreview ? null : chapter.id)}
                                className="text-[11px] font-bold text-brand-600 hover:text-brand-800"
                              >
                                {showPreview ? 'Hide extracted text' : `Preview extracted text (${chapter.contentLength.toLocaleString()} chars)`}
                              </button>
                              {showPreview && (
                                <p className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 whitespace-pre-wrap max-h-48 overflow-y-auto">
                                  {chapter.contentPreview || 'No preview available.'}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {canEdit && (
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button
                              onClick={() => handleMoveChapter(index, -1)}
                              disabled={index === 0 || savingChapters}
                              className="p-1.5 text-slate-400 hover:text-slate-700 rounded disabled:opacity-30"
                              title="Move chapter up"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleMoveChapter(index, 1)}
                              disabled={index === chapters.length - 1 || savingChapters}
                              className="p-1.5 text-slate-400 hover:text-slate-700 rounded disabled:opacity-30"
                              title="Move chapter down"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleStartEdit(chapter)}
                              className="p-1.5 text-slate-400 hover:text-brand-600 rounded"
                              title="Edit chapter / topics"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleExclude(chapter.id)}
                              className={`text-[10px] font-semibold px-2 py-1 rounded transition-colors ${
                                chapter.isExcluded
                                  ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                  : 'text-slate-500 hover:text-rose-600'
                              }`}
                            >
                              {chapter.isExcluded ? 'Include' : 'Exclude'}
                            </button>
                            <button
                              onClick={() => handleRemoveChapter(chapter)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                              title="Remove chapter"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {canEdit && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          {!showAddChapter ? (
            <button
              type="button"
              onClick={() => setShowAddChapter(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-800"
            >
              <Plus className="w-4 h-4" />
              Add Chapter
            </button>
          ) : (
            <form onSubmit={handleAddChapter} className="space-y-3">
              <h3 className="text-xs font-bold text-slate-800">Add a chapter</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Chapter title"
                  value={newChapter.title}
                  onChange={(e) => setNewChapter({ ...newChapter, title: e.target.value })}
                  className="sm:col-span-2 text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Pages (optional)"
                  value={newChapter.pages}
                  onChange={(e) => setNewChapter({ ...newChapter, pages: e.target.value })}
                  className="text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
                />
              </div>
              <textarea
                rows={2}
                placeholder="Topics (optional, one per line)"
                value={newChapter.topicsText}
                onChange={(e) => setNewChapter({ ...newChapter, topicsText: e.target.value })}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={savingChapters}
                  className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl disabled:opacity-50"
                >
                  {savingChapters ? 'Saving…' : 'Add Chapter'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddChapter(false);
                    setNewChapter({ title: '', pages: '', topicsText: '' });
                  }}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
