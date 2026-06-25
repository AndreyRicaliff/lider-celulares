import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAppStore } from '@/store/appStore';
import { ColaboradorLoja } from '@/hooks/useAuth';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { ColaboradoresPage } from '@/pages/ColaboradoresPage';
import { FolhaPagamentoPage } from '@/pages/FolhaPagamentoPage';
import { ConfiguracoesPage } from '@/pages/ConfiguracoesPage';
import { RelatoriosPage } from '@/pages/RelatoriosPage';
import { RelatoriosNumericos } from '@/pages/RelatoriosNumericos';
import { MeuRelatorioPage } from '@/pages/MeuRelatorioPage';
import { SupervisaoFolhaPage } from '@/pages/SupervisaoFolhaPage';
import { VendasDiariaPage } from '@/pages/VendasDiariaPage';
import { VendasPage } from '@/pages/VendasPage';
import { EstoquePage } from '@/pages/EstoquePage';

interface MainLayoutProps {
  children?: ReactNode;
  isColaborador?: boolean;
  isGerente?: boolean;
  isSupervisao?: boolean;
  colaboradorLojaId?: string | null;
  lojasDisponiveis?: ColaboradorLoja[];
  onSwitchLoja?: (lojaId: string) => void;
  onSignOut?: () => void;
}

export const MainLayout = ({ children, isColaborador, isGerente, isSupervisao, colaboradorLojaId, lojasDisponiveis, onSwitchLoja, onSignOut }: MainLayoutProps) => {
  const { currentView, sidebarCollapsed } = useAppStore();

  const renderContent = () => {
    if (children) return children;

    if (isSupervisao) {
      switch (currentView) {
        case 'dashboard': return <Dashboard />;
        case 'vendas': return <VendasPage />;
        case 'vendas-diarias': return <VendasDiariaPage />;
        case 'folha': return <FolhaPagamentoPage readOnly />;
        case 'supervisao-folha': return <SupervisaoFolhaPage />;
        case 'relatorio': return <RelatoriosPage />;
        case 'relatorios-numericos': return <RelatoriosNumericos />;
        case 'estoque': return <EstoquePage />;
        default: return <Dashboard />;
      }
    }

    if (isGerente && colaboradorLojaId) {
      switch (currentView) {
        case 'dashboard': return <Dashboard colaboradorLojaId={colaboradorLojaId} />;
        case 'vendas': return <VendasPage colaboradorLojaId={colaboradorLojaId} />;
        case 'relatorio': return <MeuRelatorioPage />;
        case 'folha': return <FolhaPagamentoPage gerenteLojaId={colaboradorLojaId} />;
        case 'relatorios': return <RelatoriosPage gerenteLojaId={colaboradorLojaId} />;
        case 'vendas-diarias': return <VendasDiariaPage />;
        case 'estoque': return <EstoquePage />;
        default: return <Dashboard colaboradorLojaId={colaboradorLojaId} />;
      }
    }

    if (isColaborador) {
      switch (currentView) {
        case 'dashboard': return <Dashboard colaboradorLojaId={colaboradorLojaId} />;
        case 'relatorio': return <MeuRelatorioPage />;
        case 'vendas-diarias': return <VendasDiariaPage />;
        case 'estoque': return <EstoquePage />;
        default: return <Dashboard colaboradorLojaId={colaboradorLojaId} />;
      }
    }

    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'vendas': return <VendasPage />;
      case 'colaboradores': return <ColaboradoresPage />;
      case 'vendas-diarias': return <VendasDiariaPage />;
      case 'folha': return <FolhaPagamentoPage />;
      case 'configuracoes': return <ConfiguracoesPage />;
      case 'relatorio': return <RelatoriosPage />;
      case 'relatorios-numericos': return <RelatoriosNumericos />;
      case 'supervisao-folha': return <SupervisaoFolhaPage />;
      case 'estoque': return <EstoquePage />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen gradient-dark">
      <Sidebar isColaborador={isColaborador} isGerente={isGerente} isSupervisao={isSupervisao} colaboradorLojaId={colaboradorLojaId} lojasDisponiveis={lojasDisponiveis} onSwitchLoja={onSwitchLoja} onSignOut={onSignOut} />
      <div className={cn('flex flex-col min-h-screen transition-all duration-300', sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64')}>
        <Header onSignOut={onSignOut} mostrarSeletorLoja={!isColaborador && !isGerente} />
        <main className="flex-1 p-3 sm:p-6 overflow-y-auto pt-20 lg:pt-20">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};
