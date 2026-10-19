const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();
const Storage = require('../config/storage');
const { generateExamPaper } = require('../services/aiService');
const { generateStudentPaperHTML, generateAnswerKeyHTML } = require('../services/exportService');

const generateTest = async (req, res) => {
  try {
    const {
      title,
      schoolName,
      examinationHeading,
      bookId,
      selectedChapters,
      examType = 'Chapter-wise test',
      durationMinutes = 90,
      totalMarks = 50,
      passingMarks,
      difficulty = 'Mixed',
      language = 'English',
      instructions,
      questionTypeCounts = {},
      marksPerQuestion = {},
    } = req.body;

    if (!bookId) {
      return res.status(400).json({ success: false, message: 'Please select a textbook or syllabus source.' });
    }

    const book = await Storage.findById('books', bookId);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Selected book could not be found.' });
    }

    if (!selectedChapters || selectedChapters.length === 0) {
      return res.status(400).json({ success: false, message: 'Please select at least one chapter or unit.' });
    }

    // Validate marks balance
    const defaultWeights = { mcq: 1, short_answer: 4, long_answer: 10, fill_blanks: 1, true_false: 1, numerical: 5 };
    const effectiveMarksPerType = { ...defaultWeights, ...marksPerQuestion };

    let totalAllocatedMarks = 0;
    let totalQuestionsCount = 0;
    for (const [type, count] of Object.entries(questionTypeCounts)) {
      const qCount = parseInt(count, 10) || 0;
      totalQuestionsCount += qCount;
      totalAllocatedMarks += qCount * (effectiveMarksPerType[type] || 1);
    }

    if (totalQuestionsCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please specify the number of questions to generate for at least one question type.',
      });
    }

    const targetTotal = parseInt(totalMarks, 10);
    if (totalAllocatedMarks !== targetTotal) {
      return res.status(400).json({
        success: false,
        message: `Marks mismatch! Allocated questions add up to ${totalAllocatedMarks} marks, but exam target is set to ${targetTotal} marks. Please adjust question counts or marks per question.`,
        allocatedMarks: totalAllocatedMarks,
        targetMarks: targetTotal,
      });
    }

    const settings = await Storage.getSettings();

    // Call AI Generation Engine
    console.log(`[Test Generator] Generating ${examType} for "${book.title}", ${totalQuestionsCount} questions, ${targetTotal} marks...`);
    const generated = await generateExamPaper({
      book,
      selectedChapters,
      examConfig: {
        examType,
        totalMarks: targetTotal,
        difficulty,
        marksPerQuestion: effectiveMarksPerType,
      },
      questionTypeCounts,
      settings,
    });

    const defaultInstructions = [
      'Read all questions carefully before attempting.',
      'Write answers neatly in the designated answer booklet.',
      'Check all calculations and specify units clearly.',
      'Ensure your name, roll number, and date are filled on the title page.',
    ];

    const newTestPaper = await Storage.create('testPapers', {
      title: title || `${book.className} ${book.subject} - ${examType}`,
      schoolName: schoolName || settings.schoolName || 'Beacon International Academy',
      examinationHeading: examinationHeading || `${examType.toUpperCase()} - 2026`,
      subject: book.subject,
      className: book.className,
      boardName: book.boardName || 'National Board',
      bookId: book.id,
      bookTitle: book.title,
      examType,
      durationMinutes: parseInt(durationMinutes, 10) || 90,
      totalMarks: generated.totalMarks,
      passingMarks: passingMarks ? parseInt(passingMarks, 10) : Math.round(generated.totalMarks * 0.4),
      difficulty,
      language,
      selectedChapters,
      instructions: instructions && instructions.length > 0 ? instructions : defaultInstructions,
      sections: generated.sections,
      createdBy: req.user.id,
      generatedAt: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      message: `Examination paper successfully generated with ${generated.generatedQuestionsCount} syllabus-grounded questions.`,
      testPaper: newTestPaper,
    });
  } catch (err) {
    console.error('[Test Generator] Generation failed:', err);
    res.status(500).json({ success: false, message: `Failed to generate test: ${err.message}` });
  }
};

