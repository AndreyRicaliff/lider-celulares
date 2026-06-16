import { Card, CardContent } from '@/components/ui/card';
import { Store } from 'lucide-react';

// Aviso para telas que são POR LOJA quando o filtro está em "Todas as Lojas".
export const SelecioneLoja = ({ tela }: { tela?: string }) => (
  <Card className="border-primary/20 bg-primary/5 animate-fade-in">
    <CardContent className="py-16 text-center">
      <Store className="mx-auto h-12 w-12 text-primary/60 mb-4" />
      <h3 className="text-lg font-medium mb-2">Selecione uma loja</h3>
      <p className="text-muted-foreground max-w-md mx-auto">
        {tela ? `${tela} é uma visão por loja.` : 'Esta tela é por loja.'} Escolha uma loja no seletor
        no topo da página — o filtro está em <strong>Todas as Lojas</strong>.
      </p>
    </CardContent>
  </Card>
);
