import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { FullPageSpinner } from '@/components/layout/FullPageSpinner';
import { errorMessage } from '@/lib/api';

const LAST_WORKSPACE_KEY = 'agentic-slack:last-workspace';

export const rememberWorkspace = (id: string) => {
  try {
    localStorage.setItem(LAST_WORKSPACE_KEY, id);
  } catch {
    /* storage unavailable */
  }
};

/** `/` → last used (or first) workspace. */
export function HomeRedirect() {
  const loadWorkspaces = useWorkspaceStore((s) => s.loadWorkspaces);
  const [target, setTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWorkspaces()
      .then((workspaces) => {
        let last: string | null = null;
        try {
          last = localStorage.getItem(LAST_WORKSPACE_KEY);
        } catch {
          /* ignore */
        }
        const ws = workspaces.find((w) => w.id === last) ?? workspaces[0];
        setTarget(ws ? `/w/${ws.id}` : null);
        if (!ws) setError('You are not a member of any workspace.');
      })
      .catch((err) => setError(errorMessage(err)));
  }, [loadWorkspaces]);

  if (error) return <div className="p-8 text-sm text-destructive">{error}</div>;
  if (!target) return <FullPageSpinner label="Loading your workspace…" />;
  return <Navigate to={target} replace />;
}

/** `/w/:id` → #general (or first channel). */
export function WorkspaceRedirect() {
  const channels = useWorkspaceStore((s) => s.channels);
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  if (!channels.length || !workspaceId) return <FullPageSpinner />;
  const channel = channels.find((c) => c.name === 'general') ?? channels[0];
  return <Navigate to={`/w/${workspaceId}/c/${channel.id}`} replace />;
}
