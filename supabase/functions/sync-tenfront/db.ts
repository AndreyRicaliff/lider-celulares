// ===== Última data sincronizada por loja =====

// ID do atendimento mais recente já salvo em atendimentos_audit para esta loja/mês.
// Usado como âncora de ID: assim que a API retorna esse ID numa página, paramos —
// todos os registros seguintes já estão no banco. Reduz Natal de 6-7 páginas para ~1.
// deno-lint-ignore no-explicit-any
export const getLastSyncedAtendimentoId = async (internalClient: any, lojaId: string, mes: string): Promise<string | null> => {
  const { data } = await internalClient
    .from('atendimentos_audit')
    .select('atendimento_id')
    .eq('loja_id', lojaId)
    .eq('mes', mes)
    .order('data_atendimento', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.atendimento_id ?? null;
};

// ===== Conciliação anti-fantasma =====

// Remove do audit os atendimentos que NÃO vieram na API viva — cancelados/excluídos no
// Tenfront que ficariam acumulando, já que o sync só faz upsert (nunca delete) e o sync
// incremental usa ID-stop, então nunca re-vê os antigos. Sem isso o faturamento de meses
// fechados cresce "por mais" (ex.: Campina jun tinha 1 fantasma de R$700).
// REGRA DE SEGURANÇA: só chamar após um fetch COMPLETO e não-parcial do mês. A trava do
// conjunto vazio impede que um retorno degradado da API (rate limit, página truncada)
// apague dado válido — na pior hipótese, não concilia naquele ciclo.
// deno-lint-ignore no-explicit-any
export const reconcileAudit = async (internalClient: any, lojaId: string, mes: string, liveIds: string[]): Promise<string[]> => {
  if (liveIds.length === 0) return [];
  const lista = `(${liveIds.map((id) => `"${id}"`).join(',')})`;
  const { data, error } = await internalClient
    .from('atendimentos_audit')
    .delete()
    .eq('loja_id', lojaId)
    .eq('mes', mes)
    .not('atendimento_id', 'in', lista)
    .select('atendimento_id');
  if (error) throw error;
  return (data ?? []).map((r: { atendimento_id: string }) => r.atendimento_id);
};

// deno-lint-ignore no-explicit-any
export const getLastSyncDate = async (internalClient: any, lojaId: string, mes: string): Promise<string | null> => {
  const { data } = await internalClient
    .from('vendas_diarias')
    .select('data')
    .eq('loja_id', lojaId)
    .eq('mes', mes)
    .order('data', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.data ?? null;
};
