import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import {
  websiteAPI,
  alertsAPI,
  analysisAPI,
  reportsAPI,
  dashboardAPI,
  settingsAPI,
  authAPI,
  healthAPI,
  Website,
  Alert,
  AnalysisResult,
  Report,
  DashboardData,
  UserSettings,
  User,
  Snapshot,
} from '@/services/api';

// ==================== WEBSITE HOOKS ====================

export const useWebsites = (params?: { status?: string; search?: string }) => {
  return useQuery({
    queryKey: ['websites', params],
    queryFn: () => websiteAPI.list(params),
    staleTime: 30000,
  });
};

export const useWebsite = (id: number) => {
  return useQuery({
    queryKey: ['website', id],
    queryFn: () => websiteAPI.get(id),
    enabled: !!id,
  });
};

export const useWebsiteSnapshots = (id: number) => {
  return useQuery({
    queryKey: ['website', id, 'snapshots'],
    queryFn: () => websiteAPI.getSnapshots(id),
    enabled: !!id,
  });
};

export const useCreateWebsite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: websiteAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['websites'] });
    },
  });
};

export const useUpdateWebsite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Website> }) =>
      websiteAPI.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['websites'] });
      queryClient.invalidateQueries({ queryKey: ['website', id] });
    },
  });
};

export const useDeleteWebsite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: websiteAPI.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['websites'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useScanWebsite = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, setAsBaseline = false }: { id: number; setAsBaseline?: boolean }) => {
      if (!id || isNaN(Number(id))) {
        console.warn('[useScanWebsite] Skipping - invalid ID:', id);
        return Promise.resolve({ message: 'Skipped', snapshot: null as any });
      }
      return websiteAPI.scan(id, setAsBaseline);
    },
    onSuccess: (_, { id }) => {
      if (id) {
        queryClient.invalidateQueries({ queryKey: ['websites'] });
        queryClient.invalidateQueries({ queryKey: ['website', id] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      }
    },
  });
};

export const useSetBaseline = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => websiteAPI.setBaseline(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['website', id] });
    },
  });
};

// ==================== ALERT HOOKS ====================

export const useAlerts = (params?: { status?: string; severity?: string }) => {
  return useQuery({
    queryKey: ['alerts', params],
    queryFn: () => alertsAPI.list(params),
    staleTime: 10000,
  });
};

export const useActiveAlerts = () => {
  return useQuery({
    queryKey: ['alerts', 'active'],
    queryFn: () => alertsAPI.getActive(),
    staleTime: 10000,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
};

export const useAlertStatistics = () => {
  return useQuery({
    queryKey: ['alerts', 'statistics'],
    queryFn: () => alertsAPI.getStatistics(),
    staleTime: 30000,
  });
};

export const useResolveAlert = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolutionNotes }: { id: number; resolutionNotes?: string }) =>
      alertsAPI.resolve(id, resolutionNotes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

export const useAcknowledgeAlert = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => alertsAPI.acknowledge(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
};

export const useDismissAlert = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => alertsAPI.dismiss(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
};

// ── SOC Investigation Hooks ────────────────────────────────

export const usePredictAlert = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => alertsAPI.predict(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
};

export const useClassifyAlert = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, classification, investigationNotes }: {
      id: number;
      classification: 'true_positive' | 'false_positive';
      investigationNotes?: string;
    }) => alertsAPI.classify(id, classification, investigationNotes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
};

export const useNotifyOwner = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => alertsAPI.notifyOwner(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
};

// ==================== INCIDENT HOOKS ====================

export const useIncidents = () => {
  return useQuery({
    queryKey: ['incidents'],
    queryFn: () => alertsAPI.listIncidents(),
    staleTime: 30000,
  });
};

export const useIncident = (id: number) => {
  return useQuery({
    queryKey: ['incident', id],
    queryFn: () => alertsAPI.getIncident(id),
    enabled: !!id,
  });
};

export const useResolveIncident = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolutionNotes }: { id: number; resolutionNotes?: string }) =>
      alertsAPI.resolveIncident(id, resolutionNotes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incidents'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
};

// ==================== ANALYSIS HOOKS ====================

export const useAnalyses = () => {
  return useQuery({
    queryKey: ['analyses'],
    queryFn: () => analysisAPI.list(),
    staleTime: 30000,
  });
};

export const useAnalysis = (id: number) => {
  return useQuery({
    queryKey: ['analysis', id],
    queryFn: () => analysisAPI.get(id),
    enabled: !!id,
  });
};

export const useAnalysisMatrix = (id: number) => {
  return useQuery({
    queryKey: ['analysis', id, 'matrix'],
    queryFn: () => analysisAPI.getMatrix(id),
    enabled: !!id,
  });
};

export const useAnalysisStatistics = () => {
  return useQuery({
    queryKey: ['analysis', 'statistics'],
    queryFn: () => analysisAPI.getStatistics(),
    staleTime: 30000,
  });
};

export const useCompareSnapshot = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (snapshotId: number) => analysisAPI.compare(snapshotId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analyses'] });
      queryClient.invalidateQueries({ queryKey: ['alerts'] });
    },
  });
};

// ==================== REPORT HOOKS ====================

export const useReports = () => {
  return useQuery({
    queryKey: ['reports'],
    queryFn: () => reportsAPI.list(),
    staleTime: 60000,
  });
};

export const useReport = (id: number) => {
  return useQuery({
    queryKey: ['report', id],
    queryFn: () => reportsAPI.get(id),
    enabled: !!id,
  });
};

export const useReportTemplates = () => {
  return useQuery({
    queryKey: ['reports', 'templates'],
    queryFn: () => reportsAPI.getTemplates(),
    staleTime: 300000,
  });
};

export const useCreateReport = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reportsAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
};

export const useDeleteReport = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reportsAPI.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
};

export const useRegenerateReport = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reportsAPI.regenerate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
  });
};

// ==================== DASHBOARD HOOKS ====================

export const useDashboard = () => {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardAPI.get(),
    staleTime: 30000,
    refetchInterval: 60000, // Refresh every minute
  });
};

// ==================== SETTINGS HOOKS ====================

export const useSettings = () => {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsAPI.get(),
    staleTime: 60000,
  });
};

export const useUpdateSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: settingsAPI.update,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
};

// ==================== AUTH HOOKS ====================

export const useCurrentUser = () => {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: () => authAPI.getCurrentUser(),
    staleTime: 300000,
    retry: false,
  });
};

export const useLogin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authAPI.login(email, password),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
  });
};

export const useRegister = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authAPI.register,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authAPI.logout(),
    onSuccess: () => {
      queryClient.clear();
    },
  });
};

export const useChangePassword = () => {
  return useMutation({
    mutationFn: ({ oldPassword, newPassword }: { oldPassword: string; newPassword: string }) =>
      authAPI.changePassword(oldPassword, newPassword),
  });
};

// ==================== HEALTH HOOKS ====================

export const useHealth = () => {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => healthAPI.check(),
    staleTime: 60000,
    refetchInterval: 60000,
  });
};
