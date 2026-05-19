import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type LojaSync = {
  lojaId: string;
  lastOkTime: string | null;
  okToday: number;
  failToday: number;
  dailyLimitHit: boolean;
  lastError: string | null;
};

export const useSyncStatus = () => {
  return useQuery({
    queryKey: ['sync-status-today'],
    queryFn: async (): Promise<LojaSync[]> => {
      // "Hoje" em Brasília (UTC-3): meia-noite BRT = 03:00 UTC
      const now = new Date();
      const brtMidnight = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        3, 0, 0, 0  // 03:00 UTC = 00:00 BRT
      ));
      // Se ainda não passou das 03:00 UTC (antes da meia-noite BRT), recua um dia
      if (now.getUTCHours() < 3) {
        brtMidnight.setUTCDate(brtMidnight.getUTCDate() - 1);
      }

      const { data, error } = await supabase
        .from('sync_logs')
        .select('loja_id, success, error_message, created_at')
        .gte('created_at', brtMidnight.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      const byLoja: Record<string, LojaSync> = {};
      for (const row of data || []) {
        if (!byLoja[row.loja_id]) {
          byLoja[row.loja_id] = {
            lojaId: row.loja_id,
            lastOkTime: null,
            okToday: 0,
            failToday: 0,
            dailyLimitHit: false,
            lastError: null,
          };
        }
        const s = byLoja[row.loja_id];
        if (row.success) {
          s.okToday++;
          s.lastOkTime = row.created_at;
        } else {
          s.failToday++;
          s.lastError = row.error_message;
          if (row.error_message?.toLowerCase().includes('diário')) {
            s.dailyLimitHit = true;
          }
        }
      }

      return Object.values(byLoja).sort((a, b) => a.lojaId.localeCompare(b.lojaId));
    },
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
  });
};
