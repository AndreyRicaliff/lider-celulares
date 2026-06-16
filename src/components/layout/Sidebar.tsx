import { cn } from '@/lib/utils';
import { LOJAS } from '@/lib/constants';
import { useAppStore } from '@/store/appStore';
import { ColaboradorLoja } from '@/hooks/useAuth';
import {
  Home,
  Users,
  FileText,
  Settings,
  BarChart3,
  Menu,
  X,
  LogOut,
  Briefcase,
  CalendarDays,
  Hash,
  ArrowLeftRight,
  Package,
} from 'lucide-react';
import logoLider from '@/assets/logo.jpg';

interface SidebarProps {
  isColaborador?: boolean;
  isGerente?: boolean;
  isSupervisao?: boolean;
  colaboradorLojaId?: string | null;
  lojasDisponiveis?: ColaboradorLoja[];
  onSwitchLoja?: (lojaId: string) => void;
  onSignOut?: () => void;
}

export const Sidebar = ({ isColaborador, isGerente, isSupervisao, colaboradorLojaId, lojasDisponiveis, onSwitchLoja, onSignOut }: SidebarProps) => {
  const { currentView, setCurrentView, setSelectedLoja, sidebarOpen, setSidebarOpen } = useAppStore();

  const handleNavigation = (view: typeof currentView, loja?: string) => {
    setCurrentView(view);
    if (loja) setSelectedLoja(loja);
    setSidebarOpen(false);
  };

  const isAdmin = !isColaborador && !isSupervisao && !isGerente;

  return (
    <>
      {/* Mobile toggle button */}
      <button
        className="fixed top-4 left-4 z-50 lg:hidden gradient-primary text-primary-foreground p-2 rounded-lg shadow-glow"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-full w-64 bg-sidebar border-r border-sidebar-border',
          'flex flex-col transition-transform duration-300 ease-in-out',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="p-4 border-b border-sidebar-border">
          <img src={logoLider} alt="Líder Celulares" className="h-12 w-auto mx-auto rounded" />
          <p className="text-xs text-sidebar-foreground text-center mt-2">Sistema de Comissões</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <NavItem
            icon={<Home size={18} />}
            label="Dashboard"
            active={currentView === 'dashboard'}
            onClick={() => handleNavigation('dashboard')}
          />

          {/* ===== COLABORADOR (vendedor/VR/trainee) — loja fixa ===== */}
          {isColaborador && !isGerente && (
            <>
              <TrocarLoja lojasDisponiveis={lojasDisponiveis} colaboradorLojaId={colaboradorLojaId} onSwitchLoja={onSwitchLoja} setSidebarOpen={setSidebarOpen} />
              <SectionLabel>Minha Área</SectionLabel>
              <NavItem icon={<FileText size={18} />} label="Meu Relatório" active={currentView === 'relatorio'} onClick={() => handleNavigation('relatorio')} />
              {colaboradorLojaId && (
                <NavItem icon={<CalendarDays size={18} />} label="Vendas Diárias" active={currentView === 'vendas-diarias'} onClick={() => handleNavigation('vendas-diarias', colaboradorLojaId)} />
              )}
            </>
          )}

          {/* ===== GERENTE — loja fixa, acesso ampliado ===== */}
          {isGerente && colaboradorLojaId && (
            <>
              <TrocarLoja lojasDisponiveis={lojasDisponiveis} colaboradorLojaId={colaboradorLojaId} onSwitchLoja={onSwitchLoja} setSidebarOpen={setSidebarOpen} />
              <SectionLabel>Minha Área</SectionLabel>
              <NavItem icon={<FileText size={18} />} label="Meu Relatório" active={currentView === 'relatorio'} onClick={() => handleNavigation('relatorio')} />
              <SectionLabel>Minha Loja — {LOJAS[colaboradorLojaId as keyof typeof LOJAS]}</SectionLabel>
              <NavItem icon={<CalendarDays size={18} />} label="Vendas Diárias" active={currentView === 'vendas-diarias'} onClick={() => handleNavigation('vendas-diarias', colaboradorLojaId)} />
              <NavItem icon={<FileText size={18} />} label="Folha de Pagamento" active={currentView === 'folha'} onClick={() => handleNavigation('folha', colaboradorLojaId)} />
              <NavItem icon={<Package size={18} />} label="Estoque Inteligente" active={currentView === 'estoque'} onClick={() => handleNavigation('estoque', colaboradorLojaId)} />
              <NavItem icon={<BarChart3 size={18} />} label="Relatórios" active={currentView === 'relatorios'} onClick={() => handleNavigation('relatorios', colaboradorLojaId)} />
            </>
          )}

          {/* ===== ADMIN / SUPERVISÃO — navegação por FUNÇÃO (loja via filtro no topo) ===== */}
          {(isAdmin || isSupervisao) && (
            <>
              <SectionLabel>Operação</SectionLabel>
              <NavItem icon={<CalendarDays size={18} />} label="Vendas Diárias" active={currentView === 'vendas-diarias'} onClick={() => handleNavigation('vendas-diarias')} />
              <NavItem icon={<Package size={18} />} label="Estoque Inteligente" active={currentView === 'estoque'} onClick={() => handleNavigation('estoque')} />

              <SectionLabel>Financeiro</SectionLabel>
              <NavItem icon={<FileText size={18} />} label="Folha de Pagamento" active={currentView === 'folha'} onClick={() => handleNavigation('folha')} />
              <NavItem icon={<Briefcase size={18} />} label="Supervisão — Folha" active={currentView === 'supervisao-folha'} onClick={() => handleNavigation('supervisao-folha')} />

              <SectionLabel>Relatórios</SectionLabel>
              <NavItem icon={<BarChart3 size={18} />} label="Relatórios" active={currentView === 'relatorio'} onClick={() => handleNavigation('relatorio')} />
              <NavItem icon={<Hash size={18} />} label="Relatórios Numéricos" active={currentView === 'relatorios-numericos'} onClick={() => handleNavigation('relatorios-numericos')} />

              {/* Gestão — só admin */}
              {isAdmin && (
                <>
                  <SectionLabel>Gestão</SectionLabel>
                  <NavItem icon={<Users size={18} />} label="Colaboradores" active={currentView === 'colaboradores'} onClick={() => handleNavigation('colaboradores')} />
                  <NavItem icon={<Settings size={18} />} label="Configurações" active={currentView === 'configuracoes'} onClick={() => handleNavigation('configuracoes')} />
                </>
              )}
            </>
          )}
        </nav>

        {/* Logout */}
        {onSignOut && (
          <div className="p-3 border-t border-sidebar-border">
            <button
              onClick={onSignOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-destructive hover:bg-destructive/10"
            >
              <LogOut size={18} />
              <span>Sair</span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="mt-4 mb-2">
    <span className="text-xs text-sidebar-foreground uppercase tracking-wider px-3">{children}</span>
  </div>
);

interface TrocarLojaProps {
  lojasDisponiveis?: ColaboradorLoja[];
  colaboradorLojaId?: string | null;
  onSwitchLoja?: (lojaId: string) => void;
  setSidebarOpen: (open: boolean) => void;
}

const TrocarLoja = ({ lojasDisponiveis, colaboradorLojaId, onSwitchLoja, setSidebarOpen }: TrocarLojaProps) => {
  if (!lojasDisponiveis || lojasDisponiveis.length <= 1) return null;
  return (
    <div className="mt-4 mb-2">
      <span className="text-xs text-sidebar-foreground uppercase tracking-wider px-3">Trocar Loja</span>
      <div className="mt-1 space-y-0.5 px-1">
        {lojasDisponiveis.map((loja) => (
          <button
            key={loja.lojaId}
            onClick={() => { onSwitchLoja?.(loja.lojaId); setSidebarOpen(false); }}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200',
              loja.lojaId === colaboradorLojaId
                ? 'gradient-primary text-primary-foreground shadow-glow'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:translate-x-1'
            )}
          >
            <ArrowLeftRight size={16} />
            <span>{LOJAS[loja.lojaId as keyof typeof LOJAS] || loja.lojaId}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

interface NavItemProps {
  icon: React.ReactNode;
  label: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}

const NavItem = ({ icon, label, active, onClick }: NavItemProps) => (
  <button
    onClick={onClick}
    className={cn(
      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
      'hover:bg-sidebar-accent hover:translate-x-1',
      active ? 'gradient-primary text-primary-foreground shadow-glow' : 'text-sidebar-foreground hover:text-sidebar-accent-foreground'
    )}
  >
    {icon}
    <span>{label}</span>
  </button>
);
