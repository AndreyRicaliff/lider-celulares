
import { createClient } from 'npm:@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

async function analyze() {
  const { data: records, error } = await supabase
    .from('atendimentos_audit')
    .select('vendedor_nome, detalhes_brutos, data_atendimento, mes')
    .or('vendedor_nome.ilike.%CÉLIO%,vendedor_nome.ilike.%FERNANDO%')
    .eq('mes', '2026-04');

  if (error) {
    console.error(error);
    return;
  }

  const stats = {};

  records.forEach(r => {
    const v = r.vendedor_nome.toUpperCase();
    if (!stats[v]) stats[v] = { smartphones: 0, total: 0, dates: [] };
    
    stats[v].total += 1;
    stats[v].dates.push(r.data_atendimento);

    const info = r.detalhes_brutos || [];
    info.forEach(item => {
      const vendas = item.Venda || [];
      vendas.forEach(venda => {
        const grupo = (venda.Grupo || '').toUpperCase();
        const subtipo = (venda.Subtipo || '').toUpperCase();
        const tipo = (venda['Tipo produto'] || '').toUpperCase();
        const produto = (venda.Produto || '').toUpperCase();
        const valor = parseFloat(venda['Valor de venda'] || 0);

        const isSmartphone = (grupo.includes('CELULAR') || tipo.includes('SMARTPHONE') || tipo.includes('DISPOSITIVO') || (subtipo.includes('CELULAR') && !grupo.includes('SERVIÇO'))) && valor > 0;
        
        if (isSmartphone) {
          stats[v].smartphones += (venda.Quantidade || 1);
        }
      });
    });
  });

  console.log(JSON.stringify(stats, null, 2));
}

analyze();
