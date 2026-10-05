import { create } from 'zustand';
import type { LoginInput, SignupInput, UserDTO } from '@slack/shared';
import { api } from '@/lib/api';
import { disconnectSocket } from '@/lib/socket';

interface AuthState {
  user: UserDTO | null;
  status: 'loading' | 'authenticated' | 'guest';
  init: () => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  signup: (input: SignupInput) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'loading',
  init: async () => {
    try {
      const { user } = await api.get<{ user: UserDTO }>('/auth/me');
      set({ user, status: 'authenticated' });
    } catch {
      set({ user: null, status: 'guest' });
    }
  },
  login: async (input) => {
    const { user } = await api.post<{ user: UserDTO }>('/auth/login', input);
    set({ user, status: 'authenticated' });
  },
  signup: async (input) => {
    const { user } = await api.post<{ user: UserDTO }>('/auth/signup', input);
    set({ user, status: 'authenticated' });
  },
  logout: async () => {
    await api.post('/auth/logout').catch(() => undefined);
    disconnectSocket();
    set({ user: null, status: 'guest' });
  },
}));
