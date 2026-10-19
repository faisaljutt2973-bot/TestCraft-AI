import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CheckSquare,
  Square,
  Sparkles,
  Edit2,
  Save,
  Check,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Tag,
} from 'lucide-react';
import { api } from '../services/api';

export const BookDetail = ({ bookId, onBack, onStartExamWithBook }) => {
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedChapters, setSelectedChapters] = useState([]);
  const [editingChapterId, setEditingChapterId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editTopics, setEditTopics] = useState('');
  const [savingChapters, setSavingChapters] = useState(false);

  useEffect(() => {
    const fetchBook = async () => {
      try {
        setLoading(true);
        const res = await api.getBookById(bookId);
        if (res.success && res.book) {
          setBook(res.book);
          // By default select all non-excluded chapters
          const initialSelected = (res.book.chapters || [])
            .filter((c) => !c.isExcluded)
            .map((c) => c.chapterNumber);
          setSelectedChapters(initialSelected);
        }
      } catch (err) {
        console.error('Failed to load book:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBook();
  }, [bookId]);

  const handleToggleChapter = (chNum) => {
    if (selectedChapters.includes(chNum)) {
      setSelectedChapters(selectedChapters.filter((n) => n !== chNum));
    } else {
      setSelectedChapters([...selectedChapters, chNum]);
    }
  };

  const handleSelectAll = () => {
    if (!book) return;
    const all = (book.chapters || []).map((c) => c.chapterNumber);
    setSelectedChapters(all);
  };

  const handleDeselectAll = () => {
    setSelectedChapters([]);
  };

  const handleStartEdit = (ch) => {
    setEditingChapterId(ch.id);
    setEditTitle(ch.title);
    setEditTopics((ch.topics || []).join('\n'));
  };

  const handleSaveEdit = async (chId) => {
    if (!book) return;
    try {
      setSavingChapters(true);
      const updatedChapters = (book.chapters || []).map((ch) => {
        if (ch.id === chId) {
          return {
            ...ch,
            title: editTitle.trim(),
            topics: editTopics.split('\n').map((t) => t.trim()).filter(Boolean),
          };
        }
        return ch;
      });

      const res = await api.updateBookChapters(book.id, updatedChapters);
      if (res.success) {
        setBook(res.book);
        setEditingChapterId(null);
      }
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSavingChapters(false);
    }
  };

  const handleToggleExclude = async (chId) => {
    if (!book) return;
    try {
      const updatedChapters = (book.chapters || []).map((ch) => {
        if (ch.id === chId) {
          return { ...ch, isExcluded: !ch.isExcluded };
        }
        return ch;
      });
      const res = await api.updateBookChapters(book.id, updatedChapters);
      if (res.success) {
        setBook(res.book);
      }
    } catch (err) {
      alert(`Update failed: ${err.message}`);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-xs text-slate-500">Loading textbook syllabus...</div>;
  }

  if (!book) {
    return (
      <div className="bg-white p-8 rounded-2xl text-center">
        <p className="text-sm font-bold text-slate-800">Book could not be found.</p>
        <button onClick={onBack} className="mt-4 text-xs font-bold text-brand-600">
          Back to Library
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Library</span>
        </button>

        <button
          onClick={() => onStartExamWithBook(book, selectedChapters)}
          disabled={selectedChapters.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-40 rounded-xl shadow-sm shadow-brand-600/20 transition-all hover:scale-[1.02]"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Generate Test ({selectedChapters.length} Selected)</span>
        </button>
      </div>

      {/* Book Metadata Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-50 text-brand-700">
                {book.className}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
                {book.subject}
              </span>
              <span className="text-xs font-medium text-slate-500">{book.boardName}</span>
            </div>

            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{book.title}</h2>
            <p className="text-xs text-slate-500 mt-1">
              Author / Publisher: {book.author || 'Educational Authority'} • {book.edition || 'Current Edition'}
            </p>

            <p className="text-xs text-slate-600 mt-3 max-w-3xl leading-relaxed">
              {book.description || 'Curriculum framework with structured learning objectives and assessment units.'}
            </p>
          </div>

          <div className="flex md:flex-col items-center md:items-end gap-2 text-xs text-slate-500">
            <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-700">
              {(book.chapters || []).length} Total Chapters
            </span>
            {book.pageCount > 0 && <span>{book.pageCount} Pages</span>}
          </div>
        </div>
      </div>

      {/* Chapter Selection Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800">
            Syllabus Mapping ({selectedChapters.length} of {(book.chapters || []).length} Chapters Included)
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

      {/* Chapters & Topics List */}
      <div className="space-y-3">
        {(book.chapters || []).map((ch) => {
          const isSelected = selectedChapters.includes(ch.chapterNumber);
          const isEditing = editingChapterId === ch.id;

          return (
            <div
              key={ch.id}
              className={`bg-white rounded-2xl border transition-all ${
                isSelected
                  ? 'border-brand-200 shadow-sm'
                  : ch.isExcluded
                  ? 'border-slate-200 bg-slate-50/60 opacity-60'
                  : 'border-slate-200 opacity-90'
              }`}
            >
              <div className="p-4 sm:p-5 flex items-start gap-3.5">
                {/* Selection Checkbox */}
                <button
                  onClick={() => handleToggleChapter(ch.chapterNumber)}
                  disabled={ch.isExcluded}
                  className="mt-1 text-brand-600 hover:text-brand-700 transition-colors flex-shrink-0"
                  title={isSelected ? 'Deselect Chapter' : 'Select Chapter'}
                >
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 fill-brand-600 text-white" />
                  ) : (
                    <Square className="w-5 h-5 text-slate-400" />
                  )}
                </button>

                {/* Chapter Details */}
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
                          Topics (One topic per line)
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
                          onClick={() => handleSaveEdit(ch.id)}
                          disabled={savingChapters}
                          className="px-3 py-1.5 text-xs font-bold text-white bg-brand-600 rounded-lg flex items-center gap-1"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Save Changes</span>
                        </button>
                        <button
                          onClick={() => setEditingChapterId(null)}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold text-brand-700 bg-brand-50 px-2 py-0.5 rounded">
                            Ch {ch.chapterNumber}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900">{ch.title}</h4>
                          {ch.pages && <span className="text-xs text-slate-400">({ch.pages})</span>}
                          {ch.isExcluded && (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                              Excluded from Exams
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleStartEdit(ch)}
                            className="p-1 text-slate-400 hover:text-brand-600 rounded"
                            title="Edit Chapter / Topics"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleExclude(ch.id)}
                            className={`text-[10px] font-semibold px-2 py-1 rounded transition-colors ${
                              ch.isExcluded
                                ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                : 'text-slate-500 hover:text-rose-600'
                            }`}
                          >
                            {ch.isExcluded ? 'Include' : 'Exclude'}
                          </button>
                        </div>
                      </div>

                      {ch.summary && <p className="text-xs text-slate-500 mt-1">{ch.summary}</p>}

                      {/* Topic Tags */}
                      {ch.topics && ch.topics.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {ch.topics.map((topic, tIdx) => (
                            <span
                              key={tIdx}
                              className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-700"
                            >
                              <Tag className="w-2.5 h-2.5 text-slate-400" />
                              <span>{topic}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
