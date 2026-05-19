'use client';

import { useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LOJAS, LOJAS_IDS } from '@/lib/constants';
import { formatCurrency, getDaysInMonth } from '@/lib/formatters';
import { VendaDiaria } from '@/types/database';
import { cn } from '@/lib/utils';
import { isLojaCampinaNatal, isLojaSoledadeMonteiro } from '@/lib/lojaRules';
import { ConfiguracaoData } from '@/hooks/useConfiguracoes';
import { getDiasUteisNoMes, getDiasUteisDecorridos, getDiasDecorridosNoMes } from '@/lib/dateUtils';

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

function computeValForMeta(v: VendaDiaria): number {
  const d = (v.detalhes || {}) as Record<string, number>;
  const smVal = (Number(d['BONIFICADO LC']) || 0) + (Number(d['SUPER BONIFICADO']) || 0) + (Number(d['ANATEL']) || 0);
  const accVal = (Number(d['ACESSÓRIOS']) || 0) + (Number(d['CASES']) || 0);
  const pelVal = Number(d['PELÍCULA']) || 0;
  const svcVal = (Number(d['PROTEÇÃO LÍDER']) || 0) + (Number(d['GARANTIA ESTENDIDA']) || 0);
  const atVal = Number(d['ASSISTÊNCIA TÉCNICA']) || 0;
  const gerVal = Number(d['GERAL']) || 0;

  if (v.loja_id === 'soledade') return smVal + accVal + pelVal + atVal + gerVal;
  if (v.loja_id === 'monteiro') return smVal + accVal + pelVal + svcVal + atVal + gerVal;
  if (isLojaCampinaNatal(v.loja_id)) return smVal + svcVal;
  return (Number(d['VALOR REAL (S/ JUROS)']) || 0) || (smVal + accVal + pelVal + atVal + gerVal);
}

export const LojaComparativoTable = ({
  selectedMes,
  allConfigs,
  vendasMensais,
  vendasDiarias,
}: LojaComparativoTableProps) => {
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
      let faturamento = 0;

      for (const venda of vendas) {
        const realSjuros = venda.detalhes?.['VALOR REAL (S/ JUROS)'];
        if (typeof realSjuros === 'number' && realSjuros > 0) {
          faturamento += realSjuros;
        } else {
          for (const [key, val] of Object.entries(venda.detalhes || {})) {
            if (key.startsWith('_') || ['TOTAL', 'VENDA DIÁRIA', 'VENDA DIARIA'].includes(key)) continue;
            if (typeof val === 'number') faturamento += val;
          }
        }
      }

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

      return {
        lojaId,
        lojaName: LOJAS[lojaId as keyof typeof LOJAS],
        faturamento,
        pctMeta,
        metaOuro,
        projection,
      };
    });
  }, [vendasMensais, selectedMes, allConfigs, vendasDiarias, today, isCurrentMonth]);

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
                  <span className="font-medium">{formatCurrency(loja.faturamento)}</span>
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
