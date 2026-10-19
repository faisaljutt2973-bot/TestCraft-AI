const crypto = require('crypto');
const Storage = require('../config/storage');
const { sendMail } = require('../services/emailService');

const createTicket = async (req, res) => {
  try {
    const { subject, message } = req.body;
    if (!subject || !subject.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide a subject for your support request.' });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Please describe your issue or question.' });
    }

    const ticket = await Storage.create('supportTickets', {
      userId: req.user.id,
      userName: req.user.name,
      userEmail: req.user.email,
      subject: subject.trim(),
      message: message.trim(),
      status: 'open',
      replies: [],
    });

    // Best-effort notification to administrators
    const admins = await Storage.find('users', { role: 'admin' });
    const recipients = admins.map((a) => a.email).filter(Boolean);
    if (recipients.length) {
      Promise.all(
        recipients.map((email) =>
          sendMail({
            to: email,
            subject: `[TestCraft Support] New ticket: ${ticket.subject}`,
            text: `${ticket.userName} (${ticket.userEmail}) opened a support ticket.\n\n${ticket.message}\n\nOpen the Admin Panel to reply.`,
            html: `<p><strong>${ticket.userName}</strong> (${ticket.userEmail}) opened a support ticket.</p><p>${ticket.message}</p><p>Open the Admin Panel to reply.</p>`,
          })
        )
      ).catch(() => {});
    }

    res.status(201).json({ success: true, message: 'Your support message has been sent to the administrator.', ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getTickets = async (req, res) => {
  try {
    let tickets = await Storage.find('supportTickets');
    if (req.user.role !== 'admin') {
      tickets = tickets.filter((t) => t.userId === req.user.id);
    }
    tickets.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
    res.json({ success: true, count: tickets.length, tickets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getTicketById = async (req, res) => {
  try {
    const ticket = await Storage.findById('supportTickets', req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Support ticket not found.' });
    }
    if (ticket.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You do not have permission to view this ticket.' });
    }
    res.json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const replyToTicket = async (req, res) => {
  try {
    const ticket = await Storage.findById('supportTickets', req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Support ticket not found.' });
    }

    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Please write a reply message.' });
    }

    const replies = Array.isArray(ticket.replies) ? ticket.replies : [];
    replies.push({
      id: crypto.randomUUID(),
      authorId: req.user.id,
      authorName: req.user.name,
      authorRole: req.user.role,
      message: message.trim(),
      createdAt: new Date().toISOString(),
    });

    const updated = await Storage.update('supportTickets', ticket.id, {
      replies,
      status: 'replied',
    });

    // Best-effort notification to the user
    if (ticket.userEmail) {
      sendMail({
        to: ticket.userEmail,
        subject: `[TestCraft Support] Reply to: ${ticket.subject}`,
        text: `Hello ${ticket.userName},\n\nAn administrator replied to your support ticket:\n\n${message.trim()}\n\nView the conversation in the Support section of TestCraft AI.`,
        html: `<p>Hello ${ticket.userName},</p><p>An administrator replied to your support ticket:</p><p>${message.trim()}</p><p>View the conversation in the Support section of TestCraft AI.</p>`,
      }).catch(() => {});
    }

    res.json({ success: true, message: 'Reply sent successfully.', ticket: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateTicketStatus = async (req, res) => {
  try {
    const ticket = await Storage.findById('supportTickets', req.params.id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Support ticket not found.' });
    }

    const { status } = req.body;
    if (!['open', 'replied', 'closed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid ticket status.' });
    }

    const updated = await Storage.update('supportTickets', ticket.id, { status });
    res.json({ success: true, message: `Ticket marked as ${status}.`, ticket: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  createTicket,
  getTickets,
  getTicketById,
  replyToTicket,
  updateTicketStatus,
};
