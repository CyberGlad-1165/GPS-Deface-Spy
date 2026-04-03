# Sentinel-Grid - Web Defacement Monitoring Dashboard

## 📋 Project Overview

**Sentinel-Grid** is a Security Operations Center (SOC) style web defacement monitoring dashboard built with React.js. The application provides real-time visual monitoring with matrix-based change detection, AI-suggested alert conditions, automated email reporting, and a professional cyber-themed dark UI optimized for security analysts.

### Key Features
- 🔍 **Live Visual Monitoring** - Real-time website preview with matrix grid overlay
- 🎯 **Matrix-Based Change Detection** - 12×8 grid for precise block-by-block visual change tracking
- 🤖 **AI-Suggested Alerts** - Intelligent alert conditions (visual change, script injection, logo swap, etc.)
- ⏱️ **Configurable Scan Intervals** - Automated periodic rescans (30s to 1 hour)
- 📧 **Automated Email Reports** - Reports generated and emailed via Resend API
- 📊 **PDF Report Generation** - Comprehensive exportable security reports
- 🚨 **Real-Time Alerts** - Severity-classified notifications with Framer Motion animations

---

## 🛠️ Technology Stack

| Category | Technology |
|----------|------------|
| Framework | React.js 18.3+ (Functional Components) |
| Language | TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS + Custom Design System |
| Animations | Framer Motion |
| Charts | Recharts |
| Icons | Lucide React |
| Routing | React Router v6 |
| State Management | React useState + Context API |
| PDF Generation | jsPDF + jspdf-autotable |
| Email Service | Resend API (via Edge Function) |
| Backend | Lovable Cloud |

---

## 📁 Project Structure

```
src/
├── components/
│   ├── charts/
│   │   ├── SeverityDonut.tsx       # Donut chart for severity distribution
│   │   └── TrendChart.tsx          # Area/line chart for trend analysis
│   ├── dashboard/
│   │   ├── MonitorCard.tsx         # Dashboard target monitor widget
│   │   └── DefacementAlert.tsx     # Framer Motion slide-in threat alert
│   ├── layout/
│   │   ├── MainLayout.tsx          # Main page wrapper with sidebar
│   │   ├── Sidebar.tsx             # Navigation sidebar
│   │   └── TopBar.tsx              # Top navigation bar
│   ├── monitor/
│   │   └── MonitorConfigPanel.tsx  # Alert conditions, interval & email config
│   ├── wizard/
│   │   └── CropSelector.tsx        # Region selection for monitoring
│   ├── ui/                         # shadcn/ui components
│   │   ├── animated-card.tsx       # Motion-enabled card component
│   │   ├── stat-card.tsx           # KPI statistics card
│   │   ├── button.tsx              # Custom button variants (cyber, cyber-outline)
│   │   └── [40+ UI components]     # Full shadcn/ui library
│   └── visualization/
│       ├── AIExplanationPanel.tsx  # XAI insights display
│       ├── ComparisonSlider.tsx    # Before/after comparison
│       └── MatrixHeatmap.tsx       # 8×8 pixel-block heatmap
├── data/
│   └── mockData.ts                 # Mock data for websites, alerts, stats
├── hooks/
│   ├── use-mobile.tsx              # Mobile detection hook
│   └── use-toast.ts                # Toast notification hook
├── pages/
│   ├── LandingPage.tsx             # Marketing landing page
│   ├── Dashboard.tsx               # Command center dashboard
│   ├── AddWebsite.tsx              # Visual Monitor with live preview
│   ├── Analysis.tsx                # Incident report & diff view
│   ├── Alerts.tsx                  # Alert management
│   ├── Reports.tsx                 # Reports with email send
│   ├── Settings.tsx                # System settings
│   ├── WebsiteProfile.tsx          # Individual website details
│   └── NotFound.tsx                # 404 page
├── utils/
│   └── pdfGenerator.ts             # PDF report generation utilities
├── integrations/
│   └── supabase/                   # Lovable Cloud integration
├── lib/
│   └── utils.ts                    # Utility functions (cn, etc.)
├── App.tsx                         # Main app with routing
├── main.tsx                        # Entry point
└── index.css                       # Global styles & design tokens

supabase/
├── config.toml                     # Edge function configuration
└── functions/
    └── send-report/
        └── index.ts                # Email report sending edge function
```

