// LocalHire Centralized API Client Module
// Bridges backend API endpoints (http://localhost:5000/api) with LocalStorage fallback mode

const API_BASE_URL = 'http://localhost:5000/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('localHire_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

window.localHireAPI = {
  baseUrl: API_BASE_URL,
  isOnline: false,

  // Check backend server health
  checkHealth: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, { method: 'GET' });
      if (response.ok) {
        window.localHireAPI.isOnline = true;
        return true;
      }
    } catch (e) {
      window.localHireAPI.isOnline = false;
    }
    return false;
  },

  // Auth: Login
  login: async (email, password) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('localHire_session', JSON.stringify(data.user));
        if (data.token) localStorage.setItem('localHire_token', data.token);
        return { success: true, user: data.user };
      } else if (data.message) {
        return { success: false, message: data.message };
      }
    } catch (err) {
      console.warn('[API Client] Server offline, using LocalStorage fallback for login');
    }
    return window.localHireApp.loginUser(email, password);
  },

  // Auth: Register
  register: async (userData) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem('localHire_session', JSON.stringify(data.user));
        if (data.token) localStorage.setItem('localHire_token', data.token);
        return { success: true, user: data.user };
      } else if (data.message) {
        return { success: false, message: data.message };
      }
    } catch (err) {
      console.warn('[API Client] Server offline, using LocalStorage fallback for register');
    }
    return window.localHireApp.registerUser(userData);
  },

  // Auth: Get Current User Profile
  getMe: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          localStorage.setItem('localHire_session', JSON.stringify(data.user));
          return data.user;
        }
      }
    } catch (err) {
      console.warn('[API Client] Server offline, using LocalStorage fallback for getMe');
    }
    return window.localHireApp.getCurrentUser();
  },

  // User / Profile: Update Profile
  updateProfile: async (updates) => {
    try {
      const res = await fetch(`${API_BASE_URL}/users/profile`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(updates)
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          localStorage.setItem('localHire_session', JSON.stringify(data.user));
          return { success: true, user: data.user };
        }
      }
    } catch (err) {
      console.warn('[API Client] Server offline, using LocalStorage fallback for updateProfile');
    }
    const currentUser = window.localHireApp.getCurrentUser();
    if (currentUser) {
      const updated = window.localHireApp.updateUserProfile(currentUser.id, updates);
      if (updated) {
        return { success: true, user: window.localHireApp.getCurrentUser() };
      }
    }
    return { success: false, message: 'Could not update profile' };
  },

  // Workers / Search
  getWorkers: async (queryFilters = {}) => {
    try {
      const queryStr = new URLSearchParams(queryFilters).toString();
      const res = await fetch(`${API_BASE_URL}/users/workers?${queryStr}`);
      if (res.ok) {
        const data = await res.json();
        return data.workers;
      }
    } catch (err) {
      console.warn('[API Client] Server offline, returning local workers');
    }
    let workers = window.localHireApp.getWorkers();
    if (queryFilters.q) {
      const q = queryFilters.q.toLowerCase();
      workers = workers.filter(w =>
        w.name.toLowerCase().includes(q) ||
        w.category.toLowerCase().includes(q) ||
        (w.skills && w.skills.some(s => s.toLowerCase().includes(q))) ||
        (w.bio && w.bio.toLowerCase().includes(q))
      );
    }
    if (queryFilters.category) {
      workers = workers.filter(w => w.category === queryFilters.category);
    }
    if (queryFilters.maxPrice) {
      workers = workers.filter(w => w.hourlyRate <= parseFloat(queryFilters.maxPrice));
    }
    return workers;
  },

  getWorkerById: async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/users/workers/${id}`);
      if (res.ok) {
        const data = await res.json();
        return data.worker;
      }
    } catch (err) {
      console.warn('[API Client] Server offline, using local worker lookup');
    }
    return window.localHireApp.getWorkerById(id);
  },

  // Jobs
  getJobs: async (queryFilters = {}) => {
    try {
      const queryStr = new URLSearchParams(queryFilters).toString();
      const res = await fetch(`${API_BASE_URL}/jobs?${queryStr}`);
      if (res.ok) {
        const data = await res.json();
        return data.jobs;
      }
    } catch (err) {
      console.warn('[API Client] Server offline, returning local jobs');
    }
    let jobs = window.localHireApp.getJobs();
    if (queryFilters.category) {
      jobs = jobs.filter(j => j.category === queryFilters.category);
    }
    if (queryFilters.q) {
      const q = queryFilters.q.toLowerCase();
      jobs = jobs.filter(j => j.title.toLowerCase().includes(q) || j.description.toLowerCase().includes(q));
    }
    return jobs;
  },

  getJobById: async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/jobs/${id}`);
      if (res.ok) {
        const data = await res.json();
        return data.job;
      }
    } catch (err) {
      console.warn('[API Client] Server offline, returning local job');
    }
    const jobs = window.localHireApp.getJobs();
    return jobs.find(j => j.id === id);
  },

  saveJob: async (jobData) => {
    try {
      const res = await fetch(`${API_BASE_URL}/jobs`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(jobData)
      });
      if (res.ok) {
        const data = await res.json();
        window.localHireApp.saveJob(data.job);
        return data.job;
      }
    } catch (err) {
      console.warn('[API Client] Server offline, saving job locally');
    }
    window.localHireApp.saveJob(jobData);
    return jobData;
  },

  updateJobStatus: async (jobId, status, assignedWorkerId = null) => {
    try {
      const res = await fetch(`${API_BASE_URL}/jobs/${jobId}/status`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status, assignedWorkerId })
      });
      if (res.ok) {
        const data = await res.json();
        return data.job;
      }
    } catch (err) {
      console.warn('[API Client] Server offline, updating job status locally');
    }
    const jobs = window.localHireApp.getJobs();
    const job = jobs.find(j => j.id === jobId);
    if (job) {
      job.status = status;
      if (assignedWorkerId) job.assignedWorker = assignedWorkerId;
      localStorage.setItem('localHire_jobs', JSON.stringify(jobs));
    }
    return job;
  },

  // Applications / Quotes
  createApplication: async (jobId, quote, message) => {
    try {
      const res = await fetch(`${API_BASE_URL}/applications`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ jobId, quote, message })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        window.localHireApp.saveApplication(data.application);
        return { success: true, application: data.application };
      } else if (data.message) {
        return { success: false, message: data.message };
      }
    } catch (err) {
      console.warn('[API Client] Server offline, applying locally');
    }
    const currentUser = window.localHireApp.getCurrentUser();
    const appData = {
      jobId,
      workerId: currentUser ? currentUser.id : 'w_guest',
      workerName: currentUser ? currentUser.name : 'Guest Worker',
      workerAvatar: currentUser ? currentUser.avatarUrl : '',
      quote,
      message,
      status: 'Pending'
    };
    window.localHireApp.saveApplication(appData);
    return { success: true, application: appData };
  },

  getApplicationsForJob: async (jobId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/applications/job/${jobId}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        return data.applications;
      }
    } catch (err) {
      console.warn('[API Client] Server offline, getting applications locally');
    }
    return window.localHireApp.getApplicationsForJob(jobId);
  },

  getWorkerApplications: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/applications/worker/me`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        return data.applications;
      }
    } catch (err) {
      console.warn('[API Client] Server offline, getting worker applications locally');
    }
    const currentUser = window.localHireApp.getCurrentUser();
    return currentUser ? window.localHireApp.getApplicationsForWorker(currentUser.id) : [];
  },

  acceptQuote: async (applicationId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/applications/${applicationId}/accept`, {
        method: 'PUT',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        return { success: true, message: data.message };
      }
    } catch (err) {
      console.warn('[API Client] Server offline, accepting quote locally');
    }
    const apps = window.localHireApp.getApplications();
    const app = apps.find(a => a.id === applicationId);
    if (app) {
      app.status = 'Accepted';
      localStorage.setItem('localHire_applications', JSON.stringify(apps));

      const jobs = window.localHireApp.getJobs();
      const job = jobs.find(j => j.id === app.jobId);
      if (job) {
        job.status = 'In Progress';
        job.assignedWorker = app.workerId;
        localStorage.setItem('localHire_jobs', JSON.stringify(jobs));
      }
    }
    return { success: true, message: 'Quote accepted locally' };
  },

  // Chat / Messages
  sendMessage: async (receiverId, jobId, content) => {
    try {
      const res = await fetch(`${API_BASE_URL}/chat/messages`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ receiverId, jobId, content })
      });
      if (res.ok) {
        const data = await res.json();
        return data.message;
      }
    } catch (err) {
      console.warn('[API Client] Server offline, saving message locally');
    }
    // Local fallback message append
    const localMsgs = JSON.parse(localStorage.getItem('localHire_messages') || '[]');
    const currentUser = window.localHireApp.getCurrentUser();
    const msgObj = {
      id: 'm_' + Date.now(),
      sender: currentUser ? currentUser.id : 'guest',
      receiver: receiverId,
      job: jobId,
      content,
      createdAt: new Date().toISOString()
    };
    localMsgs.push(msgObj);
    localStorage.setItem('localHire_messages', JSON.stringify(localMsgs));
    return msgObj;
  },

  getMessages: async (otherUserId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/chat/messages/${otherUserId}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        return data.messages;
      }
    } catch (err) {
      console.warn('[API Client] Server offline, retrieving local messages');
    }
    const localMsgs = JSON.parse(localStorage.getItem('localHire_messages') || '[]');
    const currentUser = window.localHireApp.getCurrentUser();
    const cId = currentUser ? currentUser.id : 'guest';
    return localMsgs.filter(m =>
      (m.sender === cId && m.receiver === otherUserId) ||
      (m.sender === otherUserId && m.receiver === cId)
    );
  },

  // Reviews
  createReview: async (jobId, workerId, rating, comment) => {
    try {
      const res = await fetch(`${API_BASE_URL}/reviews`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ jobId, workerId, rating, comment })
      });
      if (res.ok) {
        const data = await res.json();
        return { success: true, review: data.review, updatedRating: data.updatedRating };
      }
    } catch (err) {
      console.warn('[API Client] Server offline, adding review locally');
    }
    const reviews = JSON.parse(localStorage.getItem('localHire_reviews') || '[]');
    const currentUser = window.localHireApp.getCurrentUser();
    const revObj = {
      id: 'r_' + Date.now(),
      job: jobId,
      worker: workerId,
      customer: currentUser ? { name: currentUser.name, avatarUrl: currentUser.avatarUrl } : { name: 'Customer' },
      rating: parseFloat(rating),
      comment,
      createdAt: new Date().toISOString()
    };
    reviews.unshift(revObj);
    localStorage.setItem('localHire_reviews', JSON.stringify(reviews));
    return { success: true, review: revObj };
  },

  getWorkerReviews: async (workerId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/reviews/worker/${workerId}`);
      if (res.ok) {
        const data = await res.json();
        return data.reviews;
      }
    } catch (err) {
      console.warn('[API Client] Server offline, loading local reviews');
    }
    const reviews = JSON.parse(localStorage.getItem('localHire_reviews') || '[]');
    return reviews.filter(r => r.worker === workerId);
  },

  // Admin Portal API
  getAdminMetrics: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/metrics`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        return data.metrics;
      }
    } catch (err) {
      console.warn('[API Client] Server offline, building local admin metrics');
    }
    const users = window.localHireApp.getUsers();
    const jobs = window.localHireApp.getJobs();
    const apps = window.localHireApp.getApplications();
    return {
      totalUsers: users.length,
      totalWorkers: users.filter(u => u.role === 'Worker').length,
      totalCustomers: users.filter(u => u.role === 'Customer').length,
      totalJobs: jobs.length,
      activeJobs: jobs.filter(j => j.status === 'Open' || j.status === 'In Progress').length,
      completedJobs: jobs.filter(j => j.status === 'Completed').length,
      totalApplications: apps.length
    };
  },

  getAdminUsers: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        return data.users;
      }
    } catch (err) {
      console.warn('[API Client] Server offline, returning local users for admin');
    }
    return window.localHireApp.getUsers();
  },

  deleteAdminUser: async (userId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        return { success: true };
      }
    } catch (err) {
      console.warn('[API Client] Server offline, deleting user locally');
    }
    const users = window.localHireApp.getUsers().filter(u => u.id !== userId);
    localStorage.setItem('localHire_users', JSON.stringify(users));
    return { success: true };
  },

  deleteAdminJob: async (jobId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/jobs/${jobId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        return { success: true };
      }
    } catch (err) {
      console.warn('[API Client] Server offline, deleting job locally');
    }
    const jobs = window.localHireApp.getJobs().filter(j => j.id !== jobId);
    localStorage.setItem('localHire_jobs', JSON.stringify(jobs));
    return { success: true };
  },

  // Escrow & Milestone Payment API Services
  escrow: {
    fundEscrow: async (jobId, workerId, amount, paymentMethod) => {
      try {
        const res = await fetch(`${API_BASE_URL}/escrow/fund`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ jobId, workerId, amount, paymentMethod })
        });
        if (res.ok) {
          const data = await res.json();
          return data;
        }
      } catch (err) {
        console.warn('[API Client] Server offline for fundEscrow, using local mode');
      }
      return { success: false };
    },

    releaseEscrow: async (jobId) => {
      try {
        const res = await fetch(`${API_BASE_URL}/escrow/release`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ jobId })
        });
        if (res.ok) {
          const data = await res.json();
          return data;
        }
      } catch (err) {
        console.warn('[API Client] Server offline for releaseEscrow, using local mode');
      }
      return { success: false };
    },

    getJobEscrow: async (jobId) => {
      try {
        const res = await fetch(`${API_BASE_URL}/escrow/job/${jobId}`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          return data.escrow;
        }
      } catch (err) {
        console.warn('[API Client] Server offline for getJobEscrow');
      }
      return null;
    },

    getUserLedger: async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/escrow/ledger`, {
          headers: getAuthHeaders()
        });
        if (res.ok) {
          const data = await res.json();
          return data.transactions;
        }
      } catch (err) {
        console.warn('[API Client] Server offline for getUserLedger');
      }
      return [];
    }
  }
};

// Check backend status on script load
window.localHireAPI.checkHealth();
