import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ibpcexyrxwmknrfwifyy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlicGNleHlyeHdta25yZndpZnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjUzNDcsImV4cCI6MjA5NDYwMTM0N30.noVxEIHwpeaSNiaaV7VG5ZzmJqJYXFrBLgh_8w_eDFY'
);

async function analisar() {
  try {
    const { data: vendas } = await supabase
      .from('vendas')
      .select('*')
      .eq('loja_id', 'natal')
      .eq('mes', '2026-05');

    console.log('╔════════════════════════════════════════════════════════════════════════╗');
    console.log('║         ANÁLISE DE SERVIÇOS - NATAL MAIO 2026 (INVESTIGAÇÃO)         ║');
    console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

    // Análise por VENDEDOR
    console.log('📊 BREAKDOWN POR VENDEDOR - SERVIÇOS\n');
    console.log('┌─────────────────────────────────────────────────────────────────────────────────────┐');
    console.log('│ Vendedor    │ PROTEÇÃO LÍ │ GARANTIA EXT │ SERVIÇOS │ ASSISTÊNCIA │ GERAL │  TOTAL │');
    console.log('├─────────────────────────────────────────────────────────────────────────────────────┤');

    const analise = vendas.map(v => {
      const det = v.detalhes || {};
      return {
        vendedor: v.vendedor_nome,
        protecao: det['PROTEÇÃO LÍDER'] || 0,
        garantia: det['GARANTIA ESTENDIDA'] || 0,
        servicos: det['SERVIÇOS'] || 0,
        assistencia: det['ASSISTÊNCIA TÉCNICA'] || 0,
        geral: det['GERAL'] || 0,
      };
    }).sort((a, b) => {
      const totalA = a.protecao + a.garantia + a.servicos + a.assistencia + a.geral;
      const totalB = b.protecao + b.garantia + b.servicos + b.assistencia + b.geral;
      return totalB - totalA;
    });

    let totalGeral = 0;
    analise.forEach(a => {
      const total = a.protecao + a.garantia + a.servicos + a.assistencia + a.geral;
      totalGeral += total;
      console.log(`│ ${a.vendedor.padEnd(11)} │ R$ ${a.protecao.toFixed(2).padStart(8)} │ R$ ${a.garantia.toFixed(2).padStart(9)} │ R$ ${a.servicos.toFixed(2).padStart(5)} │ R$ ${a.assistencia.toFixed(2).padStart(8)} │ R$ ${a.geral.toFixed(2).padStart(6)} │ R$ ${total.toFixed(2).padStart(7)} │`);
    });
    console.log('├─────────────────────────────────────────────────────────────────────────────────────┤');
    console.log(`│ TOTAL (SERVIÇOS + PROTEÇÃO + GARANTIA + OUTROS): R$ ${totalGeral.toFixed(2).padStart(40)} │`);
    console.log('└─────────────────────────────────────────────────────────────────────────────────────┘\n');

    // Buscar anomalia de 2.545
    console.log('\n🔍 BUSCANDO ANOMALIA DE ~R$ 2.545\n');

    // Somar TODOS os campos "SERVIÇOS-like"
    let acumulado = 0;
    const campos_servicos = ['PROTEÇÃO LÍDER', 'GARANTIA ESTENDIDA', 'SERVIÇOS', 'ASSISTÊNCIA TÉCNICA'];

    const detalhes_por_categoria = {};

    analise.forEach(a => {
      campos_servicos.forEach(campo => {
        const venda = vendas.find(v => v.vendedor_nome === a.vendedor);
        const valor = venda.detalhes[campo] || 0;
        if (valor > 0) {
          if (!detalhes_por_categoria[campo]) {
            detalhes_por_categoria[campo] = [];
          }
          detalhes_por_categoria[campo].push({ vendedor: a.vendedor, valor });
        }
      });
    });

    console.log('CAMPOS "SERVIÇOS" ENCONTRADOS:\n');
    Object.entries(detalhes_por_categoria).forEach(([campo, valores]) => {
      console.log(`\n${campo}:`);
      let subtotal = 0;
      valores.sort((a, b) => b.valor - a.valor).forEach(v => {
        console.log(`  ${v.vendedor.padEnd(15)} R$ ${v.valor.toFixed(2).padStart(10)}`);
        subtotal += v.valor;
        // Procurar por 2.545
        if (Math.abs(v.valor - 2545) < 100) {
          console.log('  ⚠️  POSSÍVEL ANOMALIA ENCONTRADA!');
        }
      });
      console.log(`  ${'─'.repeat(28)}`);
      console.log(`  Subtotal: R$ ${subtotal.toFixed(2)}`);
    });

    // Análise detalhada de cada venda
    console.log('\n\n📋 DUMP COMPLETO - DETALHES POR VENDA\n');
    vendas.forEach(v => {
      console.log(`\n${v.vendedor_nome}:`);
      const det = v.detalhes;
      const chaves_importantes = ['PROTEÇÃO LÍDER', 'GARANTIA ESTENDIDA', 'SERVIÇOS', 'ASSISTÊNCIA TÉCNICA', 'GERAL', '__qtd_servicos'];
      chaves_importantes.forEach(chave => {
        if (det[chave] !== undefined && det[chave] !== 0) {
          console.log(`  ${chave.padEnd(25)} R$ ${det[chave].toFixed(2)}`);
        }
      });
    });

  } catch (err) {
    console.error('Erro:', err.message);
    process.exit(1);
  }
}

analisar();
