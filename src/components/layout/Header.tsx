import { useAppStore } from '@/store/appStore';
import { cn } from '@/lib/utils';
import { LOJAS, LOJAS_IDS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw } from 'lucide-react';
import { SyncNotifications } from './SyncNotifications';
import { ThemeToggle } from '@/components/ThemeToggle';

interface HeaderProps {
  onSignOut?: () => void;
  mostrarSeletorLoja?: boolean;
}

export const Header = ({ onSignOut, mostrarSeletorLoja }: HeaderProps) => {
  const { currentView, selectedLoja, selectedVendedor, setSelectedLoja, sidebarCollapsed } = useAppStore();

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
    <header className={cn('gradient-card border-b-2 border-primary px-3 sm:px-6 py-3 sm:py-4 shadow-card fixed top-0 right-0 left-0 z-20 transition-all duration-300', sidebarCollapsed ? 'lg:left-16' : 'lg:left-64')}>
      <div className="flex items-center justify-between">
        <h1 className="text-sm sm:text-2xl font-light tracking-wide truncate ml-12 lg:ml-0">{getTitle()}</h1>
        <div className="flex items-center gap-2 sm:gap-3">
          {mostrarSeletorLoja && (
            <Select value={selectedLoja || 'all'} onValueChange={(v) => setSelectedLoja(v === 'all' ? null : v)}>
              <SelectTrigger className="h-8 sm:h-9 w-[8.5rem] sm:w-[11rem] bg-card/50 text-xs sm:text-sm" title="Filtrar por loja">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Lojas</SelectItem>
                {LOJAS_IDS.map((id) => (
                  <SelectItem key={id} value={id}>{LOJAS[id]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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