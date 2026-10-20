import React, { useState, useEffect } from 'react';
import {
  FileQuestion,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  CheckCircle,
  Tag,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { api } from '../services/api';
import { Modal } from '../components/Modal';

export const QuestionBank = () => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  // Add Question Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [form, setForm] = useState({
    questionText: '',
    questionType: 'mcq',
    subject: 'Biology',
    className: 'Class 9',
    bookTitle: 'Biology Class 9 (PCTB)',
    chapterNumber: 1,
    topic: 'Introduction to Biology',
    difficulty: 'Medium',
    marks: 1,
    options: ['', '', '', ''],
    correctAnswer: '0',
    explanation: '',
    sourceReference: 'Textbook Chapter 1',
  });

  const fetchQuestions = async () => {
    try {
      setLoading(true);
      const res = await api.getQuestions({
        search,
        questionType: filterType,
        difficulty: filterDifficulty,
      });
      if (res.success) {
        setQuestions(res.questions);
      }
    } catch (err) {
      console.error('Failed to load questions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, [search, filterType, filterDifficulty]);

  const handleCreateQuestion = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        options: form.questionType === 'mcq' ? form.options.filter(Boolean) : [],
        marks: parseInt(form.marks, 10) || 1,
        chapterNumber: parseInt(form.chapterNumber, 10) || 1,
      };

      const res = await api.createQuestion(payload);
      if (res.success) {
        setIsAddModalOpen(false);
        fetchQuestions();
        // Reset
        setForm({
          questionText: '',
          questionType: 'mcq',
          subject: 'Biology',
          className: 'Class 9',
          bookTitle: 'Biology Class 9 (PCTB)',
          chapterNumber: 1,
          topic: '',
          difficulty: 'Medium',
          marks: 1,
          options: ['', '', '', ''],
          correctAnswer: '0',
          explanation: '',
          sourceReference: '',
        });
      }
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      const res = await api.deleteQuestion(id);
      if (res.success) {
        fetchQuestions();
      }
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3 max-w-md bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search questions by keyword, topic, or concept..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-800 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 text-slate-700 px-3 py-2 rounded-xl focus:outline-none"
          >
            <option value="">All Question Types</option>
            <option value="mcq">MCQs</option>
            <option value="short_answer">Short Answer</option>
            <option value="long_answer">Long Answer</option>
            <option value="numerical">Numerical Problems</option>
            <option value="definition">Definitions</option>
          </select>

          <select
            value={filterDifficulty}
            onChange={(e) => setFilterDifficulty(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 text-slate-700 px-3 py-2 rounded-xl focus:outline-none"
          >
            <option value="">All Difficulties</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Question</span>
          </button>
        </div>
      </div>

      {/* Questions List */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">Loading questions repository...</div>
      ) : questions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <FileQuestion className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No questions found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Build your institutional repository by creating manual questions or generating and saving exam items.
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="mt-4 px-4 py-2 text-xs font-bold text-white bg-brand-600 rounded-xl"
          >
            Add First Question
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => {
            const isExpanded = expandedId === q.id;
            return (
              <div
                key={q.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-slate-300 transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-brand-50 text-brand-700">
                      {q.questionType.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {q.difficulty}
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      {q.subject} • {q.className}
                    </span>
                    {q.chapterNumber && (
                      <span className="text-xs text-slate-400">Ch {q.chapterNumber}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-brand-700 bg-brand-100 px-2 py-0.5 rounded-full">
                      {q.marks} Mark{q.marks > 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={(e) => handleDelete(q.id, e)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                      title="Delete question"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs font-bold text-slate-900 leading-relaxed">{q.questionText}</p>

                {/* Options if MCQ */}
                {q.questionType === 'mcq' && q.options && (
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 pt-1">
                    {q.options.map((opt, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded-lg border ${
                          idx === Number(q.correctAnswer)
                            ? 'bg-emerald-50 border-emerald-300 font-semibold text-emerald-900'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <span className="font-bold mr-1">({String.fromCharCode(65 + idx)})</span>
                        <span>{opt}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Collapsible Answer & Rubric */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : q.id)}
                    className="font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1"
                  >
                    <span>{isExpanded ? 'Hide Answer & Rubric' : 'Show Answer & Marking Scheme'}</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {q.sourceReference && (
                    <span className="text-[11px] text-slate-400 truncate max-w-xs">{q.sourceReference}</span>
                  )}
                </div>

                {isExpanded && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5 animate-fadeIn">
                    <div>
                      <strong className="text-emerald-900">Model Answer:</strong>
                      <p className="text-slate-800 mt-0.5">
                        {q.questionType === 'mcq' && q.options
                          ? `(${String.fromCharCode(65 + Number(q.correctAnswer))}) ${q.options[q.correctAnswer]}`
                          : q.correctAnswer}
                      </p>
                    </div>
                    {q.explanation && (
                      <div>
                        <strong className="text-slate-600">Marking Rubric:</strong>
                        <p className="text-slate-600 text-[11px] mt-0.5">{q.explanation}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Manual Add Question Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Question to Question Bank"
        subtitle="Create a verified curriculum question with complete answer key and marking criteria"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateQuestion} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject *</label>
              <input
                type="text"
                required
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Class / Grade *</label>
              <input
                type="text"
                required
                value={form.className}
                onChange={(e) => setForm({ ...form, className: e.target.value })}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Question Type *</label>
              <select
                value={form.questionType}
                onChange={(e) => setForm({ ...form, questionType: e.target.value })}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:outline-none"
              >
                <option value="mcq">Multiple Choice Question (MCQ)</option>
                <option value="short_answer">Short Answer Question</option>
                <option value="long_answer">Long / Comprehensive Question</option>
                <option value="numerical">Numerical Problem</option>
                <option value="definition">Definition</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Marks *</label>
              <input
                type="number"
                min="1"
                max="30"
                value={form.marks}
                onChange={(e) => setForm({ ...form, marks: e.target.value })}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Question Text *</label>
            <textarea
              rows={3}
              required
              value={form.questionText}
              onChange={(e) => setForm({ ...form, questionText: e.target.value })}
              placeholder="Enter the full question prompt..."
              className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:outline-none"
            />
          </div>

          {/* MCQ Options */}
          {form.questionType === 'mcq' && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">4 Multiple Choice Options</label>
              {form.options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correctOption"
                    checked={form.correctAnswer === String(idx)}
                    onChange={() => setForm({ ...form, correctAnswer: String(idx) })}
                    title="Mark as correct answer"
                  />
                  <span className="text-xs font-bold text-slate-500 w-6">({String.fromCharCode(65 + idx)})</span>
                  <input
                    type="text"
                    required
                    placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                    value={opt}
                    onChange={(e) => {
                      const newOpts = [...form.options];
                      newOpts[idx] = e.target.value;
                      setForm({ ...form, options: newOpts });
                    }}
                    className="flex-1 text-xs p-2 border border-slate-300 rounded-lg focus:outline-none"
                  />
                </div>
              ))}
            </div>
          )}

          {form.questionType !== 'mcq' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Model Answer / Solution *</label>
              <textarea
                rows={3}
                required
                value={form.correctAnswer}
                onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })}
                placeholder="Enter standard curriculum answer or solution steps..."
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Marking Rubric / Criteria</label>
            <input
              type="text"
              placeholder="e.g. 2 marks for formula, 2 marks for calculation"
              value={form.explanation}
              onChange={(e) => setForm({ ...form, explanation: e.target.value })}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
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
              Save Question
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
