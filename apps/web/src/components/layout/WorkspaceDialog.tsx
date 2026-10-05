import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export function WorkspaceDialog({ mode, onClose }: { mode: 'create' | 'join' | null; onClose: () => void }) {
  const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
  const joinWorkspace = useWorkspaceStore((s) => s.joinWorkspace);
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => setValue(''), [mode]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    setSubmitting(true);
    try {
      const ws = mode === 'create' ? await createWorkspace(value.trim()) : await joinWorkspace(value.trim());
      toast.success(mode === 'create' ? `Created ${ws.name}` : `Joined ${ws.name}`);
      onClose();
      navigate(`/w/${ws.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{mode === 'create' ? 'Create a workspace' : 'Join a workspace'}</DialogTitle>
            <DialogDescription>
              {mode === 'create'
                ? 'New workspaces come with the default AI agents and #general.'
                : 'Ask a teammate for the invite code from their workspace menu.'}
            </DialogDescription>
          </DialogHeader>
          <div className="my-5 space-y-1.5">
            <Label htmlFor="ws-value">{mode === 'create' ? 'Workspace name' : 'Invite code'}</Label>
            <Input
              id="ws-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={mode === 'create' ? 'Acme Inc.' : 'ABCD2345'}
              className={mode === 'join' ? 'font-mono uppercase' : ''}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting || !value.trim()}>
              {submitting && <Loader2 className="animate-spin" />}
              {mode === 'create' ? 'Create' : 'Join'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
