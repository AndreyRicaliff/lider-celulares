import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAllConfiguracoes } from '@/hooks/useConfiguracoes';
import { LOJAS_IDS } from '@/lib/constants';
import { isLojaCampinaNatal, isLojaSoledadeMonteiro } from '@/lib/lojaRules';
import { getDiasUteisNoMes, getDiasUteisDecorridos, getDiasDecorridosNoMes } from '@/lib/dateUtils';
import { getDaysInMonth } from '@/lib/formatters';
import { VendaDiaria } from '@/types/database';
import { computeValForMeta } from '@/lib/metaUtils';

const ALERT_THRESHOLD = 0.70;

function getMetaOuro(lojaId: string, numericConfig: Record<string, number>): number {
  if (lojaId === 'soledade') return numericConfig.loja_meta_ouro || 65000;
  if (lojaId === 'monteiro') return numericConfig.loja_meta_prata || 50000;
  if (isLojaCampinaNatal(lojaId)) return numericConfig.gerente_meta_prata || 0;
  return numericConfig.loja_meta_ouro || 0;
}

export const useLojaAlerts = (mes: string) => {
  const today = (() => {
    const now = new Date();
    const utcDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return utcDate.toISOString().split('T')[0];
  })();

  const isCurrentMonth = today.startsWith(mes);

  const { data: allConfigs } = useAllConfiguracoes(mes);

  const { data: vendasDiarias } = useQuery({
    queryKey: ['vendas_diarias', mes, 'all-lojas'],
    queryFn: async (): Promise<VendaDiaria[]> => {
      const { data, error } = await supabase
        .from('vendas_diarias')
        .select('*')
        .eq('mes', mes);
      if (error) throw error;
      return (data || []) as VendaDiaria[];
    },
    enabled: !!mes && isCurrentMonth,
    staleTime: 1000 * 60 * 5,
  });

  return useMemo<Set<string>>(() => {
    if (!isCurrentMonth || !allConfigs || !vendasDiarias) return new Set();

    const alertLojas = new Set<string>();

    LOJAS_IDS.forEach((lojaId) => {
      const cfg = allConfigs[lojaId];
      if (!cfg) return;

      const { numericConfig, diasFechamento } = cfg;
      const metaOuro = getMetaOuro(lojaId, numericConfig);
      if (metaOuro <= 0) return;

      const isSM = isLojaSoledadeMonteiro(lojaId);
      const diasTotais = isSM
        ? getDiasUteisNoMes(mes, diasFechamento)
        : getDaysInMonth(mes) - diasFechamento.filter((d) => d.startsWith(mes)).length;

      const diasDecorridos = isSM
        ? getDiasUteisDecorridos(mes, diasFechamento, true, today)
        : getDiasDecorridosNoMes(mes, today, diasFechamento, true);

      if (diasDecorridos <= 0 || diasTotais <= 0) return;

      const totalSoFar = vendasDiarias
        .filter((v) => v.loja_id === lojaId)
        .reduce((sum, v) => sum + computeValForMeta(v), 0);

      const projected = (totalSoFar / diasDecorridos) * diasTotais;

      if (projected < metaOuro * ALERT_THRESHOLD) {
        alertLojas.add(lojaId);
      }
    });

    return alertLojas;
  }, [isCurrentMonth, allConfigs, vendasDiarias, mes, today]);
};
