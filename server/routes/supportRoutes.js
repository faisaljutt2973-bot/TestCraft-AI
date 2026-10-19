const express = require('express');
const router = express.Router();
const {
  createTicket,
  getTickets,
  getTicketById,
  replyToTicket,
  updateTicketStatus,
} = require('../controllers/supportController');
const { authenticate, authorizeRoles } = require('../middleware/auth');

router.get('/', authenticate, getTickets);
router.post('/', authenticate, createTicket);
router.get('/:id', authenticate, getTicketById);
router.post('/:id/reply', authenticate, authorizeRoles('admin'), replyToTicket);
router.put('/:id/status', authenticate, authorizeRoles('admin'), updateTicketStatus);

module.exports = router;
