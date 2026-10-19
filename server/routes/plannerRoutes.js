const express = require('express');
const router = express.Router();
const {
  createPlan,
  getPlans,
  getPlanById,
  updatePlan,
  deletePlan,
} = require('../controllers/plannerController');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, getPlans);
router.post('/', authenticate, createPlan);
router.get('/:id', authenticate, getPlanById);
router.put('/:id', authenticate, updatePlan);
router.delete('/:id', authenticate, deletePlan);

module.exports = router;
