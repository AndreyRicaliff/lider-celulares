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
