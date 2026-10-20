import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Printer,
  Download,
  FileText,
  Key,
  Edit2,
  RefreshCw,
  Plus,
  Trash2,
  Save,
  CheckCircle,
  Eye,
  Sliders,
  ChevronUp,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { api } from '../services/api';
import { Modal } from '../components/Modal';

export const TestEditor = ({ testId, onBack }) => {
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('student'); // 'student' | 'answer-key'
  const [editingQuestion, setEditingQuestion] = useState(null); // { sectionId, question }
  const [regeneratingQId, setRegeneratingQId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Question Bank Swap Modal
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [swapTarget, setSwapTarget] = useState(null); // { sectionId, questionId }
  const [bankQuestions, setBankQuestions] = useState([]);
  const [loadingBank, setLoadingBank] = useState(false);

  const fetchTest = async () => {
    try {
      setLoading(true);
      const res = await api.getTestById(testId);
      if (res.success && res.test) {
        setTest(res.test);
      }
    } catch (err) {
      console.error('Failed to load test paper:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTest();
  }, [testId]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadDocx = () => {
    window.open(api.getExportUrl(testId, viewMode, 'docx'), '_blank');
  };

  const handleRegenerateSingleQuestion = async (sectionId, questionId) => {
    try {
      setRegeneratingQId(questionId);
      const res = await api.regenerateQuestion(testId, sectionId, questionId);
      if (res.success && res.test) {
        setTest(res.test);
      }
    } catch (err) {
      alert(`Regeneration failed: ${err.message}`);
    } finally {
      setRegeneratingQId(null);
    }
  };

  const handleDeleteQuestion = (sectionId, questionId) => {
    if (!confirm('Are you sure you want to remove this question?')) return;
    const updatedSections = (test.sections || []).map((sec) => {
      if (sec.sectionId === sectionId) {
        const filtered = sec.questions.filter((q) => q.id !== questionId);
        const sectionMarks = filtered.reduce((acc, q) => acc + (q.marks || 1), 0);
        return { ...sec, questions: filtered, marks: sectionMarks };
      }
      return sec;
    });

    const totalMarks = updatedSections.reduce((acc, sec) => acc + sec.marks, 0);
    setTest({ ...test, sections: updatedSections, totalMarks });
  };

  const handleOpenBankSwap = async (sectionId, questionId) => {
    setSwapTarget({ sectionId, questionId });
    setIsBankModalOpen(true);
    try {
      setLoadingBank(true);
      const res = await api.getQuestions({ subject: test.subject });
      if (res.success) {
        setBankQuestions(res.questions);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBank(false);
    }
  };

  const handleSelectBankQuestion = (bankQ) => {
    if (!swapTarget) return;
    const updatedSections = (test.sections || []).map((sec) => {
      if (sec.sectionId === swapTarget.sectionId) {
        const updatedQs = sec.questions.map((q) => {
          if (q.id === swapTarget.questionId) {
            return {
              ...bankQ,
              id: q.id,
              number: q.number,
              marks: q.marks,
            };
          }
          return q;
        });
        return { ...sec, questions: updatedQs };
      }
      return sec;
    });

    setTest({ ...test, sections: updatedSections });
    setIsBankModalOpen(false);
    setSwapTarget(null);
  };

  const handleSaveEdits = async () => {
    try {
      setSaving(true);
      const res = await api.updateTest(test.id, {
        title: test.title,
        schoolName: test.schoolName,
        examinationHeading: test.examinationHeading,
        durationMinutes: test.durationMinutes,
        totalMarks: test.totalMarks,
        instructions: test.instructions,
        sections: test.sections,
      });
      if (res.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-xs text-slate-500">Loading exam assessment...</div>;
  }

  if (!test) {
    return (
      <div className="bg-white p-8 rounded-2xl text-center">
        <p className="text-sm font-bold text-slate-800">Test paper not found.</p>
        <button onClick={onBack} className="mt-4 text-xs font-bold text-brand-600">
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Header - Hidden during print */}
      <div className="no-print bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            title="Back to Tests"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-slate-900 leading-tight break-words">{test.title}</h2>
            <p className="text-xs text-slate-500">
              {test.className} • {test.subject} • Total Marks: {test.totalMarks} ({test.durationMinutes} Mins)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setViewMode('student')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === 'student' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Student Paper</span>
            </button>
            <button
              onClick={() => setViewMode('answer-key')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === 'answer-key' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Key className="w-3.5 h-3.5 text-emerald-600" />
              <span>Teacher Answer Key</span>
            </button>
          </div>

          <button
            onClick={handleSaveEdits}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
          >
            {saveSuccess ? (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Saved!</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Edits</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownloadDocx}
            className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download DOCX</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Paper</span>
          </button>
        </div>
      </div>

      {/* PRINTABLE ASSESSMENT PAPER CONTAINER */}
      <div className="printable-paper bg-white rounded-2xl border border-slate-200 shadow-lg p-4 sm:p-8 lg:p-12 max-w-4xl mx-auto font-serif">
        {/* Institutional Header */}
        <div className="text-center border-b-2 border-slate-900 pb-4 mb-5">
          <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wide text-slate-950 font-sans">
            {test.schoolName || 'BEACONHOUSE SCHOOL SYSTEM'}
          </h1>
          <h2 className="text-sm sm:text-base font-bold text-slate-800 underline decoration-slate-400 mt-1 uppercase font-sans">
            {test.examinationHeading || test.title}
          </h2>
          <div className="text-xs text-slate-600 italic mt-1 font-sans">
            Curriculum: {test.boardName || 'National Textbook Board'}
          </div>
        </div>

        {/* Candidate Metadata Block */}
        <div className="border border-slate-300 rounded-lg p-3 text-xs mb-6 grid grid-cols-2 sm:grid-cols-4 gap-2 font-sans bg-slate-50/50 print:bg-transparent">
          <div>
            <strong>Student Name:</strong> _________________
          </div>
          <div>
            <strong>Roll No:</strong> _____________
          </div>
          <div>
            <strong>Class:</strong> {test.className}
          </div>
          <div>
            <strong>Date:</strong> _________________
          </div>
          <div>
            <strong>Subject:</strong> {test.subject}
          </div>
          <div>
            <strong>Max Marks:</strong> {test.totalMarks}
          </div>
          <div>
            <strong>Time Allowed:</strong> {test.durationMinutes} Mins
          </div>
          <div>
            <strong>Passing Marks:</strong> {test.passingMarks || Math.round(test.totalMarks * 0.4)}
          </div>
        </div>

        {/* General Instructions */}
        {test.instructions && test.instructions.length > 0 && (
          <div className="border border-slate-200 rounded-lg p-3 text-xs text-slate-700 mb-6 font-sans bg-slate-50 print:bg-transparent">
            <span className="font-bold block mb-1">General Instructions:</span>
            <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-slate-600">
              {test.instructions.map((inst, idx) => (
                <li key={idx}>{inst}</li>
              ))}
            </ol>
          </div>
        )}

        {/* Sections and Questions */}
        <div className="space-y-8">
          {(test.sections || []).map((sec) => (
            <div key={sec.sectionId} className="space-y-4">
              <div className="border-b-2 border-slate-800 pb-1.5 flex justify-between items-baseline font-sans">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">{sec.sectionTitle}</h3>
                  {sec.instructions && <p className="text-xs text-slate-500 italic mt-0.5">{sec.instructions}</p>}
                </div>
                <span className="text-xs font-bold text-slate-700">[Marks: {sec.marks}]</span>
              </div>

              {/* Questions List */}
              <div className="space-y-5">
                {(sec.questions || []).map((q) => (
                  <div key={q.id} className="group relative rounded-xl hover:bg-slate-50/80 p-2.5 transition-colors">
                    {/* Hover Toolbar (Hidden in Print) */}
                    <div className="no-print absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1 shadow-sm z-10">
                      <button
                        onClick={() => handleRegenerateSingleQuestion(sec.sectionId, q.id)}
                        disabled={regeneratingQId === q.id}
                        className="p-1 text-slate-500 hover:text-brand-600 rounded"
                        title="Regenerate this question with AI"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${regeneratingQId === q.id ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        onClick={() => handleOpenBankSwap(sec.sectionId, q.id)}
                        className="p-1 text-slate-500 hover:text-purple-600 rounded"
                        title="Swap with Question Bank"
                      >
                        <Layers className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(sec.sectionId, q.id)}
                        className="p-1 text-slate-500 hover:text-rose-600 rounded"
                        title="Delete question"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Question Header & Content */}
                    <div className="flex justify-between items-start gap-4">
                      <div className="text-[13.5px] leading-relaxed text-slate-900 flex-1">
                        <strong className="font-sans font-bold">Q{q.number}.</strong> {q.questionText}
                      </div>
                      <span className="text-xs font-bold text-slate-500 font-sans whitespace-nowrap">
                        ({q.marks} Mark{q.marks > 1 ? 's' : ''})
                      </span>
                    </div>

                    {/* MCQs Option Grid */}
                    {q.questionType === 'mcq' && q.options && (
                      <div className="grid grid-cols-2 gap-2 mt-2 pl-5 text-xs text-slate-800 font-sans">
                        {q.options.map((opt, oIdx) => (
                          <div
                            key={oIdx}
                            className={`p-1.5 rounded flex items-center gap-2 ${
                              viewMode === 'answer-key' && oIdx === Number(q.correctAnswer)
                                ? 'bg-emerald-50 border border-emerald-300 font-bold text-emerald-900'
                                : ''
                            }`}
                          >
                            <span className="font-bold">({String.fromCharCode(65 + oIdx)})</span>
                            <span>{opt}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* True / False layout */}
                    {q.questionType === 'true_false' && (
                      <div className="flex gap-6 mt-2 pl-5 text-xs font-sans text-slate-700">
                        <span>[ &nbsp; ] <strong>True</strong></span>
                        <span>[ &nbsp; ] <strong>False</strong></span>
                      </div>
                    )}

                    {/* Short Question Answer line in Student View */}
                    {viewMode === 'student' && q.questionType === 'short_answer' && (
                      <div className="h-10 border-b border-dashed border-slate-300 mt-2" />
                    )}

                    {/* TEACHER ANSWER KEY VIEW DETAILS */}
                    {viewMode === 'answer-key' && (
                      <div className="mt-2.5 p-3 rounded-lg bg-emerald-50/80 border border-emerald-200 text-xs font-sans space-y-1">
                        <div className="text-emerald-900 font-bold">
                          Answer / Solution:{' '}
                          <span className="font-normal">
                            {q.questionType === 'mcq' && q.options
                              ? `(${String.fromCharCode(65 + Number(q.correctAnswer))}) ${q.options[q.correctAnswer]}`
                              : q.correctAnswer}
                          </span>
                        </div>
                        {q.explanation && (
                          <div className="text-slate-600 text-[11px]">
                            <em>Marking Rubric:</em> {q.explanation}
                          </div>
                        )}
                        {q.sourceReference && (
                          <div className="text-slate-500 text-[10px]">
                            <strong>Source Reference:</strong> {q.sourceReference}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 pt-4 border-t border-slate-400 text-center text-xs font-bold text-slate-600 font-sans">
          --- END OF EXAMINATION PAPER ---
        </div>
      </div>

      {/* Question Bank Swap Modal */}
      <Modal
        isOpen={isBankModalOpen}
        onClose={() => setIsBankModalOpen(false)}
        title="Swap Question with Question Bank Item"
        subtitle="Select a verified curriculum question to replace the current item"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-3">
          {loadingBank ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading question repository...</div>
          ) : bankQuestions.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No questions found in question bank.</div>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
              {bankQuestions.map((bq) => (
                <div
                  key={bq.id}
                  onClick={() => handleSelectBankQuestion(bq)}
                  className="p-3 bg-slate-50 hover:bg-brand-50 border border-slate-200 hover:border-brand-400 rounded-xl cursor-pointer transition-colors text-xs space-y-1"
                >
                  <div className="flex justify-between items-start font-semibold text-slate-900">
                    <p className="flex-1">{bq.questionText}</p>
                    <span className="text-[11px] font-bold text-brand-700 bg-brand-100 px-1.5 py-0.5 rounded ml-2">
                      {bq.marks} M
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 flex gap-2">
                    <span>{bq.questionType}</span>
                    <span>• {bq.difficulty}</span>
                    <span>• Ch {bq.chapterNumber}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
