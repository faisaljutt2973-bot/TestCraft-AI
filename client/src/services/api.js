const resolveApiBase = () => {
  const configured = (import.meta.env.VITE_API_BASE_URL || '/api').trim().replace(/\/$/, '');
  if (!configured) return '/api';
  return configured.endsWith('/api') ? configured : `${configured}/api`;
};

const API_BASE = resolveApiBase();
const nativeFetch = globalThis.fetch.bind(globalThis);
const DEFAULT_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 30000) || 30000;
const GENERATION_TIMEOUT_MS = Number(import.meta.env.VITE_GENERATION_TIMEOUT_MS || 60000) || 60000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getHeaders = (isMultipart = false) => {
  const token = localStorage.getItem('testcraft_token');
  const headers = { Accept: 'application/json' };
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const describeStatus = (status) => {
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'You do not have permission to perform this action.';
  if (status === 404) return 'The requested item could not be found.';
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status >= 500) return 'The server is temporarily unavailable. Please try again shortly.';
  return `Request failed with status ${status}`;
};

const handleResponse = async (res) => {
  const text = await res.text().catch(() => '');
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text.slice(0, 200) };
  }

  if (!res.ok) {
    const error = new Error(data.message || describeStatus(res.status));
    error.status = res.status;
    error.code = data.code;
    throw error;
  }
  return data;
};

// All requests flow through this wrapper for a hard timeout, a clearer offline
// message, and a single retry for idempotent GETs (e.g. Render cold starts).
const fetch = async (url, options = {}) => {
  const method = (options.method || 'GET').toUpperCase();
  const timeout = String(url).includes('/tests/generate') ? GENERATION_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;

  const execute = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      return await nativeFetch(url, { ...options, signal: controller.signal });
    } catch (err) {
      if (err.name === 'AbortError') {
        const timeoutError = new Error('The server took too long to respond. It may be waking up — please try again.');
        timeoutError.code = 'TIMEOUT';
        throw timeoutError;
      }
      throw new Error('Unable to reach the server. Check your connection and try again.');
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    let response = await execute();
    if (method === 'GET' && [502, 503, 504].includes(response.status)) {
      await sleep(900);
      response = await execute();
    }
    return response;
  } catch (err) {
    if (method === 'GET' && err.code !== 'TIMEOUT') {
      await sleep(900);
      return execute();
    }
    throw err;
  }
};

