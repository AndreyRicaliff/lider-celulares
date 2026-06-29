import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SupervisorConfig } from '@/lib/supervisorCalculator';

export type SupervisorOverride = Partial<SupervisorConfig>;

// Mapa nome → overrides (campos editados pelo gestor). Vazio = usa o hardcoded (default-preserving).
export const useSupervisorConfigs = () =>
  useQuery({
    queryKey: ['supervisor_config'],
    queryFn: async (): Promise<Record<string, SupervisorOverride>> => {
      const { data, error } = await supabase.from('supervisor_config').select('nome, config');
      if (error) throw error;
      const map: Record<string, SupervisorOverride> = {};
      (data ?? []).forEach((r) => { map[r.nome as string] = (r.config ?? {}) as SupervisorOverride; });
      return map;
    },
  });

export const useSaveSupervisorConfig = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ nome, config }: { nome: string; config: SupervisorOverride }) => {
      const { error } = await supabase
        .from('supervisor_config')
        .upsert({ nome, config, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['supervisor_config'] }),
  });
};
