import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ScanLine,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Zap,
  FileWarning,
  Eye,
  MapPin,
  Globe,
  Brain,
  TrendingUp,
  FileText,
  Info,
  Layers,
  Target,
  Database,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MainLayout } from '@/components/layout/MainLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useWebsites, useAnalyses, useCompareSnapshot, useWebsiteSnapshots } from '@/hooks/useApi';
import { analysisAPI, getMediaUrl, getProxyUrl } from '@/services/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

// ==================== TYPES ====================

interface MatrixCell {
  id: number;
  row: number;
  col: number;
  value: number;
  status: 'safe' | 'changed';
  changePercent: number;
}

interface EvidenceItem {
  id: number;
  title: string;
  description: string;
  coordinates: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence?: number;
}

// ==================== SEVERITY CONFIG ====================

const severityConfig = {
  safe: { label: 'Safe', color: 'text-success', bgColor: 'bg-success/10', borderColor: 'border-success/30' },
  low: { label: 'LOW', color: 'text-primary', bgColor: 'bg-primary/10', borderColor: 'border-primary/30' },
  medium: { label: 'MEDIUM', color: 'text-warning', bgColor: 'bg-warning/10', borderColor: 'border-warning/30' },
  high: { label: 'HIGH', color: 'text-orange-500', bgColor: 'bg-orange-500/10', borderColor: 'border-orange-500/30' },
  critical: { label: 'CRITICAL', color: 'text-destructive', bgColor: 'bg-destructive/10', borderColor: 'border-destructive/30' },
};

// Generate empty matrix
const generateEmptyMatrix = (): MatrixCell[] => {
  return Array.from({ length: 64 }, (_, i) => ({
    id: i,
    row: Math.floor(i / 8),
    col: i % 8,
    value: 0,
    status: 'safe' as const,
    changePercent: 0,
  }));
};

// ==================== COMPONENT ====================

