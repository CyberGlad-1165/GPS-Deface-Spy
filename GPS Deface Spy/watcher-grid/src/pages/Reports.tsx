import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  FileText,
  Download,
  Plus,
  Search,
  Globe,
  Eye,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Trash2,
  RefreshCw,
  Clock,
  Mail,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MainLayout } from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useReports, useCreateReport, useDeleteReport, useWebsites, useAlerts, useDeleteWebsite } from '@/hooks/useApi';
import { reportsAPI } from '@/services/api';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const statusConfig = {
  active: { label: 'ACTIVE', color: 'bg-primary/10 text-primary border-primary/20', icon: CheckCircle },
  paused: { label: 'PAUSED', color: 'bg-warning/10 text-warning border-warning/20', icon: Clock },
  error: { label: 'ERROR', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: AlertTriangle },
};

const reportTypeLabels = {
  summary: 'Summary',
  detailed: 'Detailed',
  incident: 'Incident',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export default function Reports() {
  const [searchQuery, setSearchQuery] = useState('');
  const [reportType, setReportType] = useState<string>('summary');
  const [emailTo, setEmailTo] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isGeneratingDownload, setIsGeneratingDownload] = useState(false);
  
  const { data: reportsData, isLoading: reportsLoading, refetch: refetchReports } = useReports();
  const { data: websitesData, isLoading: websitesLoading } = useWebsites();
  const { data: alertsData } = useAlerts();
  
  const createReport = useCreateReport();
  const deleteReport = useDeleteReport();
  const deleteWebsite = useDeleteWebsite();

  const reports = reportsData?.results || [];
  const websites = websitesData?.results || [];
  const alerts = alertsData?.results || [];

  const isLoading = reportsLoading || websitesLoading;

  const filteredWebsites = websites.filter(w =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.url.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Only active (live) websites
  const activeWebsites = websites.filter(w => w.status === 'active');

  const handleSendReportEmail = async () => {
    if (!emailTo.trim() || !emailTo.includes('@')) {
      toast({ title: 'Invalid Email', description: 'Please enter a valid email address.', variant: 'destructive' });
      return;
    }
    if (activeWebsites.length === 0) {
      toast({ title: 'No Active Websites', description: 'You need at least one active website to send a report.', variant: 'destructive' });
      return;
    }
    setIsSendingEmail(true);
    try {
      // Send report for the first active website
      const websiteId = activeWebsites[0].id;
      await reportsAPI.sendEmail(emailTo, websiteId, reportType);
      toast({ title: 'Report Sent', description: `Monitoring report sent to ${emailTo}` });
    } catch (err: any) {
      toast({ title: 'Send Failed', description: err.message || 'Failed to send report email.', variant: 'destructive' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleCreateReport = async () => {
    if (activeWebsites.length === 0) {
      toast({ title: 'No Active Websites', description: 'You need at least one active (live) website to generate a report.', variant: 'destructive' });
      return;
    }
    try {
      await createReport.mutateAsync({
        title: `${reportTypeLabels[reportType as keyof typeof reportTypeLabels]} Report - ${new Date().toLocaleDateString()}`,
        report_type: reportType as any,
        websites: activeWebsites.map(w => w.id),
      });
      toast({ title: 'Report Created', description: 'Report generated for active websites only.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDownloadReport = async (reportId: number) => {
    try {
      await reportsAPI.download(reportId);
      toast({ title: 'Download Started', description: 'Your PDF report is downloading.' });
    } catch (err: any) {
      toast({ title: 'Download Failed', description: err.message || 'Could not download the report.', variant: 'destructive' });
    }
  };

  const handleGenerateAndDownload = async () => {
    setIsGeneratingDownload(true);
    try {
      if (activeWebsites.length === 0) {
        toast({ title: 'No Active Websites', description: 'You need at least one active (live) website to generate a report.', variant: 'destructive' });
        return;
      }
      const result = await createReport.mutateAsync({
        title: `${reportTypeLabels[reportType as keyof typeof reportTypeLabels]} Report - ${new Date().toLocaleDateString()}`,
        report_type: reportType as any,
        websites: activeWebsites.map(w => w.id),
      });
      toast({ title: 'Report Generated', description: 'Starting PDF download...' });
      // The created report should be returned; download it immediately
      const reportId = (result as any)?.id;
      if (reportId) {
        await reportsAPI.download(reportId);
      } else {
        // Refetch reports and download the latest
        const refreshed = await refetchReports();
        const latest = (refreshed.data?.results || [])?.[0];
        if (latest?.id && latest.status === 'completed' && latest.file) {
          await reportsAPI.download(latest.id);
        } else {
          toast({ title: 'Report Created', description: 'Report is ready in the table below. Click the download button to save it.' });
        }
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to generate report.', variant: 'destructive' });
    } finally {
      setIsGeneratingDownload(false);
    }
  };

  const handleDeleteReport = async (reportId: number) => {
    try {
      await deleteReport.mutateAsync(reportId);
      toast({ title: 'Report Deleted', description: 'Report has been removed.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid grid-cols-4 gap-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex items-center gap-3">
              <FileText className="w-7 h-7 text-primary" />
              <div>
                <h1 className="text-2xl font-bold font-mono tracking-tight">REPORTS</h1>
                <p className="text-xs font-mono text-muted-foreground tracking-wider">AUDIT LOGS & HISTORY</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Generate Report Section */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Plus className="w-4 h-4 text-primary" />
            <span className="text-xs font-mono font-bold tracking-wider text-primary">GENERATE REPORT</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="w-[200px] bg-secondary/50 font-mono text-sm">
                <SelectValue placeholder="Report Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="summary">Summary Report</SelectItem>
                <SelectItem value="detailed">Detailed Report</SelectItem>
                <SelectItem value="incident">Incident Report</SelectItem>
                <SelectItem value="weekly">Weekly Report</SelectItem>
                <SelectItem value="monthly">Monthly Report</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="cyber"
              onClick={handleCreateReport}
              disabled={createReport.isPending}
              className="font-mono text-xs min-w-[140px]"
            >
              {createReport.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Generate
                </>
              )}
            </Button>
            <Button
              variant="cyber"
              onClick={handleGenerateAndDownload}
              disabled={isGeneratingDownload || createReport.isPending}
              className="font-mono text-xs min-w-[180px] bg-primary/20 hover:bg-primary/30 border-primary/40"
            >
              {isGeneratingDownload ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Generate & Download PDF
                </>
              )}
            </Button>
          </div>
          <p className="text-[10px] font-mono text-muted-foreground mt-2">
            Generate reports for all monitored websites. Use "Generate & Download PDF" to save it directly.
          </p>
        </motion.div>

        {/* Email Report Section */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="w-4 h-4 text-primary" />
            <span className="text-xs font-mono font-bold tracking-wider text-primary">EMAIL REPORT</span>
          </div>
          <div className="flex gap-3">
            <Input
              type="email"
              placeholder="Enter email address (e.g. you@gmail.com)"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendReportEmail()}
              className="flex-1 bg-secondary/50 font-mono text-sm h-10"
            />
            <Button
              variant="cyber"
              onClick={handleSendReportEmail}
              disabled={isSendingEmail}
              className="font-mono text-xs min-w-[140px]"
            >
              {isSendingEmail ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send Report
                </>
              )}
            </Button>
          </div>
          <p className="text-[10px] font-mono text-muted-foreground mt-2">
            Send a monitoring report with analysis data directly to your email.
          </p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Globe, label: 'WEBSITES', value: websites.length },
            { icon: FileText, label: 'REPORTS', value: reports.length },
            { icon: AlertTriangle, label: 'ALERTS', value: alerts.length },
            { icon: CheckCircle, label: 'RESOLVED', value: alerts.filter(a => a.status === 'resolved').length },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="glass-card p-4 flex items-center gap-3"
            >
              <stat.icon className="w-5 h-5 text-primary" />
              <div>
                <p className="text-[10px] font-mono text-muted-foreground tracking-wider">{stat.label}</p>
                <p className="text-2xl font-bold font-mono">{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Generated Reports List */}
        {reports.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-mono tracking-wider text-muted-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />GENERATED REPORTS
              </h2>
              <Button variant="ghost" size="sm" onClick={() => refetchReports()} className="font-mono text-xs">
                <RefreshCw className="w-3 h-3" />
                Refresh
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono text-xs">TITLE</TableHead>
                  <TableHead className="font-mono text-xs">TYPE</TableHead>
                  <TableHead className="font-mono text-xs">STATUS</TableHead>
                  <TableHead className="font-mono text-xs">CREATED</TableHead>
                  <TableHead className="font-mono text-xs text-right">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-mono text-sm">{report.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {reportTypeLabels[report.report_type as keyof typeof reportTypeLabels] || report.report_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "font-mono text-[10px]",
                          report.status === 'completed' && 'bg-primary/10 text-primary',
                          report.status === 'pending' && 'bg-warning/10 text-warning',
                          report.status === 'generating' && 'bg-neon-cyan/10 text-neon-cyan',
                          report.status === 'failed' && 'bg-destructive/10 text-destructive',
                        )}
                      >
                        {report.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {new Date(report.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {report.status === 'completed' && report.file && (
                          <>
                            <Button 
                              variant="cyber" 
                              size="sm" 
                              onClick={() => handleDownloadReport(report.id)}
                              className="font-mono text-xs gap-1"
                              title="Download PDF"
                            >
                              <Download className="w-3.5 h-3.5" />
                              PDF
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={async () => {
                                const email = emailTo || prompt('Enter email to send report:');
                                if (email) {
                                  try {
                                    await reportsAPI.sendEmail(email, null, report.report_type);
                                    toast({ title: 'Sent', description: `Report emailed to ${email}` });
                                  } catch (err: any) {
                                    toast({ title: 'Failed', description: err.message, variant: 'destructive' });
                                  }
                                }
                              }}
                              className="font-mono text-xs"
                              title="Email Report"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDeleteReport(report.id)}
                          disabled={deleteReport.isPending}
                          className="font-mono text-xs text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </motion.div>
        )}

        {/* Websites Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-mono tracking-wider text-muted-foreground flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />MONITORED WEBSITES
            </h2>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Search websites..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 text-xs font-mono bg-secondary/50"
              />
            </div>
          </div>

          {filteredWebsites.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono text-xs">WEBSITE</TableHead>
                  <TableHead className="font-mono text-xs">STATUS</TableHead>
                  <TableHead className="font-mono text-xs">LAST SCAN</TableHead>
                  <TableHead className="font-mono text-xs">SNAPSHOTS</TableHead>
                  <TableHead className="font-mono text-xs text-right">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWebsites.map((website) => {
                  const StatusIcon = statusConfig[website.status]?.icon || CheckCircle;
                  return (
                    <TableRow key={website.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="font-mono text-sm">{website.name}</p>
                            <p className="text-xs text-muted-foreground">{website.url}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn(statusConfig[website.status]?.color || 'bg-secondary', 'font-mono text-[10px]')}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusConfig[website.status]?.label || website.status.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {website.last_scan ? new Date(website.last_scan).toLocaleString() : 'Never'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {website.snapshot_count || 0}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link to={`/website/${website.id}`}>
                            <Button variant="ghost" size="sm" className="font-mono text-xs">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                          <a href={website.url} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="sm" className="font-mono text-xs">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </a>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="font-mono text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (confirm(`Delete ${website.name}?`)) {
                                deleteWebsite.mutate(website.id, {
                                  onSuccess: () => toast({ title: 'Deleted', description: `${website.name} removed` }),
                                  onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
                                });
                              }
                            }}
                            disabled={deleteWebsite.isPending}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-12 text-center">
              <Globe className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-sm text-muted-foreground font-mono">
                {searchQuery ? 'No websites match your search' : 'No websites being monitored'}
              </p>
              <Link to="/add-website">
                <Button variant="cyber" size="sm" className="mt-4 font-mono">
                  Add Website
                </Button>
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </MainLayout>
  );
}
