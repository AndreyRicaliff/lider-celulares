import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