---

## 🎨 Design System

### Color Palette — Blue & Black SOC Theme (HSL Values)

| Token | HSL Value | Usage |
|-------|-----------|-------|
| `--background` | 222 47% 6% | Main background |
| `--foreground` | 210 40% 98% | Primary text |
| `--primary` | 210 100% 55% | Blue accent/CTA |
| `--secondary` | 217 33% 17% | Secondary backgrounds |
| `--destructive` | 0 72% 51% | Error/Critical states |
| `--success` | 142 76% 36% | Success states |
| `--warning` | 38 92% 50% | Warning states |
| `--muted` | 217 33% 14% | Muted backgrounds |

### Typography
- **Primary Font**: Inter (weights: 300-800)
- **Monospace Font**: JetBrains Mono (data/logs, headers, labels)

### Custom CSS Classes

```css
.glass-card       /* Glassmorphism card with backdrop blur */
.glass-card-hover /* Glass card with hover glow effect */
.gradient-text    /* Primary gradient text effect */
.cyber-grid       /* Grid pattern background */
.matrix-overlay   /* Matrix-style overlay pattern */
.glow-primary     /* Primary color glow shadow */
.glow-success     /* Success color glow shadow */
.glow-danger      /* Danger color glow shadow */
```

### Button Variants

| Variant | Description |
|---------|-------------|
| `cyber` | Primary gradient button with glow |
| `cyber-outline` | Outlined primary button |
| `success` | Green success action button |
| `ghost` | Transparent background button |

---

## 📄 Pages & Components

### 1. Landing Page (`/`)

**Purpose**: Executive-grade first impression for stakeholders

**Features**:
- Hero section with animated gradient text
- Feature cards with hover animations
- "How It Works" 3-step process
- Technology highlights
- Statistics display (Detection Accuracy, Response Time, etc.)
- CTA buttons linking to dashboard

---

### 2. Command Center Dashboard (`/dashboard`)

**Purpose**: At-a-glance system intelligence for decision-makers

**Features**:
- KPI stat cards (Total Websites, Frames Analyzed, Defacements, Safe Sites)
- Quick stats row (Response Time, Active Alerts, Protection Rate)
- Trend chart showing defacement trends over 2 weeks
- Severity distribution donut chart
- Recent activity feed with color-coded status
- "Start Visual Monitor" CTA

**Components Used**:
- `StatCard` - Animated KPI display
- `TrendChart` - Recharts area chart
- `SeverityDonut` - Recharts pie chart

---

### 3. Visual Monitor (`/add-website`)

**Purpose**: Live website monitoring with matrix-based visual change detection (Visualping-style)

**Features**:
- URL search bar to enter any website
- Live website preview via iframe
- 12×8 matrix grid overlay for block-by-block change detection
- Real-time scan counter
- Matrix toggle and manual rescan buttons
- Summary stats (blocks changed, area percentage)
- **Monitor Config Panel** (appears after monitoring starts):
  - Alert Me When — AI-suggested conditions
  - Checking Interval — Automated rescan timing
  - Send Reports To — Email for automated reports

**Workflow**:
1. User enters a URL (e.g. `example.com`)
2. "CAPTURING BASELINE" loading animation plays
3. Live website iframe loads with matrix overlay
4. User configures alert conditions, interval, and email
5. System auto-rescans at the selected interval

**Monitor Config Panel (`MonitorConfigPanel.tsx`)**:

#### Alert Me When (AI Suggestions)
| Alert | Severity |
|-------|----------|
| Visual change exceeds 15% of monitored area | High |
| Text content is modified or removed | High |
| Logo or branding elements are replaced | Critical |
| Unknown scripts or iframes are injected | Critical |
| Major layout structure changes detected | Medium |
| Color palette significantly altered | Medium |

