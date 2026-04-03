import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, User, Radar, Loader2, ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    password_confirm: '',
    role: 'admin' as 'admin' | '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.username || !formData.password) {
      toast({ title: 'Error', description: 'Please fill in all fields', variant: 'destructive' });
      return;
    }

    if (formData.password !== formData.password_confirm) {
      toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' });
      return;
    }

    if (formData.password.length < 8) {
      toast({ title: 'Error', description: 'Password must be at least 8 characters', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const user = await register(formData);
      toast({ title: 'Account Created', description: 'Welcome to Deface Spy!' });
      navigate('/dashboard');
    } catch (err: any) {
      toast({ 
        title: 'Registration Failed', 
        description: err.message || 'Could not create account', 
        variant: 'destructive' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="absolute inset-0 cyber-grid opacity-5" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-4"
          >
            <Radar className="w-8 h-8 text-primary" />
          </motion.div>
          <h1 className="text-2xl font-bold font-mono tracking-tight">DEFACE SPY</h1>
          <p className="text-xs font-mono text-muted-foreground tracking-wider mt-1">
            WEBSITE DEFACEMENT DETECTION
          </p>
        </div>

        {/* Register Form */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-bold font-mono mb-6 text-center">CREATE ACCOUNT</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-mono">EMAIL</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="pl-10 font-mono"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username" className="text-xs font-mono">USERNAME</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="johndoe"
                  value={formData.username}
                  onChange={handleChange}
                  className="pl-10 font-mono"
                  disabled={isLoading}
                />
              </div>
              <p className="text-[10px] font-mono text-muted-foreground">Letters, numbers, @/./+/-/_ only. No spaces.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-mono">PASSWORD</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  className="pl-10 pr-10 font-mono"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password_confirm" className="text-xs font-mono">CONFIRM PASSWORD</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password_confirm"
                  name="password_confirm"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={formData.password_confirm}
                  onChange={handleChange}
                  className="pl-10 font-mono"
                  disabled={isLoading}
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="cyber"
              className="w-full font-mono"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  <User className="w-4 h-4" />
                  Create Account
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border">
            <Link to="/login">
              <Button variant="outline" className="w-full font-mono text-xs">
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
