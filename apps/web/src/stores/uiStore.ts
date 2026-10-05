import { create } from 'zustand';

interface UIState {
  openThreadId: string | null;
  openThread: (id: string) => void;
  closeThread: () => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  openThreadId: null,
  openThread: (id) => set({ openThreadId: id, mobileSidebarOpen: false }),
  closeThread: () => set({ openThreadId: null }),
  mobileSidebarOpen: false,
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
}));
