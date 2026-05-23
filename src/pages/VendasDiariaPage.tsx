import { useMemo, useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { useVendasDiarias } from '@/hooks/useVendasDiarias';
import { LOJAS } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const STANDARD_CATEGORIES = [
  'GERAL',
  'BONIFICADO LC',
  'SUPER BONIFICADO',
  'ANATEL',
  'CASES',
  'ACESSÓRIOS',
  'PELÍCULA',
  'GARANTIA ESTENDIDA',
  'PROTEÇÃO LÍDER',
  'ASSISTÊNCIA TÉCNICA',
] as const;

const SHORT_LABELS: Record<string, string> = {
  'GERAL': 'Geral',
  'BONIFICADO LC': 'Bonif. LC',
  'SUPER BONIFICADO': 'Super Bonif.',
  'ANATEL': 'Anatel',
  'CASES': 'Cases',
  'ACESSÓRIOS': 'Acessórios',
  'PELÍCULA': 'Película',
  'GARANTIA ESTENDIDA': 'Gar. Estend.',
  'PROTEÇÃO LÍDER': 'Proteção',
  'ASSISTÊNCIA TÉCNICA': 'Assist. Téc.',
};
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarDays, TrendingUp, Users, Package, CalendarIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export const VendasDiariaPage = () => {
  const { selectedLoja, selectedMes } = useAppStore();
  const { data: vendasDiarias, isLoading } = useVendasDiarias(selectedLoja || undefined, selectedMes, { useSharedBase: false });
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);

  const lojaNome = selectedLoja ? LOJAS[selectedLoja as keyof typeof LOJAS] : '';

  // Parse mes for calendar bounds
  const mesBounds = useMemo(() => {
    if (!selectedMes) return { start: undefined, end: undefined };
    const [ano, mesNum] = selectedMes.split('-').map(Number);
    const start = new Date(ano, mesNum - 1, 1);
    const end = new Date(ano, mesNum, 0); // last day of month
    return { start, end };
  }, [selectedMes]);


  // Filter by date range — STRICT FILTERING
  // ⚠️ CRITICAL: This filter MUST respect the exact date range selected.
  // If dataInicio or dataFim are not set, ALL data from the month is shown.
  // This is intentional: clearing date filters shows the full month.
  const filteredVendas = useMemo(() => {
    if (!vendasDiarias) return [];
    let filtered = vendasDiarias;

    if (dataInicio) {
      const inicioStr = format(dataInicio, 'yyyy-MM-dd');
      // INCLUDE: data >= dataInicio
      filtered = filtered.filter(v => v.data >= inicioStr);
    }
    if (dataFim) {
      const fimStr = format(dataFim, 'yyyy-MM-dd');
      // INCLUDE: data <= dataFim (inclusive of end date)
      filtered = filtered.filter(v => v.data <= fimStr);
    }

    // Validate: ensure no data outside the range if filters are active
    if (dataInicio || dataFim) {
      const firstDate = filtered.length > 0 ? filtered[0].data : null;
      const lastDate = filtered.length > 0 ? filtered[filtered.length - 1].data : null;
      const inicioStr = dataInicio ? format(dataInicio, 'yyyy-MM-dd') : null;
      const fimStr = dataFim ? format(dataFim, 'yyyy-MM-dd') : null;

      if (firstDate && inicioStr && firstDate < inicioStr) {
        console.error('[CRITICAL] VendasDiariaPage: Data before start date found:', firstDate, inicioStr);
      }
      if (lastDate && fimStr && lastDate > fimStr) {
        console.error('[CRITICAL] VendasDiariaPage: Data after end date found:', lastDate, fimStr);
      }
    }

    return filtered;
  }, [vendasDiarias, dataInicio, dataFim]);

  // Filtered dates for mini cards
  const filteredDates = useMemo(() => {
    if (!filteredVendas) return [];
    return [...new Set(filteredVendas.map(v => v.data))].sort();
  }, [filteredVendas]);


  // Group by vendor with all explicit categories
  const vendorSummary = useMemo(() => {
    const map = new Map<string, {
      vendedor_nome: string;
      valor_total: number;
      categories: Record<string, number>;
      dias: number;
    }>();

    filteredVendas.forEach(v => {
      const detalhes = (v as any).detalhes as Record<string, number> | undefined;
      const existing = map.get(v.vendedor_nome);
      if (existing) {
        existing.valor_total += Number(v.valor_total);
        existing.dias += 1;
        STANDARD_CATEGORIES.forEach(cat => {
          existing.categories[cat] += Number(detalhes?.[cat] || 0);
        });
      } else {
        const categories: Record<string, number> = {};
        STANDARD_CATEGORIES.forEach(cat => {
          categories[cat] = Number(detalhes?.[cat] || 0);
        });
        map.set(v.vendedor_nome, {
          vendedor_nome: v.vendedor_nome,
          valor_total: Number(v.valor_total),
          categories,
          dias: 1,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.valor_total - a.valor_total);
  }, [filteredVendas]);

  // Totals
  const totals = useMemo(() => {
    const categoryTotals: Record<string, number> = {};
    STANDARD_CATEGORIES.forEach(cat => { categoryTotals[cat] = 0; });
    let valor_total = 0;
    vendorSummary.forEach(v => {
      valor_total += v.valor_total;
      STANDARD_CATEGORIES.forEach(cat => {
        categoryTotals[cat] += v.categories[cat];
      });
    });
    return { valor_total, categories: categoryTotals };
  }, [vendorSummary]);

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  const limparFiltros = () => {
    setDataInicio(undefined);
    setDataFim(undefined);
  };

  const temFiltroAtivo = dataInicio || dataFim;

  const periodoLabel = useMemo(() => {
    if (dataInicio && dataFim) {
      return `${format(dataInicio, 'dd/MM')} até ${format(dataFim, 'dd/MM')}`;
    }
    if (dataInicio) return `A partir de ${format(dataInicio, 'dd/MM')}`;
    if (dataFim) return `Até ${format(dataFim, 'dd/MM')}`;
    return 'Todos os dias';
  }, [dataInicio, dataFim]);

  if (!selectedLoja) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Selecione uma loja no menu lateral.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="text-primary" size={28} />
            Vendas Diárias — {lojaNome}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Acompanhamento detalhado das vendas por dia • {selectedMes}
          </p>
        </div>

        {/* Date Range Filters */}
        <Card className="glass-card border-border/50">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Período:</span>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[160px] justify-start text-left font-normal text-sm",
                      !dataInicio && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataInicio ? format(dataInicio, 'dd/MM/yyyy') : 'Data início'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataInicio}
                    onSelect={setDataInicio}
                    disabled={(date) => {
                      if (mesBounds.start && date < mesBounds.start) return true;
                      if (mesBounds.end && date > mesBounds.end) return true;
                      if (dataFim && date > dataFim) return true;
                      return false;
                    }}
                    defaultMonth={mesBounds.start}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>

              <span className="text-sm text-muted-foreground">até</span>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[160px] justify-start text-left font-normal text-sm",
                      !dataFim && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataFim ? format(dataFim, 'dd/MM/yyyy') : 'Data fim'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataFim}
                    onSelect={setDataFim}
                    disabled={(date) => {
                      if (mesBounds.start && date < mesBounds.start) return true;
                      if (mesBounds.end && date > mesBounds.end) return true;
                      if (dataInicio && date < dataInicio) return true;
                      return false;
                    }}
                    defaultMonth={mesBounds.start}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>

              {temFiltroAtivo && (
                <Button variant="ghost" size="sm" onClick={limparFiltros} className="text-xs">
                  Limpar filtros
                </Button>
              )}

              {temFiltroAtivo && (
                <Badge variant="secondary" className="text-xs">
                  {periodoLabel}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-card border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp size={14} />
              Total Geral
            </div>
            <p className="text-xl font-bold text-foreground">{formatCurrency(totals.valor_total)}</p>
          </CardContent>
        </Card>
        {['BONIFICADO LC', 'SUPER BONIFICADO', 'ANATEL'].map(cat => (
          <Card key={cat} className="glass-card border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <Package size={14} />
                {SHORT_LABELS[cat]}
              </div>
              <p className="text-xl font-bold text-foreground">{formatCurrency(totals.categories[cat])}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Vendor Table */}
      <Card className="glass-card border-border/50">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">
                Resumo por Vendedor — {periodoLabel}
              </CardTitle>
              {!temFiltroAtivo && (
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  ⚠️ <strong>Exibindo todos os dias do mês</strong> ({selectedMes}). Use os filtros acima para um período específico.
                </p>
              )}
              {temFiltroAtivo && (
                <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                  ✓ Filtro ativo: {periodoLabel} • Apenas dados dentro desse período
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Carregando...</p>
          ) : vendorSummary.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhuma venda diária encontrada para este período.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10">Vendedor</TableHead>
                    {STANDARD_CATEGORIES.map(cat => (
                      <TableHead key={cat} className="text-right text-xs whitespace-nowrap">{SHORT_LABELS[cat]}</TableHead>
                    ))}
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center">Dias</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendorSummary.map((v) => (
                    <TableRow key={v.vendedor_nome}>
                      <TableCell className="font-medium sticky left-0 bg-background z-10">{v.vendedor_nome}</TableCell>
                      {STANDARD_CATEGORIES.map(cat => (
                        <TableCell key={cat} className="text-right text-sm">{formatCurrency(v.categories[cat])}</TableCell>
                      ))}
                      <TableCell className="text-right font-bold text-primary">
                        {formatCurrency(v.valor_total)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{v.dias}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Total row */}
                  <TableRow className="border-t-2 border-primary/30 font-bold">
                    <TableCell className="sticky left-0 bg-background z-10">TOTAL</TableCell>
                    {STANDARD_CATEGORIES.map(cat => (
                      <TableCell key={cat} className="text-right">{formatCurrency(totals.categories[cat])}</TableCell>
                    ))}
                    <TableCell className="text-right text-primary">{formatCurrency(totals.valor_total)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mini cards de volume diário */}
      {filteredDates.length > 0 && (
        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Volume por Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {filteredDates.map(d => {
                const dayTotal = filteredVendas
                  .filter(v => v.data === d)
                  .reduce((sum, v) => sum + Number(v.valor_total), 0);
                return (
                  <div
                    key={d}
                    className="flex flex-col items-center px-4 py-2 rounded-lg border bg-card border-border text-sm"
                  >
                    <span className="font-bold">{formatDate(d).slice(0, 5)}</span>
                    <span className="text-xs text-muted-foreground">{formatCurrency(dayTotal)}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
};
