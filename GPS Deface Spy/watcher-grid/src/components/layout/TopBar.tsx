import { useState, useEffect } from 'react';
import { Bell, User, Activity, Clock, LogOut, Settings, ChevronDown, BellOff, Volume2, Mail, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDashboard, useActiveAlerts } from '@/hooks/useApi';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface TopBarProps {
  sidebarCollapsed?: boolean;
}

export function TopBar({ sidebarCollapsed = false }: TopBarProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { data: dashboard } = useDashboard();
  const { data: alerts } = useActiveAlerts();
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notificationSettings, setNotificationSettings] = useState({
    email: true,
    push: true,
    sound: true,
    critical: true,
    high: true,
    medium: false,
    low: false,
  });

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const activeTargets = dashboard?.active_websites || 0;
  const unreadAlerts = alerts?.length || 0;

  return (
    <header
      className={`fixed top-0 right-0 z-30 h-16 bg-background/80 backdrop-blur-xl border-b border-border transition-all duration-300 ${
        sidebarCollapsed ? 'left-16' : 'left-64'
      }`}
    >
      <div className="flex items-center justify-between h-full px-6">
        {/* Left: System Status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/10 border border-primary/20">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="text-xs font-mono text-primary tracking-wider">LIVE</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary border border-border">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-mono text-muted-foreground">
              {currentTime.toLocaleTimeString('en-US', { hour12: false })}
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {/* Targets Active - Links to Dashboard */}
          <Link to="/dashboard">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer hover:bg-secondary/80 transition-colors ${
              activeTargets > 0 
                ? 'bg-primary/10 border-primary/30 hover:border-primary/50' 
                : 'bg-secondary border-border'
            }`}>
              <Activity className={`w-3.5 h-3.5 ${activeTargets > 0 ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={`text-xs font-mono ${activeTargets > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                {activeTargets} TARGET{activeTargets !== 1 ? 'S' : ''} ACTIVE
              </span>
            </div>
          </Link>

          {/* Notifications Bell */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                {unreadAlerts > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                    {unreadAlerts > 9 ? '9+' : unreadAlerts}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-mono font-bold text-sm">NOTIFICATIONS</h4>
                  <Link to="/alerts" className="text-xs text-primary hover:underline font-mono">
                    View All
                  </Link>
                </div>

                {/* Recent Alerts */}
                {alerts && alerts.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {alerts.slice(0, 3).map((alert) => (
                      <div key={alert.id} className="p-2 rounded-lg bg-secondary/50 text-sm">
                        <div className="font-mono font-medium truncate">{alert.title}</div>
                        <div className="text-xs text-muted-foreground">{alert.website_name}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    <BellOff className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    No new notifications
                  </div>
                )}

                <div className="border-t border-border pt-4">
                  <h5 className="text-xs font-mono font-bold text-muted-foreground mb-3">NOTIFICATION SETTINGS</h5>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Email Alerts</span>
                      </div>
                      <Switch 
                        checked={notificationSettings.email}
                        onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, email: checked }))}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Push Notifications</span>
                      </div>
                      <Switch 
                        checked={notificationSettings.push}
                        onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, push: checked }))}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Sound Alerts</span>
                      </div>
                      <Switch 
                        checked={notificationSettings.sound}
                        onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, sound: checked }))}
                      />
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-border">
                    <h6 className="text-xs font-mono text-muted-foreground mb-2">SEVERITY LEVELS</h6>
                    <div className="grid grid-cols-2 gap-2">
                      {['critical', 'high', 'medium', 'low'].map((level) => (
                        <div key={level} className="flex items-center justify-between">
                          <span className="text-xs capitalize">{level}</span>
                          <Switch 
                            checked={notificationSettings[level as keyof typeof notificationSettings] as boolean}
                            onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, [level]: checked }))}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Account Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 rounded-full pl-1 pr-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary-foreground" />
                </div>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-mono font-bold">{user?.username || 'User'}</span>
                  <span className="text-xs text-muted-foreground font-normal">{user?.email || 'email@example.com'}</span>
                  <span className="text-[10px] font-mono text-primary mt-1">
                    ADMINISTRATOR
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              <DropdownMenuItem asChild>
                <Link to="/manage-account" className="cursor-pointer">
                  <User className="w-4 h-4 mr-2" />
                  Manage Account
                </Link>
              </DropdownMenuItem>
              
              <DropdownMenuItem asChild>
                <Link to="/settings" className="cursor-pointer">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Link>
              </DropdownMenuItem>
              
              <DropdownMenuSeparator />
              
              <DropdownMenuItem 
                onClick={handleLogout}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
