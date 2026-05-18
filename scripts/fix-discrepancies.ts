
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixDiscrepancies() {
  console.log('Starting discrepancy fix for April 2026...');

  // 1. Get discrepancies
  const { data: discrepancies, error: discError } = await supabase.rpc('get_vendas_discrepancies', { target_mes: '2026-04' });
  
  // If RPC doesn't exist, we'll use a manual query approach
  let list = discrepancies;
  if (discError) {
    console.log('RPC not found, using manual query approach...');
    const { data: vData } = await supabase.from('vendas').select('*').eq('mes', '2026-04');
    const { data: vdData } = await supabase.from('vendas_diarias').select('*').eq('mes', '2026-04');
    
    const vMap = new Map();
    vData?.forEach(v => {
      const key = `${v.loja_id}|${v.vendedor_nome}`;
      const qtd = parseInt(v.detalhes?.__qtd_smartphones || '0');
      vMap.set(key, (vMap.get(key) || 0) + qtd);
    });
    
    const vdMap = new Map();
    vdData?.forEach(vd => {
      const key = `${vd.loja_id}|${vd.vendedor_nome}`;
      const qtd = parseInt(vd.detalhes?.__qtd_smartphones || '0');
      vdMap.set(key, (vdMap.get(key) || 0) + qtd);
    });
    
    list = [];
    vMap.forEach((vTotal, key) => {
      const vdTotal = vdMap.get(key) || 0;
      if (vTotal > vdTotal) {
        const [loja_id, vendedor_nome] = key.split('|');
        list.push({ loja_id, vendedor_nome, diff: vTotal - vdTotal });
      }
    });
  }

  console.log(`Found ${list?.length || 0} discrepancies.`);

  for (const item of list) {
    const { loja_id, vendedor_nome, diff } = item;
    console.log(`Fixing ${vendedor_nome} in ${loja_id}: missing ${diff} units.`);
    
    // Check if record for 2026-04-30 exists
    const { data: existing } = await supabase
      .from('vendas_diarias')
      .select('*')
      .eq('loja_id', loja_id)
      .eq('vendedor_nome', vendedor_nome)
      .eq('data', '2026-04-30')
      .single();
      
    if (existing) {
      const newDet = { ...existing.detalhes };
      newDet.__qtd_smartphones = (parseInt(newDet.__qtd_smartphones || '0')) + diff;
      
      await supabase
        .from('vendas_diarias')
        .update({ detalhes: newDet })
        .eq('id', existing.id);
      console.log(`Updated existing record for ${vendedor_nome} on 2026-04-30.`);
    } else {
      // Find another record to copy metadata (colaborador_id, etc.)
      const { data: other } = await supabase
        .from('vendas_diarias')
        .select('*')
        .eq('loja_id', loja_id)
        .eq('vendedor_nome', vendedor_nome)
        .limit(1)
        .single();
        
      await supabase
        .from('vendas_diarias')
        .insert({
          loja_id,
          mes: '2026-04',
          data: '2026-04-30',
          vendedor_nome,
          colaborador_id: other?.colaborador_id || null,
          valor_total: 0,
          smartphones: 0,
          acessorios: 0,
          servicos: 0,
          detalhes: { __qtd_smartphones: diff }
        });
      console.log(`Created new record for ${vendedor_nome} on 2026-04-30.`);
    }
  }

  console.log('Cleanup finished.');
}

fixDiscrepancies();