const getTests = async (req, res) => {
  try {
    const { className, subject } = req.query;
    let tests = await Storage.find('testPapers');

    // Only return tests created by current teacher (or all for admin)
    if (req.user.role !== 'admin') {
      tests = tests.filter((t) => t.createdBy === req.user.id);
    }

    if (className) {
      tests = tests.filter((t) => t.className === className);
    }
    if (subject) {
      tests = tests.filter((t) => t.subject.toLowerCase() === subject.toLowerCase());
    }

    // Sort by recent
    tests.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    res.json({ success: true, count: tests.length, tests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getTestById = async (req, res) => {
  try {
    const test = await Storage.findById('testPapers', req.params.id);
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test paper not found.' });
    }

    if (test.createdBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You do not have permission to view this exam paper.' });
    }

    res.json({ success: true, test });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateTestPaper = async (req, res) => {
  try {
    const test = await Storage.findById('testPapers', req.params.id);
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test paper not found.' });
    }

    if (test.createdBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You do not have permission to edit this exam paper.' });
    }

    const { title, schoolName, examinationHeading, durationMinutes, totalMarks, passingMarks, instructions, sections } = req.body;

    const updated = await Storage.update('testPapers', req.params.id, {
      ...(title && { title }),
      ...(schoolName && { schoolName }),
      ...(examinationHeading && { examinationHeading }),
      ...(durationMinutes && { durationMinutes: parseInt(durationMinutes, 10) }),
      ...(totalMarks !== undefined && { totalMarks: parseInt(totalMarks, 10) }),
      ...(passingMarks !== undefined && { passingMarks: parseInt(passingMarks, 10) }),
      ...(instructions && { instructions }),
      ...(sections && { sections }),
    });

    res.json({ success: true, message: 'Test paper updated successfully.', test: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const regenerateQuestion = async (req, res) => {
  try {
    const test = await Storage.findById('testPapers', req.params.id);
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test paper not found.' });
    }

    const { sectionId, questionId } = req.body;
    if (!sectionId || !questionId) {
      return res.status(400).json({ success: false, message: 'sectionId and questionId are required.' });
    }

    const book = await Storage.findById('books', test.bookId);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Associated book not found.' });
    }

    const section = (test.sections || []).find((s) => s.sectionId === sectionId);
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found.' });
    }

    const questionIndex = section.questions.findIndex((q) => q.id === questionId);
    if (questionIndex === -1) {
      return res.status(404).json({ success: false, message: 'Question not found in specified section.' });
    }

    const existingQ = section.questions[questionIndex];

    // Generate single replacement question of same type
    const singleTypeCount = { [existingQ.questionType]: 1 };
    const singleMarks = { [existingQ.questionType]: existingQ.marks || 1 };

    const generated = await generateExamPaper({
      book,
      selectedChapters: test.selectedChapters,
      examConfig: {
        examType: test.examType,
        totalMarks: existingQ.marks || 1,
        difficulty: test.difficulty || 'Medium',
        marksPerQuestion: singleMarks,
      },
      questionTypeCounts: singleTypeCount,
      settings: await Storage.getSettings(),
    });

    const newQuestion = generated.sections?.[0]?.questions?.[0];
    if (!newQuestion) {
      return res.status(500).json({ success: false, message: 'Failed to generate replacement question.' });
    }

    // Preserve number and ID
    newQuestion.id = existingQ.id;
    newQuestion.number = existingQ.number;
    newQuestion.marks = existingQ.marks;

    section.questions[questionIndex] = newQuestion;

    await Storage.update('testPapers', test.id, { sections: test.sections });

    res.json({
      success: true,
      message: 'Question regenerated successfully.',
      question: newQuestion,
      test,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteTest = async (req, res) => {
  try {
    const test = await Storage.findById('testPapers', req.params.id);
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test paper not found.' });
    }

    if (test.createdBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You do not have permission to delete this paper.' });
    }

    await Storage.delete('testPapers', req.params.id);
    res.json({ success: true, message: 'Test paper deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const exportTest = async (req, res) => {
  try {
    const test = await Storage.findById('testPapers', req.params.id);
    if (!test) {
      return res.status(404).json({ success: false, message: 'Test paper not found.' });
    }

    const { type = 'student', format = 'html' } = req.query;

    if (type === 'answer-key') {
      const html = generateAnswerKeyHTML(test);
      res.setHeader('Content-Type', 'text/html');
      return res.send(html);
    }

    const html = generateStudentPaperHTML(test);
    if (format === 'docx') {
      // Send as downloadable Word-compatible HTML file
      res.setHeader('Content-Type', 'application/vnd.ms-word');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(test.title)}.doc"`);
      return res.send(html);
    }

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  generateTest,
  getTests,
  getTestById,
  updateTestPaper,
  regenerateQuestion,
  deleteTest,
  exportTest,
};
