import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Sparkles,
  BookOpen,
  CheckCircle,
  AlertTriangle,
  Plus,
  Save,
  Trash2,
  FileText,
  Layers,
  Percent,
  RefreshCw,
  ChevronRight,
  ClipboardList,
} from 'lucide-react';
import { api } from '../services/api';

const DEFAULT_MARKS_PER_QUESTION = { mcq: 1, short_answer: 4, long_answer: 10 };

const statusBadge = (status) => {
  if (status === 'replied') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'closed') return 'bg-slate-100 text-slate-600 border-slate-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
};

export const ExamPlanner = ({ onStartPlannerExam, onOpenAddBook }) => {
  const [books, setBooks] = useState([]);
  const [plans, setPlans] = useState([]);
  const [selectedBookId, setSelectedBookId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Configuration
  const [assessmentType, setAssessmentType] = useState('midterm'); // 'midterm' | 'final'
  const [midtermMode, setMidtermMode] = useState('cutoff'); // 'cutoff' | 'specific'
  const [cutoff, setCutoff] = useState(5);
  const [specificChapters, setSpecificChapters] = useState([]);
  const [chapterWeights, setChapterWeights] = useState({});
  const [planTitle, setPlanTitle] = useState('');
  const [totalMarks, setTotalMarks] = useState(50);
  const [mcqMarks, setMcqMarks] = useState(10);
  const [shortMarks, setShortMarks] = useState(20);
  const [longMarks, setLongMarks] = useState(20);
  const [marksPerQuestion, setMarksPerQuestion] = useState({ ...DEFAULT_MARKS_PER_QUESTION });
  const [durationMinutes, setDurationMinutes] = useState(90);

  // Generated / selected plan
  const [selectedPlan, setSelectedPlan] = useState(null);

  const currentBook = books.find((b) => b.id === selectedBookId) || null;
  const allChapters = useMemo(
    () =>
      (currentBook?.chapters || [])
        .slice()
        .sort((a, b) => Number(a.chapterNumber) - Number(b.chapterNumber)),
    [currentBook]
  );

  const includedChapters = useMemo(() => {
    if (!currentBook) return [];
    if (assessmentType === 'final') return allChapters;
    if (midtermMode === 'cutoff') {
      return allChapters.filter((c) => Number(c.chapterNumber) <= Number(cutoff));
    }
    const wanted = new Set(specificChapters.map(Number));
    return allChapters.filter((c) => wanted.has(Number(c.chapterNumber)));
  }, [currentBook, allChapters, assessmentType, midtermMode, cutoff, specificChapters]);

  const sumMarks = (Number(mcqMarks) || 0) + (Number(shortMarks) || 0) + (Number(longMarks) || 0);
  const isBalanced = sumMarks === (Number(totalMarks) || 0);

  const questionCounts = {
    mcq: marksPerQuestion.mcq > 0 ? (Number(mcqMarks) || 0) / marksPerQuestion.mcq : 0,
    short_answer:
      marksPerQuestion.short_answer > 0 ? (Number(shortMarks) || 0) / marksPerQuestion.short_answer : 0,
    long_answer:
      marksPerQuestion.long_answer > 0 ? (Number(longMarks) || 0) / marksPerQuestion.long_answer : 0,
  };

  const totalQuestions = questionCounts.mcq + questionCounts.short_answer + questionCounts.long_answer;

  const validate = () => {
    if (!currentBook) return 'Select a textbook to plan an examination.';
    if (includedChapters.length === 0) {
      return assessmentType === 'final'
        ? 'This textbook has no chapters available.'
        : 'Select at least one chapter for the midterm plan.';
    }
    if (!(Number(totalMarks) > 0)) return 'Total marks must be greater than zero.';
    if (!isBalanced) return `Section marks add up to ${sumMarks}, but total marks is ${Number(totalMarks) || 0}. Adjust them to match.`;
    if (Object.values(marksPerQuestion).some((v) => !(Number(v) > 0))) {
      return 'Marks per question must be greater than zero for every section.';
    }
    const divisionErrors = [];
    if (mcqMarks > 0 && Number(mcqMarks) % marksPerQuestion.mcq !== 0) divisionErrors.push('MCQ');
    if (shortMarks > 0 && Number(shortMarks) % marksPerQuestion.short_answer !== 0) divisionErrors.push('Short answer');
    if (longMarks > 0 && Number(longMarks) % marksPerQuestion.long_answer !== 0) divisionErrors.push('Long question');
    if (divisionErrors.length) {
      return `${divisionErrors.join(', ')} marks must be a multiple of the marks-per-question value.`;
    }
    if (totalQuestions <= 0) return 'Configure marks for at least one question type.';
    return null;
  };

  const liveError = currentBook ? validate() : null;

  const loadData = async () => {
    setLoading(true);
    try {
      const [booksRes, plansRes] = await Promise.all([api.getBooks(), api.getExamPlans()]);
      if (booksRes.success) {
        setBooks(booksRes.books);
        setSelectedBookId((prev) => prev || (booksRes.books[0]?.id ?? ''));
      }
      if (plansRes.success) {
        setPlans(plansRes.plans);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Keep chapter selections/weights valid whenever the textbook or library changes.
  useEffect(() => {
    if (!selectedBookId) return;
    const book = books.find((b) => b.id === selectedBookId);
    if (!book) return;
    const numbers = (book.chapters || []).map((c) => Number(c.chapterNumber));
    if (!numbers.length) return;

    setSpecificChapters((prev) => {
      const valid = prev.filter((n) => numbers.includes(Number(n)));
      return valid.length ? valid : numbers;
    });
    setChapterWeights((prev) => {
      const next = {};
      numbers.forEach((n) => {
        next[n] = prev[n] !== undefined ? prev[n] : 1;
      });
      return next;
    });
    setCutoff((prev) => {
      const max = Math.max(...numbers);
      return prev >= 1 && prev <= max ? prev : Math.min(5, max);
    });
  }, [selectedBookId, books]);

  const handleBookChange = (id) => {
    setSelectedBookId(id);
    setSelectedPlan(null);
    setPlanTitle('');
    setSpecificChapters([]);
    setChapterWeights({});
    setCutoff(5);
    setError(null);
    setSuccess(null);
  };

  const handleToggleChapter = (chapterNumber) => {
    const num = Number(chapterNumber);
    setSpecificChapters((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
    );
  };

  const handleWeightChange = (chapterNumber, value) => {
    setChapterWeights((prev) => ({
      ...prev,
      [chapterNumber]: value === '' ? 0 : Math.max(0, Number(value)),
    }));
  };

  const buildPayload = () => ({
    title: planTitle.trim(),
    bookId: currentBook.id,
    assessmentType,
    selectionMode: assessmentType === 'final' ? 'all' : midtermMode,
    selectedChapters: includedChapters.map((c) => Number(c.chapterNumber)),
    totalMarks: Number(totalMarks) || 0,
    mcqMarks: Number(mcqMarks) || 0,
    shortMarks: Number(shortMarks) || 0,
    longMarks: Number(longMarks) || 0,
    marksPerQuestion: {
      mcq: Number(marksPerQuestion.mcq) || 1,
      short_answer: Number(marksPerQuestion.short_answer) || 1,
      long_answer: Number(marksPerQuestion.long_answer) || 1,
    },
    chapterWeights: Object.fromEntries(
      includedChapters.map((c) => [Number(c.chapterNumber), Number(chapterWeights[c.chapterNumber]) || 0])
    ),
    durationMinutes: Number(durationMinutes) || 90,
  });

  const handleGeneratePlan = async () => {
    const validation = validate();
    if (validation) {
      setError(validation);
      setSuccess(null);
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.createExamPlan(buildPayload());
      if (res.success && res.plan) {
        setSelectedPlan(res.plan);
        setPlans((prev) => [res.plan, ...prev.filter((p) => p.id !== res.plan.id)]);
        setPlanTitle(res.plan.title);
        setSuccess('Exam plan generated and saved successfully.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleUpdatePlan = async () => {
    if (!selectedPlan) return;
    const validation = validate();
    if (validation) {
      setError(validation);
      setSuccess(null);
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.updateExamPlan(selectedPlan.id, buildPayload());
      if (res.success && res.plan) {
        setSelectedPlan(res.plan);
        setPlans((prev) => prev.map((p) => (p.id === res.plan.id ? res.plan : p)));
        setPlanTitle(res.plan.title);
        setSuccess('Exam plan updated successfully.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleStartNewPlan = () => {
    setSelectedPlan(null);
    setPlanTitle('');
    setError(null);
    setSuccess(null);
  };

  const handleOpenPlan = (plan) => {
    setSelectedPlan(plan);
    setPlanTitle(plan.title);
    setSelectedBookId(plan.bookId);
    setAssessmentType(plan.assessmentType === 'final' ? 'final' : 'midterm');
    setMidtermMode(plan.selectionMode === 'cutoff' ? 'cutoff' : 'specific');
    setTotalMarks(plan.totalMarks);
    setMcqMarks(plan.sectionMarks?.mcq ?? 0);
    setShortMarks(plan.sectionMarks?.short_answer ?? 0);
    setLongMarks(plan.sectionMarks?.long_answer ?? 0);
    setMarksPerQuestion({ ...DEFAULT_MARKS_PER_QUESTION, ...(plan.marksPerQuestion || {}) });
    setDurationMinutes(plan.durationMinutes || 90);
    setSpecificChapters((plan.chapters || []).map((c) => Number(c.chapterNumber)));
    setChapterWeights(
      Object.fromEntries((plan.chapters || []).map((c) => [Number(c.chapterNumber), c.weightage || 1]))
    );
    if (plan.assessmentType !== 'final' && plan.chapters?.length) {
      setCutoff(Math.max(...plan.chapters.map((c) => Number(c.chapterNumber))));
    }
    setError(null);
    setSuccess(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeletePlan = async (plan) => {
    if (!confirm(`Delete the exam plan "${plan.title}"?`)) return;
    try {
      const res = await api.deleteExamPlan(plan.id);
      if (res.success) {
        setPlans((prev) => prev.filter((p) => p.id !== plan.id));
        if (selectedPlan?.id === plan.id) setSelectedPlan(null);
        setSuccess('Exam plan deleted.');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGeneratePaperFromPlan = () => {
    if (!selectedPlan) return;
    const planBook = books.find((b) => b.id === selectedPlan.bookId);
    onStartPlannerExam({
      book:
        planBook ||
        {
          id: selectedPlan.bookId,
          title: selectedPlan.bookTitle,
          className: selectedPlan.className,
          subject: selectedPlan.subject,
          boardName: selectedPlan.boardName,
          chapters: (selectedPlan.chapters || []).map((c) => ({
            chapterNumber: c.chapterNumber,
            title: c.title,
          })),
        },
      chapters: (selectedPlan.chapters || []).map((c) => c.chapterNumber),
      examType: selectedPlan.examType,
      totalMarks: selectedPlan.totalMarks,
      durationMinutes: selectedPlan.durationMinutes,
      questionCounts: selectedPlan.questionCounts,
    });
  };

  const setBalancedTotal = () => setTotalMarks(sumMarks);

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-slate-500 flex flex-col items-center gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-brand-500" />
        <span>Loading planner data...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-2 text-xs font-semibold text-purple-200 mb-2">
          <CalendarDays className="w-4 h-4" />
          <span>Curriculum Cutoff & Weighting Matrix</span>
        </div>
        <h2 className="text-xl font-black">Midterm & Full-Book Examination Planner</h2>
        <p className="text-xs text-purple-200 mt-1 max-w-xl">
          Build a saved exam blueprint with chapter coverage, mark allocation, and question distribution. Generate the
          paper later from the saved plan.
        </p>
      </div>

      {/* Notices */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-xs text-emerald-800">
          <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Empty library */}
      {books.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No textbooks in your library</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Add a textbook to your library before you can build an examination plan.
          </p>
          <button
            onClick={onOpenAddBook}
            className="mt-4 px-4 py-2 text-xs font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700 inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Book</span>
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column: Plan Config */}
            <div className="md:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                <h3 className="text-sm font-bold text-slate-900 border-b pb-2">1. Select Textbook & Term Cutoff</h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Textbook</label>
                  <select
                    value={selectedBookId}
                    onChange={(e) => handleBookChange(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500"
                  >
                    {books.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title} ({b.className} - {b.subject})
                      </option>
                    ))}
                  </select>

                  {currentBook && (
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 block">Subject</span>
                        <span className="font-bold text-slate-800">{currentBook.subject}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 block">Class</span>
                        <span className="font-bold text-slate-800">{currentBook.className}</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 col-span-2">
                        <span className="text-slate-500 block">Board</span>
                        <span className="font-bold text-slate-800 truncate block">{currentBook.boardName}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => setAssessmentType('midterm')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      assessmentType === 'midterm'
                        ? 'border-purple-600 bg-purple-50 text-purple-950 font-bold'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <span className="text-xs block">Midterm Examination</span>
                    <span className="text-[11px] text-slate-500 font-normal">Custom chapter range cutoff</span>
                  </button>

                  <button
                    onClick={() => setAssessmentType('final')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      assessmentType === 'final'
                        ? 'border-purple-600 bg-purple-50 text-purple-950 font-bold'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <span className="text-xs block">Final / Full-Book Exam</span>
                    <span className="text-[11px] text-slate-500 font-normal">All textbook chapters included</span>
                  </button>
                </div>

                {assessmentType === 'midterm' && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setMidtermMode('cutoff')}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border ${
                          midtermMode === 'cutoff'
                            ? 'border-purple-500 bg-purple-50 text-purple-800'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        Chapter cutoff
                      </button>
                      <button
                        onClick={() => setMidtermMode('specific')}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border ${
                          midtermMode === 'specific'
                            ? 'border-purple-500 bg-purple-50 text-purple-800'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        Specific chapters
                      </button>
                    </div>

                    {midtermMode === 'cutoff' ? (
                      <div>
                        <div className="flex justify-between items-center mb-1 text-xs">
                          <span className="font-semibold text-slate-700">Midterm Chapter Cutoff</span>
                          <span className="font-bold text-purple-700">Chapters 1 through {cutoff}</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max={allChapters.length ? Math.max(...allChapters.map((c) => Number(c.chapterNumber))) : 9}
                          value={cutoff}
                          onChange={(e) => setCutoff(parseInt(e.target.value, 10))}
                          className="w-full accent-purple-600"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                        {allChapters.map((ch) => {
                          const num = Number(ch.chapterNumber);
                          const checked = specificChapters.includes(num);
                          return (
                            <label
                              key={ch.id || num}
                              className={`flex items-start gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                                checked
                                  ? 'border-purple-400 bg-purple-50/60 text-purple-950 font-semibold'
                                  : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleToggleChapter(num)}
                                className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
                              />
                              <span className="min-w-0">
                                <span className="font-bold text-purple-700">Ch {num}: </span>
                                {ch.title}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <span className="font-bold text-slate-800">
                    Included chapters ({includedChapters.length})
                  </span>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {includedChapters.length === 0 ? (
                      <span className="text-rose-600 font-semibold">No chapters selected.</span>
                    ) : (
                      includedChapters.map((c) => (
                        <span
                          key={c.chapterNumber}
                          className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-700"
                        >
                          Ch {c.chapterNumber}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-sm font-bold text-slate-900">2. Term Marks Allocation</h3>
                  <div
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1.5 ${
                      isBalanced
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}
                  >
                    {isBalanced ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    <span>{sumMarks} / {Number(totalMarks) || 0} Marks</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Total Marks</label>
                    <input
                      type="number"
                      min="1"
                      value={totalMarks}
                      onChange={(e) => setTotalMarks(parseInt(e.target.value, 10) || 0)}
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Section A (MCQs)</label>
                    <input
                      type="number"
                      min="0"
                      value={mcqMarks}
                      onChange={(e) => setMcqMarks(parseInt(e.target.value, 10) || 0)}
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Section B (Short Qs)</label>
                    <input
                      type="number"
                      min="0"
                      value={shortMarks}
                      onChange={(e) => setShortMarks(parseInt(e.target.value, 10) || 0)}
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Section C (Long Qs)</label>
                    <input
                      type="number"
                      min="0"
                      value={longMarks}
                      onChange={(e) => setLongMarks(parseInt(e.target.value, 10) || 0)}
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg text-center font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Marks / MCQ</label>
                    <input
                      type="number"
                      min="1"
                      value={marksPerQuestion.mcq}
                      onChange={(e) =>
                        setMarksPerQuestion({ ...marksPerQuestion, mcq: parseInt(e.target.value, 10) || 1 })
                      }
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Marks / Short Q</label>
                    <input
                      type="number"
                      min="1"
                      value={marksPerQuestion.short_answer}
                      onChange={(e) =>
                        setMarksPerQuestion({
                          ...marksPerQuestion,
                          short_answer: parseInt(e.target.value, 10) || 1,
                        })
                      }
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Marks / Long Q</label>
                    <input
                      type="number"
                      min="1"
                      value={marksPerQuestion.long_answer}
                      onChange={(e) =>
                        setMarksPerQuestion({
                          ...marksPerQuestion,
                          long_answer: parseInt(e.target.value, 10) || 1,
                        })
                      }
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Duration (mins)</label>
                    <input
                      type="number"
                      min="15"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10) || 90)}
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg text-center font-bold"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-600">
                    Question distribution: <span className="font-bold">{questionCounts.mcq}</span> MCQs,{' '}
                    <span className="font-bold">{questionCounts.short_answer}</span> short,{' '}
                    <span className="font-bold">{questionCounts.long_answer}</span> long
                    {Number.isInteger(totalQuestions) ? ` (${totalQuestions} total)` : ' (adjust marks for whole questions)'}
                  </div>
                  {!isBalanced && (
                    <button
                      type="button"
                      onClick={setBalancedTotal}
                      className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg font-bold text-amber-900 text-[11px]"
                    >
                      Set total to {sumMarks}
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b pb-2">3. Chapter-wise Weightage</h3>
                <p className="text-[11px] text-slate-500">
                  Give chapters relative weight. Marks and questions are distributed proportionally across the selected
                  chapters.
                </p>
                {includedChapters.length === 0 ? (
                  <p className="text-xs text-rose-600 font-semibold">Select chapters to configure weightage.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {includedChapters.map((ch) => {
                      const num = Number(ch.chapterNumber);
                      const weight = chapterWeights[num] ?? 1;
                      return (
                        <div
                          key={ch.id || num}
                          className="flex items-center justify-between gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200"
                        >
                          <span className="text-xs text-slate-700 truncate">
                            <span className="font-bold text-purple-700">Ch {num}:</span> {ch.title}
                          </span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <Percent className="w-3.5 h-3.5 text-slate-400" />
                            <input
                              type="number"
                              min="0"
                              value={weight}
                              onChange={(e) => handleWeightChange(num, e.target.value)}
                              className="w-16 p-1.5 border border-slate-300 rounded-lg text-center font-bold text-xs bg-white"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Summary */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between h-fit md:sticky md:top-20">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b pb-2">Planner Summary</h3>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Subject:</span>
                    <span className="font-bold text-right">{currentBook?.subject || '—'}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Class:</span>
                    <span className="font-bold text-right">{currentBook?.className || '—'}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Assessment:</span>
                    <span className="font-bold capitalize text-right">
                      {assessmentType === 'final' ? 'Final / Full-Book' : 'Midterm'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Scope:</span>
                    <span className="font-bold text-right">{includedChapters.length} Chapters</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Questions:</span>
                    <span className="font-bold text-right">
                      {Number.isInteger(totalQuestions) ? totalQuestions : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500">Total Marks:</span>
                    <span className="font-bold text-purple-700">{sumMarks} Marks</span>
                  </div>
                </div>

                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-[11px] text-purple-900">
                  <span className="font-bold block mb-1">Blueprint Structure</span>
                  <span>
                    MCQs ({mcqMarks}M) + Short Answers ({shortMarks}M) + Long Questions ({longMarks}M) = {sumMarks}M.
                  </span>
                </div>

                {liveError && (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900">
                    {liveError}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Plan Name (optional)</label>
                  <input
                    type="text"
                    value={planTitle}
                    onChange={(e) => setPlanTitle(e.target.value)}
                    placeholder={
                      currentBook ? `${currentBook.className} ${currentBook.subject} Exam Plan` : 'Exam plan name'
                    }
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="space-y-2 mt-6">
                {selectedPlan ? (
                  <>
                    <button
                      onClick={handleUpdatePlan}
                      disabled={busy}
                      className="w-full py-3 px-4 rounded-xl font-bold text-xs text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 shadow-sm transition-all flex items-center justify-center gap-1.5"
                    >
                      {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      <span>{busy ? 'Saving changes...' : 'Update Saved Plan'}</span>
                    </button>
                    <button
                      onClick={handleStartNewPlan}
                      className="w-full py-2 px-4 rounded-xl font-semibold text-xs text-slate-600 border border-slate-200 hover:bg-slate-50 flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Start a New Plan</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleGeneratePlan}
                    disabled={busy}
                    className="w-full py-3 px-4 rounded-xl font-bold text-xs text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 shadow-sm transition-all flex items-center justify-center gap-1.5"
                  >
                    {busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    <span>{busy ? 'Generating plan...' : 'Generate Plan'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Generated / selected plan */}
          {selectedPlan && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ClipboardList className="w-4 h-4 text-purple-600" />
                    <h3 className="text-sm font-bold text-slate-900 truncate">{selectedPlan.title}</h3>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${statusBadge('open')}`}>
                      SAVED
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {selectedPlan.className} • {selectedPlan.subject} • {selectedPlan.boardName} •{' '}
                    {selectedPlan.examType}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={handleGeneratePaperFromPlan}
                    className="px-3 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Paper from This Plan</span>
                  </button>
                  <button
                    onClick={() => handleDeletePlan(selectedPlan)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                    title="Delete plan"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-purple-50 border border-purple-200">
                    <span className="text-[10px] uppercase font-bold text-purple-700 block">Total Marks</span>
                    <span className="text-lg font-black text-purple-900">{selectedPlan.totalMarks}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Chapters</span>
                    <span className="text-lg font-black text-slate-900">{selectedPlan.chapters.length}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Questions</span>
                    <span className="text-lg font-black text-slate-900">
                      {selectedPlan.questionCounts.mcq +
                        selectedPlan.questionCounts.short_answer +
                        selectedPlan.questionCounts.long_answer}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Duration</span>
                    <span className="text-lg font-black text-slate-900">{selectedPlan.durationMinutes} min</span>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    Question Type Distribution
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
                        <tr>
                          <th className="px-4 py-2.5">Section</th>
                          <th className="px-4 py-2.5">Marks Each</th>
                          <th className="px-4 py-2.5">Questions</th>
                          <th className="px-4 py-2.5 text-right">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        <tr>
                          <td className="px-4 py-2.5 font-semibold">Section A — MCQs</td>
                          <td className="px-4 py-2.5">{selectedPlan.marksPerQuestion.mcq}</td>
                          <td className="px-4 py-2.5">{selectedPlan.questionCounts.mcq}</td>
                          <td className="px-4 py-2.5 text-right font-bold">{selectedPlan.sectionMarks.mcq}</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2.5 font-semibold">Section B — Short Answers</td>
                          <td className="px-4 py-2.5">{selectedPlan.marksPerQuestion.short_answer}</td>
                          <td className="px-4 py-2.5">{selectedPlan.questionCounts.short_answer}</td>
                          <td className="px-4 py-2.5 text-right font-bold">
                            {selectedPlan.sectionMarks.short_answer}
                          </td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2.5 font-semibold">Section C — Long Questions</td>
                          <td className="px-4 py-2.5">{selectedPlan.marksPerQuestion.long_answer}</td>
                          <td className="px-4 py-2.5">{selectedPlan.questionCounts.long_answer}</td>
                          <td className="px-4 py-2.5 text-right font-bold">
                            {selectedPlan.sectionMarks.long_answer}
                          </td>
                        </tr>
                      </tbody>
                      <tfoot className="bg-slate-50">
                        <tr>
                          <td colSpan="3" className="px-4 py-2.5 text-right font-bold text-slate-700">
                            Total
                          </td>
                          <td className="px-4 py-2.5 text-right font-black text-purple-700">
                            {selectedPlan.totalMarks}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-500" />
                    Chapter-wise Blueprint
                  </h4>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-500 uppercase font-semibold">
                        <tr>
                          <th className="px-4 py-2.5">Chapter</th>
                          <th className="px-4 py-2.5">Weightage</th>
                          <th className="px-4 py-2.5">Marks</th>
                          <th className="px-4 py-2.5">MCQs</th>
                          <th className="px-4 py-2.5">Short</th>
                          <th className="px-4 py-2.5">Long</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {selectedPlan.chapters.map((ch) => (
                          <tr key={ch.chapterNumber} className="hover:bg-slate-50/70">
                            <td className="px-4 py-2.5">
                              <span className="font-bold text-purple-700">Ch {ch.chapterNumber}:</span>{' '}
                              <span className="text-slate-700">{ch.title}</span>
                            </td>
                            <td className="px-4 py-2.5">{ch.weightage}%</td>
                            <td className="px-4 py-2.5 font-bold">{ch.marks}</td>
                            <td className="px-4 py-2.5">{ch.questionCounts.mcq}</td>
                            <td className="px-4 py-2.5">{ch.questionCounts.short_answer}</td>
                            <td className="px-4 py-2.5">{ch.questionCounts.long_answer}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Saved plans */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Saved Exam Plans</h3>
                <p className="text-xs text-slate-500">Open a plan to edit it or generate its paper later.</p>
              </div>
              <span className="text-xs font-bold text-slate-500">{plans.length}</span>
            </div>
            {plans.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No exam plans saved yet. Generate a plan above to get started.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900 truncate">{plan.title}</h4>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                          {plan.assessmentType === 'final' ? 'FINAL' : 'MIDTERM'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {plan.className} • {plan.subject} • {plan.chapters.length} chapters • {plan.totalMarks} marks •{' '}
                        {new Date(plan.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleOpenPlan(plan)}
                        className="px-3 py-1.5 text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 rounded-lg flex items-center gap-1.5"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                        <span>Open</span>
                      </button>
                      <button
                        onClick={() => handleDeletePlan(plan)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                        title="Delete plan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
