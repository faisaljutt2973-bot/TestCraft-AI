import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  BookOpen,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Sliders,
  FileText,
  Clock,
  School,
  Check,
  RotateCcw,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const TestGenerator = ({ preselectedBook, preselectedChapters, preselectedConfig = {}, onTestGenerated }) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [books, setBooks] = useState([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [booksError, setBooksError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null);
  const generationLock = useRef(false);

  // Form State
  const [selectedBookId, setSelectedBookId] = useState(preselectedBook?.id || '');
  const [selectedChapters, setSelectedChapters] = useState(preselectedChapters || []);

  const [examType, setExamType] = useState('Chapter-wise test');
  const [title, setTitle] = useState('');
  const [schoolName, setSchoolName] = useState(user?.school || '');
  const [examinationHeading, setExaminationHeading] = useState('MIDTERM EXAMINATION - 2026');
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [totalMarks, setTotalMarks] = useState(50);
  const [difficulty, setDifficulty] = useState('Mixed');
  const [language, setLanguage] = useState('English');
  const [passingMarks, setPassingMarks] = useState(20);

  // Question Type Counts
  const [questionCounts, setQuestionCounts] = useState({
    mcq: 10,
    short_answer: 5,
    long_answer: 2,
    fill_blanks: 0,
    true_false: 0,
    numerical: 0,
  });

  // Marks per question type
  const [marksPerType, setMarksPerType] = useState({
    mcq: 1,
    short_answer: 4,
    long_answer: 10,
    fill_blanks: 1,
    true_false: 1,
    numerical: 5,
  });

  const loadBooks = async () => {
    try {
      setLoadingBooks(true);
      setBooksError(null);
      const res = await api.getBooks();
      if (res.success) {
        setBooks(res.books);
        if (!selectedBookId && res.books.length > 0) {
          setSelectedBookId(res.books[0].id);
          setSelectedChapters((res.books[0].chapters || []).map((c) => c.chapterNumber));
        }
      }
    } catch (err) {
      console.error('Failed to load books:', err);
      setBooksError(err.message || 'Could not load your textbook library.');
    } finally {
      setLoadingBooks(false);
    }
  };

  useEffect(() => {
    loadBooks();
  }, []);

  useEffect(() => {
    if (user?.school && !schoolName.trim()) setSchoolName(user.school);
  }, [user?.school]);

  useEffect(() => {
    if (!generating) {
      setElapsedSeconds(0);
      return undefined;
    }
    const timer = setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000);
    return () => clearInterval(timer);
  }, [generating]);

  const currentBook = books.find((b) => b.id === selectedBookId) || preselectedBook;

  useEffect(() => {
    if (currentBook) {
      if (!title) {
        setTitle(`${currentBook.className} ${currentBook.subject} - ${examType}`);
      }
      setExaminationHeading(`${examType.toUpperCase()} - 2026`);
    }
  }, [selectedBookId, examType, currentBook]);

  // Apply the configuration handed off from the Exam Planner and jump to review
  useEffect(() => {
    if (!preselectedConfig || Object.keys(preselectedConfig).length === 0) return;

    if (preselectedConfig.examType) setExamType(preselectedConfig.examType);
    if (preselectedConfig.totalMarks) setTotalMarks(parseInt(preselectedConfig.totalMarks, 10) || 0);
    if (preselectedConfig.durationMinutes) setDurationMinutes(parseInt(preselectedConfig.durationMinutes, 10) || 60);
    if (preselectedConfig.questionCounts) {
      setQuestionCounts((prev) => ({ ...prev, ...preselectedConfig.questionCounts }));
    }
    setTitle('');
    setStep(6);
  }, [preselectedConfig]);

  // Compute live allocated marks
  const computedTotal = Object.keys(questionCounts).reduce((acc, key) => {
    return acc + (parseInt(questionCounts[key], 10) || 0) * (parseInt(marksPerType[key], 10) || 1);
  }, 0);

  const isMarksBalanced = computedTotal === parseInt(totalMarks, 10);

  const handleBookChange = (id) => {
    setSelectedBookId(id);
    const b = books.find((x) => x.id === id);
    if (b) {
      setSelectedChapters((b.chapters || []).map((c) => c.chapterNumber));
      setTitle(`${b.className} ${b.subject} - ${examType}`);
    }
  };

  const handleToggleChapter = (chNum) => {
    if (selectedChapters.includes(chNum)) {
      setSelectedChapters(selectedChapters.filter((n) => n !== chNum));
    } else {
      setSelectedChapters([...selectedChapters, chNum]);
    }
  };

  const handleSelectAllChapters = () => {
    if (currentBook) {
      setSelectedChapters((currentBook.chapters || []).map((c) => c.chapterNumber));
    }
  };

  const handleAutoBalanceMarks = () => {
    setTotalMarks(computedTotal);
  };

  const handleGenerate = async () => {
    if (generationLock.current) return;

    if (!currentBook) {
      setErrorMessage('Please select a textbook before generating a paper.');
      return;
    }

    if (!isMarksBalanced) {
      setErrorMessage(`Cannot generate paper: Questions sum up to ${computedTotal} marks, but total marks is set to ${totalMarks}. Please balance marks first.`);
      return;
    }

    if (selectedChapters.length === 0) {
      setErrorMessage('Please select at least one syllabus chapter.');
      return;
    }

    generationLock.current = true;

    try {
      setGenerating(true);
      setErrorMessage(null);

      const payload = {
        title: title.trim(),
        schoolName: schoolName.trim(),
        examinationHeading: examinationHeading.trim(),
        bookId: currentBook.id,
        selectedChapters,
        examType,
        durationMinutes: parseInt(durationMinutes, 10),
        totalMarks: parseInt(totalMarks, 10),
        passingMarks: parseInt(passingMarks, 10),
        difficulty,
        language,
        questionTypeCounts: questionCounts,
        marksPerQuestion: marksPerType,
      };

      const res = await api.generateTest(payload);
      if (res.success && res.testPaper) {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
        });
        onTestGenerated(res.testPaper.id);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Generation failed. Please try again.');
    } finally {
      generationLock.current = false;
      setGenerating(false);
    }
  };

  const examTypes = [
    'Chapter-wise test',
    'Multiple-chapter test',
    'Monthly test',
    'Weekly quiz',
    'Midterm examination',
    'Final examination',
    'Full-book examination',
    'Practice test',
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Wizard Step Progress Indicator */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="flex items-center justify-between gap-1 sm:gap-2">
          {[
            { num: 1, label: 'Syllabus' },
            { num: 2, label: 'Exam Type' },
            { num: 3, label: 'Settings' },
            { num: 4, label: 'Question Types' },
            { num: 5, label: 'Marks Balancer' },
            { num: 6, label: 'Review & Run' },
          ].map((s) => (
            <div key={s.num} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
                  step === s.num
                    ? 'bg-brand-600 text-white ring-4 ring-brand-100'
                    : step > s.num
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {step > s.num ? <Check className="w-4 h-4" /> : s.num}
              </div>
              <span className={`text-xs font-semibold hidden xl:inline whitespace-nowrap ${step === s.num ? 'text-brand-900' : 'text-slate-500'}`}>
                {s.label}
              </span>
              {s.num < 6 && <div className="hidden sm:block w-6 lg:w-10 h-0.5 bg-slate-200 mx-0.5" />}
            </div>
          ))}
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-xs text-rose-800">
          <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* STEP 1: SYLLABUS & BOOK SELECTION */}
      {step === 1 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">Step 1: Select Syllabus & Chapters</h3>
            <p className="text-xs text-slate-500">Pick the target curriculum textbook and define chapter coverage.</p>
          </div>

          {booksError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs text-rose-800">
              <span>{booksError}</span>
              <button
                type="button"
                onClick={loadBooks}
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700"
              >
                Retry
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Selected Textbook</label>
            <select
              value={selectedBookId}
              onChange={(e) => handleBookChange(e.target.value)}
              disabled={loadingBooks || books.length === 0}
              className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
            >
              {loadingBooks && <option value="">Loading textbooks…</option>}
              {!loadingBooks && books.length === 0 && <option value="">No textbooks available</option>}
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title} ({b.className} - {b.subject} | {b.boardName})
                </option>
              ))}
            </select>
            {!loadingBooks && books.length === 0 && !booksError && (
              <p className="mt-1.5 text-[11px] text-slate-500">
                Add a textbook from the Textbook Library first, then return here to generate a paper.
              </p>
            )}
          </div>

          {currentBook && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700">
                  Select Included Chapters ({selectedChapters.length} Selected)
                </span>
                <button
                  type="button"
                  onClick={handleSelectAllChapters}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-800"
                >
                  Select All
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {(currentBook.chapters || []).map((ch) => {
                  const isChecked = selectedChapters.includes(ch.chapterNumber);
                  return (
                    <label
                      key={ch.id}
                      className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        isChecked
                          ? 'border-brand-400 bg-brand-50/50 text-brand-950 font-semibold'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleChapter(ch.chapterNumber)}
                        className="mt-0.5 rounded text-brand-600 focus:ring-brand-500"
                      />
                      <div className="min-w-0">
                        <span className="font-bold text-brand-700">Ch {ch.chapterNumber}: </span>
                        <span>{ch.title}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: EXAM TYPE */}
      {step === 2 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">Step 2: Choose Examination Type</h3>
            <p className="text-xs text-slate-500">Select the assessment scope and purpose.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {examTypes.map((type) => (
              <div
                key={type}
                onClick={() => setExamType(type)}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                  examType === type
                    ? 'border-brand-500 bg-brand-50/60 text-brand-900 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div>
                  <span className="text-xs font-bold block">{type}</span>
                  <span className="text-[11px] text-slate-500">
                    {type.includes('Midterm')
                      ? 'Structured cutoff exam for 1st term'
                      : type.includes('Final') || type.includes('Full-book')
                      ? 'Comprehensive end-of-year assessment'
                      : 'Focused unit and chapter evaluation'}
                  </span>
                </div>
                {examType === type && <CheckCircle2 className="w-5 h-5 text-brand-600" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 3: PAPER CONFIGURATION */}
      {step === 3 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">Step 3: Paper Metadata & Duration</h3>
            <p className="text-xs text-slate-500">Configure institutional headers, duration, and passing criteria.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Paper Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">School / Institution Name</label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="Your school or institution"
                maxLength={120}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-500">Prefilled from your profile. You can adjust it for this paper.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Examination Heading</label>
              <input
                type="text"
                value={examinationHeading}
                onChange={(e) => setExaminationHeading(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Total Marks</label>
              <input
                type="number"
                value={totalMarks}
                onChange={(e) => setTotalMarks(parseInt(e.target.value, 10) || 0)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Time Allowed (Minutes)</label>
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10) || 60)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Difficulty Level</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
              >
                <option value="Mixed">Mixed (Standard Board Ratio)</option>
                <option value="Easy">Easy (Foundational)</option>
                <option value="Medium">Medium (Conceptual)</option>
                <option value="Hard">Hard (High Analytical)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4 & 5: QUESTION DISTRIBUTION & MARKS BALANCER */}
      {(step === 4 || step === 5) && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {step === 4 ? 'Step 4: Select Question Types' : 'Step 5: Live Marks Balancer'}
              </h3>
              <p className="text-xs text-slate-500">
                Specify question quantities and marks weights. Total must equal {totalMarks} marks.
              </p>
            </div>

            {/* Live Marks Balance Pill */}
            <div
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                isMarksBalanced
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}
            >
              {isMarksBalanced ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}
              <span>
                Allocated: {computedTotal} / {totalMarks} M
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { key: 'mcq', label: 'Multiple Choice Questions (MCQs)', defaultMarks: 1 },
              { key: 'short_answer', label: 'Short Answer Questions', defaultMarks: 4 },
              { key: 'long_answer', label: 'Long / Comprehensive Questions', defaultMarks: 10 },
              { key: 'fill_blanks', label: 'Fill in the Blanks', defaultMarks: 1 },
              { key: 'true_false', label: 'True / False Statements', defaultMarks: 1 },
              { key: 'numerical', label: 'Numerical Problems / Calculations', defaultMarks: 5 },
            ].map((item) => (
              <div
                key={item.key}
                className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <span className="font-bold text-slate-800 block">{item.label}</span>
                  <span className="text-[11px] text-slate-500">
                    Subtotal: {(questionCounts[item.key] || 0) * (marksPerType[item.key] || item.defaultMarks)} Marks
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 font-medium">Quantity:</span>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={questionCounts[item.key] || 0}
                      onChange={(e) =>
                        setQuestionCounts({
                          ...questionCounts,
                          [item.key]: parseInt(e.target.value, 10) || 0,
                        })
                      }
                      className="w-16 p-1.5 border border-slate-300 rounded-lg text-center font-bold text-slate-800 bg-white"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 font-medium">Marks Each:</span>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={marksPerType[item.key] || item.defaultMarks}
                      onChange={(e) =>
                        setMarksPerType({
                          ...marksPerType,
                          [item.key]: parseInt(e.target.value, 10) || 1,
                        })
                      }
                      className="w-14 p-1.5 border border-slate-300 rounded-lg text-center font-bold text-slate-800 bg-white"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {!isMarksBalanced && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
              <span>Marks difference: {Math.abs(computedTotal - totalMarks)} Marks mismatch.</span>
              <button
                type="button"
                onClick={handleAutoBalanceMarks}
                className="px-3 py-1 bg-amber-200 hover:bg-amber-300 rounded-lg font-bold text-amber-900 text-xs"
              >
                Auto-Set Total Marks to {computedTotal}
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 6: REVIEW & RUN GENERATION */}
      {step === 6 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">Step 6: Review Configuration & Generate</h3>
            <p className="text-xs text-slate-500">Verify assessment summary before triggering curriculum AI grounding.</p>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-xs text-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-500">Textbook:</span>
              <span className="font-bold text-slate-900">{currentBook?.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Class & Subject:</span>
              <span className="font-bold">{currentBook?.className} - {currentBook?.subject}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Exam Type:</span>
              <span className="font-bold text-brand-700">{examType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Chapters Included:</span>
              <span className="font-bold">{selectedChapters.length} Chapters</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Total Marks:</span>
              <span className="font-bold text-emerald-700">{totalMarks} Marks ({durationMinutes} Mins)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Questions Breakdown:</span>
              <span>
                {questionCounts.mcq} MCQs, {questionCounts.short_answer} Short, {questionCounts.long_answer} Long
              </span>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleGenerate}
              disabled={generating || !isMarksBalanced}
              className="w-full py-3.5 px-6 rounded-xl font-extrabold text-sm text-white bg-gradient-to-r from-brand-600 via-indigo-600 to-brand-700 hover:from-brand-700 hover:to-indigo-800 shadow-lg shadow-brand-600/30 transition-all flex items-center justify-center gap-2 hover:scale-[1.01] disabled:opacity-50"
            >
              {generating ? (
                <>
                  <Sparkles className="w-5 h-5 animate-spin" />
                  <span>Generating Exam Paper… {elapsedSeconds > 0 ? `(${elapsedSeconds}s)` : ''}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Generate Examination Paper Now</span>
                </>
              )}
            </button>
            {generating && (
              <p className="mt-2 text-center text-[11px] text-slate-500">
                This usually takes 10–30 seconds. Please keep this tab open.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center pt-2">
        <button
          type="button"
          disabled={step === 1}
          onClick={() => setStep(step - 1)}
          className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-white rounded-xl border border-slate-200 disabled:opacity-30 transition-colors flex items-center gap-1.5"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Previous Step</span>
        </button>

        {step < 6 ? (
          <button
            type="button"
            onClick={() => setStep(step + 1)}
            className="px-5 py-2 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow transition-colors flex items-center gap-1.5"
          >
            <span>Next Step</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
};
