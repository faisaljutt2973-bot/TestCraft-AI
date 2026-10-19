const Storage = require('../config/storage');

const getQuestions = async (req, res) => {
  try {
    const { subject, className, difficulty, questionType, search } = req.query;
    let questions = await Storage.find('questions');

    if (subject) {
      questions = questions.filter((q) => q.subject.toLowerCase() === subject.toLowerCase());
    }
    if (className) {
      questions = questions.filter((q) => q.className === className);
    }
    if (difficulty) {
      questions = questions.filter((q) => q.difficulty.toLowerCase() === difficulty.toLowerCase());
    }
    if (questionType) {
      questions = questions.filter((q) => q.questionType === questionType);
    }
    if (search) {
      const s = search.toLowerCase();
      questions = questions.filter(
        (q) =>
          q.questionText.toLowerCase().includes(s) ||
          (q.topic && q.topic.toLowerCase().includes(s)) ||
          (q.chapterTitle && q.chapterTitle.toLowerCase().includes(s))
      );
    }

    res.json({ success: true, count: questions.length, questions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createQuestion = async (req, res) => {
  try {
    const {
      questionText,
      questionType,
      subject,
      className,
      bookId,
      bookTitle,
      chapterNumber,
      chapterTitle,
      topic,
      difficulty,
      marks,
      options,
      correctAnswer,
      explanation,
      sourceReference,
    } = req.body;

    if (!questionText || !questionType || !subject || !className) {
      return res.status(400).json({
        success: false,
        message: 'Question text, question type, subject, and class are required.',
      });
    }

    const question = await Storage.create('questions', {
      questionText: questionText.trim(),
      questionType,
      subject: subject.trim(),
      className: className.trim(),
      bookId: bookId || null,
      bookTitle: bookTitle || 'Independent Question',
      chapterNumber: chapterNumber ? parseInt(chapterNumber, 10) : null,
      chapterTitle: chapterTitle || '',
      topic: topic || 'General Topic',
      difficulty: difficulty || 'Medium',
      marks: marks ? parseInt(marks, 10) : 1,
      options: Array.isArray(options) ? options : [],
      correctAnswer: correctAnswer || '',
      explanation: explanation || '',
      sourceReference: sourceReference || 'Teacher Manual Entry',
      createdBy: req.user.id,
    });

    res.status(201).json({ success: true, message: 'Question saved to question bank.', question });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateQuestion = async (req, res) => {
  try {
    const question = await Storage.findById('questions', req.params.id);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found.' });
    }

    if (question.createdBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You do not have permission to edit this question.' });
    }

    const updated = await Storage.update('questions', req.params.id, req.body);
    res.json({ success: true, message: 'Question updated.', question: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteQuestion = async (req, res) => {
  try {
    const question = await Storage.findById('questions', req.params.id);
    if (!question) {
      return res.status(404).json({ success: false, message: 'Question not found.' });
    }

    if (question.createdBy !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You do not have permission to delete this question.' });
    }

    await Storage.delete('questions', req.params.id);
    res.json({ success: true, message: 'Question removed from question bank.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
};
