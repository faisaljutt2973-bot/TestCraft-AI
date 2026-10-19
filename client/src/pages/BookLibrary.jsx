import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  UploadCloud,
  Globe,
  FileText,
  Filter,
  CheckCircle,
  ExternalLink,
  Trash2,
  Layers,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { api } from '../services/api';
import { Modal } from '../components/Modal';

export const BookLibrary = ({ onSelectBook, isAddModalOpen, setIsAddModalOpen }) => {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterSubject, setFilterSubject] = useState('');

  // Add Book Modal State
  const [modalTab, setModalTab] = useState('upload'); // 'search' | 'upload' | 'boards' | 'manual'

  // Google Search tab
  const [googleQuery, setGoogleQuery] = useState('');
  const [googleResults, setGoogleResults] = useState([]);
  const [searchingGoogle, setSearchingGoogle] = useState(false);
  const [selectedGoogleBook, setSelectedGoogleBook] = useState(null);

  // Upload tab
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    author: '',
    className: 'Class 9',
    subject: 'Biology',
    boardName: 'Punjab Curriculum and Textbook Board (PCTB)',
  });
  const [uploading, setUploading] = useState(false);

  // Manual tab
  const [manualForm, setManualForm] = useState({
    title: '',
    author: '',
    className: 'Class 9',
    subject: 'Biology',
    boardName: 'Punjab Curriculum and Textbook Board (PCTB)',
    edition: '2025-2026 Academic Edition',
    chaptersText: 'Chapter 1: Introduction to Biology\nChapter 2: Solving a Biological Problem\nChapter 3: Biodiversity',
  });

  const fetchBooks = async () => {
    try {
      setLoading(true);
      const res = await api.getBooks({
        search: searchQuery,
        className: filterClass,
        subject: filterSubject,
      });
      if (res.success) {
        setBooks(res.books);
      }
    } catch (err) {
      console.error('Failed to fetch books:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, [searchQuery, filterClass, filterSubject]);

  const handleSearchGoogle = async (e) => {
    e.preventDefault();
    if (!googleQuery.trim()) return;
    try {
      setSearchingGoogle(true);
      const res = await api.searchGoogleBooks(googleQuery);
      if (res.success) {
        setGoogleResults(res.books);
      }
    } catch (err) {
      alert(`Google Books search error: ${err.message}`);
    } finally {
      setSearchingGoogle(false);
    }
  };

  const handleImportGoogleBook = async (gBook) => {
    try {
      const res = await api.importGoogleBook({
        googleBook: gBook,
        className: uploadForm.className,
        subject: uploadForm.subject,
        boardName: uploadForm.boardName,
      });
      if (res.success) {
        setIsAddModalOpen(false);
        fetchBooks();
      }
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      alert('Please select a PDF or document file to upload.');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('document', uploadFile);
      formData.append('title', uploadForm.title);
      formData.append('author', uploadForm.author);
      formData.append('className', uploadForm.className);
      formData.append('subject', uploadForm.subject);
      formData.append('boardName', uploadForm.boardName);

      const res = await api.uploadBookFile(formData);
      if (res.success) {
        setIsAddModalOpen(false);
        setUploadFile(null);
        fetchBooks();
        if (res.book) {
          onSelectBook(res.book.id);
        }
      }
    } catch (err) {
      alert(`Upload parsing failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    try {
      const chaptersList = manualForm.chaptersText
        .split('\n')
        .map((line, idx) => line.trim())
        .filter(Boolean)
        .map((line, idx) => ({
          chapterNumber: idx + 1,
          title: line.replace(/^chapter\s*\d+[:.\s\-]*/i, ''),
          pages: `Unit ${idx + 1}`,
          topics: ['Core Learning Objectives', 'Analytical Competencies'],
        }));

      const res = await api.createManualBook({
        title: manualForm.title,
        author: manualForm.author,
        className: manualForm.className,
        subject: manualForm.subject,
        boardName: manualForm.boardName,
        edition: manualForm.edition,
        chapters: chaptersList,
      });

      if (res.success) {
        setIsAddModalOpen(false);
        fetchBooks();
      }
    } catch (err) {
      alert(`Creation failed: ${err.message}`);
    }
  };

  const handleDeleteBook = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to remove this book from your library?')) return;
    try {
      const res = await api.deleteBook(id);
      if (res.success) {
        fetchBooks();
      }
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
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

        <div className="flex items-center gap-2.5">
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
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Textbook</span>
          </button>
        </div>
      </div>

      {/* Book Grid */}
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
            onClick={() => setIsAddModalOpen(true)}
            className="mt-4 px-4 py-2 text-xs font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700"
          >
            Add Your First Textbook
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {books.map((b) => (
            <div
              key={b.id}
              onClick={() => onSelectBook(b.id)}
              className="group cursor-pointer bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-brand-300 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header Badge */}
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-2">
                  <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-bold">
                    {b.className}
                  </span>
                  <span className="truncate max-w-[150px]">{b.boardName}</span>
                </div>

                <h3 className="text-base font-bold text-slate-900 group-hover:text-brand-600 transition-colors line-clamp-2">
                  {b.title}
                </h3>
                <p className="text-xs text-slate-500 mt-1">Author: {b.author || 'Curriculum Board'}</p>

                <p className="text-xs text-slate-600 mt-3 line-clamp-2 leading-relaxed">
                  {b.description || 'Comprehensive curriculum textbook with mapped syllabus units.'}
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1 font-medium">
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    {(b.chapters || []).length} Chapters
                  </span>
                  {b.pageCount > 0 && <span>• {b.pageCount} pgs</span>}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleDeleteBook(b.id, e)}
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
          ))}
        </div>
      )}

      {/* Add Book Modal with 4 Ingestion Options */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Textbook to Library"
        subtitle="Choose from official online search, document file upload, or curriculum entry"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-5">
          {/* Tabs */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setModalTab('upload')}
              className={`flex items-center gap-2 py-2.5 px-4 text-xs font-bold border-b-2 transition-all ${
                modalTab === 'upload'
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              <span>Upload Book (PDF / DOCX)</span>
            </button>
            <button
              onClick={() => setModalTab('search')}
              className={`flex items-center gap-2 py-2.5 px-4 text-xs font-bold border-b-2 transition-all ${
                modalTab === 'search'
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>Google Books Search</span>
            </button>
            <button
              onClick={() => setModalTab('manual')}
              className={`flex items-center gap-2 py-2.5 px-4 text-xs font-bold border-b-2 transition-all ${
                modalTab === 'manual'
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Manual Entry</span>
            </button>
          </div>

          {/* TAB 1: UPLOAD FILE */}
          {modalTab === 'upload' && (
            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 hover:border-brand-500 rounded-2xl p-6 text-center transition-colors bg-slate-50/50">
                <UploadCloud className="w-10 h-10 text-brand-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-800">
                  {uploadFile ? uploadFile.name : 'Click to select or drag and drop textbook PDF / DOCX'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Supported formats: PDF, DOCX, TXT. Our engine extracts text and automatically detects chapters and topics.
                </p>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  className="mt-3 text-xs text-slate-600 mx-auto block"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Book Title (Optional override)</label>
                  <input
                    type="text"
                    placeholder="e.g. Class 9 Biology Textbook"
                    value={uploadForm.title}
                    onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Author / Publisher</label>
                  <input
                    type="text"
                    placeholder="e.g. Punjab Curriculum & Textbook Board"
                    value={uploadForm.author}
                    onChange={(e) => setUploadForm({ ...uploadForm, author: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Class / Grade</label>
                  <select
                    value={uploadForm.className}
                    onChange={(e) => setUploadForm({ ...uploadForm, className: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
                  >
                    <option value="Class 9">Class 9</option>
                    <option value="Class 10">Class 10</option>
                    <option value="Class 11">Class 11</option>
                    <option value="Class 12">Class 12</option>
                    <option value="Cambridge O-Level">Cambridge O-Level</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
                  <input
                    type="text"
                    placeholder="e.g. Biology, Physics, Mathematics"
                    value={uploadForm.subject}
                    onChange={(e) => setUploadForm({ ...uploadForm, subject: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
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
                      <span>Extracting & Parsing Chapters...</span>
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

          {/* TAB 2: GOOGLE BOOKS SEARCH */}
          {modalTab === 'search' && (
            <div className="space-y-4">
              <form onSubmit={handleSearchGoogle} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search by book title, author, or ISBN (e.g. Campbell Biology, Cambridge Chemistry)..."
                  value={googleQuery}
                  onChange={(e) => setGoogleQuery(e.target.value)}
                  className="flex-1 text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={searchingGoogle}
                  className="px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-xl flex items-center gap-1.5"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{searchingGoogle ? 'Searching...' : 'Search'}</span>
                </button>
              </form>

              <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
                {googleResults.map((gb) => (
                  <div
                    key={gb.googleBooksId}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start justify-between gap-3 hover:border-brand-400 transition-colors"
                  >
                    <div className="flex gap-3">
                      {gb.thumbnail ? (
                        <img
                          src={gb.thumbnail}
                          alt={gb.title}
                          className="w-12 h-16 object-cover rounded shadow-sm border border-slate-200"
                        />
                      ) : (
                        <div className="w-12 h-16 bg-slate-200 rounded flex items-center justify-center text-slate-400">
                          <BookOpen className="w-5 h-5" />
                        </div>
                      )}
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{gb.title}</h4>
                        <p className="text-[11px] text-slate-500">{(gb.authors || []).join(', ')}</p>
                        <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{gb.description}</p>
                        <span className="inline-block mt-1 text-[10px] font-semibold text-slate-500 bg-white border px-1.5 py-0.5 rounded">
                          {gb.pageCount} Pages • ISBN: {gb.isbn}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleImportGoogleBook(gb)}
                      className="px-3 py-1.5 text-xs font-bold text-brand-600 hover:bg-brand-100/60 bg-white border border-brand-300 rounded-lg whitespace-nowrap flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Import</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: MANUAL ENTRY */}
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
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Author / Publisher</label>
                  <input
                    type="text"
                    placeholder="e.g. National Curriculum Authority"
                    value={manualForm.author}
                    onChange={(e) => setManualForm({ ...manualForm, author: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
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
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
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
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chapters List (Enter one chapter per line)
                </label>
                <textarea
                  rows={4}
                  value={manualForm.chaptersText}
                  onChange={(e) => setManualForm({ ...manualForm, chaptersText: e.target.value })}
                  placeholder="Chapter 1: Title&#10;Chapter 2: Title&#10;Chapter 3: Title"
                  className="w-full text-xs p-2.5 border border-slate-300 rounded-xl font-mono focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl"
                >
                  Save Book
                </button>
              </div>
            </form>
          )}
        </div>
      </Modal>
    </div>
  );
};
