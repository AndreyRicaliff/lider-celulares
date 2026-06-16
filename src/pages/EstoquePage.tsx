import { useState, useMemo } from 'react';
import { useAppStore } from '@/store/appStore';
import { useEstoque, useSyncEstoque } from '@/hooks/useEstoque';
import { LOJAS } from '@/lib/constants';
import { 
  Package, 
  AlertTriangle, 
  Clock, 
  Search, 
  ArrowUpDown,
  Filter,
  RefreshCw,
  TrendingDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LoadingSpinner } from '@/components/ui/loading';

export const EstoquePage = () => {
  const { selectedLoja } = useAppStore();
  const lojaId = selectedLoja || 'soledade';
  const [searchTerm, setSearchTerm] = useState('');

  const { data: products, isLoading, error } = useEstoque(lojaId);
  const syncEstoque = useSyncEstoque(lojaId);
  const isFetching = syncEstoque.isPending;

  const idleProducts = useMemo(() => {
    if (!products) return [];
    const now = new Date();
    return products.filter(p => {
      const entryDate = p.data_entrada ? parseISO(p.data_entrada) : now;
      const daysSinceEntry = differenceInDays(now, entryDate);
      // Idle for more than 30 days and has stock
      return daysSinceEntry > 30 && p.quantidade > 0;
    }).sort((a, b) => {
      const dateA = a.data_entrada ? parseISO(a.data_entrada).getTime() : 0;
      const dateB = b.data_entrada ? parseISO(b.data_entrada).getTime() : 0;
      return dateA - dateB; // Oldest first
    });
  }, [products]);

  const lowStockProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(p => p.quantidade > 0 && p.quantidade <= 2)
      .sort((a, b) => a.quantidade - b.quantidade);
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(p => 
      p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [products, searchTerm]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-muted-foreground animate-pulse">Carregando estoque...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="py-10 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
          <h3 className="text-lg font-medium text-destructive mb-2">Erro ao carregar estoque</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {error instanceof Error ? error.message : 'Não foi possível conectar à API do Tenfront. Verifique as credenciais nas configurações.'}
          </p>
          <Button onClick={() => syncEstoque.mutate()} variant="outline" className="border-destructive/20 text-destructive hover:bg-destructive/10">
            Tentar Novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-light flex items-center gap-2">
            <Package size={24} className="text-primary" />
            Estoque Inteligente - {LOJAS[lojaId as keyof typeof LOJAS]}
          </h1>
          <p className="text-muted-foreground">Análise de giro e alertas de reposição</p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => syncEstoque.mutate()} 
          disabled={isFetching}
          className="shadow-sm"
        >
          <RefreshCw size={16} className={isFetching ? "mr-2 animate-spin" : "mr-2"} />
          {isFetching ? 'Atualizando...' : 'Atualizar Dados'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Alerta de Produtos Parados */}
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <CardTitle className="text-amber-600 flex items-center gap-2 text-lg">
                <Clock size={20} />
                Produtos Parados (+30 dias)
              </CardTitle>
              <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">
                {idleProducts.length} itens
              </Badge>
            </div>
            <CardDescription>Produtos sem movimentação desde a entrada</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {idleProducts.length > 0 ? (
                idleProducts.map(p => (
                  <div key={p.id} className="flex justify-between items-center p-3 rounded-lg bg-background/50 border border-amber-500/10 hover:border-amber-500/30 transition-colors">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{p.nome}</span>
                      <span className="text-xs text-muted-foreground">
                        Entrada: {p.data_entrada ? format(parseISO(p.data_entrada), "dd/MM/yyyy", { locale: ptBR }) : 'N/A'} 
                        ({differenceInDays(new Date(), p.data_entrada ? parseISO(p.data_entrada) : new Date())} dias)
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-amber-600">{p.quantidade} un</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center py-10 text-muted-foreground text-sm italic">Nenhum produto parado há mais de 30 dias.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Alerta de Produtos Zerando */}
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <CardTitle className="text-destructive flex items-center gap-2 text-lg">
                <TrendingDown size={20} />
                Reposição Urgente
              </CardTitle>
              <Badge variant="destructive" className="animate-pulse">
                {lowStockProducts.length} itens
              </Badge>
            </div>
            <CardDescription>Produtos de alto giro com estoque crítico</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {lowStockProducts.length > 0 ? (
                lowStockProducts.map(p => (
                  <div key={p.id} className="flex justify-between items-center p-3 rounded-lg bg-background/50 border border-destructive/10 hover:border-destructive/30 transition-colors">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{p.nome}</span>
                      <span className="text-xs text-muted-foreground">Estoque abaixo do recomendado</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-destructive">{p.quantidade} un</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center py-10 text-muted-foreground text-sm italic">Estoque equilibrado no momento.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela Completa */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle>Estoque Geral</CardTitle>
              <CardDescription>Todos os produtos identificados</CardDescription>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                className="pl-9 bg-muted/50 border-none focus-visible:ring-1"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-sidebar-border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[100px]">ID/IMEI</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-center">Quantidade</TableHead>
                  <TableHead>Última Entrada</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length > 0 ? (
                  filteredProducts.map((p) => {
                    const daysIdle = p.data_entrada ? differenceInDays(new Date(), parseISO(p.data_entrada)) : 0;
                    const isIdle = daysIdle > 30;
                    const isLow = p.quantidade > 0 && p.quantidade <= 2;

                    return (
                      <TableRow key={p.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-mono text-xs text-muted-foreground">{p.id.substring(0, 10)}...</TableCell>
                        <TableCell className="font-medium">{p.nome}</TableCell>
                        <TableCell className="text-center">
                          <span className={isLow ? "text-destructive font-bold" : ""}>{p.quantidade}</span>
                        </TableCell>
                        <TableCell className="text-xs">
                          {p.data_entrada ? format(parseISO(p.data_entrada), "dd/MM/yyyy") : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {isIdle && <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">PARADO</Badge>}
                            {isLow && <Badge variant="destructive" className="text-[10px]">BAIXO</Badge>}
                            {!isIdle && !isLow && <Badge variant="secondary" className="text-[10px]">OK</Badge>}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      Nenhum produto encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
