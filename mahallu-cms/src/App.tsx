import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useThemeStore } from './store/themeStore';
import { useAuthStore } from './store/authStore';
import { applyTheme } from './utils/theme';
import ProtectedRoute from './components/ui/ProtectedRoute';
import Toaster from './components/ui/Toaster';
import Login from './features/auth/pages/Login';
import VerifyCertificate from './features/certificates/pages/VerifyCertificate';
import { AppErrorBoundary } from './components/ui/ErrorBoundary';
import NotFound from './components/ui/NotFound';
import { ROUTES } from './constants/routes';
import { appRoutes } from './routes';

function App() {
  const { theme } = useThemeStore();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    applyTheme();
  }, [theme]);

  return (
    <AppErrorBoundary>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          <Route path={ROUTES.LOGIN} element={<Login />} />
          <Route path="/verify/:certificateNo" element={<VerifyCertificate />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Navigate to={user?.role === 'member' ? ROUTES.MEMBER.OVERVIEW : ROUTES.DASHBOARD} replace />
              </ProtectedRoute>
            }
          />
          {appRoutes}
          {/* No match: say so, instead of leaving an empty document behind. */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    </AppErrorBoundary>
  );
}

export default App;
