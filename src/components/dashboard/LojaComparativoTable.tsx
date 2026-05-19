import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LOJAS, LOJAS_IDS, isIgnoredColumn } from '@/lib/constants';
import { formatCurrency, getDaysInMonth } from '@/lib/formatters';
import { VendaDiaria } from '@/types/database';
import { cn } from '@/lib/utils';
import { isLojaCampinaNatal, isLojaSoledadeMonteiro } from '@/lib/lojaRules';
import { ConfiguracaoData } from '@/hooks/useConfiguracoes';
import { getDiasUteisNoMes, getDiasUteisDecorridos, getDiasDecorridosNoMes } from '@/lib/dateUtils';
import { computeValForMeta } from '@/lib/metaUtils';
import { supabase } from '@/integrations/supabase/client';

interface LojaComparativoTableProps {
  selectedMes: string;
  allConfigs?: Record<string, ConfiguracaoData>;
  vendasMensais: Array<{
    loja_id: string;
    detalhes: Record<string, number>;
    valor_total?: number;
    [key: string]: any;
  }>;
  vendasDiarias: VendaDiaria[];
}

function computeFaturamento(vendas: Array<{ detalhes: Record<string, number>; [k: string]: any }>): number {
  let total = 0;
  for (const venda of vendas) {
    const realSjuros = venda.detalhes?.['VALOR REAL (S/ JUROS)'];
    if (typeof realSjuros === 'number' && realSjuros > 0) {
      total += realSjuros;
    } else {
      for (const [key, val] of Object.entries(venda.detalhes || {})) {
        if (isIgnoredColumn(key) || key.startsWith('_')) continue;
        if (typeof val === 'number') total += val;
      }
    }
  }
  return total;
}

