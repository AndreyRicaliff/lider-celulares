
import { supabase } from './src/integrations/supabase/client';
import { calcularComissaoCampinaNatal } from './src/lib/comissaoCalculator';
import { getDefaultConfig } from './src/lib/constants';

async function recalculate() {
  const lojaId = 'campina-grande';
  const mes = '2026-04';

  console.log(`Recalculating for ${lojaId} ${mes}...`);

  // 1. Get Config
  const { data: configData } = await supabase
    .from('configuracoes')
    .select('config')
    .eq('loja_id', lojaId)
    .eq('mes', mes)
    .single();
  
  const config = configData?.config as Record<string, number>;

  // 2. Get Collaborators
  const { data: collaborators } = await supabase
    .from('colaboradores')
    .select('*');

  // 3. Get Vendas
  const { data: vendas } = await supabase
    .from('vendas')
    .select('*')
    .eq('loja_id', lojaId)
    .eq('mes', mes);

  // 4. Group sales by seller
  const salesBySeller: Record<string, any> = {};
  vendas?.forEach(v => {
    salesBySeller[v.vendedor_nome] = v.detalhes;
  });

  // 5. Calculate and Update
  for (const sellerName of Object.keys(salesBySeller)) {
    const colab = collaborators?.find(c => c.nome.toUpperCase() === sellerName.toUpperCase());
    if (!colab) continue;

    const result = calcularComissaoCampinaNatal(colab, salesBySeller[sellerName], config, lojaId, mes);
    
    console.log(`Updating ${sellerName}:`, result.comissaoDetalhada);

    await supabase
      .from('comissoes')
      .update({
        comissao_base: result.comissao,
        comissao_detalhada: result.comissaoDetalhada,
        detalhes: {
          totais: salesBySeller[sellerName],
          info: result.info,
          bonusInfo: [],
          vendedorId: colab.id
        }
      })
      .eq('vendedor_nome', sellerName)
      .eq('loja_id', lojaId)
      .eq('mes', mes);
  }
}

recalculate().catch(console.error);
