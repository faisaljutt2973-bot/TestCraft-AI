const Storage = require('../config/storage');

const getBoards = async (req, res) => {
  try {
    const boards = await Storage.find('boards');
    res.json({ success: true, count: boards.length, boards });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createBoard = async (req, res) => {
  try {
    const { name, country, region, classes, subjects } = req.body;
    if (!name || !classes || !subjects) {
      return res.status(400).json({ success: false, message: 'Board name, classes, and subjects are required.' });
    }

    const newBoard = await Storage.create('boards', {
      name: name.trim(),
      country: country ? country.trim() : 'Custom Country',
      region: region ? region.trim() : 'Regional Curriculum',
      classes: Array.isArray(classes) ? classes : classes.split(',').map((c) => c.trim()),
      subjects: Array.isArray(subjects) ? subjects : subjects.split(',').map((s) => s.trim()),
      createdBy: req.user.id,
      isCustom: true,
    });

    res.status(201).json({ success: true, message: 'Custom education board registered.', board: newBoard });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getBoards,
  createBoard,
};
