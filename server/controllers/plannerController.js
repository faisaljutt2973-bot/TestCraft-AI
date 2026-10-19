const Storage = require('../config/storage');

const DEFAULT_MARKS_PER_QUESTION = { mcq: 1, short_answer: 4, long_answer: 10 };
const SECTION_KEYS = ['mcq', 'short_answer', 'long_answer'];

const toInt = (value, fallback = 0) => {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

const validationError = (message) => {
  const err = new Error(message);
  err.status = 400;
  return err;
};

// Distribute an integer total across weighted buckets using the largest remainder method.
const allocateProportionally = (total, weights) => {
  if (!weights.length) return [];
  if (total <= 0) return weights.map(() => 0);

  const safeWeights = weights.map((w) => (Number(w) > 0 ? Number(w) : 0));
  const weightSum = safeWeights.reduce((a, b) => a + b, 0);

  if (weightSum === 0) {
    const base = Math.floor(total / weights.length);
    const out = weights.map(() => base);
    out[out.length - 1] += total - base * weights.length;
    return out;
  }

  const exact = safeWeights.map((w) => (w / weightSum) * total);
  const base = exact.map((v) => Math.floor(v));
  const remainder = total - base.reduce((a, b) => a + b, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);

  for (let k = 0; k < remainder; k += 1) {
    base[order[k % order.length].i] += 1;
  }
  return base;
};

const buildPlan = ({
  book,
  assessmentType,
  selectedChapters,
  totalMarks,
  mcqMarks,
  shortMarks,
  longMarks,
  marksPerQuestion,
  chapterWeights,
  selectionMode,
  title,
  durationMinutes,
}) => {
  const type = assessmentType === 'final' ? 'final' : 'midterm';
  const mpq = { ...DEFAULT_MARKS_PER_QUESTION };
  SECTION_KEYS.forEach((key) => {
    const value = toInt(marksPerQuestion?.[key], mpq[key]);
    if (value <= 0) throw validationError(`Marks per ${key.replace('_', ' ')} question must be greater than zero.`);
    mpq[key] = value;
  });

  const sectionMarks = {
    mcq: toInt(mcqMarks),
    short_answer: toInt(shortMarks),
    long_answer: toInt(longMarks),
  };

  if (sectionMarks.mcq < 0 || sectionMarks.short_answer < 0 || sectionMarks.long_answer < 0) {
    throw validationError('Section marks cannot be negative.');
  }

  const targetTotal = toInt(totalMarks);
  if (targetTotal <= 0) {
    throw validationError('Total marks must be greater than zero.');
  }

  const sectionSum = sectionMarks.mcq + sectionMarks.short_answer + sectionMarks.long_answer;
  if (sectionSum !== targetTotal) {
    throw validationError(
      `Mark distribution must add up to the total marks. Sections add up to ${sectionSum}, but total marks is ${targetTotal}.`
    );
  }

  SECTION_KEYS.forEach((key) => {
    if (sectionMarks[key] > 0 && sectionMarks[key] % mpq[key] !== 0) {
      throw validationError(
        `Section ${key.replace('_', ' ')} marks (${sectionMarks[key]}) must be a multiple of ${mpq[key]} marks per question.`
      );
    }
  });

  const questionCounts = {
    mcq: mpq.mcq > 0 ? sectionMarks.mcq / mpq.mcq : 0,
    short_answer: mpq.short_answer > 0 ? sectionMarks.short_answer / mpq.short_answer : 0,
    long_answer: mpq.long_answer > 0 ? sectionMarks.long_answer / mpq.long_answer : 0,
  };

  if (questionCounts.mcq + questionCounts.short_answer + questionCounts.long_answer === 0) {
    throw validationError('Configure marks for at least one question type.');
  }

  const allChapters = (book.chapters || [])
    .slice()
    .sort((a, b) => toInt(a.chapterNumber) - toInt(b.chapterNumber));

  let chapters;
  if (type === 'final') {
    chapters = allChapters;
  } else {
    const wanted = new Set((selectedChapters || []).map((n) => toInt(n)));
    chapters = allChapters.filter((c) => wanted.has(toInt(c.chapterNumber)));
  }

  if (!chapters.length) {
    throw validationError(
      type === 'final'
        ? 'This textbook has no chapters available for the plan.'
        : 'Select at least one chapter to include in the midterm plan.'
    );
  }

  let weights = chapters.map((c) => {
    const raw = chapterWeights?.[c.chapterNumber];
    const value = Number(raw);
    return Number.isFinite(value) && value >= 0 ? value : 1;
  });
  if (weights.every((w) => w === 0)) {
    weights = weights.map(() => 1);
  }
  const weightSum = weights.reduce((a, b) => a + b, 0);

  const chapterMarks = allocateProportionally(sectionSum, weights);
  const mcqPerChapter = allocateProportionally(questionCounts.mcq, weights);
  const shortPerChapter = allocateProportionally(questionCounts.short_answer, weights);
  const longPerChapter = allocateProportionally(questionCounts.long_answer, weights);

  const chapterBreakdown = chapters.map((chapter, idx) => ({
    chapterNumber: toInt(chapter.chapterNumber),
    title: chapter.title || `Chapter ${chapter.chapterNumber}`,
    weightage: weightSum > 0 ? Math.round((weights[idx] / weightSum) * 1000) / 10 : 0,
    marks: chapterMarks[idx],
    questionCounts: {
      mcq: mcqPerChapter[idx],
      short_answer: shortPerChapter[idx],
      long_answer: longPerChapter[idx],
    },
  }));

  const defaultTitle = `${book.className} ${book.subject} - ${
    type === 'final' ? 'Final / Full-Book' : 'Midterm'
  } Exam Plan`;

  return {
    title: (title || '').trim() || defaultTitle,
    bookId: book.id,
    bookTitle: book.title,
    className: book.className,
    subject: book.subject,
    boardName: book.boardName || 'National Board',
    assessmentType: type,
    selectionMode: type === 'final' ? 'all' : selectionMode === 'cutoff' ? 'cutoff' : 'specific',
    examType: type === 'final' ? 'Final examination' : 'Midterm examination',
    chapters: chapterBreakdown,
    totalMarks: sectionSum,
    sectionMarks,
    marksPerQuestion: { mcq: mpq.mcq, short_answer: mpq.short_answer, long_answer: mpq.long_answer },
    questionCounts: {
      mcq: questionCounts.mcq,
      short_answer: questionCounts.short_answer,
      long_answer: questionCounts.long_answer,
      fill_blanks: 0,
      true_false: 0,
      numerical: 0,
    },
    durationMinutes: Math.max(15, toInt(durationMinutes, 90)),
  };
};

const createPlan = async (req, res) => {
  try {
    const { bookId } = req.body;
    if (!bookId) {
      return res.status(400).json({ success: false, message: 'Please select a textbook.' });
    }

    const book = await Storage.findById('books', bookId);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Selected textbook could not be found.' });
    }

    const planData = buildPlan({ ...req.body, book });
    const plan = await Storage.create('examPlans', {
      ...planData,
      createdBy: req.user.id,
      createdByName: req.user.name,
      createdByEmail: req.user.email,
    });

    res.status(201).json({ success: true, message: 'Exam plan generated and saved.', plan });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

const getPlans = async (req, res) => {
  try {
    let plans = await Storage.find('examPlans');
    if (req.user.role !== 'admin') {
      plans = plans.filter((p) => p.createdBy === req.user.id);
    }
    plans.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    res.json({ success: true, count: plans.length, plans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getPlanById = async (req, res) => {
  try {
    const plan = await Storage.findById('examPlans', req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Exam plan not found.' });
    }
    if (plan.createdBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You do not have permission to view this plan.' });
    }
    res.json({ success: true, plan });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updatePlan = async (req, res) => {
  try {
    const existing = await Storage.findById('examPlans', req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Exam plan not found.' });
    }
    if (existing.createdBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You do not have permission to edit this plan.' });
    }

    const book = await Storage.findById('books', req.body.bookId || existing.bookId);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Associated textbook could not be found.' });
    }

    const existingSections = existing.sectionMarks || {};
    const incomingSections = req.body.sectionMarks || {};
    const merged = {
      ...existing,
      ...req.body,
      book,
      selectedChapters:
        req.body.selectedChapters !== undefined
          ? req.body.selectedChapters
          : (existing.chapters || []).map((c) => c.chapterNumber),
      chapterWeights:
        req.body.chapterWeights ||
        Object.fromEntries((existing.chapters || []).map((c) => [c.chapterNumber, c.weightage || 1])),
      marksPerQuestion: req.body.marksPerQuestion || existing.marksPerQuestion,
      sectionMarks: req.body.sectionMarks || existingSections,
      totalMarks: req.body.totalMarks !== undefined ? req.body.totalMarks : existing.totalMarks,
      mcqMarks:
        req.body.mcqMarks !== undefined ? req.body.mcqMarks : incomingSections.mcq ?? existingSections.mcq,
      shortMarks:
        req.body.shortMarks !== undefined
          ? req.body.shortMarks
          : incomingSections.short_answer ?? existingSections.short_answer,
      longMarks:
        req.body.longMarks !== undefined
          ? req.body.longMarks
          : incomingSections.long_answer ?? existingSections.long_answer,
    };

    const planData = buildPlan(merged);
    const updated = await Storage.update('examPlans', req.params.id, planData);
    res.json({ success: true, message: 'Exam plan updated successfully.', plan: updated });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message });
  }
};

const deletePlan = async (req, res) => {
  try {
    const plan = await Storage.findById('examPlans', req.params.id);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Exam plan not found.' });
    }
    if (plan.createdBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You do not have permission to delete this plan.' });
    }
    await Storage.delete('examPlans', req.params.id);
    res.json({ success: true, message: 'Exam plan deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createPlan,
  getPlans,
  getPlanById,
  updatePlan,
  deletePlan,
};
