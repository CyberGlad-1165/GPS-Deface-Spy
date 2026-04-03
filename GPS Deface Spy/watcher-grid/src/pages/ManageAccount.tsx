import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Building2, Shield, Key, Save, Loader2, ArrowLeft } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import { authAPI } from '@/services/api';

export default function ManageAccount() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    organization: user?.organization || '',
  });

  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await authAPI.updateProfile(formData);
      toast({ title: 'Profile Updated', description: 'Your profile has been updated successfully' });
    } catch (err: any) {
      toast({ title: 'Update Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.new_password !== passwordData.confirm_password) {
      toast({ title: 'Error', description: 'New passwords do not match', variant: 'destructive' });
      return;
    }

    if (passwordData.new_password.length < 8) {
      toast({ title: 'Error', description: 'Password must be at least 8 characters', variant: 'destructive' });
      return;
    }

    setIsChangingPassword(true);
    try {
      await authAPI.changePassword(passwordData.current_password, passwordData.new_password);
      toast({ title: 'Password Changed', description: 'Your password has been updated successfully' });
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err: any) {
      toast({ title: 'Password Change Failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold font-mono tracking-tight">MANAGE ACCOUNT</h1>
              <p className="text-xs font-mono text-muted-foreground tracking-wider">UPDATE YOUR PROFILE & SECURITY</p>
            </div>
          </div>
        </motion.div>

        {/* Account Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6"
        >
          <h2 className="text-sm font-mono font-bold text-muted-foreground mb-4">ACCOUNT INFORMATION</h2>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary/30">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center">
                <User className="w-8 h-8 text-primary-foreground" />
              </div>
              <div>
                <div className="font-mono text-lg font-bold">{user?.username || 'User'}</div>
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Mail className="w-3 h-3" />
                  {user?.email || 'email@example.com'}
                </div>
                <div className="text-xs text-primary font-mono mt-1">
                  <Shield className="w-3 h-3 inline mr-1" />
                  {user?.role || 'admin'}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Profile Update Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6"
        >
          <h2 className="text-sm font-mono font-bold text-muted-foreground mb-4">UPDATE PROFILE</h2>
          
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name" className="text-xs font-mono">FIRST NAME</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                  className="font-mono"
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name" className="text-xs font-mono">LAST NAME</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                  className="font-mono"
                  placeholder="Doe"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="organization" className="text-xs font-mono">ORGANIZATION</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="organization"
                  value={formData.organization}
                  onChange={(e) => setFormData(prev => ({ ...prev, organization: e.target.value }))}
                  className="pl-10 font-mono"
                  placeholder="Your Organization"
                />
              </div>
            </div>

            <Button type="submit" variant="cyber" className="font-mono" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </Button>
          </form>
        </motion.div>

        {/* Change Password Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6"
        >
          <h2 className="text-sm font-mono font-bold text-muted-foreground mb-4">CHANGE PASSWORD</h2>
          
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current_password" className="text-xs font-mono">CURRENT PASSWORD</Label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="current_password"
                  type="password"
                  value={passwordData.current_password}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, current_password: e.target.value }))}
                  className="pl-10 font-mono"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="new_password" className="text-xs font-mono">NEW PASSWORD</Label>
                <Input
                  id="new_password"
                  type="password"
                  value={passwordData.new_password}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, new_password: e.target.value }))}
                  className="font-mono"
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password" className="text-xs font-mono">CONFIRM PASSWORD</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  value={passwordData.confirm_password}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirm_password: e.target.value }))}
                  className="font-mono"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <Button type="submit" variant="outline" className="font-mono" disabled={isChangingPassword}>
              {isChangingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Changing...
                </>
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  Change Password
                </>
              )}
            </Button>
          </form>
        </motion.div>
      </div>
    </MainLayout>
  );
}
