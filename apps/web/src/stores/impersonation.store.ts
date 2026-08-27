import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface ImpersonationState {
  isImpersonating: boolean;
  impersonatedUserId: string | null;
  impersonatedUserEmail: string | null;
  approverEmail: string | null;
  startImpersonation: (userId: string, email: string, approverEmail: string) => void;
  endImpersonation: () => void;
}

export const useImpersonationStore = create<ImpersonationState>()(
  persist(
    (set) => ({
      isImpersonating: false,
      impersonatedUserId: null,
      impersonatedUserEmail: null,
      approverEmail: null,
      startImpersonation: (userId, email, approverEmail) =>
        set({
          isImpersonating: true,
          impersonatedUserId: userId,
          impersonatedUserEmail: email,
          approverEmail,
        }),
      endImpersonation: () =>
        set({
          isImpersonating: false,
          impersonatedUserId: null,
          impersonatedUserEmail: null,
          approverEmail: null,
        }),
    }),
    {
      name: 'safari.impersonation',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        isImpersonating: state.isImpersonating,
        impersonatedUserId: state.impersonatedUserId,
        impersonatedUserEmail: state.impersonatedUserEmail,
        approverEmail: state.approverEmail,
      }),
    },
  ),
);
