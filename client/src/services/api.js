const API_BASE = '/api';

const getHeaders = (isMultipart = false) => {
  const token = localStorage.getItem('testcraft_token');
  const headers = {};
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

const handleResponse = async (res) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Request failed with status ${res.status}`);
  }
  return data;
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
  generateTest: async (config) => {
    const res = await fetch(`${API_BASE}/tests/generate`, {
      method: 'POST',
      headers: getHeaders(),
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
