import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getBotonOverride } from '@/lib/constants';

export interface Boton {
  id: string;
  colaborador_id: string;
  loja_id: string;
  mes: string;
  tipo: 'triplice_coroa' | 'protecao_lider';
  pontos: number;
  created_at: string;
}

export interface BotonComColaborador extends Boton {
  colaborador_nome?: string;
}

export const useBotons = (ano?: string) => {
  return useQuery({
    queryKey: ['botons', ano],
    queryFn: async (): Promise<BotonComColaborador[]> => {
      let query = supabase.from('botons').select('*');
      
      if (ano) {
        // Filter by year (mes format is YYYY-MM)
        query = query.gte('mes', `${ano}-01`).lte('mes', `${ano}-12`);
      }
      
      const { data, error } = await query.order('mes', { ascending: false });
      if (error) throw error;
      
      return (data || []) as BotonComColaborador[];
    },
  });
};

export const useCalculateBoton = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      colaboradorId, 
      lojaId, 
      mes, 
      metaSmartphones, 
      metaServicos, 
      metaPeliculas,
      vendedorNome
    }: { 
      colaboradorId: string;
      lojaId: string;
      mes: string;
      metaSmartphones: boolean;
      metaServicos: boolean;
      metaPeliculas: boolean;
      vendedorNome?: string;
    }) => {
      // Determine which boton to award
      let tipo: 'triplice_coroa' | 'protecao_lider' | null = null;
      let pontos = 0;

      // Check for manual overrides first
      const override = getBotonOverride(colaboradorId, mes, vendedorNome);
      if (override) {
        tipo = override.tipo;
        pontos = override.pontos;
      } else {
        // Triplice Coroa: bater fase 3 serviços + meta smartphones + meta películas (não mínima)
        if (metaServicos && metaSmartphones && metaPeliculas) {
          tipo = 'triplice_coroa';
          pontos = 10;
        } 
        // Proteção Líder: bater apenas fase 3 serviços (e NÃO tríplice coroa)
        else if (metaServicos) {
          tipo = 'protecao_lider';
          pontos = 5;
        }
      }

      // Delete existing boton for this month/colaborador
      await supabase
        .from('botons')
        .delete()
        .eq('colaborador_id', colaboradorId)
        .eq('mes', mes);

      // Insert new boton if earned
      if (tipo) {
        const { error } = await supabase
          .from('botons')
          .insert({
            colaborador_id: colaboradorId,
            loja_id: lojaId,
            mes,
            tipo,
            pontos
          });
        
        if (error) throw error;
      }

      return { tipo, pontos };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['botons'] });
    },
    onError: (error) => {
      toast.error('Erro ao calcular boton: ' + error.message);
    },
  });
};

export const useRankingBotons = (ano: string) => {
  return useQuery({
    queryKey: ['ranking-botons', ano],
    queryFn: async () => {
      // Get all botons for the year
      const { data: botons, error: botonsError } = await supabase
        .from('botons')
        .select('*')
        .gte('mes', `${ano}-01`)
        .lte('mes', `${ano}-12`);
      
      if (botonsError) throw botonsError;

      // Get colaboradores (excluindo Trainees - eles não participam do ranking)
      const { data: colaboradores, error: colabError } = await supabase
        .from('colaboradores')
        .select('id, nome, loja_id, cargo')
        .neq('cargo', 'Trainee');
      
      if (colabError) throw colabError;

      // Calculate ranking
      const ranking: Record<string, {
        colaboradorId: string;
        nome: string;
        lojaId: string;
        pontosTotais: number;
        tripliceCoroa: number;
        protecaoLider: number;
        botonsPorMes: Record<string, { tipo: string; pontos: number }>;
      }> = {};

      colaboradores?.forEach(colab => {
        ranking[colab.id] = {
          colaboradorId: colab.id,
          nome: colab.nome,
          lojaId: colab.loja_id,
          pontosTotais: 0,
          tripliceCoroa: 0,
          protecaoLider: 0,
          botonsPorMes: {}
        };
      });

      botons?.forEach(boton => {
        if (ranking[boton.colaborador_id]) {
          ranking[boton.colaborador_id].pontosTotais += boton.pontos;
          if (boton.tipo === 'triplice_coroa') {
            ranking[boton.colaborador_id].tripliceCoroa += 1;
          } else {
            ranking[boton.colaborador_id].protecaoLider += 1;
          }
          ranking[boton.colaborador_id].botonsPorMes[boton.mes] = {
            tipo: boton.tipo,
            pontos: boton.pontos
          };
        }
      });

      // Sort by points
      return Object.values(ranking)
        .filter(r => r.pontosTotais > 0)
        .sort((a, b) => b.pontosTotais - a.pontosTotais);
    },
  });
};
