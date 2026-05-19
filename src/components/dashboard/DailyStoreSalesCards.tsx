import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { LOJAS, LOJAS_IDS } from '@/lib/constants';
import { formatCurrency, getDaysInMonth } from '@/lib/formatters';
import { VendaDiaria } from '@/types/database';
import { cn } from '@/lib/utils';
import { isLojaCampinaNatal, isLojaSoledadeMonteiro } from '@/lib/lojaRules';
import { ConfiguracaoData } from '@/hooks/useConfiguracoes';
import { getDiasUteisNoMes, getDiasUteisDecorridos, getDiasDecorridosNoMes } from '@/lib/dateUtils';
import { supabase } from '@/integrations/supabase/client';

interface DailyStoreSalesCardsProps {
  vendasDiarias: VendaDiaria[];
  selectedMes: string;
  allConfigs?: Record<string, ConfiguracaoData>;
}

function computeValForMeta(v: VendaDiaria): number {
  const detalhes = (v.detalhes || {}) as Record<string, number>;
  const smVal = (Number(detalhes['BONIFICADO LC']) || 0) + (Number(detalhes['SUPER BONIFICADO']) || 0) + (Number(detalhes['ANATEL']) || 0);
  const accSemPelVal = (Number(detalhes['ACESSÓRIOS']) || 0) + (Number(detalhes['CASES']) || 0);
  const pelVal = Number(detalhes['PELÍCULA']) || 0;
  const svcVal = (Number(detalhes['PROTEÇÃO LÍDER']) || 0) + (Number(detalhes['GARANTIA ESTENDIDA']) || 0);
  const atVal = Number(detalhes['ASSISTÊNCIA TÉCNICA']) || 0;
  const catGerVal = (Number(detalhes['GERAL']) || Number((v as any).geral) || 0);
  const valorRealSjuros = Number(detalhes['VALOR REAL (S/ JUROS)']) || 0;

  if (v.loja_id === 'soledade') return smVal + accSemPelVal + pelVal + atVal + catGerVal;
  if (v.loja_id === 'monteiro') return smVal + accSemPelVal + pelVal + svcVal + atVal + catGerVal;
  if (isLojaCampinaNatal(v.loja_id)) return smVal + svcVal;
  return valorRealSjuros || (smVal + accSemPelVal + pelVal + atVal + catGerVal);
}