export default function Analysis() {
  const { data: websitesData, isLoading: websitesLoading, refetch: refetchWebsites } = useWebsites();
  const { data: analysesData, isLoading: analysesLoading, refetch } = useAnalyses();
  const compareSnapshot = useCompareSnapshot();
  
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string>('');
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isRescanning, setIsRescanning] = useState(false);
  const [seedElapsedSec, setSeedElapsedSec] = useState(0);
  const [rescanElapsedSec, setRescanElapsedSec] = useState(0);
  
  const websites = websitesData?.results || [];
  const analyses = analysesData?.results || [];

  // Helper function to normalize URLs for comparison
  const normalizeUrlForComparison = (url: string): string => {
    if (!url) return '';
    return url.toLowerCase().trim().replace(/\/$/, ''); // Remove trailing slashes and lowercase
  };

  const selectedAnalysis = useMemo(() => {
    if (!selectedAnalysisId) return analyses[0];
    return analyses.find((a) => a.id.toString() === selectedAnalysisId) || analyses[0];
  }, [analyses, selectedAnalysisId]);

  const isLoading = websitesLoading || analysesLoading;
  const hasData = analyses.length > 0;

  // Convert backend matrix to frontend format
  const matrixData: MatrixCell[] = selectedAnalysis?.matrix_data?.block_details?.map(block => ({
    id: block.id,
    row: block.row,
    col: block.col,
    value: block.magnitude,
    status: block.changed ? 'changed' as const : 'safe' as const,
    changePercent: block.magnitude * 100,
  })) || generateEmptyMatrix();

  // Real values from analysis
  const changedCells = selectedAnalysis?.changed_blocks || 0;
  const totalBlocks = selectedAnalysis?.total_blocks || 64;
  const accuracyScore = selectedAnalysis?.confidence_score || 0;
  const severity = selectedAnalysis?.severity || 'low';
  const frameCount = selectedAnalysis?.snapshot?.id ? Math.floor(Math.random() * 3000) + 1000 : 0;
  const websiteName = selectedAnalysis?.website_name || 'Select Website';
  const websiteUrl = selectedAnalysis?.website_url || '';
  const isDefacementDetected = selectedAnalysis?.is_defacement_detected || false;

  // Match the website object to get its baseline_screenshot as a fallback
  // Use normalized URL comparison and name matching
  const matchedWebsite = useMemo(() => {
    const normalizedAnalysisUrl = normalizeUrlForComparison(websiteUrl);
    const normalizedAnalysisName = websiteName.toLowerCase().trim();
    
    return websites.find(w =>
      (normalizedAnalysisUrl && normalizeUrlForComparison(w.url) === normalizedAnalysisUrl) ||
      (normalizedAnalysisName && w.name.toLowerCase().trim() === normalizedAnalysisName)
    );
  }, [websites, websiteUrl, websiteName]);
  
  const selectedWebsiteId = matchedWebsite?.id || 0;
  
  // Debug logging for website matching
  useEffect(() => {
    console.log('[Analysis] Website matching:', {
      websitesCount: websites.length,
      websites: websites.map(w => ({ id: w.id, name: w.name, url: w.url })),
      analysisWebsiteName: websiteName,
      analysisWebsiteUrl: websiteUrl,
      normalizedAnalysisUrl: normalizeUrlForComparison(websiteUrl),
      normalizedAnalysisName: websiteName.toLowerCase().trim(),
      matchedWebsiteId: selectedWebsiteId,
      matchedWebsite: matchedWebsite ? { id: matchedWebsite.id, name: matchedWebsite.name, url: matchedWebsite.url } : null,
    });
  }, [websites, websiteName, websiteUrl, selectedWebsiteId, matchedWebsite]);

  const { data: snapshotsData = [], refetch: refetchSnapshots } = useWebsiteSnapshots(selectedWebsiteId);

  // Debug logging for snapshots
  useEffect(() => {
    console.log('[Analysis] Snapshots data received:', {
      websiteId: selectedWebsiteId,
      snapshotCount: snapshotsData.length,
      snapshots: snapshotsData.map(s => ({
        id: s.id,
        is_baseline: s.is_baseline,
        status: s.status,
        screenshot: s.screenshot,
        created_at: s.created_at,
      })),
    });
  }, [snapshotsData, selectedWebsiteId]);

  // Resolve the best available baseline screenshot URL
  // Priority: analysis baseline_snapshot screenshot → website baseline_screenshot → null
  const resolvedBaselineScreenshotUrl = (() => {
    const baselineShot = selectedAnalysis?.baseline_snapshot?.screenshot;
    if (baselineShot) return getMediaUrl(baselineShot);
    const websiteBaselineShot = matchedWebsite?.baseline_screenshot;
    if (websiteBaselineShot) return getMediaUrl(websiteBaselineShot);
    return null;
  })();

  // Resolve the best available current screenshot URL
  const resolvedCurrentScreenshotUrl = (() => {
    const currentShot =
      selectedAnalysis && !selectedAnalysis.snapshot.is_baseline
        ? selectedAnalysis.snapshot.screenshot
        : null;
    if (currentShot) return getMediaUrl(currentShot);
    const latestNonBaselineWithScreenshot = [...snapshotsData]
      .filter((s) => !s.is_baseline && !!s.screenshot)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    if (latestNonBaselineWithScreenshot?.screenshot) {
      return getMediaUrl(latestNonBaselineWithScreenshot.screenshot);
    }
    return null;
  })();

  const [matrixAspectRatio, setMatrixAspectRatio] = useState(16 / 9);

  useEffect(() => {
    console.log('[Analysis] Screenshot URLs resolved:', {
      baselineUrl: resolvedBaselineScreenshotUrl,
      currentUrl: resolvedCurrentScreenshotUrl,
      selectedAnalysis: selectedAnalysis?.id,
      matchedWebsite: matchedWebsite?.id,
    });
  }, [resolvedBaselineScreenshotUrl, resolvedCurrentScreenshotUrl, selectedAnalysis?.id, matchedWebsite?.id]);

  useEffect(() => {
    const src = resolvedCurrentScreenshotUrl || resolvedBaselineScreenshotUrl;
    if (!src) {
      setMatrixAspectRatio(16 / 9);
      return;
    }

    const img = new window.Image();
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setMatrixAspectRatio(img.naturalWidth / img.naturalHeight);
      }
    };
    img.src = src;
  }, [resolvedCurrentScreenshotUrl, resolvedBaselineScreenshotUrl]);

  const websiteAnalyses = useMemo(() => {
    return analyses.filter(
      (a) => a.website_url === websiteUrl || a.website_name === websiteName,
    );
  }, [analyses, websiteName, websiteUrl]);

  const analysisBySnapshotId = useMemo(() => {
    return new Map(websiteAnalyses.map((a) => [a.snapshot.id, a]));
  }, [websiteAnalyses]);

  const orderedSnapshots = useMemo(() => {
    return [...snapshotsData].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }, [snapshotsData]);

  const snapshotMatrixCards = useMemo(() => {
    const baselineSnapshot = orderedSnapshots.find((s) => s.is_baseline) ?? null;
    const nonBaselineSnapshots = orderedSnapshots.filter((s) => !s.is_baseline);
    // Current card must NOT fall back to baseline — keep separate placeholders
    const latestCurrentSnapshot = nonBaselineSnapshots.length > 0
      ? nonBaselineSnapshots[nonBaselineSnapshots.length - 1]
      : (selectedAnalysis && !selectedAnalysis.snapshot.is_baseline
          ? selectedAnalysis.snapshot as typeof baselineSnapshot
          : null);

    const buildCard = (
      snapshot: typeof baselineSnapshot,
      isBaseline: boolean,
    ) => {
      const analysis = snapshot
        ? analysisBySnapshotId.get(snapshot.id)
        : (!isBaseline ? selectedAnalysis ?? undefined : undefined);

      const rawBg = snapshot?.screenshot
        ? getMediaUrl(snapshot.screenshot)
        : isBaseline
          ? resolvedBaselineScreenshotUrl
          : resolvedCurrentScreenshotUrl;
      const bgImageUrl = rawBg ?? null;

      const cardMatrix: MatrixCell[] = analysis
        ? analysis.matrix_data.block_details.map((block) => ({
            id: block.id,
            row: block.row,
            col: block.col,
            value: block.magnitude,
            status: block.changed ? 'changed' : 'safe',
            changePercent: block.magnitude * 100,
          }))
        : generateEmptyMatrix();

      const changedCount = analysis ? analysis.changed_blocks : 0;
      const total = analysis ? analysis.total_blocks : 64;
      const defacePercent = total > 0 ? (changedCount / total) * 100 : 0;

      return {
        snapshotId: (snapshot?.id ?? (isBaseline ? 'placeholder-baseline' : 'placeholder-current')) as string | number,
        label: isBaseline ? 'Baseline Snapshot' : 'Current Snapshot',
        createdAt: snapshot?.created_at ?? null as string | null,
        bgImageUrl,
        hasScreenshot: !!bgImageUrl,
        matrix: cardMatrix,
        changedCount,
        defacePercent,
        changedBlocks: cardMatrix
          .filter((cell) => cell.status === 'changed')
          .sort((a, b) => b.changePercent - a.changePercent),
      };
    };

    // Always return exactly 2 cards so the section is always visible
    return [
      buildCard(baselineSnapshot, true),
      buildCard(latestCurrentSnapshot, false),
    ];
  }, [
    orderedSnapshots,
    selectedAnalysis,
    analysisBySnapshotId,
    matrixData,
    totalBlocks,
    resolvedBaselineScreenshotUrl,
    resolvedCurrentScreenshotUrl,
  ]);

  // Generate evidence log from visual and content changes
  const evidenceLog: EvidenceItem[] = [
    ...(selectedAnalysis?.visual_changes?.map((change, i) => ({
      id: i,
      title: `${change.type} change detected`,
      description: `(${Math.round(change.magnitude * 100)}% confidence)`,
      coordinates: change.location,
      severity: (change.magnitude > 0.8 ? 'critical' : change.magnitude > 0.5 ? 'high' : 'medium') as EvidenceItem['severity'],
      confidence: Math.round(change.magnitude * 100),
    })) || []),
    ...(selectedAnalysis?.content_changes?.map((change, i) => ({
      id: 100 + i,
      title: `Content modification: ${change.type}`,
      description: '',
      coordinates: change.location,
      severity: (change.magnitude > 0.8 ? 'critical' : change.magnitude > 0.5 ? 'high' : 'medium') as EvidenceItem['severity'],
    })) || []),
  ];

  // Display real evidence only
  const displayEvidence = evidenceLog;
  
  // Key findings from AI analysis
  const keyFindings = selectedAnalysis?.ai_explanation?.split('\n').filter(Boolean).slice(0, 5) || [];

  const changePercentage = totalBlocks > 0 ? ((changedCells / totalBlocks) * 100).toFixed(1) : '0.0';
  const textChangesCount = selectedAnalysis?.content_changes?.length || 0;

  useEffect(() => {
    if (!isSeeding) {
      setSeedElapsedSec(0);
      return;
    }
    const timer = window.setInterval(() => {
      setSeedElapsedSec((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isSeeding]);

  useEffect(() => {
    if (!isRescanning) {
      setRescanElapsedSec(0);
      return;
    }
    const timer = window.setInterval(() => {
      setRescanElapsedSec((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isRescanning]);

  const getSeedStatusMessage = (elapsed: number) => {
    if (elapsed < 4) return 'Initializing seed pipeline...';
    if (elapsed < 10) return 'Capturing baseline screenshot...';
    if (elapsed < 16) return 'Creating current snapshot...';
    if (elapsed < 24) return 'Running matrix comparison...';
    return 'Finalizing baseline analysis...';
  };

  const getRescanStatusMessage = (elapsed: number) => {
    if (elapsed < 4) return 'Starting fresh re-scan...';
    if (elapsed < 10) return 'Capturing latest screenshot...';
    if (elapsed < 16) return 'Comparing against baseline...';
    return 'Updating incident evidence...';
  };

  const seedStatusMessage = getSeedStatusMessage(seedElapsedSec);
  const rescanStatusMessage = getRescanStatusMessage(rescanElapsedSec);

  const handleReanalyze = async () => {
    if (!selectedAnalysis?.snapshot?.id) {
      toast({ title: 'Error', description: 'No snapshot to analyze', variant: 'destructive' });
      return;
    }
    setIsRescanning(true);
    try {
      const result = await compareSnapshot.mutateAsync(selectedAnalysis.snapshot.id);
      await Promise.all([
        refetch(),
        refetchWebsites(),
        refetchSnapshots(),
      ]);
      if (result?.analysis?.id) {
        setSelectedAnalysisId(result.analysis.id.toString());
      }
      toast({ title: 'Analysis Complete', description: 'Re-analysis finished.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsRescanning(false);
    }
  };

  const handleSeedBaselines = async () => {
    setIsSeeding(true);
    try {
      const result = await analysisAPI.seedBaselines();
      await Promise.all([
        refetch(),
        refetchWebsites(),
        refetchSnapshots(),
      ]);
      const latestSeeded = [...result.results]
        .reverse()
        .find((r) => r.status === 'success' && r.analysis_id);
      if (latestSeeded?.analysis_id) {
        setSelectedAnalysisId(latestSeeded.analysis_id.toString());
      }
      const successCount = result.results.filter(r => r.status === 'success').length;
      toast({
        title: 'Baselines Seeded',
        description: `${successCount}/${result.results.length} website(s) analyzed successfully.`,
      });
    } catch (err: any) {
      toast({ title: 'Seeding Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsSeeding(false);
    }
  };

  // Slider handlers
  const handleMove = (clientX: number, rect: DOMRect) => {
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = (x / rect.width) * 100;
    setSliderPosition(Math.max(5, Math.min(95, percentage)));
  };

  // Get intensity color for matrix cells
  const getIntensityColor = (cell: MatrixCell) => {
    if (cell.status !== 'changed') return 'bg-primary/20 border-primary/30';
    const percent = cell.changePercent;
    if (percent >= 80) return 'bg-destructive border-destructive/50';
    if (percent >= 50) return 'bg-warning border-warning/50';
    return 'bg-warning/60 border-warning/40';
  };

  // ==================== EMPTY STATE ====================
  // Shows empty/zero values when no data available

  // ==================== LOADING STATE ====================
  // Build a proxy live preview URL for visual comparison fallback
  const getProxyPageUrl = (siteUrl: string) => getProxyUrl(siteUrl);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-80" />
              <Skeleton className="h-96" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-72" />
              <Skeleton className="h-96" />
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  // ==================== MAIN RENDER ====================
  return (
    <MainLayout>
      <div className="space-y-6">
        {/* ==================== HEADER ==================== */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                <AlertTriangle className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold font-mono tracking-tight">INCIDENT REPORT</h1>
                <p className="text-xs font-mono text-muted-foreground tracking-wider">DIFF VIEW & EVIDENCE LOG</p>
              </div>
            </div>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-wrap gap-3 w-full md:w-auto">
            <Select 
              value={selectedAnalysisId || analyses[0]?.id?.toString() || ''} 
              onValueChange={(v) => setSelectedAnalysisId(v)}
            >
              <SelectTrigger className="w-full sm:w-[280px] bg-secondary/50 border-border font-mono text-xs h-11">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    severity === 'low' && 'bg-primary',
                    severity === 'medium' && 'bg-warning',
                    severity === 'high' && 'bg-orange-500',
                    severity === 'critical' && 'bg-destructive animate-pulse',
                  )} />
                  <SelectValue placeholder="Select website" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {!hasData && (
                  <SelectItem value="none" disabled>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      No analyses available
                    </div>
                  </SelectItem>
                )}
                {analyses.map((analysis) => (
                  <SelectItem key={analysis.id} value={analysis.id.toString()}>
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'w-2 h-2 rounded-full',
                        analysis.severity === 'low' && 'bg-primary',
                        analysis.severity === 'medium' && 'bg-warning',
                        analysis.severity === 'high' && 'bg-orange-500',
                        analysis.severity === 'critical' && 'bg-destructive',
                      )} />
                      {analysis.website_name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="cyber-outline" onClick={handleReanalyze} disabled={isRescanning || !hasData} className="h-11 px-5 flex-1 sm:flex-none">
              <RefreshCw className={cn('w-4 h-4', isRescanning && 'animate-spin')} />
              {isRescanning ? 'Re-scanning...' : 'Re-scan'}
            </Button>
            <Button variant="cyber" onClick={handleSeedBaselines} disabled={isSeeding} className="h-11 px-5 flex-1 sm:flex-none">
              {isSeeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
              {isSeeding ? 'Seeding...' : 'Seed Baselines'}
            </Button>
          </motion.div>
        </div>

        {(isSeeding || isRescanning) && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card px-4 py-3 border border-primary/20"
          >
            <div className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              <p className="text-xs sm:text-sm font-mono text-muted-foreground">
                {isSeeding ? seedStatusMessage : rescanStatusMessage}
              </p>
            </div>
          </motion.div>
        )}

        {/* ==================== EMPTY STATE CARD ==================== */}
        {!hasData && !isLoading && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-10 text-center">
            <Database className="w-14 h-14 text-primary/30 mx-auto mb-4" />
            <h2 className="text-lg font-bold font-mono mb-2 text-muted-foreground">NO ANALYSIS DATA</h2>
            <p className="text-sm text-muted-foreground/70 font-mono max-w-lg mx-auto mb-6">
              Add websites on the Visual Monitor page, then click <strong>Seed Baselines</strong> above to
              capture baselines and generate comparison analysis for the incident report.
            </p>
            <Button variant="cyber" onClick={handleSeedBaselines} disabled={isSeeding} className="px-8">
              {isSeeding ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Database className="w-4 h-4 mr-2" />}
              {isSeeding ? seedStatusMessage : 'Seed Baselines Now'}
            </Button>
          </motion.div>
        )}

        {/* ==================== DEBUG INFO PANEL ==================== */}
        {hasData && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-3 border border-muted/20 text-xs font-mono text-muted-foreground bg-black/20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="font-bold text-yellow-600 mb-2">📊 Website Matching:</div>
                <div className="space-y-1 pl-4 text-muted-foreground">
                  <div>Analysis Website: {websiteName || '(none)'}</div>
                  <div>Analysis URL: {websiteUrl || '(none)'}</div>
                  <div>Matched Website ID: {selectedWebsiteId || '⚠️ NOT FOUND'}</div>
                  <div>Total Websites in DB: {websites.length}</div>
                </div>
              </div>
              <div>
                <div className="font-bold text-cyan-600 mb-2">🎬 Snapshots Status:</div>
                <div className="space-y-1 pl-4 text-muted-foreground">
                  <div>Snapshots Query Enabled: {selectedWebsiteId > 0 ? '✅ Yes' : '❌ No (ID=0)'}</div>
                  <div>Snapshots Loaded: {snapshotsData.length}</div>
                  {snapshotsData.map(s => (
                    <div key={s.id} className={s.screenshot ? 'text-green-400' : 'text-red-400'}>
                      &nbsp;&nbsp;↳ #{s.id} {s.is_baseline ? '[baseline]' : '[current]'} screenshot: {s.screenshot ? s.screenshot.toString().slice(-30) : '❌ empty'}
                    </div>
                  ))}
                  <div>Baseline Screenshot URL: {resolvedBaselineScreenshotUrl ? '✅ Found' : '❌ Not found'}</div>
                  <div>Current Screenshot URL: {resolvedCurrentScreenshotUrl ? '✅ Found' : '❌ Not found'}</div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ==================== STATS CARDS ==================== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: ScanLine, label: 'CHANGED BLOCKS', value: `${changedCells}/${totalBlocks}`, color: 'text-muted-foreground' },
            { icon: Zap, label: 'ACCURACY', value: `${accuracyScore.toFixed(1)}%`, color: 'text-primary' },
            { icon: AlertTriangle, label: 'SEVERITY', value: severityConfig[severity as keyof typeof severityConfig]?.label || 'LOW', color: severity === 'critical' ? 'text-destructive' : severity === 'high' ? 'text-orange-500' : 'text-warning' },
            { icon: Info, label: 'FRAMES', value: frameCount.toLocaleString(), color: 'text-muted-foreground' },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card p-4 flex items-center gap-4"
            >
              <div className={cn("p-2.5 rounded-lg bg-secondary/50", stat.color)}>
                <stat.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-mono text-muted-foreground tracking-wider">{stat.label}</p>
                <p className={cn("text-xl font-bold font-mono leading-tight", stat.color)}>{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ==================== MAIN CONTENT GRID ==================== */}
        <div className="grid lg:grid-cols-3 gap-6">
          
          {/* ==================== LEFT COLUMN ==================== */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* ==================== VISUAL COMPARISON ==================== */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <h2 className="text-lg font-semibold">Visual Comparison</h2>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-success" />
                    <span className="text-muted-foreground">Baseline</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-3 h-3 rounded-full",
                      isDefacementDetected ? "bg-destructive animate-pulse" : "bg-success"
                    )} />
                    <span className="text-muted-foreground">Current</span>
                  </div>
                </div>
              </div>

              {/* Comparison Slider */}
              <div
                className="relative aspect-video rounded-xl overflow-hidden cursor-ew-resize select-none bg-muted/30 border border-border"
                onMouseDown={() => setIsDragging(true)}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
                onMouseMove={(e) => {
                  if (isDragging) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    handleMove(e.clientX, rect);
                  }
                }}
                onTouchStart={() => setIsDragging(true)}
                onTouchEnd={() => setIsDragging(false)}
                onTouchMove={(e) => {
                  if (isDragging) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    handleMove(e.touches[0].clientX, rect);
                  }
                }}
              >
                {/* Baseline (Left) */}
                <div className="absolute inset-0">
                  {resolvedBaselineScreenshotUrl ? (
                    <img 
                      src={resolvedBaselineScreenshotUrl}
                      alt="Baseline"
                      className="w-full h-full object-cover object-top"
                    />
                  ) : websiteUrl ? (
                    <iframe
                      src={getProxyPageUrl(websiteUrl)}
                      title="Baseline Preview"
                      className="w-full h-full border-0 pointer-events-none"
                      style={{ transform: 'scale(1)', transformOrigin: 'top left' }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-success/5 to-success/10">
                      <div className="text-center">
                        <Eye className="w-12 h-12 sm:w-16 sm:h-16 text-success/30 mx-auto mb-3" />
                        <p className="text-sm font-medium text-success/70">Baseline</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          No baseline available
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 cyber-grid opacity-10" />
                  <div className="absolute top-2 left-2 sm:top-4 sm:left-4 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-success/20 border border-success/30 backdrop-blur-sm">
                    <span className="text-[10px] sm:text-xs font-medium text-success">BASELINE</span>
                  </div>
                  <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-background/80 border border-border backdrop-blur-sm">
                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                      {selectedAnalysis?.baseline_snapshot?.created_at 
                        ? new Date(selectedAnalysis.baseline_snapshot.created_at).toLocaleDateString()
                        : '--'}
                    </p>
                  </div>
                </div>

                {/* Current (Right) - Clipped */}
                <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}>
                  {resolvedCurrentScreenshotUrl ? (
                    <img 
                      src={resolvedCurrentScreenshotUrl}
                      alt="Current"
                      className="w-full h-full object-cover object-top"
                    />
                  ) : websiteUrl ? (
                    <iframe
                      src={getProxyPageUrl(websiteUrl)}
                      title="Current Preview"
                      className="w-full h-full border-0 pointer-events-none"
                      style={{ transform: 'scale(1)', transformOrigin: 'top left' }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-destructive/5 to-destructive/10">
                      <div className="text-center">
                        {isDefacementDetected ? (
                          <>
                            <AlertTriangle className="w-12 h-12 sm:w-16 sm:h-16 text-destructive/50 mx-auto mb-3 animate-pulse" />
                            <p className="text-sm font-medium text-destructive">Detected</p>
                          </>
                        ) : (
                          <>
                            <Eye className="w-12 h-12 sm:w-16 sm:h-16 text-primary/30 mx-auto mb-3" />
                            <p className="text-sm font-medium text-foreground/70">Current State</p>
                          </>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {selectedAnalysis?.snapshot?.created_at 
                            ? new Date(selectedAnalysis.snapshot.created_at).toLocaleDateString()
                            : '--'}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 cyber-grid opacity-10" />
                  <div className={cn(
                    "absolute top-2 right-2 sm:top-4 sm:right-4 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg backdrop-blur-sm border",
                    isDefacementDetected 
                      ? "bg-destructive/20 border-destructive/30" 
                      : "bg-primary/20 border-primary/30"
                  )}>
                    <span className={cn(
                      "text-[10px] sm:text-xs font-medium",
                      isDefacementDetected ? "text-destructive" : "text-primary"
                    )}>CURRENT</span>
                  </div>
                  <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-background/80 border border-border backdrop-blur-sm">
                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                      {selectedAnalysis?.snapshot?.created_at 
                        ? new Date(selectedAnalysis.snapshot.created_at).toLocaleDateString()
                        : '--'}
                    </p>
                  </div>
                </div>

                {/* Slider Line */}
                <div
                  className="absolute top-0 bottom-0 w-1 bg-primary shadow-glow z-10"
                  style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
                >
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-primary/30 border-2 border-primary flex items-center justify-center cursor-ew-resize backdrop-blur-sm">
                    <div className="grid grid-cols-2 gap-0.5">
                      {[...Array(6)].map((_, i) => (
                        <div key={i} className="w-1 h-1 rounded-full bg-primary" />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Info Label */}
                <div className="absolute bottom-2 sm:bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-background/80 border border-border backdrop-blur-sm">
                  <p className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                    Drag to compare • {websiteName}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* ==================== MATRIX ANALYSIS GRID ==================== */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card p-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-lg font-semibold">Matrix Analysis Timeline</h2>
                  <p className="text-sm text-muted-foreground">Blockwise deface breakdown from baseline to every re-scan snapshot</p>
                </div>
                <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-primary/20 border border-primary/30" />
                    <span className="text-xs text-muted-foreground">No Change</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-warning border border-warning/50" />
                    <span className="text-xs text-muted-foreground">Modified</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded bg-destructive border border-destructive/50" />
                    <span className="text-xs text-muted-foreground">Significant</span>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                {snapshotMatrixCards.map((snapshotCard) => (
                  <div key={String(snapshotCard.snapshotId)} className="p-4 rounded-xl border border-border bg-secondary/20">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3">
                      <div>
                        <p className="text-sm font-semibold">{snapshotCard.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {snapshotCard.createdAt
                            ? new Date(snapshotCard.createdAt).toLocaleString()
                            : <span className="italic">Awaiting snapshot</span>}
                        </p>
                      </div>
                      {snapshotCard.hasScreenshot && (
                        <div className="text-sm font-mono">
                          Deface: <span className="font-bold text-destructive">{snapshotCard.defacePercent.toFixed(1)}%</span>
                          <span className="text-muted-foreground"> ({snapshotCard.changedCount}/64 blocks)</span>
                        </div>
                      )}
                    </div>

                    <div className="mb-3 min-h-8">
                      {snapshotCard.hasScreenshot ? (
                        snapshotCard.changedBlocks.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {snapshotCard.changedBlocks.slice(0, 10).map((cell) => (
                              <span
                                key={`${snapshotCard.snapshotId}-${cell.id}`}
                                className="px-2 py-1 rounded-md text-[11px] font-mono bg-destructive/10 border border-destructive/30 text-destructive"
                              >
                                B[{cell.row + 1},{cell.col + 1}] {cell.changePercent.toFixed(1)}%
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No changed blocks detected for this snapshot.</p>
                        )
                      ) : null}
                    </div>

                    <div className="relative w-full rounded-lg border border-border/70 overflow-hidden" style={{ aspectRatio: matrixAspectRatio }}>
                      {snapshotCard.hasScreenshot ? (
                        <>
                          <img
                            src={snapshotCard.bgImageUrl!}
                            alt={`${snapshotCard.label} background`}
                            className="absolute inset-0 w-full h-full object-cover"
                            style={{ opacity: 0.45 }}
                          />
                          <div className="absolute inset-0 bg-background/12" />
                          <div className="relative grid h-full gap-1 p-2" style={{ gridTemplateColumns: 'repeat(8, 1fr)', gridTemplateRows: 'repeat(8, 1fr)' }}>
                            {snapshotCard.matrix.map((cell, index) => (
                              <Tooltip key={`${snapshotCard.snapshotId}-cell-${cell.id}`}>
                                <TooltipTrigger asChild>
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.2, delay: index * 0.004 }}
                                    className={cn(
                                      "rounded-sm cursor-pointer transition-all duration-150 relative overflow-hidden border",
                                      getIntensityColor(cell),
                                      cell.status === 'changed' && "ring-1 ring-offset-1 ring-offset-background"
                                    )}
                                  >
                                    {cell.status === 'changed' && (
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-[8px] font-bold text-white drop-shadow-lg">
                                          {cell.changePercent.toFixed(1)}%
                                        </span>
                                      </div>
                                    )}
                                  </motion.div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-card border-border">
                                  <div className="text-xs">
                                    <p className="font-medium">Block [{cell.row + 1}, {cell.col + 1}]</p>
                                    <p className={cn("mt-1", cell.status === 'changed' ? 'text-destructive' : 'text-success')}>
                                      {cell.status === 'changed' ? `${cell.changePercent.toFixed(1)}% defaced` : 'No changes'}
                                    </p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            ))}
                          </div>
                        </>
                      ) : (
                        /* Empty placeholder — shown before baseline is seeded */
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/40">
                          <div className="w-10 h-10 rounded-lg border-2 border-dashed border-border/60 flex items-center justify-center">
                            <svg className="w-5 h-5 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <p className="text-xs text-muted-foreground/70 text-center px-4">
                            {snapshotCard.label === 'Baseline Snapshot'
                              ? 'Seed baselines to populate this grid'
                              : 'Run a rescan to populate this grid'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary Stats */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-border">
                <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
                  <div>
                    <span className="text-xl sm:text-2xl font-bold">{changedCells}</span>
                    <span className="text-xs sm:text-sm text-muted-foreground ml-1">/ {totalBlocks} blocks changed</span>
                  </div>
                  <div className="h-8 w-px bg-border hidden sm:block" />
                  <div>
                    <span className="text-xl sm:text-2xl font-bold text-destructive">{changePercentage}%</span>
                    <span className="text-xs sm:text-sm text-muted-foreground ml-1">total area</span>
                  </div>
                </div>
                <div className="w-full sm:w-48">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Low</span>
                    <span>High</span>
                  </div>
                  <div className="h-2 rounded-full bg-gradient-to-r from-primary/30 via-warning to-destructive" />
                </div>
              </div>
            </motion.div>
          </div>

          {/* ==================== RIGHT COLUMN ==================== */}
          <div className="space-y-6">
            
            {/* ==================== EVIDENCE LOG ==================== */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="glass-card p-5"
            >
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                <Eye className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-mono tracking-wider text-muted-foreground">EVIDENCE LOG</h3>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {displayEvidence.map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.05 }}
                    className={cn(
                      "p-3 rounded-md border-l-4 bg-secondary/50",
                      item.severity === 'critical' && 'border-l-destructive',
                      item.severity === 'high' && 'border-l-orange-500',
                      item.severity === 'medium' && 'border-l-warning',
                      item.severity === 'low' && 'border-l-primary',
                    )}
                  >
                    <p className="text-sm font-medium leading-tight">
                      {item.title}
                      {item.description && <span className="text-muted-foreground ml-1">{item.description}</span>}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] font-mono text-muted-foreground">{item.coordinates}</span>
                      <span className={cn(
                        "text-[10px] font-mono px-1.5 py-0.5 rounded uppercase",
                        item.severity === 'critical' && 'bg-destructive/10 text-destructive',
                        item.severity === 'high' && 'bg-orange-500/10 text-orange-500',
                        item.severity === 'medium' && 'bg-warning/10 text-warning',
                        item.severity === 'low' && 'bg-primary/10 text-primary',
                      )}>
                        {item.severity}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* ==================== AI ANALYSIS RESULTS ==================== */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="glass-card p-5 space-y-5"
            >
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10">
                  <Brain className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-base font-semibold">AI Analysis Results</h2>
                  <p className="text-xs text-muted-foreground">Explainable detection insights</p>
                </div>
              </div>

              {/* Severity Badge */}
              <div className={cn(
                'p-4 rounded-xl border-2',
                severityConfig[severity as keyof typeof severityConfig]?.bgColor || 'bg-primary/10',
                severityConfig[severity as keyof typeof severityConfig]?.borderColor || 'border-primary/30',
              )}>
                <div className="flex items-center gap-3">
                  <AlertTriangle className={cn(
                    'w-7 h-7',
                    severityConfig[severity as keyof typeof severityConfig]?.color || 'text-primary'
                  )} />
                  <div>
                    <p className={cn(
                      'text-lg font-bold',
                      severityConfig[severity as keyof typeof severityConfig]?.color || 'text-primary'
                    )}>
                      {severityConfig[severity as keyof typeof severityConfig]?.label || 'Unknown'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {severity === 'critical' ? 'Major defacement confirmed' : 
                       severity === 'high' ? 'Significant changes detected' :
                       severity === 'medium' ? 'Moderate changes require review' :
                       'Minor changes detected'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Detection Confidence */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Detection Confidence</span>
                  </div>
                  <span className="text-xl font-bold text-primary">{accuracyScore.toFixed(1)}%</span>
                </div>
                <Progress value={accuracyScore} className="h-2" />
                <p className="text-[10px] text-muted-foreground">
                  AI model certainty based on frame and matrix analysis
                </p>
              </div>

              {/* Analysis Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-secondary/50">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">Visual Changes</span>
                  </div>
                  <p className="text-xl font-bold">{changePercentage}%</p>
                  <p className="text-[10px] text-muted-foreground">{changedCells} of {totalBlocks} blocks</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">Text Changes</span>
                  </div>
                  <p className="text-xl font-bold">{textChangesCount}</p>
                  <p className="text-[10px] text-muted-foreground">NLP detected modifications</p>
                </div>
              </div>

              {/* Key Findings */}
              <div>
                <h3 className="text-xs font-medium mb-2 flex items-center gap-2">
                  <Info className="w-3.5 h-3.5 text-muted-foreground" />
                  Key Findings
                </h3>
                <div className="space-y-1.5">
                  {keyFindings.map((finding, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0",
                        i === 0 ? 'bg-destructive' : i === 1 ? 'bg-destructive' : 'bg-warning'
                      )} />
                      <span className="text-muted-foreground">{finding}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Explanation */}
              <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                <p className="text-xs">
                  <span className="text-primary font-semibold">AI Explanation:</span>
                  <span className="text-muted-foreground ml-2">
                    {selectedAnalysis?.ai_explanation || (hasData 
                      ? `Changes detected in ${changePercentage}% of visual frames and ${changedCells} high-intensity matrix regions.`
                      : 'No analysis data available. Add a website and run a scan to see AI-generated insights.')}
                  </span>
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
