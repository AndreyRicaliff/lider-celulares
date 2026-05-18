import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { dadosAnalise } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Você é um consultor especialista em vendas de varejo de telecomunicações (lojas de celular/operadora). 
Analise os dados de desempenho de vendas abaixo e gere um relatório detalhado e prático em português brasileiro.

REGRAS:
- Seja direto e objetivo, use linguagem profissional mas acessível
- Use emojis para destacar pontos importantes
- Estruture o relatório em seções claras
- Para cada vendedor, dê feedback específico: pontos fortes, onde precisa melhorar, e sugestões práticas
- Analise o ritmo de vendas vs meta e dê projeções realistas
- Identifique padrões: quem está acelerando, quem está desacelerando
- Dê uma nota de urgência (🟢 tranquilo, 🟡 atenção, 🔴 crítico) para cada vendedor e para a loja
- Ao final, dê 3 recomendações estratégicas para o gerente melhorar o resultado da loja

FORMATO DO RELATÓRIO:
## 📊 Panorama Geral da Loja
(Resumo do status da loja, projeções, nível de urgência)

## 👥 Análise Individual dos Vendedores
(Para cada vendedor: performance, pontos fortes, melhorias, nota de urgência)

## 🎯 Recomendações Estratégicas
(3 ações concretas para o gerente)`;

    const userPrompt = `Dados da Análise de Metas:

Loja: ${dadosAnalise.lojaNome}
Mês: ${dadosAnalise.mes}
Progresso do mês: Dia ${dadosAnalise.diasDecorridos} de ${dadosAnalise.diasTotais} (${dadosAnalise.proporcaoMes}%)

META PRATA:
- Realizado: R$ ${dadosAnalise.totalParaMetaPrata?.toFixed(2)}
- Meta: R$ ${dadosAnalise.metaPrata?.toFixed(2)}
- Percentual: ${dadosAnalise.percentualPrata?.toFixed(1)}%
- Falta: R$ ${dadosAnalise.faltaPrata?.toFixed(2)}
- Meta diária atual: R$ ${dadosAnalise.metaDiariaAtualPrata?.toFixed(2)}
- Projeção fim do mês: R$ ${dadosAnalise.projecaoPrata?.toFixed(2)} (${dadosAnalise.projecaoAtingePrata ? 'ATINGIRÁ' : 'NÃO ATINGIRÁ'})

META OURO:
- Realizado: R$ ${dadosAnalise.totalParaMetaOuro?.toFixed(2)}
- Meta: R$ ${dadosAnalise.metaOuro?.toFixed(2)}
- Percentual: ${dadosAnalise.percentualOuro?.toFixed(1)}%
- Falta: R$ ${dadosAnalise.faltaOuro?.toFixed(2)}
- Meta diária atual: R$ ${dadosAnalise.metaDiariaAtualOuro?.toFixed(2)}
- Projeção fim do mês: R$ ${dadosAnalise.projecaoOuro?.toFixed(2)} (${dadosAnalise.projecaoAtingeOuro ? 'ATINGIRÁ' : 'NÃO ATINGIRÁ'})

Status geral: ${dadosAnalise.diferencaProjetada >= 0 ? 'ACIMA' : 'ABAIXO'} do esperado em R$ ${Math.abs(dadosAnalise.diferencaProjetada || 0).toFixed(2)}

VENDEDORES:
${dadosAnalise.vendedores?.map((v: any) => `
- ${v.nome} (${v.cargo}):
  Smartphones: R$ ${v.smartphones?.toFixed(2)} | Meta: R$ ${v.metaSmartphones?.toFixed(2)} | ${v.percentualMeta?.toFixed(1)}%
  Serviços: R$ ${v.servicos?.toFixed(2)}
  Meta diária inicial: R$ ${v.metaDiariaVendedor?.toFixed(2)} | Meta diária atual: R$ ${v.metaDiariaVendedorAtual?.toFixed(2)}
  Patamares serviço: 1º ${v.atingiuFase1 ? '✓' : '✗'} | 2º ${v.atingiuFase2 ? '✓' : '✗'} | 3º ${v.atingiuFase3 ? '✓' : '✗'}
  Meta smartphones: ${v.atingiuMeta ? 'ATINGIDA ✓' : 'NÃO ATINGIDA'}
`).join('\n') || 'Nenhum vendedor cadastrado'}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes para análise IA." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro ao gerar análise" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("analyze-metas error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
