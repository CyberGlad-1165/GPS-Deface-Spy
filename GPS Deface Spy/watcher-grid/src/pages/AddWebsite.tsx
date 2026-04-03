import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Search, Loader2, Eye, RefreshCw, ExternalLink, Maximize2, Minimize2, FileCode, Image, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MainLayout } from '@/components/layout/MainLayout';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import MonitorConfigPanel from '@/components/monitor/MonitorConfigPanel';
import { useCreateWebsite, useScanWebsite } from '@/hooks/useApi';
import { websiteAPI, analysisAPI, proxyAPI, getMediaUrl, getProxyUrl } from '@/services/api';

const TOTAL_CELLS = 96;

interface CellData {
  id: number;
  changePercent: number;
  status: 'unchanged' | 'minor' | 'moderate' | 'significant';
}

// Convert backend matrix to frontend grid format
function convertMatrixData(matrixData?: { grid?: number[][]; block_details?: Array<{ id: number; magnitude: number; changed: boolean }> }): CellData[] {
  if (!matrixData?.block_details) {
    return Array.from({ length: TOTAL_CELLS }, (_, i) => ({
      id: i,
      changePercent: 0,
      status: 'unchanged' as const,
    }));
  }

  return matrixData.block_details.map((block) => {
    let status: CellData['status'] = 'unchanged';
    const magnitude = block.magnitude * 100;
    if (magnitude > 80) status = 'significant';
    else if (magnitude > 50) status = 'moderate';
    else if (magnitude > 20) status = 'minor';
    return { id: block.id, changePercent: magnitude, status };
  });
}

type ViewMode = 'live' | 'screenshot' | 'html';

