import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Globe, ScanLine, AlertTriangle, FileText, Settings, Radar, ChevronLeft, ChevronRight, Crosshair } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

// All nav items visible to both roles
const navItems = [
  { icon: LayoutDashboard, label: 'Command Center', path: '/dashboard' },
  { icon: Crosshair, label: 'Target Config', path: '/add-website' },
  { icon: ScanLine, label: 'Incident Report', path: '/analysis' },
  { icon: AlertTriangle, label: 'Threat Alerts', path: '/alerts' },
  { icon: FileText, label: 'Reports', path: '/reports' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  const roleLabel = 'ADMINISTRATOR';

  return (
    <aside className={cn(
      "fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10" style={{ boxShadow: 'var(--shadow-neon)' }}>
            <Radar className="w-6 h-6 text-primary" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in">
              <h1 className="font-bold text-foreground font-mono text-sm tracking-wider">DEFACE SPY</h1>
              <p className="text-[10px] text-muted-foreground font-mono tracking-widest">DEFACEMENT MONITOR</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 p-3 mt-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground border border-transparent"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 transition-colors flex-shrink-0",
                isActive ? "text-primary" : "group-hover:text-foreground"
              )} />
              {!collapsed && (
                <span className="font-medium text-sm animate-fade-in">{item.label}</span>
              )}
              {isActive && !collapsed && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* System Status */}
      {!collapsed && (
        <div className="absolute bottom-16 left-0 right-0 px-4">
          <div className="p-3 rounded-lg bg-secondary/50 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span className="text-[10px] font-mono text-primary tracking-wider">SYSTEM ACTIVE</span>
            </div>
            <p className="text-[10px] font-mono text-muted-foreground">
              ROLE: {roleLabel}
            </p>
          </div>
        </div>
      )}

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute bottom-4 right-3 p-2 rounded-lg bg-sidebar-accent hover:bg-sidebar-accent/80 text-muted-foreground hover:text-foreground transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  );
}
