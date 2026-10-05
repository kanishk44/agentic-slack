import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useThemeStore } from '@/stores/themeStore';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuthStore } from '@/stores/authStore';
import { AuthPage } from '@/pages/AuthPage';
import { WorkspaceLayout } from '@/pages/WorkspaceLayout';
import { ChannelView } from '@/pages/ChannelView';
import { AgentsPage } from '@/pages/AgentsPage';
import { HomeRedirect, WorkspaceRedirect } from '@/pages/Redirects';
import { FullPageSpinner } from '@/components/layout/FullPageSpinner';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();
  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'guest') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'authenticated') return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  const init = useAuthStore((s) => s.init);
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <TooltipProvider delayDuration={300}>
      <Routes>
        <Route path="/login" element={<GuestOnly><AuthPage mode="login" /></GuestOnly>} />
        <Route path="/signup" element={<GuestOnly><AuthPage mode="signup" /></GuestOnly>} />
        <Route path="/" element={<RequireAuth><HomeRedirect /></RequireAuth>} />
        <Route path="/w/:workspaceId" element={<RequireAuth><WorkspaceLayout /></RequireAuth>}>
          <Route index element={<WorkspaceRedirect />} />
          <Route path="c/:channelId" element={<ChannelView />} />
          <Route path="agents" element={<AgentsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster theme={resolvedTheme === 'dark' ? 'dark' : 'light'} richColors position="top-right" />
    </TooltipProvider>
  );
}