export const api = {
  // Auth
  login: async (credentials) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(credentials),
    });
    return handleResponse(res);
  },
  register: async (userData) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(userData),
    });
    return handleResponse(res);
  },
  getMe: async () => {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },
  updateProfile: async (profile) => {
    const res = await fetch(`${API_BASE}/auth/profile`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(profile),
    });
    return handleResponse(res);
  },
  forgotPassword: async (email) => {
    const res = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email }),
    });
    return handleResponse(res);
  },
  resetPassword: async (token, password) => {
    const res = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ token, password }),
    });
    return handleResponse(res);
  },

  // Admin - User Management
  getUsers: async () => {
    const res = await fetch(`${API_BASE}/auth/users`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },
  createUser: async (userData) => {
    const res = await fetch(`${API_BASE}/auth/users`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(userData),
    });
    return handleResponse(res);
  },
  updateUserRole: async (id, updates) => {
    const res = await fetch(`${API_BASE}/auth/users/${id}/role`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    return handleResponse(res);
  },
  deleteUser: async (id) => {
    const res = await fetch(`${API_BASE}/auth/users/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Books
  getBooks: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/books?${query}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },
  getBookById: async (id) => {
    const res = await fetch(`${API_BASE}/books/${id}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },
  createManualBook: async (bookData) => {
    const res = await fetch(`${API_BASE}/books/manual`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(bookData),
    });
    return handleResponse(res);
  },
  uploadBookFile: async (formData) => {
    const res = await fetch(`${API_BASE}/books/upload`, {
      method: 'POST',
      headers: getHeaders(true),
      body: formData,
    });
    return handleResponse(res);
  },
  searchGoogleBooks: async (q) => {
    const res = await fetch(`${API_BASE}/books/google-search?q=${encodeURIComponent(q)}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },
  importGoogleBook: async (data) => {
    const res = await fetch(`${API_BASE}/books/google-import`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },
  updateBookChapters: async (id, chapters) => {
    const res = await fetch(`${API_BASE}/books/${id}/chapters`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ chapters }),
    });
    return handleResponse(res);
  },
  updateBook: async (id, updates) => {
    const res = await fetch(`${API_BASE}/books/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    return handleResponse(res);
  },
  deleteBook: async (id) => {
    const res = await fetch(`${API_BASE}/books/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Syllabus
  getBoards: async () => {
    const res = await fetch(`${API_BASE}/syllabus/boards`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },
  createBoard: async (boardData) => {
    const res = await fetch(`${API_BASE}/syllabus/boards`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(boardData),
    });
    return handleResponse(res);
  },

  // Tests
  generateTest: async (config, idempotencyKey) => {
    const key =
      idempotencyKey ||
      (globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

    const res = await fetch(`${API_BASE}/tests/generate`, {
      method: 'POST',
      headers: { ...getHeaders(), 'Idempotency-Key': key },
      body: JSON.stringify(config),
    });
    return handleResponse(res);
  },
  getTests: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/tests?${query}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },
  getTestById: async (id) => {
    const res = await fetch(`${API_BASE}/tests/${id}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },
  updateTest: async (id, updates) => {
    const res = await fetch(`${API_BASE}/tests/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    return handleResponse(res);
  },
  regenerateQuestion: async (id, sectionId, questionId) => {
    const res = await fetch(`${API_BASE}/tests/${id}/regenerate-question`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ sectionId, questionId }),
    });
    return handleResponse(res);
  },
  deleteTest: async (id) => {
    const res = await fetch(`${API_BASE}/tests/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },
  getExportUrl: (id, type = 'student', format = 'html') => {
    return `${API_BASE}/tests/${id}/export?type=${type}&format=${format}`;
  },
  downloadExport: async (id, type = 'student', format = 'html') => {
    const res = await fetch(`${API_BASE}/tests/${id}/export?type=${type}&format=${format}`, {
      headers: getHeaders(),
    });
    if (!res.ok) return handleResponse(res);

    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^"]+)"?/i);
    const fallbackName = `exam-paper-${type}.${format === 'docx' ? 'doc' : 'html'}`;
    const filename = match ? decodeURIComponent(match[1]) : fallbackName;

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
    return { success: true };
  },

  // Questions
  getQuestions: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/questions?${query}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },
  createQuestion: async (questionData) => {
    const res = await fetch(`${API_BASE}/questions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(questionData),
    });
    return handleResponse(res);
  },
  updateQuestion: async (id, updates) => {
    const res = await fetch(`${API_BASE}/questions/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    return handleResponse(res);
  },
  deleteQuestion: async (id) => {
    const res = await fetch(`${API_BASE}/questions/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Exam Plans (planner blueprints)
  getExamPlans: async () => {
    const res = await fetch(`${API_BASE}/plans`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },
  getExamPlanById: async (id) => {
    const res = await fetch(`${API_BASE}/plans/${id}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },
  createExamPlan: async (planData) => {
    const res = await fetch(`${API_BASE}/plans`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(planData),
    });
    return handleResponse(res);
  },
  updateExamPlan: async (id, updates) => {
    const res = await fetch(`${API_BASE}/plans/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    return handleResponse(res);
  },
  deleteExamPlan: async (id) => {
    const res = await fetch(`${API_BASE}/plans/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Support tickets
  getSupportTickets: async () => {
    const res = await fetch(`${API_BASE}/support`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },
  createSupportTicket: async (ticketData) => {
    const res = await fetch(`${API_BASE}/support`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(ticketData),
    });
    return handleResponse(res);
  },
  getSupportTicketById: async (id) => {
    const res = await fetch(`${API_BASE}/support/${id}`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },
  replySupportTicket: async (id, message) => {
    const res = await fetch(`${API_BASE}/support/${id}/reply`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ message }),
    });
    return handleResponse(res);
  },
  updateSupportTicketStatus: async (id, status) => {
    const res = await fetch(`${API_BASE}/support/${id}/status`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ status }),
    });
    return handleResponse(res);
  },

  // Settings & Stats
  getSettings: async () => {
    const res = await fetch(`${API_BASE}/settings`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },
  updateSettings: async (settings) => {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(settings),
    });
    return handleResponse(res);
  },
  getStats: async () => {
    const res = await fetch(`${API_BASE}/settings/stats`, {
      headers: getHeaders(),
    });
    return handleResponse(res);
  },
};
