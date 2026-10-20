import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Printer,
  Download,
  Edit3,
  Trash2,
  Calendar,
  Clock,
  Sparkles,
  Layers,
} from 'lucide-react';
import { api } from '../services/api';

export const SavedTests = ({ onSelectTest, onStartNewTest }) => {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('');

  const fetchTests = async () => {
    try {
      setLoading(true);
      const res = await api.getTests({ className: filterClass });
      if (res.success) {
        setTests(res.tests);
      }
    } catch (err) {
      console.error('Failed to load saved tests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTests();
  }, [filterClass]);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this examination paper?')) return;
    try {
      const res = await api.deleteTest(id);
      if (res.success) {
        fetchTests();
      }
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const filteredTests = tests.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q) ||
      t.className.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3 max-w-md bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search saved papers by title, subject, or class..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-800 focus:outline-none"
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

          <button
            onClick={onStartNewTest}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate New Paper</span>
          </button>
        </div>
      </div>

      {/* Grid of Tests */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">Loading saved examination papers...</div>
      ) : filteredTests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No examination papers found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Generate and save custom tests, monthly quizzes, or term exams using the guided generator.
          </p>
          <button
            onClick={onStartNewTest}
            className="mt-4 px-4 py-2 text-xs font-bold text-white bg-brand-600 rounded-xl"
          >
            Generate First Paper
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTests.map((t) => (
            <div
              key={t.id}
              onClick={() => onSelectTest(t.id)}
              className="group cursor-pointer bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-brand-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-2">
                  <span className="px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 font-bold">
                    {t.className}
                  </span>
                  <span className="text-emerald-700 font-bold">{t.totalMarks} Marks</span>
                </div>

                <h3 className="text-base font-bold text-slate-900 group-hover:text-brand-600 transition-colors line-clamp-2">
                  {t.title}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Subject: <strong className="text-slate-700">{t.subject}</strong> • {t.durationMinutes} Mins
                </p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                    {t.examType}
                  </span>
                  <span className="text-[10px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                    {(t.selectedChapters || []).length} Chapters
                  </span>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : 'Recent'}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => handleDelete(t.id, e)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Delete paper"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTest(t.id);
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-brand-600 hover:bg-brand-50 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Open Paper</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
