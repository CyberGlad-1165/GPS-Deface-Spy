import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/Dashboard";
import AddWebsite from "./pages/AddWebsite";
import Analysis from "./pages/Analysis";
import Alerts from "./pages/Alerts";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import WebsiteProfile from "./pages/WebsiteProfile";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ManageAccount from "./pages/ManageAccount";
import NotFound from "./pages/NotFound";

// Loading spinner shared by route guards
function LoadingSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
    </div>
  );
}

// Protected route component – admin only
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Public route – redirects to dashboard if authenticated
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <LoadingSpinner />;
  if (isAuthenticated) return <Navigate to="/home" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    {/* Public routes – Login / Register */}
    <Route path="/" element={<PublicRoute><Login /></PublicRoute>} />
    <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
    <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

    {/* All protected routes – admin only */}
    <Route path="/home" element={<ProtectedRoute><LandingPage /></ProtectedRoute>} />
    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    <Route path="/add-website" element={<ProtectedRoute><AddWebsite /></ProtectedRoute>} />
    <Route path="/analysis" element={<ProtectedRoute><Analysis /></ProtectedRoute>} />
    <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
    <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
    <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
    <Route path="/manage-account" element={<ProtectedRoute><ManageAccount /></ProtectedRoute>} />
    <Route path="/website/:id" element={<ProtectedRoute><WebsiteProfile /></ProtectedRoute>} />

    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
