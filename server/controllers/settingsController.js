const Storage = require('../config/storage');

// Never expose API keys to clients, even in mutation responses.
const maskSettings = (raw) => ({
  ...raw,
  geminiApiKey: raw.geminiApiKey ? `••••••••${raw.geminiApiKey.slice(-4)}` : '',
  hasGeminiKey: Boolean(raw.geminiApiKey || process.env.GEMINI_API_KEY),
  openaiApiKey: raw.openaiApiKey ? `••••••••${raw.openaiApiKey.slice(-4)}` : '',
  hasOpenaiKey: Boolean(raw.openaiApiKey || process.env.OPENAI_API_KEY),
  googleBooksApiKey: raw.googleBooksApiKey ? `••••••••${raw.googleBooksApiKey.slice(-4)}` : '',
  hasGoogleBooksKey: Boolean(raw.googleBooksApiKey || process.env.GOOGLE_BOOKS_API_KEY),
});

const presentSettings = (raw, isAdmin) => {
  const masked = maskSettings(raw);
  if (isAdmin) return masked;
  const {
    aiProvider,
    geminiApiKey,
    openaiApiKey,
    googleBooksApiKey,
    hasGeminiKey,
    hasOpenaiKey,
    hasGoogleBooksKey,
    ...safe
  } = masked;
  return safe;
};

const getSettings = async (req, res) => {
  try {
    const raw = await Storage.getSettings();
    const isAdmin = req.user && req.user.role === 'admin';
    res.json({ success: true, settings: presentSettings(raw, isAdmin) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateSettings = async (req, res) => {
  try {
    const {
      aiProvider,
      geminiApiKey,
      openaiApiKey,
      googleBooksApiKey,
      schoolName,
      schoolLogo,
      examHeaderTemplate,
      maxExamDuration,
      passingPercentage,
      allowNegativeMarking,
    } = req.body;

    const isAdmin = req.user && req.user.role === 'admin';

    // Institution-wide branding and exam defaults are administrator-owned.
    // Teachers keep their own school on their profile instead.
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message:
          'Institution settings can only be changed by an administrator. Update your own school from your Profile page.',
      });
    }

    const updates = {};
    if (aiProvider !== undefined) {
      if (!['gemini', 'openai', 'heuristic'].includes(aiProvider)) {
        return res.status(400).json({ success: false, message: 'Unsupported AI provider.' });
      }
      updates.aiProvider = aiProvider;
    }
    if (schoolName !== undefined) {
      const normalized = String(schoolName).trim().replace(/\s+/g, ' ');
      if (!normalized) {
        return res.status(400).json({ success: false, message: 'Institution name cannot be empty.' });
      }
      updates.schoolName = normalized.slice(0, 120);
    }
    if (schoolLogo !== undefined) updates.schoolLogo = schoolLogo;
    if (examHeaderTemplate !== undefined) updates.examHeaderTemplate = String(examHeaderTemplate).trim().slice(0, 500);
    if (maxExamDuration !== undefined) {
      updates.maxExamDuration = Math.min(Math.max(parseInt(maxExamDuration, 10) || 180, 10), 600);
    }
    if (passingPercentage !== undefined) {
      updates.passingPercentage = Math.min(Math.max(parseInt(passingPercentage, 10) || 40, 0), 100);
    }
    if (allowNegativeMarking !== undefined) updates.allowNegativeMarking = Boolean(allowNegativeMarking);

    // Only administrators may set AI provider credentials (and never re-save masked values).
    if (geminiApiKey && !geminiApiKey.startsWith('••••')) {
      updates.geminiApiKey = geminiApiKey.trim();
    }
    if (openaiApiKey && !openaiApiKey.startsWith('••••')) {
      updates.openaiApiKey = openaiApiKey.trim();
    }
    if (googleBooksApiKey && !googleBooksApiKey.startsWith('••••')) {
      updates.googleBooksApiKey = googleBooksApiKey.trim();
    }

    const updated = await Storage.updateSettings(updates);
    res.json({
      success: true,
      message: isAdmin ? 'Settings saved successfully.' : 'Institutional settings saved successfully.',
      settings: presentSettings(updated, isAdmin),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getStats = async (req, res) => {
  try {
    // Match test visibility with GET /api/tests and GET /api/tests/:id:
    // teachers only see papers they created, administrators see everything.
    const testFilter = req.user.role === 'admin' ? {} : { createdBy: req.user.id };

    // Independent queries run concurrently instead of four sequential Atlas round-trips.
    const [books, tests, questions, boards] = await Promise.all([
      Storage.find('books'),
      Storage.find('testPapers', testFilter),
      Storage.find('questions'),
      Storage.find('boards'),
    ]);

    let totalChaptersCount = 0;
    books.forEach((b) => {
      totalChaptersCount += (b.chapters || []).length;
    });

    const recentTests = tests
      .slice()
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 5);

    const subjects = [...new Set(books.map((b) => b.subject))];
    const classes = [...new Set(books.map((b) => b.className))];

    res.json({
      success: true,
      stats: {
        totalBooks: books.length,
        totalTests: tests.length,
        totalQuestions: questions.length,
        totalChapters: totalChaptersCount,
        totalBoards: boards.length,
        subjects,
        classes,
      },
      recentTests,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getSettings,
  updateSettings,
  getStats,
};
