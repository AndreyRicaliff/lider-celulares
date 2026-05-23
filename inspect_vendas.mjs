import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ibpcexyrxwmknrfwifyy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlicGNleHlyeHdta25yZndpZnl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjUzNDcsImV4cCI6MjA5NDYwMTM0N30.noVxEIHwpeaSNiaaV7VG5ZzmJqJYXFrBLgh_8w_eDFY'
);

async function inspect() {
  try {
    // Buscar dados SEM filtro para entender a estrutura
    const { data: vendas, error } = await supabase
      .from('vendas')
      .select('*')
      .limit(20);

    if (error) {
      console.error('Erro na query:', error);
      process.exit(1);
    }

    console.log('=== PRIMEIROS 3 REGISTROS (estrutura completa) ===\n');
    
    vendas.slice(0, 3).forEach((v, idx) => {
      console.log(`\nRegistro ${idx + 1}:`);
      console.log(JSON.stringify(v, null, 2));
    });

    console.log('\n\n=== COLUNAS ENCONTRADAS ===');
    if (vendas.length > 0) {
      console.log(Object.keys(vendas[0]).join(', '));
    }

    // Filtrar para Natal maio 2026
    console.log('\n\n=== FILTRANDO loja_id=natal, mes=2026-05 ===');
    const { data: natal, error: err2 } = await supabase
      .from('vendas')
      .select('*')
      .eq('loja_id', 'natal')
      .eq('mes', '2026-05');

    if (err2) {
      console.error('Erro:', err2);
    } else {
      console.log(`Registros encontrados: ${natal.length}`);
      natal.forEach((v, idx) => {
        console.log(`\n--- Registro ${idx + 1} ---`);
        console.log(JSON.stringify(v, null, 2));
      });
    }

  } catch (err) {
    console.error('Erro:', err.message);
    process.exit(1);
  }
}

inspect();
