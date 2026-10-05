import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import { FullPageSpinner } from '@/components/layout/FullPageSpinner';
import { useSocketEvents } from '@/hooks/useSocketEvents';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/uiStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { rememberWorkspace } from './Redirects';

export function WorkspaceLayout() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const workspacesLoaded = useWorkspaceStore((s) => s.workspacesLoaded);
  const loadWorkspaces = useWorkspaceStore((s) => s.loadWorkspaces);
  const selectWorkspace = useWorkspaceStore((s) => s.selectWorkspace);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const mobileSidebarOpen = useUIStore((s) => s.mobileSidebarOpen);
  const setMobileSidebarOpen = useUIStore((s) => s.setMobileSidebarOpen);
  const connected = useSocketEvents();
  const [everConnected, setEverConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (connected) setEverConnected(true);
  }, [connected]);

  useEffect(() => {
    if (!workspacesLoaded) void loadWorkspaces().catch((err) => setError(errorMessage(err)));
  }, [workspacesLoaded, loadWorkspaces]);

  useEffect(() => {
    if (!workspaceId) return;
    setError(null);
    selectWorkspace(workspaceId)
      .then(() => rememberWorkspace(workspaceId))
      .catch((err) => {
        setError(errorMessage(err));
        setTimeout(() => navigate('/', { replace: true }), 1500);
      });
  }, [workspaceId, selectWorkspace, navigate]);

  if (error) return <div className="p-8 text-sm text-destructive">{error}</div>;
  if (!workspacesLoaded || activeWorkspaceId !== workspaceId) return <FullPageSpinner label="Loading workspace…" />;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Mobile overlay */}
      <div
        className={cn('fixed inset-0 z-30 bg-black/50 md:hidden', mobileSidebarOpen ? 'block' : 'hidden')}
        onClick={() => setMobileSidebarOpen(false)}
      />
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 transition-transform md:static md:translate-x-0',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <Sidebar />
      </div>
      <main className="flex min-w-0 flex-1 flex-col">
        {everConnected && !connected && (
          <div className="flex items-center justify-center gap-2 bg-amber-500/15 px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300">
            <WifiOff className="size-3.5" /> Reconnecting…
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
}
