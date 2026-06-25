import { Dashboard } from '@/components/dashboard/Dashboard';

interface VendasPageProps {
  colaboradorLojaId?: string | null;
}

// "Vendas" = o Dashboard na variante de abas (Por Loja · Equipe · Colaborador · Diárias).
// Reusa toda a lógica/dados do Dashboard; só muda o render (prop variant).
export const VendasPage = ({ colaboradorLojaId }: VendasPageProps = {}) => (
  <Dashboard colaboradorLojaId={colaboradorLojaId} variant="vendas" />
);