#### Checking Interval Options
| Option | Scan Frequency |
|--------|---------------|
| Manual Only | No auto-scan |
| Every 30s | 30 seconds |
| Every 1 min | 60 seconds |
| Every 5 min | 300 seconds |
| Every 10 min | 600 seconds |
| Every 30 min | 1800 seconds |
| Every 1 hour | 3600 seconds |

#### Send Reports To
- Email input for automated report delivery
- When alerts trigger + interval fires, a report is generated and emailed

---

### 4. Incident Report / Analysis (`/analysis`)

**Purpose**: Visual comparison and defacement detection

**Features**:
- Website selector dropdown
- Analysis statistics (Changed Blocks, Confidence, Severity, Frames)
- **Comparison Slider** - Side-by-side baseline vs current view
- **Matrix Heatmap** - 8×8 interactive pixel-block grid
- **AI Explanation Panel** - Confidence scores and findings
- PDF export functionality

**Key Components**:
- `ComparisonSlider` - Drag-to-compare baseline vs current
- `MatrixHeatmap` - 64-cell grid with color-coded intensity
- `AIExplanationPanel` - Severity badge, detection confidence, key findings

---

### 5. Alerts & Incidents (`/alerts`)

**Purpose**: Security operations alert management

**Features**:
- Active/Resolved/All filter tabs
- Color-coded severity badges (Low, Medium, High, Critical)
- Alert type classification (Defacement, Content Change, Text Modification, Visual Anomaly)
- Confidence percentage display
- Resolve action button

---

### 6. Reports & History (`/reports`)

**Purpose**: Audit-friendly monitoring history and automated email reports

**Features**:
- **"Send To:" email section** — Enter recipient email and send full summary report via backend
- Summary statistics cards (Targets, Alerts, Resolved, Pending)
- Search filter by website name/URL
- Data table with status badges, last scan dates, frames analyzed
- Row hover reveals View and Download actions

**Email Report Flow**:
1. User enters recipient email in "Send To" field
2. Clicks "Send Report"
3. Backend edge function (`send-report`) generates styled HTML email
4. Report sent via Resend API
5. Confirmation toast displayed

---

### 7. Website Profile (`/website/:id`)

**Purpose**: Detailed individual website monitoring view

**Features**:
- Header with status badge and external link
- Statistics row (Frames, Interval, Alerts, Security Score)
- Activity timeline with vertical connector line
- Captured snapshots grid
- Related alerts section

---

### 8. Settings (`/settings`)

**Purpose**: System configuration and preferences

**Features**:
- Monitoring interval slider (1-60 min)
- Alert sensitivity slider (0-100%)
- Notification toggles (Email, Push, Auto-Resolve)
- Appearance toggle (Dark Mode)
- System information display

---

## 📊 Data Models

### Website Interface
```typescript
interface Website {
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
```

### Alert Interface
```typescript
interface Alert {
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
```

### Matrix Cell Interface (Visual Monitor)
```typescript
interface CellData {
  id: number;
  changePercent: number;
  status: 'unchanged' | 'minor' | 'moderate' | 'significant';
}
```

---

## 🔄 Application Workflows

### 1. Visual Monitoring Flow
```
Visual Monitor → Enter URL → Capture Baseline → Live Preview + Matrix Overlay
→ Configure Alerts (AI Suggestions) → Set Checking Interval → Enter Email
→ Auto-Rescan → Detect Changes → Generate Report → Email Report
```

### 2. Analysis Flow
```
Dashboard/Reports → Select Website → Analysis Page → View Comparison
→ Check Matrix → Read AI Explanation → Export PDF
```

### 3. Alert Management Flow
```
Dashboard → Alerts Page → Filter by Status → Review Details → Resolve
```

### 4. Report Email Flow
```
Reports Page → Enter Email in "Send To" → Click Send → Edge Function
→ Resend API → Styled HTML Report Emailed
```

---

## 📧 Email Report System

### Edge Function: `send-report`

**Path**: `supabase/functions/send-report/index.ts`

**Purpose**: Generates and sends styled HTML email reports via Resend API

**Request Body**:
```typescript
{
  to: string;           // Recipient email
  websites: Website[];  // Monitored websites data
  alerts: Alert[];      // Alert history
  stats: DashboardStats; // Summary statistics
}
```

