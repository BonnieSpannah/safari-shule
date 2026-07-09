import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthUser } from '@/lib/api/auth';

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  isHydrated: boolean;
  setAccessToken: (token: string | null) => void;
  setUser: (user: AuthUser | null) => void;
  setSession: (token: string, user: AuthUser) => void;
  clear: () => void;
  markHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      isHydrated: false,
      setAccessToken: (accessToken) => set({ accessToken }),
      setUser: (user) => set({ user }),
      setSession: (accessToken, user) => set({ accessToken, user }),
      clear: () => set({ accessToken: null, user: null }),
      markHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: 'safari.auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ accessToken: state.accessToken, user: state.user }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);

export function hasPermission(permission: string): boolean {
  const perms = useAuthStore.getState().user?.permissions ?? [];
  return perms.includes(permission);
}
