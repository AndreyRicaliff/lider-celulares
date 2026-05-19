import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { MainLayout } from "@/components/layout/MainLayout";
import { AuthPage } from "@/pages/AuthPage";
import { useAppStore } from "@/store/appStore";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/loading";
import { ErrorBoundary } from "@/components/ui/error-boundary";

const queryClient = new QueryClient();

const AppContent = () => {
  const { currentView } = useAppStore();
  const { user, loading, isAdmin, isSupervisao, isColaborador, isGerente, colaboradorLojaId, lojasDisponiveis, switchLoja, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen gradient-dark flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage onLogin={() => {}} />;
  }

  // Supervisão view - access to everything except configuracoes and colaboradores
  if (isSupervisao && !isAdmin) {
    return <MainLayout isSupervisao={true} onSignOut={signOut} />;
  }

  // Gerente view - expanded access to their store
  if (isGerente && !isAdmin) {
    return <MainLayout isColaborador={true} isGerente={true} colaboradorLojaId={colaboradorLojaId} lojasDisponiveis={lojasDisponiveis} onSwitchLoja={switchLoja} onSignOut={signOut} />;
  }

  // Regular colaborador view - dashboard with limited menu + personal report
  if (isColaborador && !isAdmin) {
    return <MainLayout isColaborador={true} colaboradorLojaId={colaboradorLojaId} lojasDisponiveis={lojasDisponiveis} onSwitchLoja={switchLoja} onSignOut={signOut} />;
  }

  // Admin view - full access
  return <MainLayout onSignOut={signOut} />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" storageKey="app-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
