import React, { useState, useEffect } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  LinearProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Badge,
  Stack
} from '@mui/material';
import {
  AccountBalance as BankIcon,
  Dashboard as DashboardIcon,
  UploadFile as UploadIcon,
  ReceiptLong as TransactionIcon,
  WarningAmber as ExceptionIcon,
  People as PeopleIcon,
  PlayArrow as RunIcon,
  Psychology as AiIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckIcon,
  ErrorOutline as ErrorIcon,
  Close as CloseIcon,
  Search as SearchIcon,
  FileDownload as DownloadIcon,
  AssignmentInd as AssignIcon,
  ThumbUpAlt as ResolveIcon,
  Send as SendIcon,
  AutoAwesome as SparklesIcon,
  QuestionAnswer as ChatIcon,
  ArrowForward as ArrowIcon
} from '@mui/icons-material';
import { api } from './api';

// Dark Executive Financial Theme
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#38bdf8' },
    secondary: { main: '#818cf8' },
    background: { default: '#0b0f19', paper: '#111827' },
    success: { main: '#10b981' },
    warning: { main: '#f59e0b' },
    error: { main: '#ef4444' },
    text: { primary: '#f9fafb', secondary: '#9ca3af' }
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 }
  },
  shape: { borderRadius: 10 }
});

export default function App() {
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem('lendguard_token'));
  const [currentUser, setCurrentUser] = useState<any>(JSON.parse(localStorage.getItem('lendguard_user') || 'null'));
  const [currentTab, setCurrentTab] = useState(0);

  // Login Dialog State
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginUsername, setLoginUsername] = useState('admin');
  const [loginPassword, setLoginPassword] = useState('Admin@123');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Global Notification
  const [alertInfo, setAlertInfo] = useState<{ message: string; severity: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  useEffect(() => {
    if (!authToken) {
      setLoginOpen(true);
    }
  }, [authToken]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await api.post('/auth/login', {
        username: loginUsername,
        password: loginPassword
      });
      localStorage.setItem('lendguard_token', res.data.token);
      localStorage.setItem('lendguard_user', JSON.stringify(res.data));
      setAuthToken(res.data.token);
      setCurrentUser(res.data);
      setLoginOpen(false);
      setAlertInfo({ message: `Welcome back, ${res.data.fullName || res.data.username}!`, severity: 'success' });
    } catch (err: any) {
      setLoginError(err.response?.data?.message || 'Login failed. Please check credentials.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('lendguard_token');
    localStorage.removeItem('lendguard_user');
    setAuthToken(null);
    setCurrentUser(null);
    setLoginOpen(true);
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Navigation App Bar */}
        <AppBar position="sticky" elevation={2} sx={{ bgcolor: '#0f172a', borderBottom: '1px solid #1e293b' }}>
          <Toolbar>
            <BankIcon sx={{ mr: 1.5, color: '#38bdf8', fontSize: 32 }} />
            <Typography variant="h6" sx={{ flexGrow: 1, letterSpacing: 0.5, fontWeight: 800 }}>
              LENDGUARD <span style={{ color: '#38bdf8' }}>AI</span>
              <Typography variant="caption" sx={{ ml: 1.5, color: '#94a3b8', display: { xs: 'none', md: 'inline' } }}>
                Intelligent Financial Reconciliation & Exception Management
              </Typography>
            </Typography>

            {currentUser && (
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip
                  label={`${currentUser.fullName || currentUser.username} (${currentUser.role})`}
                  color="primary"
                  variant="outlined"
                  size="small"
                />
                <Button color="inherit" size="small" onClick={handleLogout}>
                  Logout
                </Button>
              </Stack>
            )}
          </Toolbar>

          {/* Navigation Tabs */}
          {authToken && (
            <Tabs
              value={currentTab}
              onChange={(_, v) => setCurrentTab(v)}
              indicatorColor="primary"
              textColor="inherit"
              sx={{ px: 2, minHeight: 48, bgcolor: '#090d16' }}
            >
              <Tab icon={<DashboardIcon fontSize="small" />} iconPosition="start" label="Executive Dashboard" />
              <Tab icon={<UploadIcon fontSize="small" />} iconPosition="start" label="CSV Ingestion" />
              <Tab icon={<TransactionIcon fontSize="small" />} iconPosition="start" label="Transaction Management" />
              <Tab icon={<ExceptionIcon fontSize="small" />} iconPosition="start" label="Exception Management" />
              <Tab icon={<PeopleIcon fontSize="small" />} iconPosition="start" label="Employee Operations" />
              <Tab icon={<SparklesIcon fontSize="small" sx={{ color: '#38bdf8' }} />} iconPosition="start" label="AI Query Resolver" />
            </Tabs>
          )}
        </AppBar>

        {/* Global Notifications */}
        {alertInfo && (
          <Container maxWidth="xl" sx={{ mt: 2 }}>
            <Alert severity={alertInfo.severity} onClose={() => setAlertInfo(null)}>
              {alertInfo.message}
            </Alert>
          </Container>
        )}

        {/* Main Content Area */}
        <Box sx={{ flexGrow: 1, py: 3 }}>
          {authToken ? (
            <Container maxWidth="xl">
              {currentTab === 0 && <DashboardView onNotify={setAlertInfo} onNavigateTab={setCurrentTab} />}
              {currentTab === 1 && <ImportView onNotify={setAlertInfo} />}
              {currentTab === 2 && <TransactionsView onNotify={setAlertInfo} />}
              {currentTab === 3 && <ExceptionsView onNotify={setAlertInfo} />}
              {currentTab === 4 && <EmployeesView onNotify={setAlertInfo} />}
              {currentTab === 5 && <AiQueryView onNotify={setAlertInfo} onNavigateTab={setCurrentTab} />}
            </Container>
          ) : (
            <Container maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
              <Typography variant="h5" gutterBottom>
                Please Authenticate to Access LendGuard AI
              </Typography>
              <Button variant="contained" onClick={() => setLoginOpen(true)} sx={{ mt: 2 }}>
                Open Login Form
              </Button>
            </Container>
          )}
        </Box>

        {/* Login Dialog */}
        <Dialog open={loginOpen && !authToken} onClose={() => {}} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ pb: 1, textAlign: 'center', fontWeight: 700 }}>
            <BankIcon sx={{ fontSize: 40, color: '#38bdf8', mb: 1 }} />
            <br />
            Sign in to LendGuard AI
          </DialogTitle>
          <form onSubmit={handleLogin}>
            <DialogContent>
              {loginError && <Alert severity="error" sx={{ mb: 2 }}>{loginError}</Alert>}
              <Typography variant="body2" sx={{ color: '#94a3b8', mb: 2 }}>
                Default Seed Accounts:
                <br />• <b>admin</b> / <code>Admin@123</code> (Administrator)
                <br />• <b>analyst</b> / <code>Analyst@123</code> (Operations Analyst)
              </Typography>
              <TextField
                fullWidth
                label="Username"
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                margin="normal"
                required
              />
              <TextField
                fullWidth
                label="Password"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                margin="normal"
                required
              />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3 }}>
              <Button type="submit" variant="contained" fullWidth disabled={loginLoading}>
                {loginLoading ? <CircularProgress size={24} /> : 'Authenticate & Continue'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}

