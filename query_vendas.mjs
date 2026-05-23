import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ibpcexyrxwmknrfwifyy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlicGNleHlyeHdta25yZndpZnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjUzNDcsImV4cCI6MjA5NDYwMTM0N30.noVxEIHwpeaSNiaaV7VG5ZzmJqJYXFrBLgh_8w_eDFY'
);

async function investigar() {
  try {
    // Buscar todas as vendas para Natal em maio 2026
    const { data: vendas, error } = await supabase
      .from('vendas')
      .select('*')
      .eq('loja_id', 'natal')
      .eq('mes', '2026-05');

    if (error) {
      console.error('Erro na query:', error);
      process.exit(1);
    }

    console.log('=== TOTAL DE VENDAS ===');
    console.log(`Registros encontrados: ${vendas.length}`);
    console.log('');

    // Análise por VENDEDOR
    console.log('=== BREAKDOWN POR VENDEDOR ===');
    const porVendedor = {};

    vendas.forEach(venda => {
      const vendedor = venda.vendedor || 'N/A';
      if (!porVendedor[vendedor]) {
        porVendedor[vendedor] = { 
          PROTEÇÃO_LÍDER: 0,
          GARANTIA_ESTENDIDA: 0,
          total_servicos: 0,
          vendas_detalhes: []
        };
      }

      // Somar valores de SERVIÇOS
      if (venda.categoria === 'SERVIÇOS') {
        porVendedor[vendedor].total_servicos += venda.valor || 0;
      }

      // Se houver detalhes JSON, extrair subcategorias
      if (venda.detalhes) {
        const det = typeof venda.detalhes === 'string' ? 
          JSON.parse(venda.detalhes) : venda.detalhes;
        
        Object.keys(det).forEach(chave => {
          if (chave === 'PROTEÇÃO_LÍDER' || chave === 'PROTEÇÃO LÍDER') {
            porVendedor[vendedor].PROTEÇÃO_LÍDER += det[chave];
          } else if (chave === 'GARANTIA_ESTENDIDA' || chave === 'GARANTIA ESTENDIDA') {
            porVendedor[vendedor].GARANTIA_ESTENDIDA += det[chave];
          }
        });
      }

      porVendedor[vendedor].vendas_detalhes.push({
        categoria: venda.categoria,
        valor: venda.valor,
        detalhes: venda.detalhes
      });
    });

    // Exibir ordenado por valor total de SERVIÇOS (descending)
    const sorted = Object.entries(porVendedor)
      .sort((a, b) => b[1].total_servicos - a[1].total_servicos);

    sorted.forEach(([vendedor, valores]) => {
      console.log(`\n📱 ${vendedor}`);
      console.log(`   PROTEÇÃO LÍDER: R$ ${(valores.PROTEÇÃO_LÍDER).toFixed(2)}`);
      console.log(`   GARANTIA ESTENDIDA: R$ ${(valores.GARANTIA_ESTENDIDA).toFixed(2)}`);
      console.log(`   TOTAL SERVIÇOS: R$ ${(valores.total_servicos).toFixed(2)}`);
    });

    // Análise por CATEGORIA
    console.log('\n\n=== BREAKDOWN POR CATEGORIA ===');
    const porCategoria = {};
    
    vendas.forEach(venda => {
      const cat = venda.categoria || 'N/A';
      if (!porCategoria[cat]) {
        porCategoria[cat] = 0;
      }
      porCategoria[cat] += venda.valor || 0;
    });

    Object.entries(porCategoria)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, valor]) => {
        console.log(`  ${cat}: R$ ${(valor).toFixed(2)}`);
      });

    // Buscar por valor próximo de 2.545
    console.log('\n\n=== BUSCA POR ANOMALIA (≈R$ 2.545) ===');
    const anomalias = vendas.filter(v => {
      const val = v.valor || 0;
      return val > 2400 && val < 2700;
    });

    if (anomalias.length > 0) {
      anomalias.forEach(v => {
        console.log(`\n🚨 ACHADO: Vendedor: ${v.vendedor}`);
        console.log(`   Categoria: ${v.categoria}`);
        console.log(`   Valor: R$ ${(v.valor).toFixed(2)}`);
        try {
          const det = typeof v.detalhes === 'string' ? JSON.parse(v.detalhes) : v.detalhes;
          console.log(`   Detalhes JSON:`);
          Object.entries(det).forEach(([k, val]) => {
            console.log(`     - ${k}: R$ ${(val).toFixed(2)}`);
          });
        } catch (e) {
          console.log(`   Detalhes brutos: ${v.detalhes}`);
        }
      });
    } else {
      console.log('Nenhuma venda encontrada na faixa 2.400-2.700');
    }

    // Dump completo de todas as SERVIÇOS para análise
    console.log('\n\n=== DUMP COMPLETO: CATEGORIA=SERVIÇOS ===');
    const servicosVendas = vendas.filter(v => v.categoria === 'SERVIÇOS');
    console.log(`Total de linhas SERVIÇOS: ${servicosVendas.length}\n`);
    
    servicosVendas.forEach(v => {
      console.log(`Vendedor: ${v.vendedor} | Valor: R$ ${(v.valor).toFixed(2)}`);
      try {
        const det = typeof v.detalhes === 'string' ? JSON.parse(v.detalhes) : v.detalhes;
        Object.entries(det).forEach(([k, val]) => {
          console.log(`  └─ ${k}: R$ ${(val).toFixed(2)}`);
        });
      } catch (e) {
        console.log(`  └─ ${v.detalhes}`);
      }
    });

  } catch (err) {
    console.error('Erro:', err.message);
    process.exit(1);
  }
}

investigar();
