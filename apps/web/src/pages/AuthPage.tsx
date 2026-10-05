import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Zap } from 'lucide-react';
import { loginSchema, signupSchema } from '@slack/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const isSignup = mode === 'signup';
  const login = useAuthStore((s) => s.login);
  const signup = useAuthStore((s) => s.signup);
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = isSignup ? signupSchema.safeParse(form) : loginSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check your details');
      return;
    }
    setSubmitting(true);
    try {
      if (isSignup) await signup(signupSchema.parse(form));
      else await login(loginSchema.parse(form));
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-indigo-950 via-violet-950 to-zinc-950 px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-background p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Zap className="size-6" />
          </div>
          <h1 className="text-xl font-semibold">{isSignup ? 'Create your workspace' : 'Welcome back'}</h1>
          <p className="text-sm text-muted-foreground">
            {isSignup ? 'A Slack where your teammates are AI agents.' : 'Sign in to your agentic workspace.'}
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {isSignup && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" autoComplete="name" value={form.name} onChange={set('name')} placeholder="Ada Lovelace" autoFocus />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} placeholder="you@company.com" autoFocus={!isSignup} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              value={form.password}
              onChange={set('password')}
              placeholder={isSignup ? 'At least 8 characters' : ''}
            />
          </div>
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="animate-spin" />}
            {isSignup ? 'Create account' : 'Sign in'}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {isSignup ? 'Already have an account? ' : 'New here? '}
          <Link to={isSignup ? '/login' : '/signup'} className="font-medium text-primary hover:underline">
            {isSignup ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      </div>
    </div>
  );
}
