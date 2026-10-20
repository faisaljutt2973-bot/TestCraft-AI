const crypto = require('crypto');
const uuidv4 = () => crypto.randomUUID();
const Storage = require('../config/storage');
const { generateExamPaper } = require('../services/aiService');
const { generateStudentPaperHTML, generateAnswerKeyHTML } = require('../services/exportService');

const MAX_QUESTIONS_PER_PAPER = 150;
const MAX_TOTAL_MARKS = 1000;
const DUPLICATE_WINDOW_MS = 60 * 1000;

// Per-process guards. They stop double-taps/duplicate retries from creating
// two identical papers; the database remains the source of truth.
const inFlightGenerations = new Map();
const recentGenerationResults = new Map();

const sanitizeText = (value, maxLength = 160) =>
  typeof value === 'string'
    ? value
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength)
    : '';

const storeGenerationResult = (key, payload) => {
  const now = Date.now();
  for (const [storedKey, entry] of recentGenerationResults) {
    if (entry.expiresAt <= now) recentGenerationResults.delete(storedKey);
  }
  recentGenerationResults.set(key, { payload, expiresAt: now + DUPLICATE_WINDOW_MS });
};

const generateTest = async (req, res) => {
  const userId = req.user.id;

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

    const chapters = Array.isArray(selectedChapters)
      ? [...new Set(selectedChapters.map((chapter) => String(chapter)))]
      : [];
    if (chapters.length === 0) {
      return res.status(400).json({ success: false, message: 'Please select at least one chapter or unit.' });
    }

    const defaultWeights = { mcq: 1, short_answer: 4, long_answer: 10, fill_blanks: 1, true_false: 1, numerical: 5 };
    const effectiveMarksPerType = { ...defaultWeights };
    for (const [type, marks] of Object.entries(marksPerQuestion || {})) {
      const parsed = parseInt(marks, 10);
      if (Number.isFinite(parsed) && parsed > 0 && parsed <= 50) {
        effectiveMarksPerType[type] = parsed;
      }
    }

    const normalizedCounts = {};
    let totalAllocatedMarks = 0;
    let totalQuestionsCount = 0;
    for (const [type, rawCount] of Object.entries(questionTypeCounts || {})) {
      const qCount = Math.min(Math.max(parseInt(rawCount, 10) || 0, 0), 50);
      if (qCount === 0) continue;
      normalizedCounts[type] = qCount;
      totalQuestionsCount += qCount;
      totalAllocatedMarks += qCount * (effectiveMarksPerType[type] || 1);
    }

    if (totalQuestionsCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please specify the number of questions to generate for at least one question type.',
      });
    }

    if (totalQuestionsCount > MAX_QUESTIONS_PER_PAPER) {
      return res.status(400).json({
        success: false,
        message: `A single paper cannot contain more than ${MAX_QUESTIONS_PER_PAPER} questions.`,
      });
    }

    const targetTotal = parseInt(totalMarks, 10);
    if (!Number.isFinite(targetTotal) || targetTotal <= 0 || targetTotal > MAX_TOTAL_MARKS) {
      return res.status(400).json({ success: false, message: `Total marks must be between 1 and ${MAX_TOTAL_MARKS}.` });
    }

    if (totalAllocatedMarks !== targetTotal) {
      return res.status(400).json({
        success: false,
        message: `Marks mismatch! Allocated questions add up to ${totalAllocatedMarks} marks, but exam target is set to ${targetTotal} marks. Please adjust question counts or marks per question.`,
        allocatedMarks: totalAllocatedMarks,
        targetMarks: targetTotal,
      });
    }

    const book = await Storage.findById('books', bookId);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Selected book could not be found.' });
    }
    if (book.isPublic === false && book.createdBy !== userId && req.user.role !== 'admin') {
      return res.status(404).json({ success: false, message: 'Selected book could not be found.' });
    }

    const resolvedExamType = sanitizeText(examType, 80) || 'Chapter-wise test';
    const fingerprint = crypto
      .createHash('sha256')
      .update(
        JSON.stringify({
          userId,
          bookId,
          chapters: [...chapters].sort(),
          counts: normalizedCounts,
          marks: effectiveMarksPerType,
          targetTotal,
          resolvedExamType,
          title: sanitizeText(title, 180),
          difficulty: sanitizeText(difficulty, 40),
          language: sanitizeText(language, 40),
          durationMinutes: parseInt(durationMinutes, 10) || 90,
          passingMarks: parseInt(passingMarks, 10) || null,
          schoolName: sanitizeText(schoolName, 120) || sanitizeText(req.user.school, 120),
          examinationHeading: sanitizeText(examinationHeading, 160),
          instructions: Array.isArray(instructions) ? instructions.map(String).slice(0, 20) : [],
        })
      )
      .digest('hex');

    const idempotencyKey = sanitizeText(req.get('Idempotency-Key'), 120);
    const idempotencyCacheKey = idempotencyKey ? `idem:${userId}:${idempotencyKey}` : null;

    for (const key of [fingerprint, idempotencyCacheKey].filter(Boolean)) {
      const cached = recentGenerationResults.get(key);
      if (cached && cached.expiresAt > Date.now()) {
        return res.status(200).json({
          ...cached.payload,
          duplicate: true,
          message: 'This paper was already generated a moment ago. Opening the existing copy.',
        });
      }
    }

    if (inFlightGenerations.has(userId)) {
      return res.status(409).json({
        success: false,
        code: 'GENERATION_IN_PROGRESS',
        message: 'A test paper is already being generated. Please wait for it to finish before starting another.',
      });
    }

    inFlightGenerations.set(userId, Date.now());
    try {
      const settings = await Storage.getSettings();
      const resolvedSchoolName =
        sanitizeText(schoolName, 120) ||
        sanitizeText(req.user.school, 120) ||
        sanitizeText(settings.schoolName, 120) ||
        'Academic Institution';

      console.log(
        `[Test Generator] User ${userId} generating ${resolvedExamType} for "${book.title}", ${totalQuestionsCount} questions, ${targetTotal} marks...`
      );

      const generated = await generateExamPaper({
        book,
        selectedChapters: chapters,
        examConfig: {
          examType: resolvedExamType,
          totalMarks: targetTotal,
          difficulty,
          marksPerQuestion: effectiveMarksPerType,
        },
        questionTypeCounts: normalizedCounts,
        settings,
      });

      const defaultInstructions = [
        'Read all questions carefully before attempting.',
        'Write answers neatly in the designated answer booklet.',
        'Check all calculations and specify units clearly.',
        'Ensure your name, roll number, and date are filled on the title page.',
      ];

      const parsedDuration = Math.min(Math.max(parseInt(durationMinutes, 10) || 90, 10), 600);
      const parsedPassing = parseInt(passingMarks, 10);

      const newTestPaper = await Storage.create('testPapers', {
        title: sanitizeText(title, 180) || `${book.className} ${book.subject} - ${resolvedExamType}`,
        schoolName: resolvedSchoolName,
        examinationHeading: sanitizeText(examinationHeading, 160) || `${resolvedExamType.toUpperCase()} - 2026`,
        subject: book.subject,
        className: book.className,
        boardName: book.boardName || 'National Board',
        bookId: book.id,
        bookTitle: book.title,
        examType: resolvedExamType,
        durationMinutes: parsedDuration,
        totalMarks: generated.totalMarks,
        passingMarks:
          Number.isFinite(parsedPassing) && parsedPassing > 0
            ? Math.min(parsedPassing, generated.totalMarks)
            : Math.round(generated.totalMarks * 0.4),
        difficulty,
        language,
        selectedChapters: chapters,
        instructions: Array.isArray(instructions) && instructions.length > 0 ? instructions : defaultInstructions,
        sections: generated.sections,
        createdBy: userId,
        generatedAt: new Date().toISOString(),
      });

      const payload = {
        success: true,
        message: `Examination paper successfully generated with ${generated.generatedQuestionsCount} syllabus-grounded questions.`,
        testPaper: newTestPaper,
      };

      storeGenerationResult(fingerprint, payload);
      if (idempotencyCacheKey) storeGenerationResult(idempotencyCacheKey, payload);

      return res.status(201).json(payload);
    } finally {
      inFlightGenerations.delete(userId);
    }
  } catch (err) {
    console.error('[Test Generator] Generation failed:', err);
    const message = String(err.message || '');
    const databaseFailure = /buffering timed out|Mongo(?:DB|ose)?|topology|connection .*closed|ECONN|socket hang up/i.test(
      message
    );

    if (databaseFailure) {
      return res.status(503).json({
        success: false,
        code: 'DATABASE_UNAVAILABLE',
        message: 'The database is temporarily unavailable. Please try again in a moment.',
      });
    }

    if (err.status && err.status < 500) {
      return res.status(err.status).json({ success: false, message: err.message });
    }

    return res.status(500).json({
      success: false,
      code: 'GENERATION_FAILED',
      message:
        process.env.NODE_ENV === 'production'
          ? 'The test paper could not be generated. Please try again.'
          : `Failed to generate test: ${message}`,
    });
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

    if (test.createdBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You do not have permission to edit this exam paper.' });
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

    if (test.createdBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You do not have permission to export this exam paper.' });
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
