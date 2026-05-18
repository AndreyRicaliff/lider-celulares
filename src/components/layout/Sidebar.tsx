import { useState } from 'react';
import { cn } from '@/lib/utils';
import { LOJAS, LOJAS_IDS, type LojaId } from '@/lib/constants';
import { useAppStore } from '@/store/appStore';
import { ColaboradorLoja } from '@/hooks/useAuth';
import { 
  Home, 
  Users, 
  ChevronDown, 
  Upload, 
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
  FileSearch,
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
  const { 
    currentView, 
    setCurrentView, 
    selectedLoja, 
    setSelectedLoja,
    sidebarOpen,
    setSidebarOpen
  } = useAppStore();
  
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  const toggleMenu = (lojaId: string) => {
    setOpenMenus(prev => {
      // Se o menu clicado já está aberto, fecha-o
      if (prev[lojaId]) {
        return { ...prev, [lojaId]: false };
      }
      // Caso contrário, fecha todos e abre apenas o clicado
      const newState: Record<string, boolean> = {};
      LOJAS_IDS.forEach(id => {
        newState[id] = id === lojaId;
      });
      return newState;
    });
  };

  const handleNavigation = (view: typeof currentView, loja?: string) => {
    setCurrentView(view);
    if (loja) {
      setSelectedLoja(loja);
    }
    setSidebarOpen(false);
  };

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
          <p className="text-xs text-sidebar-foreground text-center mt-2">
            Sistema de Comissões
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {/* Dashboard */}
          <NavItem
            icon={<Home size={18} />}
            label="Dashboard"
            active={currentView === 'dashboard'}
            onClick={() => handleNavigation('dashboard')}
          />


          {/* Colaborador - show Meu Relatório */}
          {isColaborador && !isGerente && (
            <>
              {/* Multi-store switcher */}
              {lojasDisponiveis && lojasDisponiveis.length > 1 && (
                <div className="mt-4 mb-2">
                  <span className="text-xs text-sidebar-foreground uppercase tracking-wider px-3">
                    Trocar Loja
                  </span>
                  <div className="mt-1 space-y-0.5 px-1">
                    {lojasDisponiveis.map((loja) => (
                      <button
                        key={loja.lojaId}
                        onClick={() => {
                          onSwitchLoja?.(loja.lojaId);
                          setSidebarOpen(false);
                        }}
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
              )}

              <div className="mt-4 mb-2">
                <span className="text-xs text-sidebar-foreground uppercase tracking-wider px-3">
                  Minha Área
                </span>
              </div>
              <NavItem
                icon={<FileText size={18} />}
                label="Meu Relatório"
                active={currentView === 'relatorio'}
                onClick={() => handleNavigation('relatorio')}
              />
              {colaboradorLojaId && (
                <>
                  <NavItem
                    icon={<Upload size={18} />}
                    label="Produtos Vendidos"
                    active={currentView === 'vendas'}
                    onClick={() => handleNavigation('vendas', colaboradorLojaId)}
                  />
                  <NavItem
                    icon={<CalendarDays size={18} />}
                    label="Vendas Diárias"
                    active={currentView === 'vendas-diarias'}
                    onClick={() => handleNavigation('vendas-diarias', colaboradorLojaId)}
                  />
                  <NavItem
                    icon={<FileSearch size={18} />}
                    label="Auditoria Detalhada"
                    active={currentView === 'auditoria'}
                    onClick={() => handleNavigation('auditoria')}
                  />
                </>
              )}
            </>
          )}

          {/* Gerente - expanded access */}
          {isGerente && colaboradorLojaId && (
            <>
              {/* Multi-store switcher for gerente */}
              {lojasDisponiveis && lojasDisponiveis.length > 1 && (
                <div className="mt-4 mb-2">
                  <span className="text-xs text-sidebar-foreground uppercase tracking-wider px-3">
                    Trocar Loja
                  </span>
                  <div className="mt-1 space-y-0.5 px-1">
                    {lojasDisponiveis.map((loja) => (
                      <button
                        key={loja.lojaId}
                        onClick={() => {
                          onSwitchLoja?.(loja.lojaId);
                          setSidebarOpen(false);
                        }}
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
              )}
              <div className="mt-4 mb-2">
                <span className="text-xs text-sidebar-foreground uppercase tracking-wider px-3">
                  Minha Área
                </span>
              </div>
              <NavItem
                icon={<FileText size={18} />}
                label="Meu Relatório"
                active={currentView === 'relatorio'}
                onClick={() => handleNavigation('relatorio')}
              />

              <div className="mt-4 mb-2">
                <span className="text-xs text-sidebar-foreground uppercase tracking-wider px-3">
                  Minha Loja - {LOJAS[colaboradorLojaId as keyof typeof LOJAS]}
                </span>
              </div>
              <NavItem
                icon={<Upload size={18} />}
                label="Análise de Metas"
                active={currentView === 'vendas'}
                onClick={() => handleNavigation('vendas', colaboradorLojaId)}
              />
              <NavItem
                icon={<FileText size={18} />}
                label="Folha de Pagamento"
                active={currentView === 'folha'}
                onClick={() => handleNavigation('folha', colaboradorLojaId)}
              />
              <NavItem
                icon={<CalendarDays size={18} />}
                label="Vendas Diárias"
                active={currentView === 'vendas-diarias'}
                onClick={() => handleNavigation('vendas-diarias', colaboradorLojaId)}
              />
              <NavItem
                icon={<FileSearch size={18} />}
                label="Auditoria Detalhada"
                active={currentView === 'auditoria'}
                onClick={() => handleNavigation('auditoria')}
              />
              <NavItem
                icon={<BarChart3 size={18} />}
                label="Relatórios"
                active={currentView === 'relatorios'}
                onClick={() => handleNavigation('relatorios', colaboradorLojaId)}
              />
            </>
          )}

          {/* Supervisão - access to everything except configurações and colaboradores */}
          {isSupervisao && (
            <>
              {/* Lojas */}
              <div className="mt-4 mb-2">
                <span className="text-xs text-sidebar-foreground uppercase tracking-wider px-3">
                  Lojas
                </span>
              </div>
              {LOJAS_IDS.map((lojaId) => (
                <div key={lojaId}>
                  <NavItem
                    variant="loja"
                    icon={<ChevronDown size={18} className={cn(
                      'transition-transform duration-200',
                      openMenus[lojaId] && 'rotate-180'
                    )} />}
                    label={LOJAS[lojaId]}
                    active={openMenus[lojaId]}
                    onClick={() => toggleMenu(lojaId)}
                  />
                  {openMenus[lojaId] && (
                    <div className="ml-3 mt-1 space-y-0.5 animate-fade-in pl-2 border-l-2 border-primary/20 bg-primary/5 rounded-r-lg py-1.5">
                      <SubNavItem
                        icon={<Upload size={16} />}
                        label="Lançamento de Vendas"
                        active={currentView === 'vendas' && selectedLoja === lojaId}
                        onClick={() => handleNavigation('vendas', lojaId)}
                      />
                      <SubNavItem
                        icon={<CalendarDays size={16} />}
                        label="Vendas Diárias"
                        active={currentView === 'vendas-diarias' && selectedLoja === lojaId}
                        onClick={() => handleNavigation('vendas-diarias', lojaId)}
                      />
                      <SubNavItem
                        icon={<FileText size={16} />}
                        label="Folha de Pagamento"
                        active={currentView === 'folha' && selectedLoja === lojaId}
                        onClick={() => handleNavigation('folha', lojaId)}
                      />
                      <SubNavItem
                        icon={<Package size={16} />}
                        label="Estoque Inteligente"
                        active={currentView === 'estoque' && selectedLoja === lojaId}
                        onClick={() => handleNavigation('estoque', lojaId)}
                      />
                    </div>
                  )}
                </div>
              ))}

              {/* Sistema */}
              <div className="mt-4 mb-2">
                <span className="text-xs text-sidebar-foreground uppercase tracking-wider px-3">
                  Sistema
                </span>
              </div>
              <NavItem
                icon={<Briefcase size={18} />}
                label="Supervisão - Folha"
                active={currentView === 'supervisao-folha'}
                onClick={() => handleNavigation('supervisao-folha')}
              />
              <NavItem
                icon={<BarChart3 size={18} />}
                label="Relatórios"
                active={currentView === 'relatorio'}
                onClick={() => handleNavigation('relatorio')}
              />
              <NavItem
                icon={<Hash size={18} />}
                label="Relatórios Numéricos"
                active={currentView === 'relatorios-numericos'}
                onClick={() => handleNavigation('relatorios-numericos')}
              />
              <NavItem
                icon={<FileSearch size={18} />}
                label="Auditoria Detalhada"
                active={currentView === 'auditoria'}
                onClick={() => handleNavigation('auditoria')}
              />
            </>
          )}

          {/* Admin-only sections */}
          {!isColaborador && !isSupervisao && (
            <>
              {/* Gestão */}
              <div className="mt-4 mb-2">
                <span className="text-xs text-sidebar-foreground uppercase tracking-wider px-3">
                  Gestão
                </span>
              </div>
              <NavItem
                icon={<Users size={18} />}
                label="Colaboradores"
                active={currentView === 'colaboradores'}
                onClick={() => handleNavigation('colaboradores')}
              />

              {/* Lojas */}
              <div className="mt-4 mb-2">
                <span className="text-xs text-sidebar-foreground uppercase tracking-wider px-3">
                  Lojas
                </span>
              </div>
              {LOJAS_IDS.map((lojaId) => (
                <div key={lojaId}>
                  <NavItem
                    variant="loja"
                    icon={<ChevronDown size={18} className={cn(
                      'transition-transform duration-200',
                      openMenus[lojaId] && 'rotate-180'
                    )} />}
                    label={LOJAS[lojaId]}
                    active={openMenus[lojaId]}
                    onClick={() => toggleMenu(lojaId)}
                  />
                  {openMenus[lojaId] && (
                    <div className="ml-3 mt-1 space-y-0.5 animate-fade-in pl-2 border-l-2 border-primary/20 bg-primary/5 rounded-r-lg py-1.5">
                      <SubNavItem
                        icon={<Upload size={16} />}
                        label="Lançamento de Vendas"
                        active={currentView === 'vendas' && selectedLoja === lojaId}
                        onClick={() => handleNavigation('vendas', lojaId)}
                      />
                      <SubNavItem
                        icon={<CalendarDays size={16} />}
                        label="Vendas Diárias"
                        active={currentView === 'vendas-diarias' && selectedLoja === lojaId}
                        onClick={() => handleNavigation('vendas-diarias', lojaId)}
                      />
                      <SubNavItem
                        icon={<FileText size={16} />}
                        label="Folha de Pagamento"
                        active={currentView === 'folha' && selectedLoja === lojaId}
                        onClick={() => handleNavigation('folha', lojaId)}
                      />
                      <SubNavItem
                        icon={<Settings size={16} />}
                        label="Configurações"
                        active={currentView === 'configuracoes' && selectedLoja === lojaId}
                        onClick={() => handleNavigation('configuracoes', lojaId)}
                      />
                      <SubNavItem
                        icon={<Package size={16} />}
                        label="Estoque Inteligente"
                        active={currentView === 'estoque' && selectedLoja === lojaId}
                        onClick={() => handleNavigation('estoque', lojaId)}
                      />
                    </div>
                  )}
                </div>
              ))}

              {/* Sistema */}
              <div className="mt-4 mb-2">
                <span className="text-xs text-sidebar-foreground uppercase tracking-wider px-3">
                  Sistema
                </span>
              </div>
              <NavItem
                icon={<Briefcase size={18} />}
                label="Supervisão - Folha"
                active={currentView === 'supervisao-folha'}
                onClick={() => handleNavigation('supervisao-folha')}
              />
              <NavItem
                icon={<BarChart3 size={18} />}
                label="Relatórios"
                active={currentView === 'relatorio'}
                onClick={() => handleNavigation('relatorio')}
              />
              <NavItem
                icon={<Hash size={18} />}
                label="Relatórios Numéricos"
                active={currentView === 'relatorios-numericos'}
                      onClick={() => handleNavigation('relatorios-numericos')}
                    />
              <NavItem
                icon={<FileSearch size={18} />}
                label="Auditoria Detalhada"
                active={currentView === 'auditoria'}
                onClick={() => handleNavigation('auditoria')}
              />
            </>
          )}
        </nav>

        {/* Logout button */}
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

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  variant?: 'default' | 'loja';
}

const NavItem = ({ icon, label, active, onClick, variant = 'default' }: NavItemProps) => (
  <button
    onClick={onClick}
    className={cn(
      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
      'hover:bg-sidebar-accent hover:translate-x-1',
      active && variant === 'default' && 'gradient-primary text-primary-foreground shadow-glow',
      active && variant === 'loja' && 'bg-primary/10 text-primary border border-primary/20',
      !active && 'text-sidebar-foreground hover:text-sidebar-accent-foreground'
    )}
  >
    {icon}
    <span>{label}</span>
  </button>
);

const SubNavItem = ({ icon, label, active, onClick }: NavItemProps) => (
  <button
    onClick={onClick}
    className={cn(
      'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-200',
      'hover:bg-primary/10 hover:text-primary',
      active 
        ? 'bg-primary/15 text-primary font-medium shadow-sm' 
        : 'text-sidebar-foreground/80'
    )}
  >
    <span className={cn(
      'transition-colors duration-200',
      active ? 'text-primary' : 'text-sidebar-foreground/60'
    )}>
      {icon}
    </span>
    <span>{label}</span>
  </button>
);