export const DailyStoreSalesCards = ({ vendasDiarias, selectedMes, allConfigs }: DailyStoreSalesCardsProps) => {
  const { data: brutoPorDia } = useQuery({
    queryKey: ['atendimentos-bruto-dia', selectedMes],
    queryFn: async () => {
      const { data } = await supabase
        .from('atendimentos_audit')
        .select('loja_id, data_atendimento, valor_total, status')
        .eq('mes', selectedMes)
        .not('status', 'ilike', '%cancel%');
      const grouped: Record<string, number> = {};
      for (const a of data || []) {
        const key = `${a.loja_id}|${a.data_atendimento}`;
        grouped[key] = (grouped[key] || 0) + Number(a.valor_total);
      }
      return grouped;
    },
    staleTime: 1000 * 60 * 5,
  });

  const today = (() => {
    const now = new Date();
    const utcDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
    return utcDate.toISOString().split('T')[0];
  })();

  const isCurrentMonth = today.startsWith(selectedMes);

  // Per-store: independent target date + totals + accumulated
  const storeData = useMemo(() => {
    const result: Record<string, { total: number; totalDia: number; targetDate: string | null; accumulated: number; isToday: boolean }> = {};

    LOJAS_IDS.forEach(lojaId => {
      const storeDates = [...new Set(
        vendasDiarias.filter(v => v.loja_id === lojaId).map(v => v.data)
      )].sort();

      let targetDate: string | null = null;
      let isToday = false;

      if (isCurrentMonth) {
        if (storeDates.includes(today)) {
          targetDate = today;
          isToday = true;
        } else {
          // Fall back to most recent day with data
          targetDate = storeDates[storeDates.length - 1] || null;
        }
      } else {
        targetDate = storeDates[storeDates.length - 1] || null;
      }

      const total = targetDate
        ? vendasDiarias
            .filter(v => v.loja_id === lojaId && v.data === targetDate)
            .reduce((sum, v) => sum + computeValForMeta(v), 0)
        : 0;

      const totalDia = targetDate
        ? vendasDiarias
            .filter(v => v.loja_id === lojaId && v.data === targetDate)
            .reduce((sum, v) => sum + Number(v.valor_total), 0)
        : 0;

      const accumulated = targetDate
        ? vendasDiarias
            .filter(v => v.loja_id === lojaId && v.data < targetDate!)
            .reduce((sum, v) => sum + computeValForMeta(v), 0)
        : 0;

      result[lojaId] = { total, totalDia, targetDate, accumulated, isToday };
    });

    return result;
  }, [vendasDiarias, today, isCurrentMonth]);

  const getGoalInfo = (lojaId: string, accumulated: number, targetDate: string | null) => {
    const fallback = { dailyGoal: 3800, projected: null as number | null, metaOuro: 0 };
    if (!allConfigs || !allConfigs[lojaId] || !targetDate) return fallback;

    const config = allConfigs[lojaId];
    const { numericConfig, diasFechamento } = config;
    const isSoledadeMonteiro = isLojaSoledadeMonteiro(lojaId);

    const diasTotais = isSoledadeMonteiro
      ? getDiasUteisNoMes(selectedMes, diasFechamento)
      : getDaysInMonth(selectedMes) - diasFechamento.filter(d => d.startsWith(selectedMes)).length;

    const diasDecorridos = isSoledadeMonteiro
      ? getDiasUteisDecorridos(selectedMes, diasFechamento, false, targetDate)
      : getDiasDecorridosNoMes(selectedMes, targetDate, diasFechamento, false);

    const diasDecorridosComHoje = isSoledadeMonteiro
      ? getDiasUteisDecorridos(selectedMes, diasFechamento, true, targetDate)
      : getDiasDecorridosNoMes(selectedMes, targetDate, diasFechamento, true);

    const diasRestantes = Math.max(1, diasTotais - diasDecorridos);

    let metaOuro = 0;
    if (lojaId === 'soledade') metaOuro = numericConfig.loja_meta_ouro || 65000;
    else if (lojaId === 'monteiro') metaOuro = numericConfig.loja_meta_prata || 50000;
    else if (isLojaCampinaNatal(lojaId)) metaOuro = numericConfig.gerente_meta_prata || 0;
    else metaOuro = numericConfig.loja_meta_ouro || 0;

    const remainingGoal = Math.max(0, metaOuro - accumulated);
    const dailyGoal = remainingGoal / diasRestantes;

    return { dailyGoal, metaOuro, projected: diasDecorridosComHoje > 0 ? null : null };
  };

  const getDailyGoal = (lojaId: string, accumulated: number, targetDate: string | null) =>
    getGoalInfo(lojaId, accumulated, targetDate).dailyGoal;

  const getProjection = (lojaId: string, totalSoFar: number, targetDate: string | null) => {
    if (!allConfigs || !allConfigs[lojaId] || !targetDate || !isCurrentMonth) return null;

    const { numericConfig, diasFechamento } = allConfigs[lojaId];
    const isSoledadeMonteiro = isLojaSoledadeMonteiro(lojaId);

    const diasTotais = isSoledadeMonteiro
      ? getDiasUteisNoMes(selectedMes, diasFechamento)
      : getDaysInMonth(selectedMes) - diasFechamento.filter(d => d.startsWith(selectedMes)).length;

    const diasDecorridosComHoje = isSoledadeMonteiro
      ? getDiasUteisDecorridos(selectedMes, diasFechamento, true, targetDate)
      : getDiasDecorridosNoMes(selectedMes, targetDate, diasFechamento, true);

    if (diasDecorridosComHoje <= 0 || diasTotais <= 0) return null;

    const projected = (totalSoFar / diasDecorridosComHoje) * diasTotais;

    let metaOuro = 0;
    if (lojaId === 'soledade') metaOuro = numericConfig.loja_meta_ouro || 65000;
    else if (lojaId === 'monteiro') metaOuro = numericConfig.loja_meta_prata || 50000;
    else if (isLojaCampinaNatal(lojaId)) metaOuro = numericConfig.gerente_meta_prata || 0;
    else metaOuro = numericConfig.loja_meta_ouro || 0;

    return { projected, pctMeta: metaOuro > 0 ? (projected / metaOuro) * 100 : null };
  };

  return (
    <div className="space-y-2 mb-6">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
          Vendas do Dia
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {LOJAS_IDS.map((lojaId) => {
          const { total, totalDia, targetDate, accumulated, isToday } = storeData[lojaId] || { total: 0, totalDia: 0, targetDate: null, accumulated: 0, isToday: false };
          const brutoDia = targetDate ? (brutoPorDia?.[`${lojaId}|${targetDate}`] || 0) : 0;
          const jurosDia = brutoDia > totalDia + 0.01 ? brutoDia - totalDia : 0;
          const currentDailyGoal = getDailyGoal(lojaId, accumulated, targetDate);
          const reachedGoal = total >= currentDailyGoal && total > 0;
          const hasData = total > 0;
          const pct = currentDailyGoal > 0 ? Math.min(100, (total / currentDailyGoal) * 100) : 0;
          const lojaNome = LOJAS[lojaId as keyof typeof LOJAS];

          const dateLabel = targetDate
            ? isToday
              ? 'Hoje'
              : new Date(targetDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
            : null;

          const projection = getProjection(lojaId, accumulated + total, targetDate);

          return (
            <Card key={lojaId} className="overflow-hidden border-none shadow-sm hover:shadow-md transition-shadow bg-card/40 backdrop-blur-sm border border-border/50">
              <CardContent className="p-3 flex flex-col justify-between h-full min-h-[110px]">
                <div className="flex justify-between items-start mb-1">
                  <div className="min-w-0 pr-2">
                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase truncate">{lojaNome}</h3>
                    {dateLabel && !isToday && (
                      <span className="text-[9px] text-amber-400/70 font-medium">{dateLabel}</span>
                    )}
                  </div>
                  <span className="text-[9px] text-muted-foreground/70 font-medium whitespace-nowrap">
                    Meta/dia: {formatCurrency(currentDailyGoal)}
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center flex-1 py-1">
                  {hasData ? (
                    <>
                      {/* Bruto = número principal */}
                      <span className={cn(
                        "text-xl font-black tracking-tight",
                        jurosDia > 1 ? "text-amber-400" : reachedGoal ? "text-success" : "text-destructive"
                      )}>
                        {formatCurrency(brutoDia > 0 ? brutoDia : (totalDia > 0 ? totalDia : total))}
                      </span>
                      {/* Líquido sempre visível abaixo */}
                      <span className={cn("text-[11px] font-semibold mt-0.5", reachedGoal ? "text-success/70" : "text-destructive/70")}>
                        Líq: {formatCurrency(totalDia > 0 ? totalDia : total)}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground/40 italic">
                      {isCurrentMonth ? 'Sem dados hoje' : 'Sem dados'}
                    </span>
                  )}
                </div>

                <div className="mt-1 space-y-0.5">
                  <div className="h-1 w-full rounded-full bg-secondary/50 overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all duration-1000 ease-out",
                        !hasData ? "bg-transparent" : reachedGoal ? "bg-success" : "bg-destructive"
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {hasData && (
                    <p className="text-[9px] text-muted-foreground/50 text-right">
                      {total < totalDia - 0.01 && (
                        <span className="text-muted-foreground/40 mr-1">meta: {formatCurrency(total)} ·</span>
                      )}
                      {pct.toFixed(0)}% da meta</p>
                  )}
                  {projection && (
                    <p className={cn(
                      "text-[9px] font-semibold text-right mt-0.5",
                      projection.pctMeta !== null && projection.pctMeta >= 100
                        ? "text-success/70"
                        : projection.pctMeta !== null && projection.pctMeta >= 80
                          ? "text-amber-400/70"
                          : "text-destructive/60"
                    )}>
                      Proj: {formatCurrency(projection.projected)}
                      {projection.pctMeta !== null && ` · ${projection.pctMeta.toFixed(0)}% M.Ouro`}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
