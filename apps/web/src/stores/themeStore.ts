import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';
const KEY = 'agentic-slack:theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

function readStored(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

const resolve = (theme: Theme): 'light' | 'dark' => (theme === 'system' ? (media.matches ? 'dark' : 'light') : theme);

function apply(resolved: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  document.documentElement.style.colorScheme = resolved;
}

interface ThemeState {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set) => {
  const theme = readStored();
  const resolvedTheme = resolve(theme);
  apply(resolvedTheme);

  media.addEventListener('change', () => {
    const { theme } = useThemeStore.getState();
    if (theme !== 'system') return;
    const next = resolve(theme);
    apply(next);
    set({ resolvedTheme: next });
  });

  return {
    theme,
    resolvedTheme,
    setTheme: (next) => {
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* storage unavailable */
      }
      const resolved = resolve(next);
      apply(resolved);
      set({ theme: next, resolvedTheme: resolved });
    },
  };
});
