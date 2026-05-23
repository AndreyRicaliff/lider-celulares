import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  currentView: 'dashboard' | 'colaboradores' | 'vendas' | 'folha' | 'relatorio' | 'relatorios' | 'configuracoes' | 'supervisao-folha' | 'vendas-diarias' | 'relatorios-numericos' | 'estoque' | 'auditoria';
  selectedLoja: string | null;
  selectedMes: string;
  selectedVendedor: string | null;
  selectedComissaoId: string | null;
  sidebarOpen: boolean;

  setCurrentView: (view: AppState['currentView']) => void;
  setSelectedLoja: (loja: string | null) => void;
  setSelectedMes: (mes: string) => void;
  setSelectedVendedor: (vendedor: string | null) => void;
  setSelectedComissaoId: (id: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  resetDashboardContext: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentView: 'dashboard',
      selectedLoja: null, // Set dynamically in App.tsx based on user role
      selectedMes: (() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      })(),
      selectedVendedor: null,
      selectedComissaoId: null,
      sidebarOpen: false,

      setCurrentView: (view) => set({ currentView: view }),
      setSelectedLoja: (loja) => set({ selectedLoja: loja }),
      setSelectedMes: (mes) => set({ selectedMes: mes }),
      setSelectedVendedor: (vendedor) => set({ selectedVendedor: vendedor }),
      setSelectedComissaoId: (id) => set({ selectedComissaoId: id }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      resetDashboardContext: () => set({ selectedVendedor: null }),
    }),
    {
      name: 'lider-app-store',
      partialize: (state) => ({
        selectedLoja: state.selectedLoja,
        selectedMes: state.selectedMes,
      }),
    }
  )
);
