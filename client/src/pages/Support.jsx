import React, { useEffect, useState } from 'react';
import {
  LifeBuoy,
  Send,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Clock,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const badgeClass = (status) => {
  if (status === 'replied') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (status === 'closed') return 'bg-slate-100 text-slate-600 border-slate-200';
  return 'bg-amber-100 text-amber-800 border-amber-200';
};

export const Support = () => {
  const { isAdmin } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm] = useState({ subject: '', message: '' });

  const loadTickets = async () => {
    try {
      setLoading(true);
      const res = await api.getSupportTickets();
      if (res.success) setTickets(res.tickets);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) {
      setError('Please provide a subject and a message.');
      return;
    }
    try {
      setSending(true);
      setError(null);
      setSuccess(null);
      const res = await api.createSupportTicket(form);
      if (res.success) {
        setForm({ subject: '', message: '' });
        setSuccess('Your message has been sent to the administrator. You can track the reply here.');
        await loadTickets();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-gradient-to-r from-slate-900 to-brand-900 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-2 text-xs font-semibold text-brand-200 mb-2">
          <LifeBuoy className="w-4 h-4" />
          <span>Help Center</span>
        </div>
        <h2 className="text-xl font-black">Support & Feedback</h2>
        <p className="text-xs text-slate-300 mt-1 max-w-xl">
          Send a message directly to the administrator. Replies will appear in this conversation thread.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-xs text-emerald-800">
          <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {!isAdmin && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <MessageSquare className="w-4 h-4 text-brand-600" />
            <h3 className="text-sm font-bold text-slate-900">Contact the Administrator</h3>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject *</label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="e.g. Problem generating a Biology paper"
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Message *</label>
              <textarea
                rows={4}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Describe your issue or question in detail..."
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={sending}
                className="px-5 py-2.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-xl flex items-center gap-2"
              >
                {sending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{sending ? 'Sending...' : 'Send Message'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {isAdmin ? 'All Support Messages' : 'My Support Messages'}
            </h3>
            <p className="text-xs text-slate-500">
              {isAdmin
                ? 'Reply to users from the Admin Panel → Support tab.'
                : 'Your conversations with the administrator.'}
            </p>
          </div>
          <button
            onClick={loadTickets}
            className="p-2 text-slate-500 hover:text-brand-600 hover:bg-slate-50 rounded-lg"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="p-10 text-center text-xs text-slate-500">Loading support messages...</div>
        ) : tickets.length === 0 ? (
          <div className="p-10 text-center">
            <LifeBuoy className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-500">No support messages yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {tickets.map((ticket) => {
              const expanded = expandedId === ticket.id;
              return (
                <div key={ticket.id}>
                  <button
                    onClick={() => setExpandedId(expanded ? null : ticket.id)}
                    className="w-full px-6 py-4 flex items-start justify-between gap-3 text-left hover:bg-slate-50/70"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-slate-900 truncate">{ticket.subject}</h4>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${badgeClass(ticket.status)}`}>
                          {ticket.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {isAdmin && `${ticket.userName} (${ticket.userEmail}) • `}
                        {new Date(ticket.createdAt).toLocaleString()} • {(ticket.replies || []).length} replies
                      </p>
                    </div>
                    {expanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}
                  </button>

                  {expanded && (
                    <div className="px-6 pb-5 space-y-3">
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 whitespace-pre-wrap">
                        {ticket.message}
                      </div>

                      {(ticket.replies || []).length > 0 && (
                        <div className="space-y-2">
                          {ticket.replies.map((reply) => (
                            <div
                              key={reply.id}
                              className="p-3 bg-brand-50 border border-brand-200 rounded-xl text-xs text-slate-800"
                            >
                              <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold text-brand-800">
                                <CheckCircle className="w-3 h-3" />
                                <span>{reply.authorName || 'Administrator'}</span>
                                <span className="text-brand-500 font-normal flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  {new Date(reply.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="whitespace-pre-wrap">{reply.message}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