function prevMonth(mes: string): string {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const LojaComparativoTable = ({
  selectedMes,
  allConfigs,
  vendasMensais,
  vendasDiarias,
}: LojaComparativoTableProps) => {
  const prevMes = prevMonth(selectedMes);

  const { data: vendasPrevMes } = useQuery({
    queryKey: ['vendas-prev-mes-comparativo', prevMes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendas')
        .select('loja_id, detalhes')
        .eq('mes', prevMes);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 15,
  });

  const prevFaturamentoPorLoja = useMemo(() => {
    if (!vendasPrevMes) return {} as Record<string, number>;
    const result: Record<string, number> = {};
    for (const lojaId of LOJAS_IDS) {
      result[lojaId] = computeFaturamento(
        vendasPrevMes.filter(v => v.loja_id === lojaId) as any
      );
    }
    return result;
  }, [vendasPrevMes]);

  const today = (() => {
    const now = new Date();
    const utcDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
    return utcDate.toISOString().split('T')[0];
  })();

  const isCurrentMonth = today.startsWith(selectedMes);

  const lojaData = useMemo(() => {
    return LOJAS_IDS.map(lojaId => {
      const config = allConfigs?.[lojaId];
      const diasFechamento = config?.diasFechamento || [];

      const vendas = vendasMensais.filter(v => v.loja_id === lojaId);
      const faturamento = computeFaturamento(vendas as any);

      let metaOuro = 0;
      if (isLojaSoledadeMonteiro(lojaId)) {
        metaOuro = config?.numericConfig?.loja_meta_ouro || 65000;
      } else if (isLojaCampinaNatal(lojaId)) {
        metaOuro = config?.numericConfig?.gerente_meta_prata || 0;
      } else {
        metaOuro = config?.numericConfig?.loja_meta_ouro || 0;
      }

      const pctMeta = metaOuro > 0 ? (faturamento / metaOuro) * 100 : 0;

      let projection: { projected: number | null; pctProjected: number | null } | null = null;

      if (isCurrentMonth) {
        const diasTotais = isLojaSoledadeMonteiro(lojaId)
          ? getDiasUteisNoMes(selectedMes, diasFechamento)
          : getDaysInMonth(selectedMes) - diasFechamento.filter(d => d.startsWith(selectedMes)).length;

        const totalSoFarVD = vendasDiarias
          .filter(v => v.loja_id === lojaId)
          .reduce((sum, v) => sum + computeValForMeta(v), 0);

        const diasDecorridosComHoje = isLojaSoledadeMonteiro(lojaId)
          ? getDiasUteisDecorridos(selectedMes, diasFechamento, true, today)
          : getDiasDecorridosNoMes(selectedMes, today, diasFechamento, true);

        const projected = diasDecorridosComHoje > 0
          ? (totalSoFarVD / diasDecorridosComHoje) * diasTotais
          : null;

        const pctProjected = metaOuro > 0 && projected !== null ? (projected / metaOuro) * 100 : null;

        projection = { projected, pctProjected };
      }

      const prevFat = prevFaturamentoPorLoja[lojaId] ?? null;
      const delta = prevFat !== null && prevFat > 0
        ? faturamento - prevFat
        : null;
      const deltaPct = delta !== null && prevFat !== null && prevFat > 0
        ? (delta / prevFat) * 100
        : null;

      return {
        lojaId,
        lojaName: LOJAS[lojaId as keyof typeof LOJAS],
        faturamento,
        pctMeta,
        metaOuro,
        projection,
        delta,
        deltaPct,
      };
    });
  }, [vendasMensais, selectedMes, allConfigs, vendasDiarias, today, isCurrentMonth, prevFaturamentoPorLoja]);

  if (vendasMensais.length === 0) return null;

  const getStatusBadge = (pctMeta: number, pctProjected: number | null) => {
    const percentToCheck = isCurrentMonth && pctProjected !== null ? pctProjected : pctMeta;

    if (percentToCheck >= 100) {
      return <Badge className="bg-green-900/30 text-green-400 border-green-700">Meta Ouro ✓</Badge>;
    }
    if (percentToCheck >= 80) {
      return <Badge className="bg-amber-900/30 text-amber-400 border-amber-700">No Ritmo</Badge>;
    }
    return <Badge className="bg-red-900/30 text-red-400 border-red-700">Abaixo</Badge>;
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 100) return 'bg-green-600';
    if (pct >= 80) return 'bg-amber-600';
    return 'bg-red-600';
  };

  return (
    <Card className="bg-card/40 border-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Comparativo de Lojas</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-3 px-3 font-semibold text-muted-foreground">Loja</th>
                <th className="text-right py-3 px-3 font-semibold text-muted-foreground">Faturamento</th>
                <th className="text-center py-3 px-3 font-semibold text-muted-foreground">Δ Mês Ant.</th>
                <th className="text-center py-3 px-3 font-semibold text-muted-foreground">% Meta Ouro</th>
                <th className="text-center py-3 px-3 font-semibold text-muted-foreground">Projeção</th>
                <th className="text-center py-3 px-3 font-semibold text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {lojaData.map(loja => (
                <tr key={loja.lojaId} className="border-b border-border/30 hover:bg-surface/40 transition">
                  <td className="py-4 px-3 font-medium">{loja.lojaName}</td>
                  <td className="text-right py-4 px-3 text-foreground">{formatCurrency(loja.faturamento)}</td>
                  <td className="py-4 px-3 text-center">
                    {loja.delta !== null ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className={cn(
                          'flex items-center gap-0.5 text-xs font-semibold',
                          loja.delta >= 0 ? 'text-green-400' : 'text-red-400'
                        )}>
                          {loja.delta >= 0
                            ? <TrendingUp size={12} />
                            : <TrendingDown size={12} />}
                          {loja.delta >= 0 ? '+' : ''}{formatCurrency(loja.delta)}
                        </span>
                        {loja.deltaPct !== null && (
                          <span className={cn(
                            'text-[10px]',
                            loja.delta >= 0 ? 'text-green-400/70' : 'text-red-400/70'
                          )}>
                            {loja.delta >= 0 ? '+' : ''}{loja.deltaPct.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    ) : (
                      <Minus size={14} className="mx-auto text-muted-foreground/40" />
                    )}
                  </td>
                  <td className="py-4 px-3">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="w-24 h-2 bg-surface/60 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full transition-all', getProgressColor(loja.pctMeta))}
                          style={{ width: `${Math.min(loja.pctMeta, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {loja.pctMeta.toFixed(0)}% ({formatCurrency(loja.metaOuro)})
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-3 text-center">
                    {loja.projection ? (
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-foreground font-medium">{formatCurrency(loja.projection.projected!)}</span>
                        {loja.projection.pctProjected !== null && (
                          <span className={cn(
                            'text-xs font-semibold',
                            loja.projection.pctProjected >= 100 ? 'text-green-400' :
                            loja.projection.pctProjected >= 80 ? 'text-amber-400' :
                            'text-red-400'
                          )}>
                            {loja.projection.pctProjected.toFixed(0)}% M.Ouro
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-4 px-3 text-center">
                    {getStatusBadge(loja.pctMeta, loja.projection?.pctProjected ?? null)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden space-y-3">
          {lojaData.map(loja => (
            <div key={loja.lojaId} className="border border-border/30 rounded-lg p-4 bg-surface/20">
              <div className="font-semibold text-base mb-3">{loja.lojaName}</div>

              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Faturamento</span>
                  <div className="text-right">
                    <span className="font-medium">{formatCurrency(loja.faturamento)}</span>
                    {loja.delta !== null && (
                      <span className={cn(
                        'ml-2 text-xs font-semibold',
                        loja.delta >= 0 ? 'text-green-400' : 'text-red-400'
                      )}>
                        {loja.delta >= 0 ? '▲' : '▼'}{loja.deltaPct !== null ? ` ${Math.abs(loja.deltaPct).toFixed(0)}%` : ''}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-muted-foreground">% Meta Ouro</span>
                    <span className="font-medium">{loja.pctMeta.toFixed(0)}%</span>
                  </div>
                  <div className="w-full h-2 bg-surface/60 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full transition-all', getProgressColor(loja.pctMeta))}
                      style={{ width: `${Math.min(loja.pctMeta, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{formatCurrency(loja.metaOuro)}</span>
                </div>

                {loja.projection && (
                  <div>
                    <div className="text-muted-foreground mb-1">Projeção</div>
                    <div className="font-medium">{formatCurrency(loja.projection.projected!)}</div>
                    {loja.projection.pctProjected !== null && (
                      <span className={cn(
                        'text-xs font-semibold',
                        loja.projection.pctProjected >= 100 ? 'text-green-400' :
                        loja.projection.pctProjected >= 80 ? 'text-amber-400' :
                        'text-red-400'
                      )}>
                        {loja.projection.pctProjected.toFixed(0)}% M.Ouro
                      </span>
                    )}
                  </div>
                )}

                <div className="pt-1">
                  {getStatusBadge(loja.pctMeta, loja.projection?.pctProjected ?? null)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
