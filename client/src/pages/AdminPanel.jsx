import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Users,
  BookPlus,
  UploadCloud,
  FileText,
  Sparkles,
  UserPlus,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Globe,
  LifeBuoy,
  Send,
  MessageSquare,
  Clock,
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const AdminPanel = ({ onMakeTest }) => {
  const { user } = useAuth();
  const [tab, setTab] = useState('books'); // 'books' | 'users' | 'support'
  const [books, setBooks] = useState([]);
  const [users, setUsers] = useState([]);
  const [supportTickets, setSupportTickets] = useState([]);
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyingId, setReplyingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);

  // Add Book state
  const [addMode, setAddMode] = useState('manual'); // 'manual' | 'upload'
  const [distribute, setDistribute] = useState(true);
  const [savingBook, setSavingBook] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [bookForm, setBookForm] = useState({
    title: '',
    author: '',
    className: 'Class 9',
    subject: 'Biology',
    boardName: 'Punjab Curriculum and Textbook Board (PCTB)',
    edition: '2025-2026 Academic Edition',
    chaptersText: 'Chapter 1: Introduction to the Subject\nChapter 2: Core Concepts\nChapter 3: Applications',
  });

  // Manage Users state
  const [savingUser, setSavingUser] = useState(false);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'teacher',
    school: '',
  });

  const flash = (type, text) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 4000);
  };

  const loadBooks = async () => {
    const res = await api.getBooks();
    if (res.success) setBooks(res.books);
  };

  const loadUsers = async () => {
    const res = await api.getUsers();
    if (res.success) setUsers(res.users);
  };

  const loadSupport = async () => {
    const res = await api.getSupportTickets();
    if (res.success) setSupportTickets(res.tickets);
  };

  useEffect(() => {
    const init = async () => {
      try {
        setLoading(true);
        await Promise.all([loadBooks(), loadUsers(), loadSupport()]);
      } catch (err) {
        flash('error', err.message);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const buildChapters = () =>
    bookForm.chaptersText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, idx) => ({
        chapterNumber: idx + 1,
        title: line.replace(/^chapter\s*\d+[:.\s\-]*/i, ''),
        pages: `Unit ${idx + 1}`,
        topics: ['Core Learning Objectives', 'Analytical Competencies'],
      }));

  const handleAddBook = async (e) => {
    e.preventDefault();
    try {
      setSavingBook(true);

      if (addMode === 'upload') {
        if (!uploadFile) {
          flash('error', 'Please select a PDF, DOCX, or TXT file to upload.');
          return;
        }
        const formData = new FormData();
        formData.append('document', uploadFile);
        formData.append('title', bookForm.title);
        formData.append('author', bookForm.author);
        formData.append('className', bookForm.className);
        formData.append('subject', bookForm.subject);
        formData.append('boardName', bookForm.boardName);
        formData.append('isPublic', String(distribute));

        const res = await api.uploadBookFile(formData);
        if (res.success) {
          setUploadFile(null);
          setBookForm({ ...bookForm, title: '', author: '' });
          await loadBooks();
          flash('success', res.message || 'Book uploaded and distributed.');
        }
      } else {
        if (!bookForm.title.trim() || !bookForm.className.trim() || !bookForm.subject.trim()) {
          flash('error', 'Book title, class, and subject are required.');
          return;
        }
        const res = await api.createManualBook({
          title: bookForm.title,
          author: bookForm.author,
          className: bookForm.className,
          subject: bookForm.subject,
          boardName: bookForm.boardName,
          edition: bookForm.edition,
          chapters: buildChapters(),
          isPublic: distribute,
        });
        if (res.success) {
          setBookForm({ ...bookForm, title: '', author: '' });
          await loadBooks();
          flash('success', distribute ? 'Book added and distributed to all users.' : 'Book added to library.');
        }
      }
    } catch (err) {
      flash('error', err.message);
    } finally {
      setSavingBook(false);
    }
  };

  const handleToggleDistribute = async (book) => {
    try {
      const res = await api.updateBook(book.id, { isPublic: book.isPublic === false });
      if (res.success) {
        await loadBooks();
        flash('success', `"${book.title}" is now ${res.book.isPublic ? 'distributed to all users' : 'private'}.`);
      }
    } catch (err) {
      flash('error', err.message);
    }
  };

  const handleDeleteBook = async (book) => {
    if (!confirm(`Remove "${book.title}" from the library?`)) return;
    try {
      const res = await api.deleteBook(book.id);
      if (res.success) {
        await loadBooks();
        flash('success', 'Book removed from library.');
      }
    } catch (err) {
      flash('error', err.message);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      setSavingUser(true);
      const res = await api.createUser(userForm);
      if (res.success) {
        setUserForm({ name: '', email: '', password: '', role: 'teacher', school: '' });
        await loadUsers();
        flash('success', res.message || 'User account created.');
      }
    } catch (err) {
      flash('error', err.message);
    } finally {
      setSavingUser(false);
    }
  };

  const handleRoleChange = async (targetUser, role) => {
    try {
      const res = await api.updateUserRole(targetUser.id, { role });
      if (res.success) {
        await loadUsers();
        flash('success', res.message || 'User role updated.');
      }
    } catch (err) {
      flash('error', err.message);
    }
  };

  const handleDeleteUser = async (targetUser) => {
    if (!confirm(`Remove the account for ${targetUser.name}?`)) return;
    try {
      const res = await api.deleteUser(targetUser.id);
      if (res.success) {
        await loadUsers();
        flash('success', res.message || 'User removed.');
      }
    } catch (err) {
      flash('error', err.message);
    }
  };

  const handleReplyTicket = async (ticket) => {
    const message = (replyDrafts[ticket.id] || '').trim();
    if (!message) {
      flash('error', 'Write a reply before sending.');
      return;
    }
    try {
      setReplyingId(ticket.id);
      const res = await api.replySupportTicket(ticket.id, message);
      if (res.success) {
        setReplyDrafts((prev) => ({ ...prev, [ticket.id]: '' }));
        await loadSupport();
        flash('success', 'Reply sent to the user.');
      }
    } catch (err) {
      flash('error', err.message);
    } finally {
      setReplyingId(null);
    }
  };

  const handleTicketStatus = async (ticket, status) => {
    try {
      const res = await api.updateSupportTicketStatus(ticket.id, status);
      if (res.success) {
        await loadSupport();
        flash('success', res.message || 'Ticket updated.');
      }
    } catch (err) {
      flash('error', err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-brand-900 to-indigo-900 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-2 text-xs font-semibold text-brand-200 mb-2">
          <ShieldCheck className="w-4 h-4" />
          <span>Administrator Control Center</span>
        </div>
        <h2 className="text-xl font-black">Admin Panel</h2>
        <p className="text-xs text-slate-300 mt-1 max-w-2xl">
          Add and distribute textbooks to every educator, manage platform user accounts and roles, and respond to
          support messages.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm w-fit">
        <button
          onClick={() => setTab('books')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            tab === 'books' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <BookPlus className="w-4 h-4" />
          <span>Add Book</span>
        </button>
        <button
          onClick={() => setTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            tab === 'users' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Manage Users</span>
        </button>
        <button
          onClick={() => setTab('support')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            tab === 'support' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <LifeBuoy className="w-4 h-4" />
          <span>Support</span>
          {supportTickets.filter((t) => t.status === 'open').length > 0 && (
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                tab === 'support' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {supportTickets.filter((t) => t.status === 'open').length}
            </span>
          )}
        </button>
      </div>

      {notice && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-xs ${
            notice.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {notice.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">Loading admin data...</div>
      ) : (
        <>
          {/* ADD BOOK */}
          {tab === 'books' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Add New Textbook</h3>
                    <p className="text-xs text-slate-500">Create a textbook and optionally distribute it to all users.</p>
                  </div>
                  <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => setAddMode('manual')}
                      className={`px-3 py-1.5 text-[11px] font-bold rounded-lg flex items-center gap-1.5 ${
                        addMode === 'manual' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Manual Entry</span>
                    </button>
                    <button
                      onClick={() => setAddMode('upload')}
                      className={`px-3 py-1.5 text-[11px] font-bold rounded-lg flex items-center gap-1.5 ${
                        addMode === 'upload' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'
                      }`}
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Upload File</span>
                    </button>
                  </div>
                </div>

                <form onSubmit={handleAddBook} className="space-y-4">
                  {addMode === 'upload' && (
                    <div className="border-2 border-dashed border-slate-300 hover:border-brand-500 rounded-2xl p-6 text-center bg-slate-50/50">
                      <UploadCloud className="w-10 h-10 text-brand-600 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-800">
                        {uploadFile ? uploadFile.name : 'Select a textbook PDF / DOCX / TXT file'}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Chapters and topics are automatically detected from the document.
                      </p>
                      <input
                        type="file"
                        accept=".pdf,.docx,.txt"
                        onChange={(e) => setUploadFile(e.target.files[0])}
                        className="mt-3 text-xs text-slate-600 mx-auto block"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Book Title *</label>
                      <input
                        type="text"
                        value={bookForm.title}
                        onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })}
                        placeholder="e.g. Biology Class 9"
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Author / Publisher</label>
                      <input
                        type="text"
                        value={bookForm.author}
                        onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })}
                        placeholder="e.g. National Curriculum Authority"
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Class / Grade *</label>
                      <input
                        type="text"
                        value={bookForm.className}
                        onChange={(e) => setBookForm({ ...bookForm, className: e.target.value })}
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Subject *</label>
                      <input
                        type="text"
                        value={bookForm.subject}
                        onChange={(e) => setBookForm({ ...bookForm, subject: e.target.value })}
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Board / Curriculum</label>
                      <input
                        type="text"
                        value={bookForm.boardName}
                        onChange={(e) => setBookForm({ ...bookForm, boardName: e.target.value })}
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {addMode === 'manual' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Chapters (one per line)
                      </label>
                      <textarea
                        rows={4}
                        value={bookForm.chaptersText}
                        onChange={(e) => setBookForm({ ...bookForm, chaptersText: e.target.value })}
                        className="w-full text-xs p-2.5 border border-slate-300 rounded-xl font-mono focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                  )}

                  <label className="flex items-center gap-2.5 p-3 bg-brand-50/60 border border-brand-200 rounded-xl cursor-pointer">
                    <input
                      type="checkbox"
                      checked={distribute}
                      onChange={(e) => setDistribute(e.target.checked)}
                      className="rounded text-brand-600 focus:ring-brand-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-brand-900 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5" />
                        Distribute to all users
                      </span>
                      <span className="text-[11px] text-brand-700">
                        When enabled, every teacher can access this textbook for test generation.
                      </span>
                    </div>
                  </label>

                  <div className="flex justify-end pt-3 border-t border-slate-100">
                    <button
                      type="submit"
                      disabled={savingBook}
                      className="px-5 py-2.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-xl flex items-center gap-2"
                    >
                      {savingBook ? (
                        <>
                          <Sparkles className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <BookPlus className="w-3.5 h-3.5" />
                          <span>Add Textbook</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Library & Distribution */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">Library & Distribution</h3>
                  <p className="text-xs text-slate-500">Select any book to immediately create a test with it.</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {books.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">No textbooks in the library yet.</div>
                  ) : (
                    books.map((b) => (
                      <div key={b.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900 truncate">{b.title}</h4>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                b.isPublic === false ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {b.isPublic === false ? 'PRIVATE' : 'DISTRIBUTED'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {b.className} - {b.subject} • {b.boardName} • {(b.chapters || []).length} Chapters
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleToggleDistribute(b)}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg flex items-center gap-1.5"
                          >
                            <Globe className="w-3.5 h-3.5" />
                            <span>{b.isPublic === false ? 'Distribute' : 'Make Private'}</span>
                          </button>
                          <button
                            onClick={() => onMakeTest(b)}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-lg flex items-center gap-1.5"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Make Test</span>
                          </button>
                          <button
                            onClick={() => handleDeleteBook(b)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                            title="Delete book"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MANAGE USERS */}
          {tab === 'users' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-base font-bold text-slate-900">Create User Account</h3>
                  <p className="text-xs text-slate-500">Provision a new teacher or administrator account.</p>
                </div>

                <form onSubmit={handleCreateUser} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={userForm.name}
                      onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={userForm.email}
                      onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Password *</label>
                    <input
                      type="password"
                      required
                      value={userForm.password}
                      onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                    <select
                      value={userForm.role}
                      onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
                    >
                      <option value="teacher">Teacher</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">School / Institution</label>
                    <input
                      type="text"
                      value={userForm.school}
                      onChange={(e) => setUserForm({ ...userForm, school: e.target.value })}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={savingUser}
                      className="px-5 py-2.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-xl flex items-center gap-2"
                    >
                      {savingUser ? (
                        <>
                          <Sparkles className="w-3.5 h-3.5 animate-spin" />
                          <span>Creating...</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Create User</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Users Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-900">All Users ({users.length})</h3>
                  <p className="text-xs text-slate-500">Change roles or remove accounts across the platform.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase font-semibold border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-3">Name</th>
                        <th className="px-6 py-3">Email</th>
                        <th className="px-6 py-3">School</th>
                        <th className="px-6 py-3">Role</th>
                        <th className="px-6 py-3">Activity</th>
                        <th className="px-6 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-6 py-3.5 font-bold text-slate-900">
                            {u.name}
                            {u.id === user?.id && (
                              <span className="ml-1.5 text-[10px] font-bold text-brand-600">(You)</span>
                            )}
                          </td>
                          <td className="px-6 py-3.5">{u.email}</td>
                          <td className="px-6 py-3.5">{u.school}</td>
                          <td className="px-6 py-3.5">
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u, e.target.value)}
                              className="text-xs border border-slate-300 rounded-lg px-2 py-1 bg-white focus:outline-none"
                            >
                              <option value="teacher">Teacher</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td className="px-6 py-3.5 text-slate-500">
                            {u.testsCreatedCount} Tests • {u.booksUploadedCount} Books
                          </td>
                          <td className="px-6 py-3.5 text-right">
                            <button
                              onClick={() => handleDeleteUser(u)}
                              disabled={u.id === user?.id}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Delete user"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SUPPORT */}
          {tab === 'support' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Support Messages ({supportTickets.length})</h3>
                  <p className="text-xs text-slate-500">Read user requests and send replies directly to them.</p>
                </div>
                <button
                  onClick={loadSupport}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Refresh
                </button>
              </div>

              {supportTickets.length === 0 ? (
                <div className="p-10 text-center">
                  <LifeBuoy className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">No support messages have been received yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {supportTickets.map((ticket) => (
                    <div key={ticket.id} className="p-6 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <MessageSquare className="w-4 h-4 text-brand-600" />
                            <h4 className="text-sm font-bold text-slate-900">{ticket.subject}</h4>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                                ticket.status === 'replied'
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                  : ticket.status === 'closed'
                                  ? 'bg-slate-100 text-slate-600 border-slate-200'
                                  : 'bg-amber-100 text-amber-800 border-amber-200'
                              }`}
                            >
                              {ticket.status.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">
                            From {ticket.userName} • {ticket.userEmail} •{' '}
                            {new Date(ticket.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {['open', 'replied', 'closed'].map((status) => (
                            <button
                              key={status}
                              onClick={() => handleTicketStatus(ticket, status)}
                              disabled={ticket.status === status}
                              className={`px-2 py-1 text-[10px] font-bold rounded-lg border capitalize ${
                                ticket.status === status
                                  ? 'bg-brand-600 text-white border-brand-600'
                                  : 'text-slate-500 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 whitespace-pre-wrap">
                        {ticket.message}
                      </div>

                      {(ticket.replies || []).length > 0 && (
                        <div className="space-y-2 pl-2 border-l-2 border-brand-100">
                          {ticket.replies.map((reply) => (
                            <div key={reply.id} className="text-xs">
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-brand-800 mb-0.5">
                                <span>{reply.authorName || 'Administrator'}</span>
                                <span className="text-slate-400 font-normal flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  {new Date(reply.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-slate-700 whitespace-pre-wrap">{reply.message}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-2">
                        <textarea
                          rows={2}
                          value={replyDrafts[ticket.id] || ''}
                          onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [ticket.id]: e.target.value }))}
                          placeholder="Write a reply to the user..."
                          className="flex-1 text-xs p-2.5 border border-slate-300 rounded-xl focus:border-brand-500 focus:outline-none"
                        />
                        <button
                          onClick={() => handleReplyTicket(ticket)}
                          disabled={replyingId === ticket.id}
                          className="self-end px-4 py-2.5 text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-xl flex items-center gap-1.5 flex-shrink-0"
                        >
                          {replyingId === ticket.id ? (
                            <Sparkles className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          <span>Send Reply</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
