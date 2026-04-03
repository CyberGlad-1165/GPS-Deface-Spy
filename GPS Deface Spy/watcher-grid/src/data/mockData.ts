// Mock data for the defacement detection platform

export interface Website {
  id: string;
  url: string;
  name: string;
  status: 'safe' | 'warning' | 'defaced' | 'monitoring';
  lastChecked: string;
  baselineDate: string;
  framesAnalyzed: number;
  monitoringInterval: number;
  frameMonitoring: boolean;
  matrixAnalysis: boolean;
  nlpAnalysis: boolean;
}

export interface Alert {
  id: string;
  websiteId: string;
  websiteName: string;
  websiteUrl: string;
  type: 'defacement' | 'content_change' | 'text_modification' | 'visual_anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  description: string;
  confidence: number;
  resolved: boolean;
}

export interface AnalysisResult {
  id: string;
  websiteId: string;
  timestamp: string;
  framesDifferent: number;
  totalFrames: number;
  matrixChanges: number;
  textChanges: number;
  overallScore: number;
  severity: 'safe' | 'low' | 'medium' | 'high' | 'critical';
}

export const mockWebsites: Website[] = [
  {
    id: '1',
    url: 'https://example-bank.com',
    name: 'Example Bank',
    status: 'safe',
    lastChecked: '2024-01-15T10:30:00Z',
    baselineDate: '2024-01-01T00:00:00Z',
    framesAnalyzed: 1247,
    monitoringInterval: 5,
    frameMonitoring: true,
    matrixAnalysis: true,
    nlpAnalysis: true,
  },
  {
    id: '2',
    url: 'https://gov-portal.org',
    name: 'Government Portal',
    status: 'warning',
    lastChecked: '2024-01-15T10:25:00Z',
    baselineDate: '2024-01-02T00:00:00Z',
    framesAnalyzed: 892,
    monitoringInterval: 10,
    frameMonitoring: true,
    matrixAnalysis: true,
    nlpAnalysis: false,
  },
  {
    id: '3',
    url: 'https://ecommerce-store.io',
    name: 'E-Commerce Store',
    status: 'defaced',
    lastChecked: '2024-01-15T10:20:00Z',
    baselineDate: '2024-01-03T00:00:00Z',
    framesAnalyzed: 2341,
    monitoringInterval: 5,
    frameMonitoring: true,
    matrixAnalysis: true,
    nlpAnalysis: true,
  },
  {
    id: '4',
    url: 'https://university-edu.edu',
    name: 'University Portal',
    status: 'safe',
    lastChecked: '2024-01-15T10:15:00Z',
    baselineDate: '2024-01-04T00:00:00Z',
    framesAnalyzed: 567,
    monitoringInterval: 15,
    frameMonitoring: true,
    matrixAnalysis: false,
    nlpAnalysis: true,
  },
  {
    id: '5',
    url: 'https://news-media.com',
    name: 'News Media',
    status: 'monitoring',
    lastChecked: '2024-01-15T10:10:00Z',
    baselineDate: '2024-01-05T00:00:00Z',
    framesAnalyzed: 1823,
    monitoringInterval: 5,
    frameMonitoring: true,
    matrixAnalysis: true,
    nlpAnalysis: true,
  },
];

export const mockAlerts: Alert[] = [
  {
    id: 'a1',
    websiteId: '3',
    websiteName: 'E-Commerce Store',
    websiteUrl: 'https://ecommerce-store.io',
    type: 'defacement',
    severity: 'critical',
    timestamp: '2024-01-15T10:20:00Z',
    description: 'Major visual changes detected. Homepage content replaced with unauthorized content.',
    confidence: 98.5,
    resolved: false,
  },
  {
    id: 'a2',
    websiteId: '2',
    websiteName: 'Government Portal',
    websiteUrl: 'https://gov-portal.org',
    type: 'content_change',
    severity: 'medium',
    timestamp: '2024-01-15T09:45:00Z',
    description: 'Significant text modifications detected in the footer section.',
    confidence: 76.2,
    resolved: false,
  },
  {
    id: 'a3',
    websiteId: '1',
    websiteName: 'Example Bank',
    websiteUrl: 'https://example-bank.com',
    type: 'visual_anomaly',
    severity: 'low',
    timestamp: '2024-01-14T22:30:00Z',
    description: 'Minor CSS changes detected. Likely authorized update.',
    confidence: 45.8,
    resolved: true,
  },
  {
    id: 'a4',
    websiteId: '5',
    websiteName: 'News Media',
    websiteUrl: 'https://news-media.com',
    type: 'text_modification',
    severity: 'high',
    timestamp: '2024-01-14T18:15:00Z',
    description: 'Headline text modified without authorization.',
    confidence: 89.3,
    resolved: true,
  },
];

export const dashboardStats = {
  totalWebsites: 47,
  framesAnalyzed: 124589,
  defacementsDetected: 12,
  safeWebsites: 42,
  activeAlerts: 5,
  avgResponseTime: '2.3s',
};

export const trendData = [
  { date: 'Jan 1', safe: 40, warning: 4, defaced: 1 },
  { date: 'Jan 3', safe: 42, warning: 3, defaced: 2 },
  { date: 'Jan 5', safe: 41, warning: 5, defaced: 1 },
  { date: 'Jan 7', safe: 43, warning: 2, defaced: 2 },
  { date: 'Jan 9', safe: 44, warning: 3, defaced: 0 },
  { date: 'Jan 11', safe: 42, warning: 4, defaced: 1 },
  { date: 'Jan 13', safe: 45, warning: 2, defaced: 0 },
  { date: 'Jan 15', safe: 42, warning: 4, defaced: 1 },
];

export const severityDistribution = [
  { name: 'Safe', value: 42, color: 'hsl(142, 76%, 36%)' },
  { name: 'Low', value: 3, color: 'hsl(199, 89%, 48%)' },
  { name: 'Medium', value: 2, color: 'hsl(38, 92%, 50%)' },
  { name: 'High', value: 1, color: 'hsl(15, 75%, 50%)' },
  { name: 'Critical', value: 1, color: 'hsl(0, 72%, 51%)' },
];

export const recentActivity = [
  { id: 1, action: 'Scan completed', website: 'Example Bank', time: '2 mins ago', status: 'success' },
  { id: 2, action: 'Alert triggered', website: 'E-Commerce Store', time: '15 mins ago', status: 'danger' },
  { id: 3, action: 'Baseline captured', website: 'News Media', time: '1 hour ago', status: 'info' },
  { id: 4, action: 'Scan completed', website: 'Government Portal', time: '2 hours ago', status: 'warning' },
  { id: 5, action: 'Website added', website: 'University Portal', time: '3 hours ago', status: 'info' },
];

// Matrix analysis mock data (8x8 grid)
export const matrixData = {
  baseline: Array(64).fill(0).map((_, i) => ({
    id: i,
    value: Math.random() * 100,
    status: 'safe' as const,
  })),
  current: Array(64).fill(0).map((_, i) => ({
    id: i,
    value: Math.random() * 100,
    status: (i === 12 || i === 13 || i === 20 || i === 21 || i === 45 || i === 46) 
      ? 'changed' as const 
      : 'safe' as const,
    changePercent: (i === 12 || i === 13 || i === 20 || i === 21 || i === 45 || i === 46)
      ? Math.random() * 80 + 20
      : 0,
  })),
};
