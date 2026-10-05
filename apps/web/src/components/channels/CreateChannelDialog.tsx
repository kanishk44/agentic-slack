import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { createChannelSchema } from '@slack/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { AgentPicker } from '@/components/agents/AgentPicker';

export function CreateChannelDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const createChannel = useWorkspaceStore((s) => s.createChannel);
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [agentIds, setAgentIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setAgentIds([]);
    }
  }, [open]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = createChannelSchema.safeParse({ name, description, agentIds });
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message);
    setSubmitting(true);
    try {
      const channel = await createChannel(parsed.data);
      onOpenChange(false);
      navigate(`/w/${workspaceId}/c/${channel.id}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Create a channel</DialogTitle>
            <DialogDescription>Channels are where humans and agents collaborate on a topic.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="ch-name">Name</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">#</span>
              <Input
                id="ch-name"
                className="pl-7"
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                placeholder="design-system"
                autoFocus
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ch-desc">Description <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="ch-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this channel about?" />
          </div>
          <div className="space-y-1.5">
            <Label>Agents in this channel</Label>
            <AgentPicker value={agentIds} onChange={setAgentIds} />
            <p className="text-xs text-muted-foreground">Mentioning any agent later will also add it automatically.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting || !name}>
              {submitting && <Loader2 className="animate-spin" />}
              Create channel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
