import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LOJAS, LOJAS_IDS } from '@/lib/constants';
import { formatCurrency, getDaysInMonth } from '@/lib/formatters';
import { VendaDiaria } from '@/types/database';
import { cn } from '@/lib/utils';
import { isLojaCampinaNatal, isLojaSoledadeMonteiro } from '@/lib/lojaRules';
import { ConfiguracaoData } from '@/hooks/useConfiguracoes';
import { getDiasUteisNoMes, getDiasUteisDecorridos, getDiasDecorridosNoMes } from '@/lib/dateUtils';

interface DailyStoreSalesCardsProps {
  vendasDiarias: VendaDiaria[];
  selectedMes: string;
  allConfigs?: Record<string, ConfiguracaoData>;
}

export const DailyStoreSalesCards = ({ vendasDiarias, selectedMes, allConfigs }: DailyStoreSalesCardsProps) => {
  const today = (() => {
    const now = new Date();
    const utcDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
    return utcDate.toISOString().split('T')[0];
  })();
  
  const { totals, targetDate, accumulatedSalesBeforeTarget } = useMemo(() => {
    // Pegamos todos os dias disponíveis no mês selecionado
    const availableDates = [...new Set(vendasDiarias.map(v => v.data))].sort();
    
    // Se estivermos visualizando o mês atual, mostramos sempre o dia de hoje (que pode estar zerado)
    // Se for outro mês, usamos a última data disponível com vendas.
    const date = today.startsWith(selectedMes) ? today : availableDates[availableDates.length - 1];

    if (!date) return { totals: {} as Record<string, number>, targetDate: null, accumulatedSalesBeforeTarget: {} as Record<string, number> };

    const dailyData = vendasDiarias.filter(v => v.data === date);
    
    const totals: Record<string, number> = {};
    dailyData.forEach(v => {
      const detalhes = (v.detalhes || {}) as Record<string, number>;
      const isSoledadeMonteiro = isLojaSoledadeMonteiro(v.loja_id);
      const isCampinaNatal = isLojaCampinaNatal(v.loja_id);

      const smVal = (Number(detalhes['BONIFICADO LC']) || 0) + (Number(detalhes['SUPER BONIFICADO']) || 0) + (Number(detalhes['ANATEL']) || 0);
      const accSemPelVal = (Number(detalhes['ACESSÓRIOS']) || 0) + (Number(detalhes['CASES']) || 0);
      const pelVal = Number(detalhes['PELÍCULA']) || 0;
      const svcVal = (Number(detalhes['PROTEÇÃO LÍDER']) || 0) + (Number(detalhes['GARANTIA ESTENDIDA']) || 0);
      const atVal = Number(detalhes['ASSISTÊNCIA TÉCNICA']) || 0;
      const catGerVal = (Number(detalhes['GERAL']) || Number((v as any).geral) || 0);
      const valorRealSjuros = Number(detalhes['VALOR REAL (S/ JUROS)']) || 0;

      let valForMeta = 0;
      if (v.loja_id === 'soledade') {
        valForMeta = smVal + accSemPelVal + pelVal + atVal + catGerVal;
      } else if (v.loja_id === 'monteiro') {
        valForMeta = smVal + accSemPelVal + pelVal + svcVal + atVal + catGerVal;
      } else if (isCampinaNatal) {
        valForMeta = smVal + svcVal; // Natal: Apenas Smartphones + Serviços (Pelicula NÃO conta)
      } else {
        // Caruaru e outras: Usar Valor Real (S/ Juros) como solicitado
        valForMeta = valorRealSjuros || (smVal + accSemPelVal + pelVal + atVal + catGerVal);
      }

      totals[v.loja_id] = (totals[v.loja_id] || 0) + valForMeta;
    });

    // Cálculo do acumulado por loja até o dia anterior ao targetDate
    // Considerando as regras específicas de cada loja para o que conta na meta
    const accumulated: Record<string, number> = {};
    const previousVendas = vendasDiarias.filter(v => v.data < date);
    
    previousVendas.forEach(v => {
      const detalhes = (v.detalhes || {}) as Record<string, number>;
      const isSoledadeMonteiro = isLojaSoledadeMonteiro(v.loja_id);
      const isCampinaNatal = isLojaCampinaNatal(v.loja_id);

      const smVal = (Number(detalhes['BONIFICADO LC']) || 0) + (Number(detalhes['SUPER BONIFICADO']) || 0) + (Number(detalhes['ANATEL']) || 0);
      const accSemPelVal = (Number(detalhes['ACESSÓRIOS']) || 0) + (Number(detalhes['CASES']) || 0);
      const pelVal = Number(detalhes['PELÍCULA']) || 0;
      const svcVal = (Number(detalhes['PROTEÇÃO LÍDER']) || 0) + (Number(detalhes['GARANTIA ESTENDIDA']) || 0);
      const atVal = Number(detalhes['ASSISTÊNCIA TÉCNICA']) || 0;
      const catGerVal = (Number(detalhes['GERAL']) || Number((v as any).geral) || 0);
      const valorRealSjuros = Number(detalhes['VALOR REAL (S/ JUROS)']) || 0;

      let valForMeta = 0;
      if (v.loja_id === 'soledade') {
        // Soledade: Meta Ouro (sem serviços)
        valForMeta = smVal + accSemPelVal + pelVal + atVal + catGerVal;
      } else if (v.loja_id === 'monteiro') {
        // Monteiro: Meta Prata (com serviços)
        valForMeta = smVal + accSemPelVal + pelVal + svcVal + atVal + catGerVal;
      } else if (isCampinaNatal) {
        // Campina/Natal: Meta Prata (smartphones + serviços) - Pelicula NÃO conta
        valForMeta = smVal + svcVal;
      } else {
        // Caruaru / Outras: Valor Real (S/ Juros)
        valForMeta = valorRealSjuros || (smVal + accSemPelVal + pelVal + atVal + catGerVal);
      }

      accumulated[v.loja_id] = (accumulated[v.loja_id] || 0) + valForMeta;
    });

    return { totals, targetDate: date, accumulatedSalesBeforeTarget: accumulated };
  }, [vendasDiarias, today]);

  const getDailyGoal = (lojaId: string) => {
    if (!allConfigs || !allConfigs[lojaId] || !targetDate) return 3800.00;
    
    const config = allConfigs[lojaId];
    const { numericConfig, diasFechamento } = config;
    const isSoledadeMonteiro = isLojaSoledadeMonteiro(lojaId);
    const isCampinaNatal = isLojaCampinaNatal(lojaId);
    
    const diasTotais = isSoledadeMonteiro 
      ? getDiasUteisNoMes(selectedMes, diasFechamento) 
      : getDaysInMonth(selectedMes) - diasFechamento.filter(d => d.startsWith(selectedMes)).length;

    const diasDecorridos = isSoledadeMonteiro
      ? getDiasUteisDecorridos(selectedMes, diasFechamento, false, targetDate)
      : getDiasDecorridosNoMes(selectedMes, targetDate, diasFechamento, false);

    const diasRestantes = Math.max(1, diasTotais - diasDecorridos);
    
    let totalGoalValue = 0;
    if (lojaId === 'soledade') {
      totalGoalValue = numericConfig.loja_meta_ouro || 65000;
    } else if (lojaId === 'monteiro') {
      totalGoalValue = numericConfig.loja_meta_prata || 50000;
    } else {
      totalGoalValue = isCampinaNatal
        ? (numericConfig.gerente_meta_prata || 0)
        : (numericConfig.loja_meta_ouro || 0);
    }

    const accumulated = accumulatedSalesBeforeTarget[lojaId] || 0;
    const remainingGoal = Math.max(0, totalGoalValue - accumulated);

    return remainingGoal / diasRestantes;
  };

  const displayDate = targetDate ? new Date(targetDate + 'T12:00:00').toLocaleDateString('pt-BR') : '';
  const isToday = targetDate === today;

  return (
    <div className="space-y-2 mb-6">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          Vendas do Dia {isToday ? "(Hoje)" : `(${displayDate})`}
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {LOJAS_IDS.map((lojaId) => {
          const total = totals[lojaId] || 0;
          const currentDailyGoal = getDailyGoal(lojaId);
          const reachedGoal = total >= currentDailyGoal;
          const lojaNome = LOJAS[lojaId as keyof typeof LOJAS];

          return (
            <Card key={lojaId} className="overflow-hidden border-none shadow-sm hover:shadow-md transition-shadow bg-card/40 backdrop-blur-sm border border-border/50">
              <CardContent className="p-3 flex flex-col justify-between h-full min-h-[110px]">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="text-[10px] font-bold text-muted-foreground uppercase truncate pr-2">{lojaNome}</h3>
                  <span className="text-[9px] text-muted-foreground/70 font-medium flex items-center gap-0.5 whitespace-nowrap">
                    Meta: {formatCurrency(currentDailyGoal)}
                  </span>
                </div>
                
                <div className="flex flex-col items-center justify-center flex-1 py-1">
                  <span className={cn(
                    "text-xl font-black tracking-tight",
                    total === 0 ? "text-muted-foreground/30" : (reachedGoal ? "text-success" : "text-destructive")
                  )}>
                    {formatCurrency(total)}
                  </span>
                </div>

                <div className="mt-1">
                  <div className="h-1 w-full rounded-full bg-secondary/50 overflow-hidden">
                    <div 
                      className={cn(
                        "h-full transition-all duration-1000 ease-out",
                        reachedGoal ? "bg-success" : "bg-destructive"
                      )}
                      style={{ width: `${Math.min(100, (total / currentDailyGoal) * 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
