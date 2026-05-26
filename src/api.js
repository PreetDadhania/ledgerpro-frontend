import axios from 'axios';

// Use VITE_API_URL in production (Render), fallback to /api in local dev
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('lp_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('lp_token');
      localStorage.removeItem('lp_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────
export const authAPI = {
  register:       (data) => api.post('/auth/register', data),
  login:          (data) => api.post('/auth/login', data),
  changePassword: (data) => api.post('/auth/change-password', data),
  me:             ()     => api.get('/auth/me'),
};

// ── Customers ─────────────────────────────────────────────────────────
export const customerAPI = {
  list:   ()         => api.get('/customers'),
  create: (data)     => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id)       => api.delete(`/customers/${id}`),
  detail: (id)       => api.get(`/customers/${id}/detail`),
};

// ── Transactions ──────────────────────────────────────────────────────
export const txnAPI = {
  create: (data)     => api.post('/transactions', data),
  update: (id, data) => api.put(`/transactions/${id}`, data),
  delete: (id)       => api.delete(`/transactions/${id}`),
};

// ── Payments ──────────────────────────────────────────────────────────
export const paymentAPI = {
  create: (data)     => api.post('/payments', data),
  update: (id, data) => api.put(`/payments/${id}`, data),
  delete: (id)       => api.delete(`/payments/${id}`),
};

export default api;
