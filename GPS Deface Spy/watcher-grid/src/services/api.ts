// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8001/api';

// Derive server origin from API base URL (e.g. "http://127.0.0.1:8001")
const SERVER_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

export const getMediaUrl = (path: string) => {
  if (!path) return '';

  // Already absolute URL
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  // Django/FileField values on Windows can sometimes contain backslashes.
  const normalized = path.replace(/\\/g, '/');

  // Handle values that already contain media prefix.
  if (normalized.startsWith('/media/')) {
    return `${SERVER_ORIGIN}${normalized}`;
  }
  if (normalized.startsWith('media/')) {
    return `${SERVER_ORIGIN}/${normalized}`;
  }

  return `${SERVER_ORIGIN}/media/${normalized.replace(/^\/+/, '')}`;
};
export const getProxyUrl = (siteUrl: string) =>
  `${API_BASE_URL}/websites/proxy/page/?url=${encodeURIComponent(siteUrl)}`;
export { API_BASE_URL, SERVER_ORIGIN };

// Token management
let accessToken: string | null = localStorage.getItem('access_token');
let refreshToken: string | null = localStorage.getItem('refresh_token');

export const setTokens = (access: string, refresh: string) => {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('access_token', access);
  localStorage.setItem('refresh_token', refresh);
};

export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
};

export const getAccessToken = () => accessToken;

