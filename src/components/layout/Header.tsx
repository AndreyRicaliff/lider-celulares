import { useAppStore } from '@/store/appStore';
import { LOJAS, LOJAS_IDS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { SyncNotifications } from './SyncNotifications';
import { ThemeToggle } from '@/components/ThemeToggle';

interface HeaderProps {
  onSignOut?: () => void;
  mostrarSeletorLoja?: boolean;
}

export const Header = ({ onSignOut, mostrarSeletorLoja }: HeaderProps) => {
  const { currentView, selectedLoja, selectedVendedor, setSelectedLoja } = useAppStore();

  const getTitle = () => {
    switch (currentView) {
      case 'dashboard':
        if (selectedVendedor) {
          return `Dashboard > ${selectedVendedor}`;
        }
        if (selectedLoja) {
          return `Dashboard - ${LOJAS[selectedLoja as keyof typeof LOJAS]}`;
        }
        return 'Dashboard Geral';
      case 'colaboradores':
        return 'Gestão de Colaboradores';
      case 'vendas':
        return `Lançamento de Vendas - ${selectedLoja ? LOJAS[selectedLoja as keyof typeof LOJAS] : ''}`;
      case 'folha':
        return `Folha de Pagamento - ${selectedLoja ? LOJAS[selectedLoja as keyof typeof LOJAS] : ''}`;
      case 'configuracoes':
        return `Configurações - ${selectedLoja ? LOJAS[selectedLoja as keyof typeof LOJAS] : ''}`;
      case 'relatorio':
        return 'Relatórios';
      default:
        return 'Sistema de Comissões';
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <header className="gradient-card border-b-2 border-primary px-3 sm:px-6 py-3 sm:py-4 shadow-card fixed top-0 right-0 left-0 lg:left-64 z-20">
      <div className="flex items-center justify-between">
        <h1 className="text-sm sm:text-2xl font-light tracking-wide truncate ml-12 lg:ml-0">{getTitle()}</h1>
        <div className="flex items-center gap-2 sm:gap-3">
          {mostrarSeletorLoja && (
            <select
              value={selectedLoja || ''}
              onChange={(e) => setSelectedLoja(e.target.value || null)}
              className="h-8 sm:h-9 px-2 sm:px-3 rounded-lg border border-border bg-card/50 text-foreground text-xs sm:text-sm focus:ring-2 focus:ring-primary/30 max-w-[9rem] sm:max-w-none"
              title="Filtrar por loja"
            >
              <option value="">Todas as Lojas</option>
              {LOJAS_IDS.map((id) => (
                <option key={id} value={id}>{LOJAS[id]}</option>
              ))}
            </select>
          )}
          <SyncNotifications />
          <ThemeToggle />
          <Button variant="outline" size="icon" onClick={handleRefresh} className="h-8 w-8 sm:h-9 sm:w-9">
            <RefreshCw size={14} className="sm:hidden" />
            <RefreshCw size={16} className="hidden sm:block" />
          </Button>
        </div>
      </div>
    </header>
  );
};