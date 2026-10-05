import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';
import { createAgentSchema, toHandle, type AgentDTO } from '@slack/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { errorMessage } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const EMOJIS = ['🤖', '🧑‍💻', '🎨', '✍️', '🔍', '🧠', '📋', '📈', '🧪', '🛡️', '🗺️', '🎯', '💡', '🦉', '🚀', '📚'];

interface FormState {
  name: string;
  handle: string;
  avatar: string;
  description: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  contextWindow: number;
}

const blank = (model: string): FormState => ({
  name: '',
  handle: '',
  avatar: '🤖',
  description: '',
  systemPrompt: 'You are a helpful expert. ',
  model,
  temperature: 0.7,
  contextWindow: 20,
});

export function AgentFormDialog({
  open,
  agent,
  onOpenChange,
}: {
  open: boolean;
  /** Existing agent to edit; null to create. */
  agent: AgentDTO | null;
  onOpenChange: (open: boolean) => void;
}) {
  const models = useWorkspaceStore((s) => s.models);
  const defaultModel = useWorkspaceStore((s) => s.defaultModel);
  const loadModels = useWorkspaceStore((s) => s.loadModels);
  const createAgent = useWorkspaceStore((s) => s.createAgent);
  const updateAgent = useWorkspaceStore((s) => s.updateAgent);
  const deleteAgent = useWorkspaceStore((s) => s.deleteAgent);

  const [form, setForm] = useState<FormState>(blank(defaultModel));
  const [handleTouched, setHandleTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setModelsError(null);
    loadModels().catch((err) => setModelsError(errorMessage(err)));
    setHandleTouched(!!agent);
    setForm(
      agent
        ? {
            name: agent.name,
            handle: agent.handle,
            avatar: agent.avatar,
            description: agent.description,
            systemPrompt: agent.systemPrompt,
            model: agent.model,
            temperature: agent.temperature,
            contextWindow: agent.contextWindow,
          }
        : blank(defaultModel || 'openrouter/free'),
    );
  }, [open, agent, defaultModel, loadModels]);

  useEffect(() => {
    if (!agent && !form.model && defaultModel) setForm((f) => ({ ...f, model: defaultModel }));
  }, [agent, defaultModel, form.model]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const onNameChange = (name: string) => setForm((f) => ({ ...f, name, handle: handleTouched ? f.handle : toHandle(name) }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = createAgentSchema.safeParse(form);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return toast.error(`${issue?.path.join('.')}: ${issue?.message}`);
    }
    setSubmitting(true);
    try {
      if (agent) await updateAgent(agent.id, parsed.data);
      else await createAgent(parsed.data);
      toast.success(agent ? `Updated ${parsed.data.name}` : `${parsed.data.name} joined the workspace. Mention @${parsed.data.handle} to try it.`);
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async () => {
    if (!agent || !confirm(`Delete ${agent.name}? Its past messages stay in history.`)) return;
    try {
      await deleteAgent(agent.id);
      toast.success(`Deleted ${agent.name}`);
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  // Keep the current model selectable even if it's not in the free list (e.g. retired or paid).
  const modelOptions = models.some((m) => m.id === form.model) || !form.model ? models : [{ id: form.model, name: form.model, contextLength: 0 }, ...models];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {agent ? `Edit ${agent.name}` : 'Create an agent'}
              {agent?.isBuiltIn && <Badge variant="secondary">Built-in</Badge>}
            </DialogTitle>
            <DialogDescription>Agents reply when @mentioned, using recent conversation as context.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-[auto_1fr_1fr]">
            <div className="space-y-1.5">
              <Label>Avatar</Label>
              <Select value={form.avatar} onValueChange={(v) => set('avatar', v)}>
                <SelectTrigger className="w-20 text-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...new Set([form.avatar, ...EMOJIS])].map((e) => (
                    <SelectItem key={e} value={e} className="text-lg">{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ag-name">Name</Label>
              <Input id="ag-name" value={form.name} onChange={(e) => onNameChange(e.target.value)} placeholder="SQL Wizard" autoFocus={!agent} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ag-handle">Handle</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                <Input
                  id="ag-handle"
                  className="pl-7"
                  value={form.handle}
                  disabled={agent?.isBuiltIn}
                  onChange={(e) => {
                    setHandleTouched(true);
                    set('handle', e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''));
                  }}
                  placeholder="sql"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ag-desc">Description</Label>
            <Input id="ag-desc" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Writes and optimizes SQL queries." />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ag-prompt">System prompt</Label>
            <Textarea
              id="ag-prompt"
              value={form.systemPrompt}
              onChange={(e) => set('systemPrompt', e.target.value)}
              className="min-h-40 font-mono text-xs"
              placeholder="You are…"
            />
            <p className="text-xs text-muted-foreground">Defines the agent's expertise, tone and rules. Channel and participant context is added automatically.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Model</Label>
            {modelsError ? (
              <Input value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="openrouter/free" className="font-mono text-sm" />
            ) : (
            <Select value={form.model} onValueChange={(v) => set('model', v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={modelsError ? 'Could not load models' : 'Loading free models…'} />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {modelOptions.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="truncate">{m.name}</span>
                    {m.contextLength > 0 && <span className="text-xs text-muted-foreground">{Math.round(m.contextLength / 1000)}k ctx</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            )}
            <p className="text-xs text-muted-foreground">
              {modelsError && "Couldn't load the model list, so enter an OpenRouter model ID. "}
              Free OpenRouter models. Free models are rate-limited and their availability changes over time.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2.5">
              <Label>Temperature <span className="font-mono text-muted-foreground">{form.temperature.toFixed(1)}</span></Label>
              <Slider min={0} max={2} step={0.1} value={[form.temperature]} onValueChange={([v]) => set('temperature', v ?? 0.7)} />
              <p className="text-xs text-muted-foreground">Lower is focused, higher is creative.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ag-ctx">Context window (messages)</Label>
              <Input id="ag-ctx" type="number" min={1} max={50} value={form.contextWindow} onChange={(e) => set('contextWindow', Number(e.target.value))} />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            {agent && !agent.isBuiltIn ? (
              <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDelete}>
                <Trash2 /> Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="animate-spin" />}
                {agent ? 'Save changes' : 'Create agent'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
