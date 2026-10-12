import { useEffect } from 'react';
import { BrowserRouter, Route, Navigate } from 'react-router-dom';
import { useThemeStore } from './store/themeStore';
import { useAuthStore } from './store/authStore';
import { applyTheme } from './utils/theme';
import ProtectedRoute from './components/ui/ProtectedRoute';
import Toaster from './components/ui/Toaster';
import Login from './features/auth/pages/Login';
import { ROUTES } from './constants/routes';
import { appRoutes } from './routes';
import { route } from './routes/routeHelpers';
import ModalRoutes from './components/routing/ModalRoutes';
import NotFound from './features/errors/pages/NotFound';

function App() {
  const { theme } = useThemeStore();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    applyTheme();
  }, [theme]);

  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <ModalRoutes>
        <Route path={ROUTES.LOGIN} element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Navigate to={user?.role === 'member' ? ROUTES.MEMBER.OVERVIEW : ROUTES.DASHBOARD} replace />
            </ProtectedRoute>
          }
        />
        {appRoutes}
        {route('*', <NotFound />)}
      </ModalRoutes>
      <Toaster />
    </BrowserRouter>
  );
}

export default App;
