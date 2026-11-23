import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';

import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ApplicantDashboard from './pages/applicant/ApplicantDashboard';
import ApplyLoan from './pages/applicant/ApplyLoan';
import OfficerDashboard from './pages/officer/OfficerDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';

function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  if (!isAuthenticated) return null;

  return (
    <nav className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
      <Link to="/" className="font-bold text-lg text-indigo-600">
        FinCore LMS
      </Link>
      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-600">
          {user.name} (<strong className="uppercase">{user.role}</strong>)
        </span>
        <button
          onClick={logout}
          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}

function HomeRedirect() {
  const { isAuthenticated, role, getDefaultRouteForRole } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={getDefaultRouteForRole(role)} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" />
        <div className="min-h-screen bg-slate-50">
          <Navbar />
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Applicant Routes */}
            <Route element={<ProtectedRoute allowedRoles={['applicant']} />}>
              <Route path="/applicant/dashboard" element={<ApplicantDashboard />} />
              <Route path="/applicant/apply" element={<ApplyLoan />} />
              <Route path="/applicant/apply/:id" element={<ApplyLoan />} />
            </Route>

            {/* Officer Routes */}
            <Route element={<ProtectedRoute allowedRoles={['officer']} />}>
              <Route path="/officer/queue" element={<OfficerDashboard />} />
            </Route>

            {/* Admin Routes */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
            </Route>
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
