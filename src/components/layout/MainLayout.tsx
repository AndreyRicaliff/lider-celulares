import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { ColaboradoresPage } from '@/pages/ColaboradoresPage';
import { VendasUploadPage } from '@/pages/VendasUploadPage';
import { FolhaPagamentoPage } from '@/pages/FolhaPagamentoPage';
import { ConfiguracoesPage } from '@/pages/ConfiguracoesPage';
import { RelatoriosPage } from '@/pages/RelatoriosPage';
import { RelatoriosNumericos } from '@/pages/RelatoriosNumericos';
import { MeuRelatorioPage } from '@/pages/MeuRelatorioPage';
import { SupervisaoFolhaPage } from '@/pages/SupervisaoFolhaPage';
import { VendasDiariaPage } from '@/pages/VendasDiariaPage';
import { EstoquePage } from '@/pages/EstoquePage';
import { AuditoriaVendasPage } from '@/pages/AuditoriaVendasPage';


import { useAppStore } from '@/store/appStore';
import { ColaboradorLoja } from '@/hooks/useAuth';

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
          {renderContent()}
        </main>
      </div>
    </div>
  );
};