// API Request helper
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (accessToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle token refresh
  if (response.status === 401 && refreshToken) {
    const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (refreshResponse.ok) {
      const data = await refreshResponse.json();
      setTokens(data.access, refreshToken);
      
      // Retry original request
      (headers as Record<string, string>)['Authorization'] = `Bearer ${data.access}`;
      const retryResponse = await fetch(url, { ...options, headers });
      
      if (!retryResponse.ok) {
        throw new Error(`API Error: ${retryResponse.status}`);
      }
      
      // Handle 204 No Content for retry
      if (retryResponse.status === 204) {
        return {} as T;
      }
      return retryResponse.json();
    } else {
      clearTokens();
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    // Extract the first meaningful message from DRF validation errors.
    // DRF may return: { "field": ["msg"] } or { "error": "msg" } or { "detail": "msg" }
    let message = errorData.error || errorData.detail;
    if (!message) {
      // Collect field-level validation errors (e.g. { username: ["..."], password: ["..."] })
      const fieldMessages: string[] = [];
      for (const [key, value] of Object.entries(errorData)) {
        const msgs = Array.isArray(value) ? value.join(', ') : String(value);
        fieldMessages.push(`${key}: ${msgs}`);
      }
      message = fieldMessages.length > 0 ? fieldMessages.join(' | ') : `API Error: ${response.status}`;
    }
    throw new Error(message);
  }

  // Handle 204 No Content (typically from DELETE requests)
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// ==================== AUTH API ====================

export interface User {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  organization: string;
  role: string;
  created_at: string;
}

export interface AuthResponse {
  message: string;
  user: User;
  tokens: {
    access: string;
    refresh: string;
  };
}

export const authAPI = {
  register: async (data: {
    email: string;
    username: string;
    password: string;
    password_confirm: string;
    first_name?: string;
    last_name?: string;
    organization?: string;
    role: string;
  }): Promise<AuthResponse> => {
    const response = await apiRequest<AuthResponse>('/auth/register/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setTokens(response.tokens.access, response.tokens.refresh);
    return response;
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await apiRequest<AuthResponse>('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setTokens(response.tokens.access, response.tokens.refresh);
    return response;
  },

  logout: async () => {
    try {
      await apiRequest('/auth/logout/', {
        method: 'POST',
        body: JSON.stringify({ refresh: refreshToken }),
      });
    } finally {
      clearTokens();
    }
  },

  getCurrentUser: () => apiRequest<User>('/auth/me/'),

  updateProfile: (data: { first_name?: string; last_name?: string; organization?: string }) =>
    apiRequest<User>('/auth/me/', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  changePassword: (oldPassword: string, newPassword: string) =>
    apiRequest('/auth/change-password/', {
      method: 'POST',
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
    }),
};

// ==================== WEBSITE API ====================

export interface Website {
  id: number;
  name: string;
  url: string;
  description: string;
  status: 'active' | 'paused' | 'error';
  monitoring_interval: number;
  last_scan: string | null;
  next_scan: string | null;
  baseline_screenshot: string | null;
  is_baseline_set: boolean;
  tags: string[];
  notification_emails: string[];
  created_at: string;
  updated_at: string;
  latest_snapshot: Snapshot | null;
  snapshot_count: number;
}

export interface Snapshot {
  id: number;
  website: number;
  screenshot: string | null;
  html_content: string;
  status: 'pending' | 'completed' | 'failed';
  error_message: string;
  response_time: number | null;
  http_status_code: number | null;
  is_baseline: boolean;
  created_at: string;
}

export interface WebsiteListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Website[];
}

export const websiteAPI = {
  list: (params?: { status?: string; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.search) searchParams.append('search', params.search);
    const query = searchParams.toString();
    return apiRequest<WebsiteListResponse>(`/websites/${query ? `?${query}` : ''}`);
  },

  get: (id: number) => apiRequest<Website>(`/websites/${id}/`),

  create: (data: {
    name: string;
    url: string;
    description?: string;
    monitoring_interval?: number;
    tags?: string[];
    notification_emails?: string[];
  }) =>
    apiRequest<Website>('/websites/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: Partial<Website>) =>
    apiRequest<Website>(`/websites/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    apiRequest(`/websites/${id}/`, { method: 'DELETE' }),

  scan: (id: number, setAsBaseline: boolean = false) => {
    if (!id || id === undefined || id === null || isNaN(Number(id))) {
      console.warn('[API] Skipping scan - no valid website ID:', id);
      return Promise.resolve({ message: 'Skipped - no website ID', snapshot: null as any });
    }
    return apiRequest<{ message: string; snapshot: Snapshot }>(`/websites/${id}/scan/`, {
      method: 'POST',
      body: JSON.stringify({ set_as_baseline: setAsBaseline }),
    });
  },

  setBaseline: (id: number) =>
    apiRequest<{ message: string; snapshot: Snapshot }>(`/websites/${id}/set_baseline/`, {
      method: 'POST',
    }),

  getSnapshots: (id: number) =>
    apiRequest<Snapshot[]>(`/websites/${id}/snapshots/`),
};

// ==================== SNAPSHOT API ====================

export const snapshotAPI = {
  getHtmlContent: (id: number) =>
    apiRequest<{ html_content: string; website_url: string; captured_at: string; status: string }>(
      `/websites/snapshots/${id}/html/`
    ),
};

// ==================== PROXY API ====================

export const proxyAPI = {
  fetch: async (url: string): Promise<{ html: string; status_code: number; url: string }> => {
    // Direct fetch without auth - proxy endpoint allows unauthenticated access
    const fetchUrl = `${API_BASE_URL}/websites/proxy/fetch/?url=${encodeURIComponent(url)}`;
    console.log('[proxyAPI] Fetching:', fetchUrl);
    
    const response = await fetch(fetchUrl);
    console.log('[proxyAPI] Response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[proxyAPI] Error response:', errorData);
      throw new Error(errorData.error || `Failed to fetch: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('[proxyAPI] Success, html length:', data.html?.length || 0);
    return data;
  },
};

// ==================== ANALYSIS API ====================

export interface AnalysisResult {
  id: number;
  snapshot: Snapshot;
  baseline_snapshot: Snapshot | null;
  website_name: string;
  website_url: string;
  matrix_data: {
    grid: number[][];
    block_details: Array<{
      id: number;
      row: number;
      col: number;
      changed: boolean;
      magnitude: number;
      type: string | null;
    }>;
  };
  changed_blocks: number;
  total_blocks: number;
  change_percentage: number;
  confidence_score: number;
  similarity_score: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  is_defacement_detected: boolean;
  ai_explanation: string;
  visual_changes: Array<{
    block_id: number;
    location: string;
    type: string;
    magnitude: number;
  }>;
  content_changes: Array<{
    block_id: number;
    location: string;
    type: string;
    magnitude: number;
  }>;
  created_at: string;
}

export interface AnalysisStatistics {
  total_analyses: number;
  defacements_detected: number;
  severity_breakdown: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  averages: {
    confidence: number;
    similarity: number;
    change_percentage: number;
  };
}

export const analysisAPI = {
  list: () => apiRequest<{ results: AnalysisResult[] }>('/analysis/'),

  get: (id: number) => apiRequest<AnalysisResult>(`/analysis/${id}/`),

  getMatrix: (id: number) => apiRequest<{
    matrix_data: AnalysisResult['matrix_data'];
    changed_blocks: number;
    total_blocks: number;
    change_percentage: number;
  }>(`/analysis/${id}/matrix/`),

  compare: (snapshotId: number) =>
    apiRequest<{ message: string; analysis: AnalysisResult }>('/analysis/compare/', {
      method: 'POST',
      body: JSON.stringify({ snapshot_id: snapshotId }),
    }),

  getStatistics: () => apiRequest<AnalysisStatistics>('/analysis/statistics/'),

  seedBaselines: () =>
    apiRequest<{ message: string; results: Array<{ website: string; status: string; analysis_id?: number; severity?: string; changed_blocks?: number; error?: string }> }>(
      '/analysis/seed_baselines/',
      { method: 'POST' },
    ),
};

// ==================== ALERTS API ====================

export interface Alert {
  id: number;
  incident: number | null;
  incident_id: number | null;
  website: number;
  website_name: string;
  website_url: string;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
  is_email_sent: boolean;
  email_sent_at: string | null;
  acknowledged_by: number | null;
  acknowledged_by_name: string | null;
  acknowledged_at: string | null;
  resolved_at: string | null;
  resolution_notes: string;
  // SOC classification
  classification: 'pending' | 'true_positive' | 'false_positive';
  classified_by: number | null;
  classified_by_name: string | null;
  classified_at: string | null;
  investigation_notes: string;
  ai_prediction: 'pending' | 'true_positive' | 'false_positive';
  ai_prediction_confidence: number;
  ai_prediction_details: Record<string, any>;
  owner_notified: boolean;
  owner_notified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIPredictionResult {
  message: string;
  prediction: 'true_positive' | 'false_positive';
  confidence: number;
  details: Record<string, any>;
  alert: Alert;
}

export interface Incident {
  id: number;
  website: number;
  website_name: string;
  website_url: string;
  snapshot: number;
  analysis_result: number | null;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'resolved' | 'false_positive';
  change_percentage: number;
  affected_blocks: number;
  resolved_by: number | null;
  resolved_by_name: string | null;
  resolved_at: string | null;
  resolution_notes: string;
  created_at: string;
  updated_at: string;
}

export const alertsAPI = {
  list: (params?: { status?: string; severity?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    if (params?.severity) searchParams.append('severity', params.severity);
    const query = searchParams.toString();
    return apiRequest<{ results: Alert[] }>(`/alerts/${query ? `?${query}` : ''}`);
  },

  get: (id: number) => apiRequest<Alert>(`/alerts/${id}/`),

  resolve: (id: number, resolutionNotes?: string) =>
    apiRequest<{ message: string; alert: Alert }>(`/alerts/${id}/resolve/`, {
      method: 'PATCH',
      body: JSON.stringify({ resolution_notes: resolutionNotes }),
    }),

  acknowledge: (id: number) =>
    apiRequest<{ message: string; alert: Alert }>(`/alerts/${id}/acknowledge/`, {
      method: 'PATCH',
    }),

  dismiss: (id: number) =>
    apiRequest<{ message: string; alert: Alert }>(`/alerts/${id}/dismiss/`, {
      method: 'PATCH',
    }),

  getActive: () => apiRequest<Alert[]>('/alerts/active/'),

  getStatistics: () => apiRequest<{
    total: number;
    active: number;
    acknowledged: number;
    resolved: number;
    dismissed: number;
    severity_breakdown: {
      low: number;
      medium: number;
      high: number;
      critical: number;
    };
  }>('/alerts/statistics/'),

  // Incidents
  listIncidents: () => apiRequest<{ results: Incident[] }>('/alerts/incidents/'),
  
  getIncident: (id: number) => apiRequest<Incident>(`/alerts/incidents/${id}/`),
  
  resolveIncident: (id: number, resolutionNotes?: string) =>
    apiRequest<{ message: string; incident: Incident }>(`/alerts/incidents/${id}/resolve/`, {
      method: 'PATCH',
      body: JSON.stringify({ resolution_notes: resolutionNotes }),
    }),

  // ── SOC Investigation ─────────────────────────────────

  predict: (id: number) =>
    apiRequest<AIPredictionResult>(`/alerts/${id}/predict/`, {
      method: 'POST',
    }),

  classify: (id: number, classification: 'true_positive' | 'false_positive', investigationNotes?: string) =>
    apiRequest<{ message: string; alert: Alert }>(`/alerts/${id}/classify/`, {
      method: 'PATCH',
      body: JSON.stringify({ classification, investigation_notes: investigationNotes }),
    }),

  notifyOwner: (id: number) =>
    apiRequest<{ message: string; alert: Alert }>(`/alerts/${id}/notify_owner/`, {
      method: 'POST',
    }),

  downloadSocReport: async (id: number) => {
    try {
      const token = getAccessToken();
      const response = await fetch(`${API_BASE_URL}/alerts/${id}/soc_report/`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to generate report');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SOC_Report_Alert_${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      throw new Error('Failed to download SOC report');
    }
  },
};

// ==================== REPORTS API ====================

export interface Report {
  id: number;
  title: string;
  report_type: 'summary' | 'detailed' | 'incident' | 'weekly' | 'monthly';
  status: 'pending' | 'generating' | 'completed' | 'failed';
  websites: number[];
  websites_list: Array<{ id: number; name: string }>;
  start_date: string | null;
  end_date: string | null;
  file: string | null;
  file_size: number | null;
  data: Record<string, unknown>;
  download_url: string | null;
  generated_at: string | null;
  created_at: string;
}

export const reportsAPI = {
  list: () => apiRequest<{ results: Report[] }>('/reports/'),

  get: (id: number) => apiRequest<Report>(`/reports/${id}/`),

  create: (data: {
    title: string;
    report_type: Report['report_type'];
    websites?: number[];
    start_date?: string;
    end_date?: string;
  }) =>
    apiRequest<Report>('/reports/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    apiRequest(`/reports/${id}/`, { method: 'DELETE' }),

  regenerate: (id: number) =>
    apiRequest<{ message: string; report: Report }>(`/reports/${id}/regenerate/`, {
      method: 'POST',
    }),

  getTemplates: () => apiRequest<{
    templates: Array<{ id: string; name: string; description: string }>;
  }>('/reports/templates/'),

  download: async (id: number) => {
    try {
      const token = getAccessToken();
      const response = await fetch(`${API_BASE_URL}/reports/${id}/download/`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        // Fallback: try query-param approach
        window.open(`${API_BASE_URL}/reports/${id}/download/?token=${token}`, '_blank');
        return;
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition');
      const filename = disposition?.match(/filename="(.+)"/)?.[1] || `report_${id}.pdf`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // Last resort fallback
      const token = getAccessToken();
      window.open(`${API_BASE_URL}/reports/${id}/download/?token=${token}`, '_blank');
    }
  },

  sendEmail: (email: string, websiteId?: number | null, reportType: string = 'incident') =>
    apiRequest<{ message: string; email: string; website: string | null }>('/reports/send_email/', {
      method: 'POST',
      body: JSON.stringify({ email, website_id: websiteId, report_type: reportType }),
    }),
};

// ==================== DASHBOARD API ====================

export interface DashboardData {
  total_websites: number;
  active_websites: number;
  total_incidents: number;
  open_incidents: number;
  total_alerts: number;
  active_alerts: number;
  severity_breakdown: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  recent_incidents: Incident[];
  recent_alerts: Alert[];
}

export const dashboardAPI = {
  get: () => apiRequest<DashboardData>('/dashboard/'),
};

// ==================== SETTINGS API ====================

export interface UserSettings {
  id: number;
  email_notifications: boolean;
  notify_on_high: boolean;
  notify_on_critical: boolean;
  notify_on_medium: boolean;
  notify_on_low: boolean;
  dashboard_refresh_interval: number;
  timezone: string;
  date_format: string;
  default_report_type: string;
}

export const settingsAPI = {
  get: () => apiRequest<UserSettings>('/settings/'),

  update: (data: Partial<UserSettings>) =>
    apiRequest<{ message: string; settings: UserSettings }>('/settings/', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// ==================== HEALTH API ====================

export interface HealthStatus {
  status: string;
  database: string;
  scheduler: string;
  timestamp: string;
  version: string;
}

export const healthAPI = {
  check: () => apiRequest<HealthStatus>('/health/'),
};

export default {
  auth: authAPI,
  websites: websiteAPI,
  analysis: analysisAPI,
  alerts: alertsAPI,
  reports: reportsAPI,
  dashboard: dashboardAPI,
  settings: settingsAPI,
  health: healthAPI,
};