export default function AddWebsite() {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [liveHtml, setLiveHtml] = useState<string>('');
  const [matrixData, setMatrixData] = useState<CellData[]>([]);
  const [scanCount, setScanCount] = useState(0);
  const [websiteId, setWebsiteId] = useState<number | null>(null);
  const [normalizedUrl, setNormalizedUrl] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('live');
  const [capturedHtml, setCapturedHtml] = useState('');
  const [screenshotPath, setScreenshotPath] = useState<string | null>(null);
  const [iframeLoading, setIframeLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [iframeKey, setIframeKey] = useState(0); // force iframe reload
  
  const createWebsite = useCreateWebsite();
  const scanWebsite = useScanWebsite();

  const normalizeUrl = (input: string) => {
    let u = input.trim();
    if (!/^https?:\/\//i.test(u)) {
      const host = u.split('/')[0].toLowerCase();
      const isLocalHost =
        host.includes('localhost') ||
        host.startsWith('127.') ||
        host.startsWith('10.') ||
        host.startsWith('192.168.') ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
      u = `${isLocalHost ? 'http' : 'https'}://${u}`;
    }
    return u;
  };

  const [liveContentError, setLiveContentError] = useState<string | null>(null);

  // Fetch live website content through proxy
  const fetchLiveContent = useCallback(async (targetUrl: string) => {
    setLiveContentError(null);
    console.log('[Proxy] Fetching live content for:', targetUrl);
    try {
      const result = await proxyAPI.fetch(targetUrl);
      console.log('[Proxy] Success - received', result.html?.length || 0, 'bytes');
      setLiveHtml(result.html);
      return result.html;
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to fetch live content';
      console.error('[Proxy] Error:', errorMsg, err);
      setLiveContentError(errorMsg);
      toast({ title: 'Content Fetch Error', description: errorMsg, variant: 'destructive' });
      return null;
    }
  }, [toast]);

  const handleMonitor = useCallback(async () => {
    if (!url.trim()) {
      toast({ title: 'Enter a URL', description: 'Please type a website address to monitor.', variant: 'destructive' });
      return;
    }
    const normalized = normalizeUrl(url);
    setNormalizedUrl(normalized);
    setIsLoading(true);
    setIsMonitoring(false);
    setLiveContentError(null);

    // Step 1: Fetch live website content (doesn't require auth)
    const liveContent = await fetchLiveContent(normalized);
    
    // Even if live content fails, continue to try backend
    if (liveContent) {
      setIsMonitoring(true); // Show monitoring UI even before backend succeeds
    }

    try {
      // Create website in backend (requires auth)
      let website;
      try {
        website = await createWebsite.mutateAsync({
          name: new URL(normalized).hostname,
          url: normalized,
          description: `Monitoring ${normalized}`,
          monitoring_interval: 300,
        });
      } catch (createErr: any) {
        // If website already exists, try to find it by URL
        const errMsg = createErr.message || '';
        if (errMsg.includes('already') || errMsg.includes('unique') || errMsg.includes('duplicate') || errMsg.includes('exists')) {
          try {
            const existingList = await websiteAPI.list({ search: new URL(normalized).hostname });
            const found = existingList.results.find(w => w.url === normalized || w.url === normalized.replace(/\/$/, '') || w.url + '/' === normalized);
            if (found) {
              website = found;
            }
          } catch {
            // ignore lookup error
          }
        }
        if (!website) throw createErr;
      }

      setWebsiteId(website.id);

      // Initial scan to capture baseline
      const scanResult = await scanWebsite.mutateAsync({ id: website.id, setAsBaseline: true });
      
      // Store captured data
      if (scanResult.snapshot) {
        setCapturedHtml(scanResult.snapshot.html_content || '');
        if (scanResult.snapshot.screenshot) {
          setScreenshotPath(scanResult.snapshot.screenshot);
        }
      }

      // Get analysis data if available
      if (scanResult.snapshot?.id) {
        try {
          const analysis = await analysisAPI.compare(scanResult.snapshot.id);
          setMatrixData(convertMatrixData(analysis.analysis.matrix_data));
        } catch {
          setMatrixData(convertMatrixData());
        }
      } else {
        setMatrixData(convertMatrixData());
      }

      setIsLoading(false);
      setIsMonitoring(true);
      setScanCount(1);
      toast({ title: 'Monitoring Started', description: `Now monitoring ${normalized}` });
    } catch (err: any) {
      setIsLoading(false);

      // Even if backend fails, try to find existing website for scan capability
      if (!websiteId) {
        try {
          const existingList = await websiteAPI.list({ search: new URL(normalized).hostname });
          const found = existingList.results.find(w => w.url === normalized || w.url === normalized.replace(/\/$/, '') || w.url + '/' === normalized);
          if (found) {
            setWebsiteId(found.id);
          }
        } catch {
          // ignore - live preview still works
        }
      }

      // Keep showing live content if it was fetched
      if (liveHtml) {
        setIsMonitoring(true);
      }
      const errorMsg = err.message || 'Failed to start monitoring';
      if (errorMsg.includes('401') || errorMsg.includes('Authentication') || errorMsg.includes('Session')) {
        toast({ 
          title: 'Authentication Required', 
          description: 'Please login to save and track websites. Live preview is still available.', 
          variant: 'destructive' 
        });
      } else {
        toast({ 
          title: 'Backend Error', 
          description: errorMsg + '. Live preview may still work.', 
          variant: 'destructive' 
        });
      }
    }
  }, [url, toast, createWebsite, scanWebsite, fetchLiveContent, liveHtml]);

  // Handle manual rescan
  const handleRescan = useCallback(async () => {
    if (!normalizedUrl) return;
    
    try {
      // Always refresh live content
      await fetchLiveContent(normalizedUrl);

      // Only do backend scan if we have a valid website ID
      if (websiteId) {
        const scanResult = await scanWebsite.mutateAsync({ id: websiteId });
        setScanCount(c => c + 1);
        
        // Update captured data
        if (scanResult.snapshot) {
          setCapturedHtml(scanResult.snapshot.html_content || '');
          if (scanResult.snapshot.screenshot) {
            setScreenshotPath(scanResult.snapshot.screenshot);
          }
        }

        if (scanResult.snapshot?.id) {
          try {
            const analysis = await analysisAPI.compare(scanResult.snapshot.id);
            setMatrixData(convertMatrixData(analysis.analysis.matrix_data));
          } catch {
            // Keep existing matrix
          }
        }
        toast({ title: 'Scan Complete', description: 'Matrix updated with latest changes' });
      } else {
        toast({ title: 'Live Preview Updated', description: 'Content refreshed' });
      }
    } catch (err: any) {
      toast({ title: 'Refresh Failed', description: err.message, variant: 'destructive' });
    }
  }, [websiteId, normalizedUrl, scanWebsite, toast, fetchLiveContent]);

  // Periodic re-scans
  const [checkingInterval, setCheckingInterval] = useState(0);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (isMonitoring && checkingInterval > 0) {
      intervalRef.current = setInterval(async () => {
        try {
          // Always refresh live content
          if (normalizedUrl) {
            await fetchLiveContent(normalizedUrl);
          }
          // Only do backend scan if we have a valid website ID
          if (websiteId) {
            const scanResult = await websiteAPI.scan(websiteId);
            setScanCount(c => c + 1);
            if (scanResult.snapshot) {
              setCapturedHtml(scanResult.snapshot.html_content || '');
              if (scanResult.snapshot.screenshot) {
                setScreenshotPath(scanResult.snapshot.screenshot);
              }
            }
            if (scanResult.snapshot?.id) {
              const analysis = await analysisAPI.compare(scanResult.snapshot.id);
              setMatrixData(convertMatrixData(analysis.analysis.matrix_data));
            }
          }
        } catch (err) {
          console.error('Auto-scan failed:', err);
        }
      }, checkingInterval * 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isMonitoring, checkingInterval, websiteId, normalizedUrl, fetchLiveContent]);

  // Build the proxy page URL for iframe live preview
  const getProxyPageUrl = useCallback((siteUrl: string) => {
    return getProxyUrl(siteUrl);
  }, []);

  const changedCells = matrixData.filter(c => c.status !== 'unchanged').length;
  const changePercent = matrixData.length > 0 ? ((changedCells / matrixData.length) * 100).toFixed(1) : '0';

  const getScreenshotUrl = () => {
    if (screenshotPath) {
      return getMediaUrl(screenshotPath);
    }
    // No server screenshot available — return null so we show proxy iframe instead
    return null;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-2">
            <Eye className="w-7 h-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold font-mono tracking-tight">VISUAL MONITOR</h1>
              <p className="text-xs font-mono text-muted-foreground tracking-wider">LIVE WEBSITE MONITORING WITH REAL-TIME CONTENT</p>
            </div>
          </div>
        </motion.div>

        {/* Search Bar */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Enter website URL (e.g. example.com)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleMonitor()}
                className="pl-10 bg-secondary/50 font-mono h-12 text-base"
              />
            </div>
            <Button variant="cyber" size="lg" onClick={handleMonitor} disabled={isLoading} className="font-mono min-w-[140px]">
              {isLoading ? (<><Loader2 className="w-4 h-4 animate-spin" />Scanning...</>) : (<><Search className="w-4 h-4" />Monitor</>)}
            </Button>
          </div>
        </motion.div>

        {/* Loading State */}
        <AnimatePresence>
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="glass-card p-16 text-center">
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }} className="w-16 h-16 mx-auto mb-6 rounded-full border-2 border-primary/30 border-t-primary flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-primary" />
              </motion.div>
              <h2 className="text-xl font-bold font-mono mb-2">CAPTURING WEBSITE DATA</h2>
              <p className="text-sm text-muted-foreground font-mono">{normalizeUrl(url)}</p>
              <p className="text-xs text-muted-foreground/60 font-mono mt-2">Fetching live content, HTML, and creating baseline...</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live Monitor View */}
        <AnimatePresence>
          {isMonitoring && !isLoading && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* Status Bar */}
              <div className="glass-card p-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
                    </span>
                    <span className="text-xs font-mono text-primary tracking-wider">LIVE MONITORING</span>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">Scans: {scanCount}</span>
                  <a href={normalizedUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-primary transition-colors">
                    <ExternalLink className="w-3 h-3" />
                    Open in new tab
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  {/* View Mode Toggles */}
                  <div className="flex items-center border border-border/50 rounded overflow-hidden mr-2">
                    <button
                      onClick={() => setViewMode('live')}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1 text-xs font-mono transition-colors",
                        viewMode === 'live' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Monitor className="w-3 h-3" />Live
                    </button>
                    <button
                      onClick={() => setViewMode('screenshot')}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1 text-xs font-mono transition-colors border-x border-border/50",
                        viewMode === 'screenshot' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Image className="w-3 h-3" />Captured
                    </button>
                    <button
                      onClick={() => setViewMode('html')}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1 text-xs font-mono transition-colors",
                        viewMode === 'html' ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <FileCode className="w-3 h-3" />HTML
                    </button>
                  </div>
                  
                  <button onClick={() => setIsFullscreen(!isFullscreen)} className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
                    {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                  </button>
                  <button onClick={() => { handleRescan(); setIframeKey(k => k + 1); }} disabled={scanWebsite.isPending} className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50">
                    <RefreshCw className={cn("w-3 h-3", scanWebsite.isPending && "animate-spin")} />Rescan
                  </button>
                </div>
              </div>

              {/* Website Preview */}
              <div className={cn("glass-card overflow-hidden transition-all", isFullscreen && "fixed inset-4 z-50")}>
                <div className="relative" style={{ minHeight: isFullscreen ? 'calc(100vh - 32px)' : '600px' }}>
                  {/* Live Website View — iframe-based real-time preview */}
                  {viewMode === 'live' && (
                    <>
                      {normalizedUrl ? (
                        <div className="relative w-full bg-white" style={{ height: isFullscreen ? 'calc(100vh - 32px)' : '600px' }}>
                          {iframeLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                              <div className="text-center">
                                <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-3" />
                                <p className="text-xs font-mono text-muted-foreground">Loading live website preview...</p>
                              </div>
                            </div>
                          )}
                          <iframe
                            ref={iframeRef}
                            key={`${normalizedUrl}-${iframeKey}`}
                            src={getProxyPageUrl(normalizedUrl)}
                            title="Live Website Preview"
                            className="w-full h-full border-0"
                            onLoad={() => setIframeLoading(false)}
                            onError={() => setIframeLoading(false)}
                          />
                          {/* Live badge */}
                          <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background/80 border border-primary/30 backdrop-blur-sm z-20">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                            </span>
                            <span className="text-[10px] font-mono text-primary tracking-wider">LIVE PREVIEW</span>
                          </div>
                          {/* Refresh button overlay */}
                          <button
                            onClick={() => { setIframeLoading(true); setIframeKey(k => k + 1); }}
                            className="absolute top-3 right-3 p-2 rounded-lg bg-background/80 border border-border hover:border-primary/50 backdrop-blur-sm transition-colors z-20"
                            title="Refresh live preview"
                          >
                            <RefreshCw className="w-4 h-4 text-muted-foreground hover:text-primary" />
                          </button>
                        </div>
                      ) : (
                        <div className="w-full flex items-center justify-center bg-muted/20" style={{ height: isFullscreen ? 'calc(100vh - 32px)' : '600px' }}>
                          <div className="text-center">
                            <Globe className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                            <p className="text-muted-foreground">Enter a URL to preview</p>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Captured Screenshot View (real server-side capture or proxy fallback) */}
                  {viewMode === 'screenshot' && (
                    <div className="relative w-full" style={{ minHeight: '600px' }}>
                      {getScreenshotUrl() ? (
                        <>
                          <img
                            src={getScreenshotUrl()!}
                            alt="Captured Screenshot"
                            className="w-full border-0"
                            style={{ minHeight: '600px', objectFit: 'cover', objectPosition: 'top' }}
                          />
                          <div className="absolute top-3 left-3 px-3 py-1.5 rounded-lg bg-background/80 border border-primary/30 backdrop-blur-sm">
                            <span className="text-[10px] font-mono text-primary tracking-wider">REAL SCREENSHOT CAPTURE</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <iframe
                            src={getProxyPageUrl(normalizedUrl)}
                            title="Captured Website Snapshot"
                            className="w-full border-0 pointer-events-none"
                            style={{ height: isFullscreen ? 'calc(100vh - 32px)' : '600px' }}
                          />
                          <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background/80 border border-border backdrop-blur-sm">
                            <span className="text-[10px] font-mono text-muted-foreground tracking-wider">SERVER-RENDERED SNAPSHOT</span>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* HTML Source View */}
                  {viewMode === 'html' && (
                    <div className="p-4 bg-secondary/30 overflow-auto" style={{ height: isFullscreen ? 'calc(100vh - 32px)' : '600px' }}>
                      <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap break-all">
                        {capturedHtml || liveHtml || 'No HTML content captured yet'}
                      </pre>
                    </div>
                  )}

                </div>
              </div>

              {/* Alert & Interval Config Panel */}
              <MonitorConfigPanel
                monitoredUrl={normalizedUrl}
                onIntervalChange={setCheckingInterval}
                websiteId={websiteId}
                liveHtml={liveHtml}
                changeData={{
                  changedBlocks: changedCells,
                  totalBlocks: matrixData.length,
                  changePercent: parseFloat(changePercent),
                  htmlSize: (capturedHtml || liveHtml).length,
                  scanCount: scanCount,
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty State */}
        {!isLoading && !isMonitoring && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="glass-card p-16 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-center">
              <Globe className="w-10 h-10 text-primary/40" />
            </div>
            <h2 className="text-lg font-bold font-mono mb-2 text-muted-foreground">NO ACTIVE MONITOR</h2>
            <p className="text-sm text-muted-foreground/70 font-mono max-w-md mx-auto">
              Enter a website URL above to start real-time visual monitoring with live content preview and matrix-by-matrix change detection
            </p>
            <div className="mt-6 flex justify-center gap-4 text-xs font-mono text-muted-foreground/50">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4" />
                <span>Live Preview</span>
              </div>
              <div className="flex items-center gap-2">
                <Image className="w-4 h-4" />
                <span>Screenshots</span>
              </div>
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4" />
                <span>HTML Source</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </MainLayout>
  );
}
