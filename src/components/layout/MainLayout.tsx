import { ReactNode, lazy, Suspense } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { LoadingSpinner } from '@/components/ui/loading';
import { useAppStore } from '@/store/appStore';
import { ColaboradorLoja } from '@/hooks/useAuth';

const Dashboard = lazy(() => import('@/components/dashboard/Dashboard').then(m => ({ default: m.Dashboard })));
const ColaboradoresPage = lazy(() => import('@/pages/ColaboradoresPage').then(m => ({ default: m.ColaboradoresPage })));
const VendasUploadPage = lazy(() => import('@/pages/VendasUploadPage').then(m => ({ default: m.VendasUploadPage })));
const FolhaPagamentoPage = lazy(() => import('@/pages/FolhaPagamentoPage').then(m => ({ default: m.FolhaPagamentoPage })));
const ConfiguracoesPage = lazy(() => import('@/pages/ConfiguracoesPage').then(m => ({ default: m.ConfiguracoesPage })));
const RelatoriosPage = lazy(() => import('@/pages/RelatoriosPage').then(m => ({ default: m.RelatoriosPage })));
const RelatoriosNumericos = lazy(() => import('@/pages/RelatoriosNumericos').then(m => ({ default: m.RelatoriosNumericos })));
const MeuRelatorioPage = lazy(() => import('@/pages/MeuRelatorioPage').then(m => ({ default: m.MeuRelatorioPage })));
const SupervisaoFolhaPage = lazy(() => import('@/pages/SupervisaoFolhaPage').then(m => ({ default: m.SupervisaoFolhaPage })));
const VendasDiariaPage = lazy(() => import('@/pages/VendasDiariaPage').then(m => ({ default: m.VendasDiariaPage })));
const EstoquePage = lazy(() => import('@/pages/EstoquePage').then(m => ({ default: m.EstoquePage })));
const AuditoriaVendasPage = lazy(() => import('@/pages/AuditoriaVendasPage').then(m => ({ default: m.AuditoriaVendasPage })));

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
  const { currentView } = useAppStore();

  const renderContent = () => {
    if (children) return children;
    
    // Supervisão view - READ ONLY access to everything except configuracoes and colaboradores
    if (isSupervisao) {
      switch (currentView) {
        case 'dashboard':
          return <Dashboard />;
        case 'vendas':
          return <VendasUploadPage readOnly />;
        case 'vendas-diarias':
          return <VendasDiariaPage />;
        case 'folha':
          return <FolhaPagamentoPage readOnly />;
        case 'supervisao-folha':
          return <SupervisaoFolhaPage />;
        case 'relatorio':
          return <RelatoriosPage />;
        case 'relatorios-numericos':
          return <RelatoriosNumericos />;
        case 'estoque':
          return <EstoquePage />;
        case 'auditoria':
          return <AuditoriaVendasPage />;
        default:
          return <Dashboard />;
      }
    }
    
    // Gerente has expanded access to their store's data
    if (isGerente && colaboradorLojaId) {
      switch (currentView) {
        case 'dashboard':
          return <Dashboard colaboradorLojaId={colaboradorLojaId} />;
        case 'relatorio':
          return <MeuRelatorioPage />;
        case 'folha':
          return <FolhaPagamentoPage gerenteLojaId={colaboradorLojaId} />;
        case 'relatorios':
          return <RelatoriosPage gerenteLojaId={colaboradorLojaId} />;
        case 'vendas':
          return <VendasUploadPage gerenteLojaId={colaboradorLojaId} />;
        case 'vendas-diarias':
          return <VendasDiariaPage />;
        case 'estoque':
          return <EstoquePage />;
        case 'auditoria':
          return <AuditoriaVendasPage />;
        default:
          return <Dashboard colaboradorLojaId={colaboradorLojaId} />;
      }
    }
    
    // Regular colaborador can only access dashboard and their personal report
    if (isColaborador) {
      switch (currentView) {
        case 'dashboard':
          return <Dashboard colaboradorLojaId={colaboradorLojaId} />;
        case 'relatorio':
          return <MeuRelatorioPage />;
        case 'vendas':
          return <VendasUploadPage gerenteLojaId={colaboradorLojaId || undefined} readOnly isVendedor />;
        case 'vendas-diarias':
          return <VendasDiariaPage />;
        case 'estoque':
          return <EstoquePage />;
        case 'auditoria':
          return <AuditoriaVendasPage />;
        default:
          return <Dashboard colaboradorLojaId={colaboradorLojaId} />;
      }
    }
    
    // Admin view - full access
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'colaboradores':
        return <ColaboradoresPage />;
      case 'vendas':
        return <VendasUploadPage />;
      case 'vendas-diarias':
        return <VendasDiariaPage />;
      case 'folha':
        return <FolhaPagamentoPage />;
      case 'configuracoes':
        return <ConfiguracoesPage />;
      case 'relatorio':
        return <RelatoriosPage />;
      case 'relatorios-numericos':
        return <RelatoriosNumericos />;
      case 'supervisao-folha':
        return <SupervisaoFolhaPage />;
      case 'estoque':
        return <EstoquePage />;
      case 'auditoria':
        return <AuditoriaVendasPage />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen gradient-dark">
      <Sidebar isColaborador={isColaborador} isGerente={isGerente} isSupervisao={isSupervisao} colaboradorLojaId={colaboradorLojaId} lojasDisponiveis={lojasDisponiveis} onSwitchLoja={onSwitchLoja} onSignOut={onSignOut} />
      <div className="lg:ml-64 flex flex-col min-h-screen">
        <Header onSignOut={onSignOut} />
        <main className="flex-1 p-3 sm:p-6 overflow-y-auto pt-20 lg:pt-20">
          <Suspense fallback={<div className="flex items-center justify-center h-64"><LoadingSpinner size="lg" /></div>}>
            {renderContent()}
          </Suspense>
        </main>
      </div>
    </div>
  );
};