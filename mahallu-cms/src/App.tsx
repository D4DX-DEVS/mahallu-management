import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useThemeStore } from './store/themeStore';
import { applyTheme } from './utils/theme';
import { useCrossTabAuthSync } from './hooks/useCrossTabAuthSync';
import Toaster from './components/ui/Toaster';
import Landing from './features/landing/pages/Landing';
import Login from './features/auth/pages/Login';
import VerifyCertificate from './features/certificates/pages/VerifyCertificate';
import { AppErrorBoundary } from './components/ui/ErrorBoundary';
import NotFound from './components/ui/NotFound';
import { ROUTES } from './constants/routes';
import { appRoutes } from './routes';

function App() {
  const { theme } = useThemeStore();

  useEffect(() => {
    applyTheme();
  }, [theme]);

  // A login, role/tenant switch or logout in another tab changes the token this
  // tab sends, but not the role it draws: reload (or go to /login) when that happens.
  useCrossTabAuthSync();

  return (
    <AppErrorBoundary>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          {/* The public front door. Opening the site lands here; sign-in is reached from its header. */}
          <Route path={ROUTES.LANDING} element={<Landing />} />
          <Route path={ROUTES.LOGIN} element={<Login />} />
          <Route path="/verify/:certificateNo" element={<VerifyCertificate />} />
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
