import { useState } from 'react';
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
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react';
import { LiderLogo } from './LiderLogo';

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
  const { currentView, setCurrentView, setSelectedLoja, sidebarOpen, setSidebarOpen, sidebarCollapsed, toggleSidebarCollapsed } = useAppStore();

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
          'flex flex-col transition-all duration-300 ease-in-out',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          sidebarCollapsed && 'lg:w-16'
        )}
      >
        {/* Logo + recolher */}
        <div className={cn('border-b border-sidebar-border p-4', sidebarCollapsed && 'lg:px-2')}>
          <div className={cn('flex items-center gap-2', sidebarCollapsed ? 'justify-between lg:flex-col lg:gap-3' : 'justify-between')}>
            <LiderLogo collapsed={sidebarCollapsed} />
            <button
              onClick={toggleSidebarCollapsed}
              className="hidden lg:flex items-center justify-center h-7 w-7 rounded-md text-sidebar-foreground hover:bg-sidebar-accent shrink-0"
              title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
              aria-label={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <NavGroup title="Painel">
            <NavItem
              icon={<Home size={18} />}
              label="Visão Geral"
              active={currentView === 'dashboard'}
              onClick={() => handleNavigation('dashboard')}
            />
            {(isAdmin || isSupervisao || isGerente) && (
              <NavItem
                icon={<ShoppingCart size={18} />}
                label="Vendas"
                active={currentView === 'vendas'}
                onClick={() => handleNavigation('vendas')}
              />
            )}
          </NavGroup>

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
              <NavGroup title="Operação">
                <NavItem icon={<CalendarDays size={18} />} label="Vendas Diárias" active={currentView === 'vendas-diarias'} onClick={() => handleNavigation('vendas-diarias')} />
                <NavItem icon={<Package size={18} />} label="Estoque Inteligente" active={currentView === 'estoque'} onClick={() => handleNavigation('estoque')} />
              </NavGroup>
              <NavGroup title="Financeiro">
                <NavItem icon={<TrendingUp size={18} />} label="DRE" active={currentView === 'dre'} onClick={() => handleNavigation('dre')} />
              </NavGroup>
              <NavGroup title="Comissões">
                <NavItem icon={<FileText size={18} />} label="Folha de Pagamento" active={currentView === 'folha'} onClick={() => handleNavigation('folha')} />
                <NavItem icon={<Briefcase size={18} />} label="Supervisão — Folha" active={currentView === 'supervisao-folha'} onClick={() => handleNavigation('supervisao-folha')} />
                <NavItem icon={<BarChart3 size={18} />} label="Relatórios" active={currentView === 'relatorio'} onClick={() => handleNavigation('relatorio')} />
                <NavItem icon={<Hash size={18} />} label="Relatórios Numéricos" active={currentView === 'relatorios-numericos'} onClick={() => handleNavigation('relatorios-numericos')} />
              </NavGroup>
              {isAdmin && (
                <NavGroup title="Gestão">
                  <NavItem icon={<Users size={18} />} label="Colaboradores" active={currentView === 'colaboradores'} onClick={() => handleNavigation('colaboradores')} />
                  <NavItem icon={<Settings size={18} />} label="Configurações" active={currentView === 'configuracoes'} onClick={() => handleNavigation('configuracoes')} />
                </NavGroup>
              )}
            </>
          )}
        </nav>

        {/* Logout */}
        {onSignOut && (
          <div className="p-3 border-t border-sidebar-border">
            <button
              onClick={onSignOut}
              title={sidebarCollapsed ? 'Sair' : undefined}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-destructive hover:bg-destructive/10',
                sidebarCollapsed && 'lg:justify-center lg:gap-0 lg:px-0'
              )}
            >
              <LogOut size={18} />
              <span className={cn(sidebarCollapsed && 'lg:hidden')}>Sair</span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  return (
    <div className="mt-4 mb-1">
      <span className={cn('flex items-center gap-2 text-[11px] font-extrabold text-primary uppercase tracking-[0.18em] px-3', collapsed && 'lg:hidden')}>
        <span className="h-3.5 w-1 rounded-full bg-primary" />
        {children}
      </span>
      {collapsed && <div className="hidden lg:block mx-2 mt-1 border-t border-sidebar-border/60" />}
    </div>
  );
};

const NavGroup = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const [open, setOpen] = useState(true);
  if (collapsed) {
    return (
      <div className="mt-3">
        <div className="hidden lg:block mx-2 mb-1 border-t border-sidebar-border/60" />
        <div className="space-y-1">{children}</div>
      </div>
    );
  }
  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 mb-0.5 rounded-md text-[11px] font-extrabold text-primary uppercase tracking-[0.18em] hover:bg-primary/10 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="h-3.5 w-1 rounded-full bg-primary" />
          {title}
        </span>
        <ChevronDown size={14} className={cn('transition-transform text-primary/70', !open && '-rotate-90')} />
      </button>
      {open && <div className="mt-1 space-y-1">{children}</div>}
    </div>
  );
};

interface TrocarLojaProps {
  lojasDisponiveis?: ColaboradorLoja[];
  colaboradorLojaId?: string | null;
  onSwitchLoja?: (lojaId: string) => void;
  setSidebarOpen: (open: boolean) => void;
}

const TrocarLoja = ({ lojasDisponiveis, colaboradorLojaId, onSwitchLoja, setSidebarOpen }: TrocarLojaProps) => {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  if (!lojasDisponiveis || lojasDisponiveis.length <= 1) return null;
  return (
    <div className="mt-4 mb-2">
      <span className={cn('text-xs text-sidebar-foreground uppercase tracking-wider px-3', collapsed && 'lg:hidden')}>Trocar Loja</span>
      <div className="mt-1 space-y-0.5 px-1">
        {lojasDisponiveis.map((loja) => (
          <button
            key={loja.lojaId}
            onClick={() => { onSwitchLoja?.(loja.lojaId); setSidebarOpen(false); }}
            title={collapsed ? (LOJAS[loja.lojaId as keyof typeof LOJAS] || loja.lojaId) : undefined}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200',
              collapsed && 'lg:justify-center lg:gap-0 lg:px-0',
              loja.lojaId === colaboradorLojaId
                ? 'gradient-primary text-primary-foreground shadow-glow'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:translate-x-1'
            )}
          >
            <ArrowLeftRight size={16} />
            <span className={cn(collapsed && 'lg:hidden')}>{LOJAS[loja.lojaId as keyof typeof LOJAS] || loja.lojaId}</span>
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

const NavItem = ({ icon, label, active, onClick }: NavItemProps) => {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  return (
    <button
      onClick={onClick}
      title={collapsed && typeof label === 'string' ? label : undefined}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-sidebar-accent',
        collapsed ? 'lg:justify-center lg:gap-0 lg:px-0' : 'hover:translate-x-1',
        active ? 'gradient-primary text-primary-foreground shadow-glow' : 'text-sidebar-foreground hover:text-sidebar-accent-foreground'
      )}
    >
      {icon}
      <span className={cn('truncate', collapsed && 'lg:hidden')}>{label}</span>
    </button>
  );
};