// ==========================================
// 1. DASHBOARD & ANALYTICS VIEW (MODULE 8)
// ==========================================
function DashboardView({ onNotify, onNavigateTab }: { onNotify: any; onNavigateTab?: (tab: number) => void }) {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const res = await api.get('/dashboard/metrics');
      setMetrics(res.data);
    } catch (err: any) {
      onNotify({ message: 'Failed to load dashboard metrics from database.', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const handleRunReconciliation = async () => {
    setReconciling(true);
    try {
      const res = await api.post('/reconcile/run', { executedBy: 'Lead Administrator' });
      onNotify({
        message: `Reconciliation completed! Matched: ${res.data.matchedCount}, Exceptions Generated: ${res.data.generatedExceptions?.length || 0}, Success Rate: ${res.data.successRate}%`,
        severity: 'success'
      });
      await fetchMetrics();
    } catch (err: any) {
      onNotify({ message: 'Error executing deterministic reconciliation engine.', severity: 'error' });
    } finally {
      setReconciling(false);
    }
  };

  if (loading && !metrics) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const kpis = metrics?.kpis || {};
  const charts = metrics?.charts || {};

  return (
    <Box>
      {/* Top Action Bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <div>
          <Typography variant="h5">Operational Reconciliation Metrics</Typography>
          <Typography variant="body2" color="text.secondary">
            Live database records & automated reconciliation engine analytics
          </Typography>
        </div>
        <Stack direction="row" spacing={1.5}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchMetrics} disabled={loading || reconciling}>
            Refresh
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={reconciling ? <CircularProgress size={20} color="inherit" /> : <RunIcon />}
            onClick={handleRunReconciliation}
            disabled={reconciling}
            sx={{ fontWeight: 700 }}
          >
            {reconciling ? 'Reconciling Ledger...' : 'Run Reconciliation Engine'}
          </Button>
        </Stack>
      </Box>

      {/* AI Intelligence Query Quick Copilot Banner */}
      <Paper
        sx={{
          p: 2.5,
          mb: 3,
          bgcolor: '#0f1c3f',
          border: '1px solid #1e3a8a',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
          borderRadius: 2
        }}
      >
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={8}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Box
                sx={{
                  bgcolor: '#1e293b',
                  p: 1.2,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #38bdf8'
                }}
              >
                <SparklesIcon sx={{ color: '#38bdf8', fontSize: 30 }} />
              </Box>
              <div>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#f8fafc' }}>
                  LendGuard AI Query Copilot & Resolution Assistant
                </Typography>
                <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                  Natural language audit insights: ask about ledger health, discrepancy root-causes, or Isolation Forest anomalies.
                </Typography>
              </div>
            </Stack>
          </Grid>
          <Grid item xs={12} md={4} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<ChatIcon />}
              endIcon={<ArrowIcon />}
              onClick={() => onNavigateTab && onNavigateTab(5)}
              sx={{ fontWeight: 700 }}
            >
              Ask AI Financial Assistant
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* 6 Key Performance Indicator Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={2}>
          <Card sx={{ bgcolor: '#1e293b', borderLeft: '4px solid #38bdf8' }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary">TOTAL TRANSACTIONS</Typography>
              <Typography variant="h5" sx={{ mt: 0.5, fontWeight: 700 }}>
                {kpis.totalTransactions?.toLocaleString() || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card sx={{ bgcolor: '#1e293b', borderLeft: '4px solid #10b981' }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary">MATCHED RECORDS</Typography>
              <Typography variant="h5" sx={{ mt: 0.5, fontWeight: 700, color: '#10b981' }}>
                {kpis.matchedTransactions?.toLocaleString() || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card sx={{ bgcolor: '#1e293b', borderLeft: '4px solid #ef4444' }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary">UNMATCHED / VARIANCE</Typography>
              <Typography variant="h5" sx={{ mt: 0.5, fontWeight: 700, color: '#ef4444' }}>
                {kpis.unmatchedTransactions?.toLocaleString() || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card sx={{ bgcolor: '#1e293b', borderLeft: '4px solid #f59e0b' }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary">OPEN EXCEPTIONS</Typography>
              <Typography variant="h5" sx={{ mt: 0.5, fontWeight: 700, color: '#f59e0b' }}>
                {kpis.openExceptions?.toLocaleString() || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card sx={{ bgcolor: '#1e293b', borderLeft: '4px solid #818cf8' }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary">RESOLVED EXCEPTIONS</Typography>
              <Typography variant="h5" sx={{ mt: 0.5, fontWeight: 700, color: '#818cf8' }}>
                {kpis.resolvedExceptions?.toLocaleString() || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={2}>
          <Card sx={{ bgcolor: '#1e293b', borderLeft: '4px solid #06b6d4' }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary">RECONCILIATION RATE</Typography>
              <Typography variant="h5" sx={{ mt: 0.5, fontWeight: 700, color: '#06b6d4' }}>
                {kpis.successRate || 0}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Analytics Breakdown */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Exception Types Breakdown */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2.5, height: '100%' }}>
            <Typography variant="h6" gutterBottom>Exceptions by Discrepancy Category</Typography>
            <Divider sx={{ mb: 2 }} />
            {charts.exceptionsByType?.length > 0 ? (
              <List dense>
                {charts.exceptionsByType.map((item: any, i: number) => (
                  <ListItem key={i} sx={{ px: 0, py: 1 }}>
                    <ListItemText
                      primary={item.type}
                      secondary={`Detected discrepancy instances requiring analyst review`}
                    />
                    <Chip label={`${item.count} items`} color="warning" size="small" />
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                No active discrepancies found. Run reconciliation to detect exceptions.
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Severities & Workload */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2.5, height: '100%' }}>
            <Typography variant="h6" gutterBottom>Exception Severity & Employee Workload</Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">SEVERITY MATRIX</Typography>
                <Box sx={{ mt: 1 }}>
                  {charts.exceptionsBySeverity?.map((s: any, idx: number) => (
                    <Box key={idx} sx={{ mb: 1, display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">{s.severity}</Typography>
                      <Chip
                        label={s.count}
                        size="small"
                        color={s.severity === 'Critical' ? 'error' : s.severity === 'High' ? 'warning' : 'default'}
                      />
                    </Box>
                  ))}
                  {(!charts.exceptionsBySeverity || charts.exceptionsBySeverity.length === 0) && (
                    <Typography variant="body2" color="text.secondary">No exceptions recorded.</Typography>
                  )}
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">ANALYST QUEUE STATUS</Typography>
                <Box sx={{ mt: 1 }}>
                  {charts.employeeWorkload?.map((emp: any, idx: number) => (
                    <Box key={idx} sx={{ mb: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{emp.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Active: {emp.assignedCount} | Resolved: {emp.resolvedCount}
                      </Typography>
                    </Box>
                  ))}
                  {(!charts.employeeWorkload || charts.employeeWorkload.length === 0) && (
                    <Typography variant="body2" color="text.secondary">No analysts assigned yet.</Typography>
                  )}
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>

      {/* Recent Reconciliation Executions */}
      <Paper sx={{ p: 2.5 }}>
        <Typography variant="h6" gutterBottom>Recent Reconciliation Batches</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Batch ID</TableCell>
                <TableCell>Executed At</TableCell>
                <TableCell>Matched</TableCell>
                <TableCell>Missing Int / Ext</TableCell>
                <TableCell>Amount Mismatches</TableCell>
                <TableCell>Duplicates</TableCell>
                <TableCell>Success Rate</TableCell>
                <TableCell>Operator</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {charts.recentBatches?.map((b: any) => (
                <TableRow key={b.id}>
                  <TableCell>#{b.id}</TableCell>
                  <TableCell>{new Date(b.executedAt).toLocaleString()}</TableCell>
                  <TableCell sx={{ color: '#10b981', fontWeight: 600 }}>{b.matchedCount}</TableCell>
                  <TableCell>{b.unmatchedInternalCount} / {b.unmatchedExternalCount}</TableCell>
                  <TableCell>{b.amountMismatchCount}</TableCell>
                  <TableCell>{b.duplicateCount}</TableCell>
                  <TableCell sx={{ color: '#38bdf8', fontWeight: 600 }}>{b.successRate}%</TableCell>
                  <TableCell>{b.executedBy}</TableCell>
                </TableRow>
              ))}
              {(!charts.recentBatches || charts.recentBatches.length === 0) && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    No reconciliation runs executed yet. Click "Run Reconciliation Engine" above to trigger.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

// ==========================================
// 2. CSV INGESTION & VALIDATION (MODULE 2)
// ==========================================
function ImportView({ onNotify }: { onNotify: any }) {
  const [internalFile, setInternalFile] = useState<File | null>(null);
  const [externalFile, setExternalFile] = useState<File | null>(null);
  const [uploadingInternal, setUploadingInternal] = useState(false);
  const [uploadingExternal, setUploadingExternal] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [selectedErrorHistory, setSelectedErrorHistory] = useState<any | null>(null);
  const [errorReportData, setErrorReportData] = useState<any[]>([]);

  const fetchHistory = async () => {
    try {
      const res = await api.get('/transactionimport/history');
      setHistoryList(res.data);
    } catch (err) {
      // Ignored
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleUploadInternal = async () => {
    if (!internalFile) return;
    setUploadingInternal(true);
    const formData = new FormData();
    formData.append('file', internalFile);

    try {
      const res = await api.post('/transactionimport/internal', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      onNotify({
        message: `Internal CSV parsed: ${res.data.acceptedRows} accepted, ${res.data.rejectedRows} rejected out of ${res.data.totalRows} rows.`,
        severity: res.data.rejectedRows > 0 ? 'warning' : 'success'
      });
      setInternalFile(null);
      await fetchHistory();
    } catch (err: any) {
      onNotify({ message: err.response?.data?.message || 'Error uploading internal file.', severity: 'error' });
    } finally {
      setUploadingInternal(false);
    }
  };

  const handleUploadExternal = async () => {
    if (!externalFile) return;
    setUploadingExternal(true);
    const formData = new FormData();
    formData.append('file', externalFile);

    try {
      const res = await api.post('/externalimport/external', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      onNotify({
        message: `External Bank CSV parsed: ${res.data.acceptedRows} accepted, ${res.data.rejectedRows} rejected out of ${res.data.totalRows} rows.`,
        severity: res.data.rejectedRows > 0 ? 'warning' : 'success'
      });
      setExternalFile(null);
      await fetchHistory();
    } catch (err: any) {
      onNotify({ message: err.response?.data?.message || 'Error uploading external bank file.', severity: 'error' });
    } finally {
      setUploadingExternal(false);
    }
  };

  const handleViewReport = async (item: any) => {
    setSelectedErrorHistory(item);
    try {
      const res = await api.get(`/transactionimport/history/${item.id}/report`);
      setErrorReportData(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setErrorReportData([]);
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>CSV Financial Transaction Ingestion</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Upload internal financial system ledger exports and external banking settlement statement files.
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Internal Import Card */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, border: '1px dashed #38bdf8', bgcolor: '#111827' }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
              <UploadIcon sx={{ color: '#38bdf8', fontSize: 32 }} />
              <div>
                <Typography variant="h6">1. Internal Transaction Ledger</Typography>
                <Typography variant="caption" color="text.secondary">
                  Source: Internal ERP / Billing Database CSV
                </Typography>
              </div>
            </Stack>
            <Typography variant="body2" sx={{ mb: 2, color: '#94a3b8' }}>
              Required headers: <code>ReferenceId, TransactionDate, Amount, Currency, Type, Status</code>
            </Typography>
            <input
              type="file"
              accept=".csv"
              id="internal-csv"
              style={{ display: 'none' }}
              onChange={(e) => setInternalFile(e.target.files?.[0] || null)}
            />
            <label htmlFor="internal-csv">
              <Button variant="outlined" component="span" fullWidth sx={{ mb: 2 }}>
                {internalFile ? internalFile.name : 'Select Internal CSV File'}
              </Button>
            </label>
            <Button
              variant="contained"
              fullWidth
              color="primary"
              disabled={!internalFile || uploadingInternal}
              onClick={handleUploadInternal}
            >
              {uploadingInternal ? <CircularProgress size={24} /> : 'Validate & Ingest Internal Records'}
            </Button>
          </Paper>
        </Grid>

        {/* External Bank Import Card */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, border: '1px dashed #818cf8', bgcolor: '#111827' }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
              <BankIcon sx={{ color: '#818cf8', fontSize: 32 }} />
              <div>
                <Typography variant="h6">2. External Settlement Statements</Typography>
                <Typography variant="caption" color="text.secondary">
                  Source: Bank Clearings / Payment Gateway Settlement CSV
                </Typography>
              </div>
            </Stack>
            <Typography variant="body2" sx={{ mb: 2, color: '#94a3b8' }}>
              Required headers: <code>ReferenceId, TransactionDate, Amount, Currency, Type, Status</code>
            </Typography>
            <input
              type="file"
              accept=".csv"
              id="external-csv"
              style={{ display: 'none' }}
              onChange={(e) => setExternalFile(e.target.files?.[0] || null)}
            />
            <label htmlFor="external-csv">
              <Button variant="outlined" component="span" fullWidth sx={{ mb: 2 }}>
                {externalFile ? externalFile.name : 'Select External Settlement CSV File'}
              </Button>
            </label>
            <Button
              variant="contained"
              fullWidth
              color="secondary"
              disabled={!externalFile || uploadingExternal}
              onClick={handleUploadExternal}
            >
              {uploadingExternal ? <CircularProgress size={24} /> : 'Validate & Ingest External Records'}
            </Button>
          </Paper>
        </Grid>
      </Grid>

      {/* Ingestion History & Error Reports */}
      <Paper sx={{ p: 2.5 }}>
        <Typography variant="h6" gutterBottom>Ingestion Audit History</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Batch #</TableCell>
                <TableCell>File Name</TableCell>
                <TableCell>Source System</TableCell>
                <TableCell>Uploaded At</TableCell>
                <TableCell>Total Rows</TableCell>
                <TableCell>Accepted</TableCell>
                <TableCell>Rejected</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Validation Report</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {historyList.map((h) => (
                <TableRow key={h.id}>
                  <TableCell>#{h.id}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{h.fileName}</TableCell>
                  <TableCell>
                    <Chip
                      label={h.sourceSystem}
                      size="small"
                      color={h.sourceSystem === 'Internal' ? 'primary' : 'secondary'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{new Date(h.uploadedAt).toLocaleString()}</TableCell>
                  <TableCell>{h.totalRows}</TableCell>
                  <TableCell sx={{ color: '#10b981', fontWeight: 600 }}>{h.acceptedRows}</TableCell>
                  <TableCell sx={{ color: h.rejectedRows > 0 ? '#ef4444' : 'inherit', fontWeight: 600 }}>
                    {h.rejectedRows}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={h.status}
                      size="small"
                      color={h.rejectedRows > 0 ? 'warning' : 'success'}
                    />
                  </TableCell>
                  <TableCell>
                    {h.rejectedRows > 0 ? (
                      <Button size="small" variant="text" color="warning" onClick={() => handleViewReport(h)}>
                        View Errors ({h.rejectedRows})
                      </Button>
                    ) : (
                      <Typography variant="caption" color="text.secondary">Clean (0 errors)</Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {historyList.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    No CSV uploads found. Please upload sample files to populate records.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Validation Report Dialog */}
      <Dialog open={Boolean(selectedErrorHistory)} onClose={() => setSelectedErrorHistory(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          Validation Error Report - {selectedErrorHistory?.fileName}
        </DialogTitle>
        <DialogContent dividers>
          {errorReportData.length > 0 ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Row Number</TableCell>
                  <TableCell>Validation Diagnostic Reason</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {errorReportData.map((err, idx) => (
                  <TableRow key={idx}>
                    <TableCell sx={{ fontWeight: 600 }}>Row {err.Row}</TableCell>
                    <TableCell sx={{ color: '#ef4444' }}>{err.Error}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Typography variant="body2">No detailed error report stored for this file.</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedErrorHistory(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ==========================================
// 3. TRANSACTION MANAGEMENT VIEW (MODULE 3)
// ==========================================
function TransactionsView({ onNotify }: { onNotify: any }) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sourceSystem, setSourceSystem] = useState('All');
  const [status, setStatus] = useState('All');
  const [loading, setLoading] = useState(false);

  // Detail Modal
  const [selectedTx, setSelectedTx] = useState<any | null>(null);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await api.get('/transactions', {
        params: {
          search,
          sourceSystem,
          reconciliationStatus: status,
          page,
          pageSize: 15
        }
      });
      setTransactions(res.data.data);
      setTotalCount(res.data.totalCount);
    } catch (err) {
      onNotify({ message: 'Error retrieving transactions.', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [page, sourceSystem, status]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTransactions();
  };

  const handleOpenDetail = async (id: number) => {
    try {
      const res = await api.get(`/transactions/${id}`);
      setSelectedTx(res.data);
    } catch (err) {
      onNotify({ message: 'Failed to fetch transaction details.', severity: 'error' });
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Financial Transactions Repository</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Search, filter, inspect, and analyze internal and external transaction settlement records.
      </Typography>

      {/* Filter Toolbar */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <form onSubmit={handleSearchSubmit}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="Search Reference ID / Type"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                InputProps={{
                  endAdornment: (
                    <IconButton size="small" type="submit">
                      <SearchIcon />
                    </IconButton>
                  )
                }}
              />
            </Grid>
            <Grid item xs={6} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Source System</InputLabel>
                <Select
                  value={sourceSystem}
                  label="Source System"
                  onChange={(e) => {
                    setSourceSystem(e.target.value);
                    setPage(1);
                  }}
                >
                  <MenuItem value="All">All Source Systems</MenuItem>
                  <MenuItem value="Internal">Internal Ledger</MenuItem>
                  <MenuItem value="External">External Bank Settlement</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6} sm={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Reconciliation Status</InputLabel>
                <Select
                  value={status}
                  label="Reconciliation Status"
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <MenuItem value="All">All Statuses</MenuItem>
                  <MenuItem value="Matched">Matched</MenuItem>
                  <MenuItem value="Pending">Pending</MenuItem>
                  <MenuItem value="Discrepancy">Discrepancy</MenuItem>
                  <MenuItem value="Duplicate">Duplicate</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={2}>
              <Button fullWidth variant="contained" type="submit">
                Apply Filters
              </Button>
            </Grid>
          </Grid>
        </form>
      </Paper>

      {/* Table */}
      <Paper sx={{ p: 2 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Reference ID</TableCell>
                <TableCell>Source System</TableCell>
                <TableCell>Transaction Date</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Currency</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Reconciliation Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id} hover>
                  <TableCell>#{tx.id}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{tx.referenceId}</TableCell>
                  <TableCell>
                    <Chip
                      label={tx.sourceSystem}
                      size="small"
                      color={tx.sourceSystem === 'Internal' ? 'primary' : 'secondary'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{new Date(tx.transactionDate).toLocaleDateString()}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    ${Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>{tx.currency}</TableCell>
                  <TableCell>{tx.type}</TableCell>
                  <TableCell>
                    <Chip
                      label={tx.reconciliationStatus}
                      size="small"
                      color={
                        tx.reconciliationStatus === 'Matched'
                          ? 'success'
                          : tx.reconciliationStatus === 'Discrepancy'
                          ? 'error'
                          : tx.reconciliationStatus === 'Duplicate'
                          ? 'warning'
                          : 'default'
                      }
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="text" onClick={() => handleOpenDetail(tx.id)}>
                      Compare
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {transactions.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    No transactions match current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination Controls */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, pt: 1, borderTop: '1px solid #1e293b' }}>
          <Typography variant="body2" color="text.secondary">
            Showing {transactions.length} of {totalCount} transactions
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button size="small" disabled={transactions.length < 15} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </Stack>
        </Box>
      </Paper>

      {/* Comparison Detail Modal */}
      <Dialog open={Boolean(selectedTx)} onClose={() => setSelectedTx(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          Transaction Comparison: {selectedTx?.transaction?.referenceId}
        </DialogTitle>
        <DialogContent dividers>
          {selectedTx && (
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <Paper sx={{ p: 2, bgcolor: '#1e293b' }}>
                  <Typography variant="subtitle2" color="primary" gutterBottom>
                    INSPECTED RECORD ({selectedTx.transaction.sourceSystem})
                  </Typography>
                  <Divider sx={{ mb: 1.5 }} />
                  <Typography variant="body2"><b>Reference ID:</b> {selectedTx.transaction.referenceId}</Typography>
                  <Typography variant="body2"><b>Amount:</b> ${selectedTx.transaction.amount}</Typography>
                  <Typography variant="body2"><b>Date:</b> {new Date(selectedTx.transaction.transactionDate).toLocaleDateString()}</Typography>
                  <Typography variant="body2"><b>Type:</b> {selectedTx.transaction.type}</Typography>
                  <Typography variant="body2"><b>Status:</b> {selectedTx.transaction.reconciliationStatus}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Paper sx={{ p: 2, bgcolor: '#1e293b' }}>
                  <Typography variant="subtitle2" color="secondary" gutterBottom>
                    COUNTERPART RECORD ({selectedTx.counterpart ? selectedTx.counterpart.sourceSystem : 'NOT FOUND'})
                  </Typography>
                  <Divider sx={{ mb: 1.5 }} />
                  {selectedTx.counterpart ? (
                    <>
                      <Typography variant="body2"><b>Reference ID:</b> {selectedTx.counterpart.referenceId}</Typography>
                      <Typography variant="body2"><b>Amount:</b> ${selectedTx.counterpart.amount}</Typography>
                      <Typography variant="body2"><b>Date:</b> {new Date(selectedTx.counterpart.transactionDate).toLocaleDateString()}</Typography>
                      <Typography variant="body2"><b>Type:</b> {selectedTx.counterpart.type}</Typography>
                      <Typography variant="body2"><b>Status:</b> {selectedTx.counterpart.reconciliationStatus}</Typography>
                    </>
                  ) : (
                    <Alert severity="warning" sx={{ mt: 1 }}>
                      No matching counterpart record detected in opposing ledger.
                    </Alert>
                  )}
                </Paper>
              </Grid>

              {selectedTx.relatedExceptions?.length > 0 && (
                <Grid item xs={12}>
                  <Alert severity="error">
                    <b>Active Exceptions on this Transaction:</b>
                    {selectedTx.relatedExceptions.map((ex: any) => (
                      <div key={ex.id}>• [{ex.exceptionType}] {ex.description}</div>
                    ))}
                  </Alert>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedTx(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ==========================================
// 4. EXCEPTION MANAGEMENT & AI (MODULE 5 & 7)
// ==========================================
function ExceptionsView({ onNotify }: { onNotify: any }) {
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [loading, setLoading] = useState(false);

  // Selected Exception Drawer / Detail
  const [activeExId, setActiveExId] = useState<number | null>(null);
  const [activeExDetail, setActiveExDetail] = useState<any | null>(null);
  const [newNote, setNewNote] = useState('');
  const [aiAnalysisResult, setAiAnalysisResult] = useState<any | null>(null);
  const [analyzingAi, setAnalyzingAi] = useState(false);

  // Resolve Dialog
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolutionCategory, setResolutionCategory] = useState('TimingDifference');
  const [resolutionExplanation, setResolutionExplanation] = useState('');

  const fetchExceptions = async () => {
    setLoading(true);
    try {
      const res = await api.get('/exceptions', {
        params: {
          status: statusFilter,
          severity: severityFilter,
          pageSize: 25
        }
      });
      setExceptions(res.data.data);
    } catch (err) {
      onNotify({ message: 'Error retrieving exceptions.', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExceptions();
  }, [statusFilter, severityFilter]);

  const loadExceptionDetail = async (id: number) => {
    setActiveExId(id);
    setAiAnalysisResult(null);
    try {
      const res = await api.get(`/exceptions/${id}`);
      setActiveExDetail(res.data);
      // Pre-populate AI state if already analyzed
      if (res.data.exception?.aiAnomalyScore != null) {
        setAiAnalysisResult({
          anomaly_score: res.data.exception.aiAnomalyScore,
          classification: res.data.exception.aiClassification,
          explanation: res.data.exception.aiExplanation,
          recommended_steps: JSON.parse(res.data.exception.aiRecommendedSteps || '[]')
        });
      }
    } catch (err) {
      onNotify({ message: 'Failed to load exception details.', severity: 'error' });
    }
  };

  const handleAddNote = async () => {
    if (!activeExId || !newNote.trim()) return;
    try {
      await api.post(`/exceptions/${activeExId}/notes`, {
        noteText: newNote,
        authorName: 'Operations Analyst'
      });
      setNewNote('');
      await loadExceptionDetail(activeExId);
      onNotify({ message: 'Investigation note added.', severity: 'success' });
    } catch (err) {
      onNotify({ message: 'Error adding note.', severity: 'error' });
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!activeExId) return;
    try {
      await api.patch(`/exceptions/${activeExId}/status`, {
        status: newStatus,
        note: `Status updated to ${newStatus}`
      });
      await loadExceptionDetail(activeExId);
      await fetchExceptions();
      onNotify({ message: `Exception marked as ${newStatus}.`, severity: 'success' });
    } catch (err) {
      onNotify({ message: 'Error updating exception status.', severity: 'error' });
    }
  };

  const handleAnalyzeWithAI = async () => {
    if (!activeExId) return;
    setAnalyzingAi(true);
    try {
      const res = await api.post(`/exceptions/${activeExId}/analyze-ai`);
      setAiAnalysisResult(res.data);
      await loadExceptionDetail(activeExId);
      onNotify({ message: 'AI Anomaly Analysis completed successfully!', severity: 'success' });
    } catch (err: any) {
      onNotify({ message: 'AI Analysis call failed.', severity: 'error' });
    } finally {
      setAnalyzingAi(false);
    }
  };

  const handleResolveSubmit = async () => {
    if (!activeExId || !resolutionExplanation.trim()) {
      onNotify({ message: 'Please provide a resolution explanation.', severity: 'warning' });
      return;
    }

    try {
      await api.post(`/exceptions/${activeExId}/resolve`, {
        resolutionCategory,
        resolutionExplanation,
        resolvedBy: 'Operations Analyst'
      });
      setResolveDialogOpen(false);
      setResolutionExplanation('');
      await loadExceptionDetail(activeExId);
      await fetchExceptions();
      onNotify({ message: 'Exception successfully resolved!', severity: 'success' });
    } catch (err) {
      onNotify({ message: 'Error resolving exception.', severity: 'error' });
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <div>
          <Typography variant="h5">Exception Investigation & Resolution</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage reconciliation breaks, assign analysts, review evidence, and trigger AI-assisted diagnostics.
          </Typography>
        </div>
      </Box>

      {/* Filter Chips */}
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="body2" sx={{ alignSelf: 'center', mr: 1, color: 'text.secondary' }}>
          Status:
        </Typography>
        {['All', 'Open', 'Assigned', 'In Progress', 'Resolved', 'Closed'].map((s) => (
          <Chip
            key={s}
            label={s}
            onClick={() => setStatusFilter(s)}
            color={statusFilter === s ? 'primary' : 'default'}
            variant={statusFilter === s ? 'filled' : 'outlined'}
          />
        ))}

        <Divider orientation="vertical" flexItem sx={{ mx: 2 }} />

        <Typography variant="body2" sx={{ alignSelf: 'center', mr: 1, color: 'text.secondary' }}>
          Severity:
        </Typography>
        {['All', 'Critical', 'High', 'Medium', 'Low'].map((sev) => (
          <Chip
            key={sev}
            label={sev}
            onClick={() => setSeverityFilter(sev)}
            color={
              severityFilter === sev
                ? sev === 'Critical'
                  ? 'error'
                  : sev === 'High'
                  ? 'warning'
                  : 'primary'
                : 'default'
            }
            variant={severityFilter === sev ? 'filled' : 'outlined'}
          />
        ))}
      </Stack>

      {/* Exceptions Table */}
      <Paper sx={{ p: 2 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Ex #</TableCell>
                <TableCell>Reference</TableCell>
                <TableCell>Exception Type</TableCell>
                <TableCell>Severity</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Assigned To</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>AI Anomaly</TableCell>
                <TableCell align="right">Investigate</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {exceptions.map((ex) => (
                <TableRow key={ex.id} hover>
                  <TableCell>#{ex.id}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{ex.transactionReference}</TableCell>
                  <TableCell>{ex.exceptionType}</TableCell>
                  <TableCell>
                    <Chip
                      label={ex.severity}
                      size="small"
                      color={
                        ex.severity === 'Critical'
                          ? 'error'
                          : ex.severity === 'High'
                          ? 'warning'
                          : ex.severity === 'Medium'
                          ? 'info'
                          : 'default'
                      }
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>${Number(ex.amount).toFixed(2)}</TableCell>
                  <TableCell>{ex.assignedEmployeeName || 'Unassigned'}</TableCell>
                  <TableCell>
                    <Chip
                      label={ex.status}
                      size="small"
                      color={
                        ex.status === 'Resolved' || ex.status === 'Closed'
                          ? 'success'
                          : ex.status === 'In Progress'
                          ? 'primary'
                          : 'warning'
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {ex.aiAnomalyScore != null ? (
                      <Chip
                        icon={<AiIcon />}
                        label={`${Math.round(ex.aiAnomalyScore * 100)}% (${ex.aiClassification || 'Advisory'})`}
                        size="small"
                        color={ex.aiAnomalyScore >= 0.65 ? 'error' : 'info'}
                      />
                    ) : (
                      <Typography variant="caption" color="text.secondary">Pending</Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      onClick={() => loadExceptionDetail(ex.id)}
                    >
                      Investigate
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {exceptions.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No exceptions found for selected filters. Run reconciliation engine to detect discrepancies.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Investigation Drawer */}
      <Drawer
        anchor="right"
        open={Boolean(activeExId)}
        onClose={() => setActiveExId(null)}
        PaperProps={{ sx: { width: { xs: '100%', md: 720 }, bgcolor: '#0f172a', p: 3 } }}
      >
        {activeExDetail && (
          <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <div>
                <Typography variant="h6">
                  Exception #{activeExDetail.exception.id}: {activeExDetail.exception.transactionReference}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                  <Chip label={activeExDetail.exception.exceptionType} color="warning" size="small" />
                  <Chip label={`Severity: ${activeExDetail.exception.severity}`} size="small" />
                  <Chip label={`Status: ${activeExDetail.exception.status}`} color="primary" size="small" />
                </Stack>
              </div>
              <IconButton onClick={() => setActiveExId(null)}>
                <CloseIcon />
              </IconButton>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* AI Advisory Section (MODULE 7: AI EXPLANATION INTERFACE) */}
            <Paper sx={{ p: 2.5, mb: 3, border: '1px solid #38bdf8', bgcolor: '#111e38' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <AiIcon sx={{ color: '#38bdf8', fontSize: 28 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#38bdf8' }}>
                    AI-Assisted Anomaly Detection & Advisory
                  </Typography>
                </Stack>
                <Button
                  variant="contained"
                  size="small"
                  color="primary"
                  startIcon={analyzingAi ? <CircularProgress size={16} /> : <AiIcon />}
                  onClick={handleAnalyzeWithAI}
                  disabled={analyzingAi}
                >
                  {analyzingAi ? 'Running Scikit-learn...' : 'Analyze with AI'}
                </Button>
              </Box>

              {aiAnalysisResult ? (
                <Box sx={{ mt: 2 }}>
                  <Grid container spacing={2} sx={{ mb: 1.5 }}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">ISOLATION FOREST SCORE</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                        <LinearProgress
                          variant="determinate"
                          value={Math.round(aiAnalysisResult.anomaly_score * 100)}
                          sx={{ flexGrow: 1, mr: 1.5, height: 8, borderRadius: 4 }}
                          color={aiAnalysisResult.anomaly_score >= 0.65 ? 'error' : 'primary'}
                        />
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {Math.round(aiAnalysisResult.anomaly_score * 100)}%
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">CLASSIFICATION</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.5, color: '#38bdf8' }}>
                        {aiAnalysisResult.classification} ({aiAnalysisResult.confidence_level || 'Advisory'})
                      </Typography>
                    </Grid>
                  </Grid>

                  <Typography variant="subtitle2" sx={{ color: '#f8fafc', mt: 1 }}>
                    Why was this flagged?
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 1.5 }}>
                    {aiAnalysisResult.why_flagged || aiAnalysisResult.explanation}
                  </Typography>

                  {aiAnalysisResult.recommended_steps?.length > 0 && (
                    <Box sx={{ mt: 1.5 }}>
                      <Typography variant="subtitle2" sx={{ color: '#38bdf8' }}>
                        Recommended Investigation Checklist:
                      </Typography>
                      <List dense disablePadding>
                        {aiAnalysisResult.recommended_steps.map((step: string, sIdx: number) => (
                          <ListItem key={sIdx} sx={{ px: 0, py: 0.5 }}>
                            <ListItemText
                              primary={`• ${step}`}
                              primaryTypographyProps={{ variant: 'body2', color: '#e2e8f0' }}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Click <b>Analyze with AI</b> to execute Isolation Forest statistical anomaly scoring and generate structured advisory explanations.
                </Typography>
              )}
            </Paper>

            {/* Description & Supporting Evidence */}
            <Typography variant="subtitle2" gutterBottom>Description & Evidence Log</Typography>
            <Paper sx={{ p: 2, mb: 2, bgcolor: '#1e293b' }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                <b>Description:</b> {activeExDetail.exception.description}
              </Typography>
              <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                <b>Supporting Evidence:</b> {activeExDetail.exception.evidence}
              </Typography>
            </Paper>

            {/* Compared Records */}
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={6}>
                <Paper sx={{ p: 1.5, bgcolor: '#1e293b' }}>
                  <Typography variant="caption" color="primary">INTERNAL RECORD</Typography>
                  {activeExDetail.internalRecord ? (
                    <Typography variant="body2">
                      Amount: ${activeExDetail.internalRecord.amount}
                      <br />Date: {activeExDetail.internalRecord.transactionDate?.slice(0, 10)}
                    </Typography>
                  ) : (
                    <Typography variant="caption" color="error" display="block">No Internal Entry</Typography>
                  )}
                </Paper>
              </Grid>
              <Grid item xs={6}>
                <Paper sx={{ p: 1.5, bgcolor: '#1e293b' }}>
                  <Typography variant="caption" color="secondary">EXTERNAL RECORD</Typography>
                  {activeExDetail.externalRecord ? (
                    <Typography variant="body2">
                      Amount: ${activeExDetail.externalRecord.amount}
                      <br />Date: {activeExDetail.externalRecord.transactionDate?.slice(0, 10)}
                    </Typography>
                  ) : (
                    <Typography variant="caption" color="error" display="block">No External Entry</Typography>
                  )}
                </Paper>
              </Grid>
            </Grid>

            {/* Action Buttons */}
            <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
              {activeExDetail.exception.status !== 'In Progress' && (
                <Button size="small" variant="outlined" onClick={() => handleStatusChange('In Progress')}>
                  Mark In Progress
                </Button>
              )}
              {activeExDetail.exception.status !== 'Resolved' && (
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  startIcon={<ResolveIcon />}
                  onClick={() => setResolveDialogOpen(true)}
                >
                  Resolve Exception
                </Button>
              )}
              {activeExDetail.exception.status === 'Resolved' && (
                <Button size="small" variant="outlined" color="inherit" onClick={() => handleStatusChange('Closed')}>
                  Close Exception
                </Button>
              )}
            </Stack>

            {/* Investigation Notes */}
            <Typography variant="subtitle2" gutterBottom>Investigation Notes</Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Enter audit note or human findings..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
              />
              <Button variant="contained" onClick={handleAddNote}>
                Add Note
              </Button>
            </Box>

            <List dense>
              {activeExDetail.notes?.map((n: any) => (
                <Paper key={n.id} sx={{ p: 1.5, mb: 1, bgcolor: '#1e293b' }}>
                  <Typography variant="caption" color="text.secondary">
                    {n.authorName} • {new Date(n.createdAt).toLocaleString()}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>{n.noteText}</Typography>
                </Paper>
              ))}
            </List>
          </Box>
        )}
      </Drawer>

      {/* Resolve Exception Dialog */}
      <Dialog open={resolveDialogOpen} onClose={() => setResolveDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Resolve Exception #{activeExId}</DialogTitle>
        <DialogContent dividers>
          <FormControl fullWidth margin="normal" size="small">
            <InputLabel>Resolution Category</InputLabel>
            <Select
              value={resolutionCategory}
              label="Resolution Category"
              onChange={(e) => setResolutionCategory(e.target.value)}
            >
              <MenuItem value="TimingDifference">Timing Difference (ACH / T+1 Delay)</MenuItem>
              <MenuItem value="FeeAdjustment">Fee Adjustment / Processing Surcharge</MenuItem>
              <MenuItem value="FalsePositive">False Positive / Legitimate Discrepancy</MenuItem>
              <MenuItem value="RefundReversal">Refund or Chargeback Reversal</MenuItem>
              <MenuItem value="SystemError">Ledger Gateway Retry Voided</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Resolution Explanation (Required)"
            multiline
            rows={3}
            margin="normal"
            value={resolutionExplanation}
            onChange={(e) => setResolutionExplanation(e.target.value)}
            placeholder="Explain root cause and authorization steps taken..."
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResolveDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="success" onClick={handleResolveSubmit}>
            Confirm Human Resolution
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ==========================================
// 5. EMPLOYEE MANAGEMENT (MODULE 9)
// ==========================================
function EmployeesView({ onNotify }: { onNotify: any }) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('Operations Analyst');

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setEmployees(res.data);
    } catch (err) {
      onNotify({ message: 'Error retrieving employee roster.', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleToggleStatus = async (id: number) => {
    try {
      await api.patch(`/users/${id}/toggle-status`);
      await fetchEmployees();
      onNotify({ message: 'User active status updated.', severity: 'success' });
    } catch (err) {
      onNotify({ message: 'Error updating user status.', severity: 'error' });
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/users', {
        username: newUsername,
        password: newPassword,
        fullName: newFullName,
        email: newEmail,
        role: newRole,
        department: 'Financial Operations'
      });
      setCreateDialogOpen(false);
      setNewUsername('');
      setNewPassword('');
      setNewFullName('');
      setNewEmail('');
      await fetchEmployees();
      onNotify({ message: 'New employee analyst added successfully!', severity: 'success' });
    } catch (err: any) {
      onNotify({ message: err.response?.data?.message || 'Error creating user.', severity: 'error' });
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <div>
          <Typography variant="h5">Employee Operations & Workload Management</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage authorized analysts, track assigned exception queues, and balance pending workloads.
          </Typography>
        </div>
        <Button variant="contained" startIcon={<AssignIcon />} onClick={() => setCreateDialogOpen(true)}>
          Add Analyst / Administrator
        </Button>
      </Box>

      <Paper sx={{ p: 2 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Employee ID</TableCell>
                <TableCell>Full Name / Username</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Assigned / Active Queue</TableCell>
                <TableCell>Resolved Exceptions</TableCell>
                <TableCell>Account Status</TableCell>
                <TableCell align="right">Manage</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {employees.map((emp) => (
                <TableRow key={emp.id} hover>
                  <TableCell>#{emp.id}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {emp.fullName || emp.username}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {emp.email || `@${emp.username}`}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={emp.role}
                      size="small"
                      color={emp.role === 'Administrator' ? 'primary' : 'default'}
                    />
                  </TableCell>
                  <TableCell>{emp.department}</TableCell>
                  <TableCell sx={{ color: '#f59e0b', fontWeight: 700 }}>
                    {emp.assignedExceptionCount} exceptions
                  </TableCell>
                  <TableCell sx={{ color: '#10b981', fontWeight: 700 }}>
                    {emp.resolvedExceptionCount} resolved
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={emp.isActive ? 'Active' : 'Deactivated'}
                      size="small"
                      color={emp.isActive ? 'success' : 'error'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      color={emp.isActive ? 'error' : 'success'}
                      onClick={() => handleToggleStatus(emp.id)}
                    >
                      {emp.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Team Member</DialogTitle>
        <form onSubmit={handleCreateEmployee}>
          <DialogContent>
            <TextField
              fullWidth
              size="small"
              label="Username"
              margin="normal"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              required
            />
            <TextField
              fullWidth
              size="small"
              label="Password"
              type="password"
              margin="normal"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <TextField
              fullWidth
              size="small"
              label="Full Name"
              margin="normal"
              value={newFullName}
              onChange={(e) => setNewFullName(e.target.value)}
            />
            <TextField
              fullWidth
              size="small"
              label="Email Address"
              margin="normal"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <FormControl fullWidth size="small" margin="normal">
              <InputLabel>Role</InputLabel>
              <Select value={newRole} label="Role" onChange={(e) => setNewRole(e.target.value)}>
                <MenuItem value="Operations Analyst">Operations Analyst</MenuItem>
                <MenuItem value="Administrator">Administrator</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">
              Save Member
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}

// ==========================================
// 6. AI QUERY RESOLVER & COPILOT VIEW
// ==========================================
function AiQueryView({ onNotify, onNavigateTab }: { onNotify: any; onNavigateTab: (tab: number) => void }) {
  const [queryInput, setQueryInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestedQueries, setSuggestedQueries] = useState<any[]>([]);
  const [history, setHistory] = useState<Array<{
    id: string;
    sender: 'user' | 'ai';
    text: string;
    response?: any;
    timestamp: string;
  }>>([
    {
      id: 'welcome',
      sender: 'ai',
      text: "### Welcome to LendGuard AI Query Resolver\n\nI am your intelligent financial reconciliation and audit copilot. You can ask me natural language queries about:\n\n- **Reconciliation Status & Rates:** *\"What is our current reconciliation rate?\"*\n- **Discrepancy Root Causes:** *\"Why is TXN_1005 flagged with an amount mismatch?\"*\n- **Statistical Anomalies & Fraud Outliers:** *\"Show high-risk anomalies detected by Isolation Forest\"*\n- **Duplicate Payment Investigations:** *\"How do I resolve duplicate settlement exceptions?\"*\n- **Resolution Workflow SOP:** *\"What are the approved categories to close an exception?\"*\n\nSelect one of the suggested query chips below or enter your own question.",
      response: {
        intent: "system_greeting",
        confidence: 1.0,
        summary: "LendGuard AI Query Copilot online and connected to active database.",
        action_items: [
          "Select a suggested query chip below for instant analysis.",
          "Ask about any specific transaction reference (e.g. TXN_1001 through TXN_2003)."
        ],
        suggested_followups: [
          "What is our current reconciliation rate and operational health?",
          "Show me the highest risk anomalies and outlier transactions.",
          "Why is transaction TXN_1005 flagged with an amount mismatch?",
          "What types of reconciliation exceptions were detected?"
        ]
      },
      timestamp: new Date().toLocaleTimeString()
    }
  ]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const res = await api.get('/aiassistant/suggested-queries');
        if (Array.isArray(res.data)) {
          setSuggestedQueries(res.data);
        }
      } catch (err) {
        setSuggestedQueries([
          { title: "Ledger Health", query: "What is our current reconciliation rate and operational health?" },
          { title: "High-Risk Outliers", query: "Show me the highest risk anomalies and outlier transactions." },
          { title: "Audit TXN_1005", query: "Why is transaction TXN_1005 flagged with an amount mismatch?" },
          { title: "Duplicate Charges", query: "How do I resolve duplicate settlement errors?" },
          { title: "Discrepancy Breakdown", query: "What types of reconciliation exceptions were detected?" },
          { title: "Resolution SOP", query: "What are the approved categories and workflow to resolve an exception?" }
        ]);
      }
    };
    fetchSuggestions();
  }, []);

  const handleSendQuery = async (queryText?: string) => {
    const textToSend = (queryText || queryInput).trim();
    if (!textToSend || loading) return;

    const userMsg = {
      id: String(Date.now()),
      sender: 'user' as const,
      text: textToSend,
      timestamp: new Date().toLocaleTimeString()
    };
    setHistory((prev) => [...prev, userMsg]);
    setQueryInput('');
    setLoading(true);

    try {
      const res = await api.post('/aiassistant/query', { query: textToSend });
      const aiMsg = {
        id: String(Date.now() + 1),
        sender: 'ai' as const,
        text: res.data.detailed_answer || res.data.summary,
        response: res.data,
        timestamp: new Date().toLocaleTimeString()
      };
      setHistory((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      onNotify({ message: 'Error communicating with AI query resolver.', severity: 'error' });
      setHistory((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: 'ai',
          text: "I was unable to complete the query resolution request at this moment. Please verify that the backend and AI services are running.",
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const renderFormattedText = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('### ')) {
        return (
          <Typography key={idx} variant="h6" sx={{ color: '#38bdf8', mt: 1.5, mb: 0.5, fontWeight: 700 }}>
            {line.replace('### ', '')}
          </Typography>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <Typography key={idx} variant="subtitle1" sx={{ color: '#818cf8', mt: 1, mb: 0.5, fontWeight: 700 }}>
            {line.replace('## ', '')}
          </Typography>
        );
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const itemText = line.replace(/^[\-\*]\s+/, '');
        return (
          <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', my: 0.5, ml: 1 }}>
            <Typography variant="body2" sx={{ color: '#38bdf8', mr: 1 }}>•</Typography>
            <Typography variant="body2" sx={{ color: '#e2e8f0' }}>
              {itemText.split('**').map((part, pIdx) =>
                pIdx % 2 === 1 ? <b key={pIdx} style={{ color: '#fff' }}>{part}</b> : part
              )}
            </Typography>
          </Box>
        );
      }
      if (line.match(/^\d+\.\s+/)) {
        return (
          <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', my: 0.5, ml: 1 }}>
            <Typography variant="body2" sx={{ color: '#818cf8', mr: 1, fontWeight: 700 }}>
              {line.match(/^\d+\./)?.[0]}
            </Typography>
            <Typography variant="body2" sx={{ color: '#e2e8f0' }}>
              {line.replace(/^\d+\.\s+/, '').split('**').map((part, pIdx) =>
                pIdx % 2 === 1 ? <b key={pIdx} style={{ color: '#fff' }}>{part}</b> : part
              )}
            </Typography>
          </Box>
        );
      }
      if (line.trim() === '') {
        return <Box key={idx} sx={{ height: 6 }} />;
      }
      return (
        <Typography key={idx} variant="body2" sx={{ color: '#cbd5e1', my: 0.3 }}>
          {line.split('**').map((part, pIdx) =>
            pIdx % 2 === 1 ? <b key={pIdx} style={{ color: '#fff' }}>{part}</b> : part
          )}
        </Typography>
      );
    });
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <div>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <SparklesIcon sx={{ color: '#38bdf8', fontSize: 32 }} />
            <Typography variant="h5">LendGuard AI Query Resolver</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Natural Language Financial Intelligence, Ledger Diagnostics & Advisory Explanations
          </Typography>
        </div>
        <Stack direction="row" spacing={1}>
          <Chip icon={<AiIcon />} label="Scikit-Learn Isolation Forest Engine" color="primary" variant="outlined" />
          <Chip label="Deterministic Heuristic Rules" color="secondary" variant="outlined" />
        </Stack>
      </Box>

      {/* Suggested Quick Queries */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: '#111827' }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 600 }}>
          SUGGESTED AUDIT INQUIRIES:
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          {suggestedQueries.map((sq, idx) => (
            <Chip
              key={idx}
              label={sq.title || sq.query}
              onClick={() => handleSendQuery(sq.query)}
              clickable
              color="primary"
              variant="outlined"
              size="small"
              sx={{ '&:hover': { bgcolor: '#1e3a8a' } }}
            />
          ))}
        </Stack>
      </Paper>

      {/* Query Stream Conversation */}
      <Paper
        sx={{
          p: 3,
          mb: 3,
          minHeight: 480,
          maxHeight: 620,
          overflowY: 'auto',
          bgcolor: '#090d16',
          border: '1px solid #1e293b'
        }}
      >
        <Stack spacing={3}>
          {history.map((msg) => (
            <Box
              key={msg.id}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start'
              }}
            >
              <Box
                sx={{
                  maxWidth: { xs: '100%', md: '85%' },
                  p: 2.5,
                  borderRadius: 2,
                  bgcolor: msg.sender === 'user' ? '#1e3a8a' : '#111827',
                  border: msg.sender === 'user' ? '1px solid #38bdf8' : '1px solid #1e293b',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
                }}
              >
                {/* Message Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, gap: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {msg.sender === 'user' ? (
                      <Chip label="Operations Analyst" size="small" color="primary" />
                    ) : (
                      <>
                        <SparklesIcon sx={{ color: '#38bdf8', fontSize: 18 }} />
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#38bdf8' }}>
                          LendGuard AI Copilot
                        </Typography>
                      </>
                    )}
                  </Stack>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    {msg.timestamp}
                  </Typography>
                </Box>

                {/* Formatted Content */}
                <Box sx={{ mt: 1 }}>{renderFormattedText(msg.text)}</Box>

                {/* AI Structured Additions */}
                {msg.sender === 'ai' && msg.response && (
                  <Box sx={{ mt: 2.5, pt: 2, borderTop: '1px solid #1e293b' }}>
                    {/* Metadata Pill */}
                    {msg.response.intent && (
                      <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                        <Chip
                          label={`Intent: ${msg.response.intent}`}
                          size="small"
                          color="info"
                          variant="outlined"
                        />
                        {msg.response.confidence && (
                          <Chip
                            label={`Confidence: ${Math.round(msg.response.confidence * 100)}%`}
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        )}
                        {msg.response.metrics?.successRate !== undefined && (
                          <Chip
                            label={`Reconciliation Rate: ${msg.response.metrics.successRate}%`}
                            size="small"
                            color="primary"
                          />
                        )}
                      </Stack>
                    )}

                    {/* Action Items Box */}
                    {msg.response.action_items && msg.response.action_items.length > 0 && (
                      <Paper sx={{ p: 2, mb: 2, bgcolor: '#0f172a', border: '1px solid #334155' }}>
                        <Typography variant="subtitle2" sx={{ color: '#38bdf8', fontWeight: 700, mb: 1 }}>
                          Recommended Action Steps:
                        </Typography>
                        {msg.response.action_items.map((step: string, sIdx: number) => (
                          <Box key={sIdx} sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.5 }}>
                            <CheckIcon sx={{ color: '#10b981', fontSize: 16, mr: 1, mt: 0.3 }} />
                            <Typography variant="body2" sx={{ color: '#cbd5e1' }}>
                              {step}
                            </Typography>
                          </Box>
                        ))}
                      </Paper>
                    )}

                    {/* Related References */}
                    {msg.response.related_references && msg.response.related_references.length > 0 && (
                      <Box sx={{ mb: 1.5 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          RELATED REFERENCES:
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                          {msg.response.related_references.map((ref: string, rIdx: number) => (
                            <Chip
                              key={rIdx}
                              label={ref}
                              size="small"
                              color="warning"
                              clickable
                              onClick={() => handleSendQuery(`Explain transaction ${ref}`)}
                            />
                          ))}
                        </Stack>
                      </Box>
                    )}

                    {/* Follow-up Suggested Queries */}
                    {msg.response.suggested_followups && msg.response.suggested_followups.length > 0 && (
                      <Box sx={{ mt: 1.5 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          SUGGESTED FOLLOW-UPS:
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                          {msg.response.suggested_followups.map((fu: string, fIdx: number) => (
                            <Chip
                              key={fIdx}
                              label={fu}
                              size="small"
                              variant="outlined"
                              clickable
                              onClick={() => handleSendQuery(fu)}
                              sx={{ color: '#93c5fd', borderColor: '#3b82f6' }}
                            />
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </Box>
                )}
              </Box>
            </Box>
          ))}

          {loading && (
            <Box sx={{ display: 'flex', alignItems: 'center', p: 2, gap: 2 }}>
              <CircularProgress size={24} color="primary" />
              <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                LendGuard AI is synthesizing ledger analytics & Isolation Forest metrics...
              </Typography>
            </Box>
          )}
        </Stack>
      </Paper>

      {/* Query Input Box */}
      <Paper sx={{ p: 2, bgcolor: '#111827', border: '1px solid #1e293b' }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendQuery();
          }}
        >
          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={12} sm={10}>
              <TextField
                fullWidth
                size="small"
                placeholder="Ask any financial, audit, or discrepancy query (e.g. 'Why is TXN_1005 mismatched?')..."
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                disabled={loading}
              />
            </Grid>
            <Grid item xs={12} sm={2}>
              <Button
                type="submit"
                variant="contained"
                fullWidth
                color="primary"
                disabled={!queryInput.trim() || loading}
                endIcon={<SendIcon />}
                sx={{ height: 40, fontWeight: 700 }}
              >
                Resolve
              </Button>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Box>
  );
}

