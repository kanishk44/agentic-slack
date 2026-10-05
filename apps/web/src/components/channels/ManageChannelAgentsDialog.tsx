import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { ChannelDTO } from '@slack/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { errorMessage } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { AgentPicker } from '@/components/agents/AgentPicker';

export function ManageChannelAgentsDialog({
  channel,
  open,
  onOpenChange,
}: {
  channel: ChannelDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const setChannelAgents = useWorkspaceStore((s) => s.setChannelAgents);
  const [agentIds, setAgentIds] = useState(channel.agentIds);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setAgentIds(channel.agentIds);
  }, [open, channel.agentIds]);

  const save = async () => {
    setSaving(true);
    try {
      await setChannelAgents(channel.id, agentIds);
      toast.success('Channel agents updated');
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agents in #{channel.name}</DialogTitle>
          <DialogDescription>Agents in a channel show up first in @mention suggestions and know about each other.</DialogDescription>
        </DialogHeader>
        <AgentPicker value={agentIds} onChange={setAgentIds} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