**Email Template**: Dark-themed HTML with:
- Sentinel-Grid branding header
- Stats grid (Targets, Alerts, Resolved, Pending)
- Website status cards with URLs
- Generation timestamp

**Required Secret**: `RESEND_API_KEY` — API key from [resend.com](https://resend.com)

---

## 📄 PDF Report Generation

### Individual Website Report
Generated via `generatePDFReport()`:
- Header with Sentinel-Grid branding
- Website details table
- Analysis results (confidence, severity, blocks changed)
- Alert history table
- Monitoring configuration summary

### Summary Report
Generated via `generateSummaryReport()`:
- Executive summary header
- Overview statistics cards
- All monitored websites table
- Consolidated metrics

---

## 🎬 Animations & Micro-interactions

### Framer Motion Animations

| Animation | Usage |
|-----------|-------|
| `fade-in` | Page transitions, content reveal |
| `slide-up` | Cards loading, list items |
| `scale` | Button hover, card interactions |
| `staggerChildren` | Sequential list item animations |
| `whileHover` | Interactive element feedback |
| `AnimatePresence` | Exit animations for loading/monitoring states |

---

## 🔌 Integrations

### Lovable Cloud
- **Edge Functions**: `send-report` for email delivery
- **Secrets**: `RESEND_API_KEY` for email service
- Future: Data persistence, user authentication, real-time monitoring

### Resend API
- Sends styled HTML email reports
- Triggered from Reports page or automated monitoring intervals
- Dark SOC-themed email template

### ScreenshotOne API (Planned)
- Real website screenshot capture for sites that block iframe embedding

---

## 📱 Responsive Design

Desktop-first approach optimized for security analyst workstations:

| Breakpoint | Width | Usage |
|------------|-------|-------|
| Default | Desktop | Full sidebar, multi-column layouts |
| `lg` | 1024px | 3-column grids, full charts |
| `md` | 768px | 2-column grids, collapsible elements |
| `sm` | 640px | Single column, stacked layouts |

### Sidebar Behavior
- Desktop: Fixed 256px sidebar (`w-64`)
- Collapsed: 64px mini sidebar (`w-16`)
- Toggle button at sidebar bottom

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or bun package manager

### Installation
```bash
npm install
npm run dev
npm run build
```

### Environment Variables
```env
VITE_SUPABASE_URL=<auto-configured>
VITE_SUPABASE_PUBLISHABLE_KEY=<auto-configured>
VITE_SUPABASE_PROJECT_ID=<auto-configured>
```

### Required Secrets (Lovable Cloud)
| Secret | Purpose |
|--------|---------|
| `RESEND_API_KEY` | Email report delivery via Resend API |

---

## 📈 Future Enhancements

1. **ScreenshotOne API Integration** - Real website screenshot capture
2. **User Authentication** - Login/signup with session management
3. **Real-time WebSocket Monitoring** - Live push-based updates
4. **Historical Trend Analysis** - Long-term change data visualization
5. **Multi-user Support** - Team collaboration features
6. **Database Persistence** - Store monitoring configs, alerts, and reports

---

## 📝 Code Conventions

### File Naming
- Components: PascalCase (`MonitorConfigPanel.tsx`)
- Utilities: camelCase (`pdfGenerator.ts`)
- Pages: PascalCase (`Dashboard.tsx`)

### Styling Approach
- Use Tailwind utility classes
- Use semantic design tokens from CSS variables
- Avoid hardcoded colors in components
- Use `cn()` utility for conditional classes

---

## 🔒 Security Considerations

- All monitoring data is currently mock/simulated
- No sensitive data stored in frontend
- API keys stored as Lovable Cloud secrets (never in code)
- Input validation on email and URL fields
- Edge functions use CORS headers
- Prepared for RLS policies

---

## 📚 Additional Resources

- [React Documentation](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/)
- [Recharts](https://recharts.org/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Lucide Icons](https://lucide.dev/)
- [Resend](https://resend.com/)

---

## 👥 Credits

**Sentinel-Grid** — Web Defacement Monitoring Dashboard
Built with ❤️ using Lovable

© 2024 Sentinel-Grid. Website Security.
