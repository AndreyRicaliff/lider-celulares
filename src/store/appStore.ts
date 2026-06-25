import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  currentView: 'dashboard' | 'vendas' | 'colaboradores' | 'folha' | 'relatorio' | 'relatorios' | 'configuracoes' | 'supervisao-folha' | 'vendas-diarias' | 'relatorios-numericos' | 'estoque' | 'auditoria';
  selectedLoja: string | null;
  selectedMes: string;
  selectedVendedor: string | null;
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;

  setCurrentView: (view: AppState['currentView']) => void;
  setSelectedLoja: (loja: string | null) => void;
  setSelectedMes: (mes: string) => void;
  setSelectedVendedor: (vendedor: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  toggleSidebarCollapsed: () => void;
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
      sidebarOpen: false,
      sidebarCollapsed: false,

      setCurrentView: (view) => set({ currentView: view }),
      setSelectedLoja: (loja) => set({ selectedLoja: loja }),
      setSelectedMes: (mes) => set({ selectedMes: mes }),
      setSelectedVendedor: (vendedor) => set({ selectedVendedor: vendedor }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    {
      name: 'lider-app-store',
      // selectedLoja NÃO é persistido: ao abrir o app volta para o default
      // (Todas, p/ admin/supervisão). A escolha vive só na sessão atual.
      partialize: (state) => ({
        selectedMes: state.selectedMes,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
