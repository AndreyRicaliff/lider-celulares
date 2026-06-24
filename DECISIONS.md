# DECISIONS — Líder Celulares

Registro de decisões técnicas datadas, em primeira pessoa. Material de defesa em entrevista.

> Regra (CLAUDE.md §ENSINAR EM CONTEXTO): toda mudança não-trivial vira entrada aqui no mesmo commit da feature.
>
> Decisões marcadas **[reconstruído]** vieram de evidência (git/memória/código). Decisões com `[reconstruir com Ricalfiff]` precisam de sessão dedicada — não decorar, é fato observado sem motivação confirmada.

---

## 2026-06-18 — [retificação] O alvo é o ② "Preço de venda", NÃO o "Total bruto"

**Contexto:** a entrada abaixo (espelhar Total bruto) partiu de premissa errada. Ao comparar com a tela **"Resultado por produto"** do Tenfront (Campina, 2026-06-18), ficou claro que o Tenfront tem DOIS conceitos:
- **"Faturamento" (dashboard)** = 112.726,85 — inflado, inclui juros/troca/etc., **NÃO reproduzível pela API** (sondei 14 endpoints, todos 404; 14 fórmulas, nenhuma fecha).
- **② "Total preço venda produto"** = 94.603,81 — a base de comissão, = `Σ "Valor de venda" dos itens (Venda+Brinde)`.

**Decisão final:** o painel espelha o **②**. `valor_total = Σ itens` (cálculo original) **+ guard de Total bruto < 0** (exclui compra de seminovo). Revertido: "espelhar Total bruto", categoria TROCA, recuperação do GAR — tudo errado (o próprio ② do Tenfront ignora a revenda via troca).

**Validação:** reconciliação centavo a centavo — `Venda+Brinde, excl. seminovo = 94.603,81 ✓EXATO`. Após reprocesso, banco de Campina: líquido = **94.603,81** (= ② oficial), custo 66.888,61 (Δ+22,50, 1 brinde). Deployado e verificado em prod.

**Lição:** não assumir qual métrica do ERP é o alvo. "Faturamento" do dashboard ≠ base de comissão. Sempre reconciliar contra a tela exata que o cliente usa.

**Como explicar em entrevista (30s):**
> "O ERP mostrava dois números de receita — um 'faturamento' de dashboard, inflado e sem endpoint na API, e o 'preço de venda por produto', que é a base de comissão. Eu estava perseguindo o número errado. Reconciliei contra a tela de resultado por produto e fechei centavo a centavo: soma do valor de venda dos itens, excluindo a compra de seminovo que o ERP registra com total negativo."

**Fonte:** sessão 2026-06-18 com Ricalfiff (telas do Tenfront + reconciliação fresca).

---

## 2026-06-18 — [fix] (SUPERADA pela retificação acima) Faturamento passa a espelhar "Total bruto"

**Problema:** Campina-Grande vinha com "dados a mais". Diagnóstico (`scripts/diag-campina-dup.mjs` + dump `scripts/diag-atendimento.mjs`, dados frescos da API) isolou a causa: **não é parse nem paginação** (521 atend, 521 IDs únicos). É uma **compra de seminovo registrada como venda**:
- `ATE-EE7SBAA`: iPhone 17 Pro Max seminovo, item em `Venda` com `Valor de venda 8.300`, mas `Total bruto = −8.300` (a loja *comprou* o aparelho — saída de caixa). O `map-venda` somava `info.Venda` sem olhar o sinal → contava +8.300 de receita **e pagava comissão** ao vendedor sobre uma compra.
- `GAR-P5NVFK7` (mesmo IMEI, a revenda): `Total bruto +8.800`, item em `Troca` sem `Valor de venda` → o código contava **0** (receita perdida).

A premissa antiga no código ("itens de troca têm Valor de venda 0") era **falsa**.

**Opções consideradas:**
- A — remendar caso a caso (excluir bruto<0 e ler "Proposta" da troca) — frágil, não generaliza.
- B — **inverter a base**: faturamento = `Total bruto` (fonte oficial); itens só fazem a quebra por categoria; resíduo (líquido − Σ itens) vai para categoria `TROCA`.

**Decisão:** B. (1) `Total bruto < 0` → `return null` (compra/devolução, espelha o Tenfront). (2) `valor_bruto = Total bruto`, `valor_total = Total bruto − juros`. (3) resíduo positivo → categoria `TROCA`, **não-comissionável** (nenhum calculador lê `'TROCA'`).

**Por quê:** o `Total bruto` é a verdade oficial (validada pela invariante `bruto = venda + juros` nas lojas sãs); a soma de itens só coincide quando não há troca. Resíduo em `TROCA` faz o total fechar sem pagar comissão sobre valor sem categoria — conservador no que toca dinheiro de vendedor.

**Validação (simulação no cache + type-check):** lojas sãs (Natal/Monteiro/Soledade) Δ ≤ 0,01 — **zero regressão**. Campina Δ=+500 (−8.300 da compra +8.800 da revenda = resultado contábil real do seminovo). Caruaru +2.025 (receita de troca recuperada). `tsc --noEmit --strict` exit 0.

**Consequências / dívidas:**
- `custo`/`lucro` da operação de troca ficam aproximados (custo segue só itens de Venda; o resíduo TROCA não tem custo associado). Não afeta comissão (que é por categoria de venda), mas o lucro do atendimento de troca fica otimista. Anotado.
- `TROCA` não gera comissão por padrão — se o cliente quiser comissionar venda de seminovo, é decisão futura.
- **Não deployado** — mudança em edge function de produção aguarda branch/PR/deploy autorizado.

**Como explicar em entrevista (30s):**
> "O painel reconstruía o faturamento somando os itens de venda, então uma compra de aparelho usado (que o ERP registra com total negativo) entrava como receita positiva e ainda gerava comissão, enquanto a revenda via troca era perdida. Inverti a base: o total passa a vir do campo oficial do ERP, os itens só fazem a quebra por categoria, e o que sobra vira uma linha de troca que não comissiona. Validei que as lojas sem troca não mudam nada."

**Fonte:** sessão 2026-06-18 com Ricalfiff. Decisões confirmadas via AskUserQuestion (excluir seminovo + recuperar troca).

---

## 2026-06-18 — [domínio] Regra de cálculo do faturamento Tenfront (fórmula reconciliada)

**Problema:** o painel precisava reproduzir exatamente os números oficiais do Tenfront (Faturamento, Preço de venda, Custo, Lucro), mas faltava a fórmula confirmada — qual campo entra em cada métrica e como bruto/líquido se relacionam.

**Método:** `scripts/analise-formula.mjs` lê o cache de junho (`scripts/_cache-junho.json`, zero quota) e testa cada fórmula candidata contra os valores oficiais por loja.

**Confirmado com dados FRESCOS (2026-06-18, `scripts/diag-reconcile-tenfront.mjs` puxando da API ao vivo):** como junho está aberto, comparar com a tabela `OFICIAL` (snapshot de 17/jun) é inútil — os Δ ficam poluídos pelo crescimento do mês. A prova real é a **identidade contábil interna no mesmo snapshot**: `Σ Total bruto = Σ Valor de venda + juros`. Bate ao vivo em **Natal** (Δ=0,31), **Monteiro** (exato) e **Soledade** (exato) — matemática interna dos dados, independente de qualquer número oficial. Lição metodológica: validar fórmula por invariante interna, NUNCA por match contra um snapshot oficial de período aberto.

**Fórmula confirmada:**

| Métrica Tenfront | Fórmula |
|---|---|
| **① Faturamento** | `Σ "Total bruto"` por atendimento = **Líquido + Juros** |
| **② Preço de venda (líquido)** | `Σ "Valor de venda"` dos itens de **Venda** = `① − juros` (base de comissão) |
| **Juros (acréscimo de parcelamento)** | `Σ ("Valor com acréscimo" − "Valor informado")` dos Pagamentos |
| **Custo** | `Σ Custo × qtd` **só dos itens de Venda** (NÃO troca/brinde) |
| **Lucro** | `② − Custo` |
| **Desconto** | já embutido no Valor de venda — **não soma** |

**Por quê (invariantes de domínio):**
- `Faturamento − Preço de venda = juros` — provado em Soledade (`30.318,43 − 29.269,74 = 1.048,69 = juros`). Juros é a ÚNICA diferença entre bruto e líquido.
- O código (`map-venda.ts`) usa `valor_bruto = líquido + juros` em vez do `"Total bruto"` cru — deliberado: o campo cru é distorcido por troca (vem negativo no seminovo) e por registros GAR/garantia sem venda. Troca é forma de pagamento, não receita (regra do cliente).
- O campo `"Total custos"` do atendimento está SEMPRE inflado (Natal +17k) porque inclui custo de itens de troca/seminovo. O custo oficial é só `Custo×qtd` dos itens de **Venda**.

**Consequências / dívidas abertas:**
- `map-venda.ts` soma custo de Brinde/Troca além de Venda. Impacto pequeno (quase sempre valor 0), mas pela regra deveria ser só Venda. Anotado, não corrigido nesta sessão (a pedido).
- **Campina-Grande não reconcilia (confirmado ao vivo 18/jun)** — `Σ valorVenda (104.308) > Σ Total bruto (97.023)`, o que é contabilmente impossível (bruto ≥ líquido sempre). Reproduz idêntico no fetch fresco → **bug de dados/parse, não de fórmula.** Campina é a loja do JSON inválido (barras soltas); o parse resiliente está **duplicando/inflando itens de venda**. Investigar `parseTenfrontJson`/`escapeInvalidBackslashes` antes de confiar no número de Campina.
- **Caruaru tem leve divergência (Δ 2.025) no script de diagnóstico** porque ele só soma itens de `Venda`; a loja tem brinde/troca com valor que entram no `Total bruto`. O `map-venda.ts` de produção soma brinde/troca>0, então fecha melhor — confirma que incluir brinde/troca no líquido está certo.
- Threshold/heurísticas de categoria não afetam os totais — só a quebra por grupo.

**Como explicar em entrevista (30s):**
> "O ERP mostra Faturamento e Preço de venda e eu precisava reproduzir os dois. Reconciliei por engenharia reversa contra os números oficiais: o líquido é a soma dos valores de venda dos itens, o faturamento é o líquido mais os juros de parcelamento, e o custo/lucro só contam itens de venda — troca e brinde ficam de fora porque troca é forma de pagamento, não receita. Validei numa loja que fechou centavo a centavo nas quatro métricas."

**Fonte:** sessão 2026-06-18 com Ricalfiff, via `scripts/analise-formula.mjs` sobre cache de junho.

---

## 2026-05 — [diagnóstico] Entregar diagnóstico formal antes de implementar (Fase 1 → Fase 2) **[reconstruído]**

**Problema:** O cliente tinha uma integração instável que "travava por tempo indeterminado". A pressão era ir direto para o fix. A causa raiz ainda era desconhecida.

**Opções consideradas:**
- A — Ir direto para o desenvolvimento (Fase 2) — mais rápido na aparência; risco alto de corrigir sintoma errado; se a causa for outra, reescrever tudo
- B — Entregar diagnóstico formal primeiro (Fase 1, 2-3 dias úteis) com causa identificada + evidências, depois implementar (Fase 2, 5-12 dias úteis) — mais lento; mas cliente entende o problema antes de pagar a solução

**Decisão:** B — Fase 1 diagnóstico primeiro.

**Por quê:** Sem saber a causa, qualquer implementação é chute. O diagnóstico revelou que o problema era esgotamento de quota diária da API Tenfront — não bug de código, não problema de rede, não instabilidade do Lovable. Sem essa etapa, teria reescrito a integração sem resolver nada.

**Consequências:** O diagnóstico fechado em 2026-05-15 confirmou: plano Estratégia (máximo disponível) = 350 req/dia; sync a cada 5min consome ~288 req → esgota em ~14h → integração trava até reset à meia-noite. Toda a arquitetura da Fase 2 parte dessa causa raiz.

**Como explicar em entrevista (30s):**
> "O cliente descrevia a integração como 'travando'. Em vez de ir direto para o código, entreguei um diagnóstico formal em 3 dias úteis. Descobri que a causa era esgotamento de quota diária da API do ERP — o sync a cada 5 minutos consumia 288 requisições por dia, mas o plano máximo disponível era 350. Às 14h a quota zerava e a integração parava até meia-noite. Sem esse diagnóstico, teria reescrito código saudável."

**Fonte da reconstrução:** memória `project_lider_celulares.md` (Diagnóstico FECHADO 2026-05-15)

---

## 2026-05 — [sync] Intervalo de 10 minutos com budget de 300 req/dia **[reconstruído]**

**Problema:** Com 350 req/dia no plano Estratégia (máximo), qual intervalo de sync garante dados frescos sem esgotar a quota?

**Opções consideradas:**
- A — 5 minutos (sync original) — mais fresco; mas 24h × 12 ciclos/hora × 2 páginas = 576 req/dia → esgota antes das 9h; pior que o estado atual
- B — 15 minutos — 96 ciclos/dia × 2 = 192 req → sobra 158 para reserva e full-sync; mas dados ficam até 15min atrasados
- C — 10 minutos — 144 ciclos/dia × 2 = 288 req → 300 com margem de segurança (50 req reserva para full-sync e saldo check); dados com no máximo 10min de atraso

**Decisão:** C — 10 minutos.

**Por quê:** 10 minutos é o intervalo que maximiza a frequência de atualização dentro do budget diário. O cálculo: 144 ciclos × 2 páginas = 288 req + 12 req de `/v1/saldo-token` (check antes de cada ciclo) = ~300 req, deixando 50 de reserva para full-sync das 00:00. 5min esgota, 15min é mais conservador do que precisa.

**Consequências:** Dados com até 10min de atraso — aceitável para dashboard de vendas. O commit `chore(cron): switch cron to 30-min interval` sugere que em algum momento o intervalo foi ajustado para 30min; o valor definitivo deve ser confirmado com o estado atual do cron. Commit `fix(sync): skip daily-rate-limited lojas` mostra que a lógica de skip por quota está implementada.

**Como explicar em entrevista (30s):**
> "O plano máximo do ERP era 350 requisições por dia. Com sync a cada 10 minutos, o math é: 144 ciclos × 2 páginas = 288 requisições, deixando 50 de reserva para o full-sync noturno e os checks de saldo. 5 minutos esgotava antes das 9h. 10 minutos é o intervalo ótimo dentro do budget — dados com no máximo 10 minutos de atraso, que é aceitável para dashboard de vendas."

**Fonte da reconstrução:** memória `project_lider_celulares.md` (Arquitetura planejada), git log (`chore(cron): switch cron to 30-min interval`, `perf(sync): reduce Tenfront API calls by 40% via shared saldo check`)

---

## 2026-05 — [confiabilidade] Check de saldo antes de cada ciclo de sync **[reconstruído]**

**Problema:** Mesmo com intervalo de 10min, picos de uso ou requests anteriores podiam esgotar a quota antes do previsto. Um ciclo rodando sem saldo gera erro 429 + dados corrompidos pela metade.

**Opções consideradas:**
- A — Confiar no cálculo de requests e nunca checar — simples; mas se algo consumir quota fora do esperado (bug, request manual, outro processo), o sync cai silenciosamente na metade
- B — Chamar `/v1/saldo-token` antes de cada ciclo — +1 req por ciclo (~144 req/dia extras); mas garante que o sync só roda se há saldo; skip elegante quando não há

**Decisão:** B — check de saldo antes de cada ciclo.

**Por quê:** O custo é 1 req por ciclo (144/dia), e o benefício é saber com certeza antes de consumir as 2 páginas se há saldo disponível. Sem isso, um ciclo pode consumir 1 página e falhar na 2ª — dados do dia meio-sincronizados são piores do que dados atrasados. O commit `perf(sync): reduce Tenfront API calls by 40% via shared saldo check` mostra que o check foi otimizado para ser compartilhado.

**Consequências:** Quando saldo insuficiente, o ciclo é pulado com log. O commit `fix(sync): saldo_insuficiente must contain 'diário' to be detected by skip query` indica que a detecção do skip foi refinada — a string de resposta da API tem formato específico.

**Como explicar em entrevista (30s):**
> "Antes de cada ciclo, chamo o endpoint de saldo da API. Custa 1 requisição a mais por ciclo, mas garante que o sync só roda quando há budget disponível. Um ciclo interrompido pela metade gera dados inconsistentes — metade das vendas do dia sincronizada é pior do que dados com 10 minutos de atraso. O check de saldo é o guard que mantém o banco sempre consistente."

**Fonte da reconstrução:** memória `project_lider_celulares.md` (Arquitetura planejada: saldo check), git log (`perf(sync): reduce Tenfront API calls by 40% via shared saldo check`, `fix(sync): saldo_insuficiente must contain 'diário'`)

---

## 2026-05 — [consistência] Full-sync dos últimos 7 dias às 00:00 **[reconstruído]**

**Problema:** O sync incremental de 10min garante dados recentes, mas não cobre lacunas: vendas editadas retroativamente, registros que chegaram fora de ordem, ou períodos onde a quota zerou.

**Opções consideradas:**
- A — Só sync incremental — simples; mas deriva ao longo do tempo; erros de janela ou quota esgotada criam gaps permanentes no banco
- B — Full-sync diário (todos os dados desde sempre) — garante integridade total; mas consome todo o budget diário de uma vez às 00:00; inviável com 350 req/dia
- C — Full-sync dos últimos 7 dias às 00:00 — cobre o período com maior probabilidade de edições retroativas; budget controlado; mesmo padrão que o BETO MOTOBIKE usa com full-year

**Decisão:** C — full-sync dos últimos 7 dias às 00:00.

**Por quê:** O padrão foi estabelecido no BETO MOTOBIKE (full-year às 00:00) e reutilizado aqui por consistência cross-project. A janela de 7 dias é suficiente para cobrir edições retroativas típicas de ERP (ajustes de fechamento mensal, estornos). O horário 00:00 aproveita o reset diário da quota Tenfront, que também ocorre à meia-noite.

**Consequências:** O banco converge para o estado correto a cada 24h no mínimo. O sync incremental mantém dados frescos durante o dia. Idempotência por ID de atendimento garante que re-processar o mesmo registro é seguro.

**Como explicar em entrevista (30s):**
> "O sync incremental de 10 minutos cobre o dia a dia, mas não corrige gaps — se a quota zerou às 14h, aquele período ficou sem sync. O full-sync das 00:00 cobre os últimos 7 dias e garante que o banco converge para o estado correto pelo menos uma vez por dia. O horário é estratégico: a quota Tenfront reseta à meia-noite, então o full-sync começa com 350 requisições disponíveis."

**Fonte da reconstrução:** memória `project_lider_celulares.md` (Arquitetura planejada: full-sync 7 dias 00:00, referência BETO MOTOBIKE), git log (`feat(sync): add full-year sync on Sundays at 18h BRT`)

---

## 2026-05 — [banco] Idempotência por ID de atendimento no Supabase **[reconstruído]**

**Problema:** O sync incremental re-processa janelas de tempo com overlap de 10 minutos para não perder registros na borda. Isso significa que o mesmo atendimento pode chegar múltiplas vezes.

**Opções consideradas:**
- A — INSERT simples — cada re-processamento duplica o registro; banco cresce com lixo; métricas de vendas infladas
- B — DELETE + INSERT por janela — limpa a janela antes de inserir; perde dados se o DELETE rodar e o INSERT falhar
- C — UPSERT por ID de atendimento (`ON CONFLICT (id) DO UPDATE`) — idempotente por natureza; re-processar o mesmo ID atualiza o registro em vez de duplicar

**Decisão:** C — UPSERT por ID.

**Por quê:** O ID de atendimento no Tenfront é imutável e único. UPSERT garante que re-processar é sempre seguro, independente de quantas vezes o mesmo atendimento aparecer. O commit `fix(sync): remove page-1 skip opt that caused missing records + upsert instead of delete+insert` mostra que o padrão DELETE+INSERT foi descartado explicitamente em favor de UPSERT.

**Consequências:** O banco Supabase é sempre convergente. O full-sync de 7 dias pode rodar múltiplas vezes sem efeito colateral. Isso também simplifica recovery em caso de falha — basta re-rodar o sync.

**Como explicar em entrevista (30s):**
> "O sync usa overlap de janela — cada ciclo re-processa os últimos 10 minutos para não perder registros na borda. Isso significa o mesmo atendimento pode chegar duas vezes. Resolvi com UPSERT por ID de atendimento: se o registro já existe, atualiza; se não existe, insere. O banco é idempotente por design — posso re-rodar o full-sync quantas vezes quiser sem criar duplicatas."

**Fonte da reconstrução:** memória `project_lider_celulares.md` (Arquitetura planejada: idempotência por ID), git log (`fix(sync): remove page-1 skip opt + upsert instead of delete+insert`)

---

## 2026-05 — [estratégia] Por que não pedir aumento de quota ao Tenfront

**Problema:** o cliente está no plano máximo (Estratégia, 350 req/dia). Pedir mais quota parece a solução mais simples — por que não fizemos isso?

**Opções consideradas:**
- A — solicitar quota personalizada ao Tenfront — **não existe**: o Estratégia é o teto comercial, não há plano enterprise/customizado acima
- B — adaptar a integração ao limite do plano atual — zero custo adicional; resolve com engenharia

**Decisão:** B — adaptar à quota existente.

**Por quê:** o Tenfront não oferece quota acima do Estratégia. Não havia caminho comercial para escalar — engenharia foi o único caminho real. Não é uma escolha entre "pagar mais" vs "trabalhar mais", é uma restrição dura do fornecedor. *(confirmado em sessão 2026-06-01)*

**Consequências:** a solução técnica é completamente funcional dentro das 350 req/dia. Como a quota é teto comercial fixo, todo crescimento futuro do cliente (mais filiais, mais transações) **pressiona o mesmo limite** — a arquitetura tem que continuar otimizando consumo (overlap, dedup, incrementais maiores), não esperar headroom novo.

**Como explicar em entrevista (30s):**
> "O cliente estava no plano máximo do ERP — não existia opção comercial de subir quota. Engenharia era o único caminho. Reescrevi o sync para caber em 300 req/dia com overlap, check de saldo antes de cada ciclo, e full-sync diário às 00:00 quando o budget reseta. A restrição vira invariante do design: toda otimização futura tem que preservar esse teto."

**Fonte da reconstrução:** memória `project_lider_celulares.md` + confirmação 2026-06-01 com Ricalfiff

---

## 2026-06-08 — [sync] ID-stop por âncora de atendimento + reclassificação GERAL≥R$900 como smartphone

**Problema:** dois pontos no `sync-tenfront`. (1) A API Tenfront ignora o filtro de data no servidor e devolve **todas** as páginas; o early-stop por data ainda fazia lojas grandes (Natal) varrerem 6-7 páginas por ciclo, pressionando a quota de 300 req/dia. (2) Vendas caras sem grupo mapeado caíam em `GERAL`, subavaliando a receita de smartphones nos relatórios.

**Opções consideradas:**
- Paginação — A: manter early-stop só por data (empata em dias com muitos atendimentos, re-busca páginas inteiras); B: âncora pelo **último `atendimento_id` já gravado** em `atendimentos_audit` — como a API é newest-first, para de paginar assim que reencontra esse ID.
- Classificação — A: manter `GERAL` e corrigir manualmente; B: heurística de domínio — em loja de celular, item sem categoria com `valor ≥ R$900` é quase sempre aparelho → `classifySmartphone`.

**Decisão:** B nos dois casos. ID-stop com fallback para early-stop por data (primeiro sync do mês, sem `lastKnownId`) e fallback final de `maxPages`. Threshold de R$900 confirmado com Ricalfiff em 2026-06-08.

**Por quê:** o ID exato corta Natal de 6-7 páginas para ~1 sem risco de perda — a API entrega newest-first, então ao reencontrar o ID âncora tudo mais novo já foi coletado antes na própria lista, e o `upsert onConflict: atendimento_id` mantém a idempotência (ver decisão de 2026-05). A reclassificação recupera receita mal-categorizada; o falso-positivo (acessório caro ≥ R$900) é raro e tolerável frente ao ganho. Também: `force=true` (cron) deixou de forçar full fetch — só bypassa o guard de intervalo — para o early-stop valer também nos ciclos do cron; e o check de saldo passou a rodar sempre (economiza N-1 req por ciclo).

**Consequências:** consumo de quota cai bem em lojas de alto volume. A heurística de R$900 vira invariante de domínio: se a tabela de preços mudar de patamar, o threshold precisa ser revisto. Logs de debug verbosos (`[GERAL_STEP9→PHONE]` etc.) ficam ligados por ora para auditar reclassificações — remover quando estabilizar (dívida anotada).

**Como explicar em entrevista (30s):**
> "A API do ERP não filtrava por data e devolvia todas as páginas, então lojas grandes varriam 6-7 páginas por ciclo e estouravam a quota. Usei o último ID de atendimento já salvo como âncora: como a API é newest-first, paro de paginar assim que reencontro esse ID — tudo mais novo já veio antes na lista, e o upsert por ID garante idempotência. Caiu pra ~1 página por ciclo."

**Fonte:** sessão 2026-06-08 com Ricalfiff (deploy autorizado).

---

## 2026-06-09 — [bug-prod] Janela de data e JSON inválido da API Tenfront travavam o sync incremental

**Problema:** dois comportamentos não-documentados da API Tenfront, descobertos em smoke test pós-deploy:
1. **Janela de data:** a API só retorna registros quando `data-inicial` é o **primeiro dia do mês**. Qualquer data mais recente devolve **zero** — mesmo havendo vendas no período. Como o sync incremental enviava `data-inicial = lastSyncDate − 1`, lojas já sincronizadas (natal, caruaru, monteiro, soledade) recebiam vazio a cada ciclo. Só o full-sync das 00:00 (que busca do dia 1) funcionava → dados pareciam "travar" durante o dia.
2. **JSON inválido:** a API emite barra invertida solta em campos de texto (ex: Fornecedor `"Moura \ cliente"`), que não é escape JSON válido. O `JSON.parse`/`.json()` morria e derrubava o sync da loja inteira (campina-grande).

**Opções consideradas:**
- Janela — A: ajustar o offset de `lastSyncDate`; B: **sempre buscar do dia 1** e cortar páginas com o ID-stop client-side (já existente).
- Parse — A: regex global de sanitização (quebra `\\` legítimos); B: escapar **só** backslashes que não iniciam escape válido, varrendo char a char e preservando os demais; C: `.json()` direto (status quo, quebra).

**Decisão:** B nos dois casos. `data-inicial` fixo no dia 1; `parseTenfrontJson` tenta `JSON.parse` normal e, no erro, refaz com `escapeInvalidBackslashes` (fallback barato, só paga custo quando há lixo).

**Por quê:** não controlamos a API — o cliente tem que ser resiliente a um fornecedor que viola o contrato. Buscar do dia 1 é a única janela que a API honra, e o ID-stop (entregue em 2026-06-08) é justamente o que torna isso eficiente sem estourar a quota. O sanitizador char-a-char preserva escapes válidos (incl. `\\`) que uma regex global corromperia.

**Consequências:** sync incremental volta a atualizar durante o dia, não só à meia-noite — resolve a "inconsistência" histórica do projeto. Validado em prod: 5/5 lojas retornam dados, campina processa 478 atendimentos sem travar. O comentário antigo "a API ignora filtros de data" era verdadeiro no passado e ficou obsoleto — a API mudou de comportamento. Dívida: se a Tenfront mudar de novo, o boundary precisa ser revalidado.

**Como explicar em entrevista (30s):**
> "A API do ERP tinha dois comportamentos não-documentados: só devolvia dados se a data-inicial fosse o dia 1 do mês, e às vezes mandava JSON inválido por não escapar barras digitadas pelo usuário. O sync incremental pedia a data do último registro e recebia zero — por isso os dados só atualizavam no full-sync da meia-noite. Corrigi buscando sempre do dia 1, cortando páginas pelo último ID já salvo, e tornei o parse resiliente: tento o JSON.parse normal e, se falhar, saneio só os escapes inválidos antes de tentar de novo."

**Fonte:** sessão 2026-06-09 com Ricalfiff (deploy autorizado). Bug de janela é pré-existente (não introduzido em 2026-06-08).

---

## 2026-06-15 — [limpeza] Remoção de dead code verificado + scripts one-off da raiz

**Problema:** o projeto acumulou código morto (arquivos e exports nunca importados) e ~16 scripts de investigação/sync soltos na raiz — vários com a anon key Supabase hardcoded. Pedido: limpar e modularizar.

**Opções consideradas:**
- Detecção — A: confiar no `--fix` do eslint / inspeção manual rápida; B: contar referências de cada símbolo em todo o `src/` (grep) e só remover os com zero usos externos, com `tsc --noEmit` + `vite build` como gate antes/depois.
- Scripts da raiz — A: deletar tudo; B: deletar os one-off mas **mover** `sync-now.mjs` para `scripts/` (é o sync manual completo, possível fallback operacional).
- Modularização da edge function `sync-tenfront/index.ts` (1295 linhas) — A: deployar junto agora; B: modularizar em branch com `deno check` como gate, **sem deploy** até verificação acompanhada.

**Decisão:** B em tudo. Removidos 5 arquivos inteiros mortos (`NavLink`, `OptimizedCategorySelector`, `apiOptimization`, `useOptimization`, `cache`) + 18 símbolos mortos (hooks `useComissao`/`useSaveComissoes`/`useColaborador`/`useUpdateColaborador`/`useUpdateDivida`/`useCreateColaborador`, funções de `formatters`, `parseCurrency` duplicado, `calcularDescontosDividasSupervisor`, `CargoType`, campos do store) + dep órfã `react-router-dom`. Scripts one-off deletados, `sync-now.mjs` movido para `scripts/` (paths corrigidos para `../`). `index.ts` modularizado em 10 módulos (`types`, `constants`, `utils`, `categorization`, `price-audit`, `tenfront-api`, `db`, `map-venda`, `sync-loja`, `index`) — **commitado em branch, deploy NÃO feito**.

**Por quê:** `tsc` não acusa export não-usado (trata como API pública), então a contagem de referências foi o que deu confiança real — não a intuição. A modularização foi feita sob proteção tripla por causa do **precedente documentado de regressão** (PULSAR-RH perdeu 37 símbolos e quebrou prod, memória `pulsar_rh_modularizacao_regressao`): (1) inventário dos 37 símbolos top-level como checklist, conferido 37/37 após o split; (2) `deno check` antes/depois — o original já tinha 4 erros de tipo pré-existentes, e o gate foi "exatamente os mesmos 4, nenhum novo"; (3) diff verbatim das funções críticas (só `export` adicionado). Deploy adiado porque o Supabase deploya sem type-check estrito e a verificação real de uma edge function só acontece em produção — isso exige acompanhamento (§9).

**Consequências:** −633 linhas em `src/`, raiz sem scripts soltos, `index.ts` de 1295→219 linhas com responsabilidades separadas. Anon keys hardcoded saíram do working tree (seguem no histórico — anon key é pública por design, risco baixo; rotacionar se o repo virar público). `tsc`+`build` (frontend) e `deno check` (edge, 4 erros baseline) verdes. **Pendência: deploy da edge function modularizada + smoke test pós-deploy** (5/5 lojas gravando, campina processa sem travar) — não fazer sem acompanhar. Dívida que permanece: 102 erros de lint pré-existentes (`any`/`require`) e `sync-loja.ts` ainda com 335 linhas.

**Como explicar em entrevista (30s):**
> "Antes de remover qualquer código, contei as referências de cada símbolo no projeto inteiro — porque o TypeScript não reclama de export não-usado, ele assume que é API pública. Trabalhei em branch com typecheck e build como rede de segurança e revisei o diff. E separei deliberadamente a limpeza segura da modularização da edge function de produção, que tem precedente de regressão: misturar as duas num PR esconderia a causa de uma eventual quebra."

**Fonte:** sessão 2026-06-15 com Ricalfiff (`/revisao` — dead code + modularização).

---

## 2026-06-15 — [segurança] RLS crítico: credenciais Tenfront e escrita anônima expostas

**Problema:** auditoria do controle de acesso (pergunta "é seguro?"). O gating de telas em `App.tsx`/`Sidebar` é só UX — a segurança real é o RLS. Teste empírico com a anon key (que está no bundle público do frontend), **sem autenticar**, vazou: `lojas` (com `tenfront_api_key`/`consumer_key`/`bearer_token` — credenciais do ERP do cliente), `colaboradores`/`colaborador_lojas` (com `salario`), `vendas`/`comissoes`/`configuracoes`/`sync_logs`. Pior: `colaborador_lojas` aceitava INSERT/UPDATE/DELETE anônimo. Causa: 32 das 92 policies eram `USING (true)` `TO public` (padrão de protótipo Lovable nunca endurecido).

**Opções consideradas:**
- Aplicação — A: `supabase db push` (PROIBIDO: `migration list` mostra drift total — remote vazio em todas; reaplicaria ~50 migrations contra banco já populado); B: SQL Editor manual (à prova de drift, mas manual); C: `supabase db query --linked` (Management API, aplica só o alvo, sem tocar tracking).
- Escopo — A: reescrever as 28 tabelas agora; B: começar pelo mais crítico (credenciais + escrita anônima) e deixar refinamento por loja/role para fase 2.

**Decisão:** C + B. Migration `20260615120000_harden_rls_critical.sql`: `lojas` → `FOR ALL` só admin (`has_role`); `colaborador_lojas` → SELECT autenticado, escrita só admin. Aplicada via `db query --linked`.

**Por quê:** a edge function lê `lojas` via service_role (bypassa RLS), então travar o cliente não a afeta — confirmado rodando sync force pós-fix (`success:true`). O drift inviabilizou o fluxo normal de migration; `db query --linked` foi o único caminho cirúrgico e seguro. Verificação §16: re-teste anônimo confirmou `lojas` e `colaborador_lojas` fechados + INSERT anônimo `permission denied`.

**Consequências:** vazamento crítico (credenciais + escrita de salário) fechado e verificado em prod.

**Fase 2 nível 1 (mesma sessão, migration `20260615130000`):** removido o acesso ANÔNIMO de TODAS as 10 tabelas restantes (`botons`, `colaboradores`, `comissoes`, `configuracoes`, `dividas`, `sync_logs`, `tabela_precos`, `vendas`, `vendas_diarias`, `vendedor_bloqueios`) — `TO public USING(true)` → `TO authenticated`. Verificado: 12/12 tabelas fechadas para anon, zero policy pública restante, sync intacto. Aplicado por-tabela via `db query --linked` porque batch grande estoura limite da Management API (statements individuais e por-tabela passam; só o lote de ~66 statements falha — rollback transacional, sem dano).

**Fase 2 nível 2 (mesma sessão, migrations `20260615140000` funções helper + `20260615150000` policies):** leitura por escopo em `vendas`, `vendas_diarias`, `comissoes`, `colaboradores`. Funções `SECURITY DEFINER`: `current_colaborador_id()`, `is_gerente()`, `current_user_lojas()`. Policy SELECT: admin/supervisão = tudo; gerente = `loja_id IN current_user_lojas()`; colaborador = `colaborador_id`/`id` próprio. Escrita mantida `authenticated` (refinamento de escrita por role = futuro). **Validado com 4 usuários de teste reais** (criados via service key, logados via `signInWithPassword`, removidos ao fim): admin/sup veem 86 vendas/5 lojas; gerente-natal vê 25/só natal; vendedor vê 0 (sem vendas próprias) e só a si em colaboradores. Edge function (service_role) intacta.

**PENDÊNCIAS:** (1) **rotacionar credenciais Tenfront** (estiveram públicas = comprometidas) — ação do cliente; (2) salário e nome na mesma tabela `colaboradores` → RLS por linha não isola coluna (gerente/admin/sup veem salário; colaborador só o próprio — OK; mas se quiser esconder salário de gerente, precisa column-level ou separar tabela); (3) refinar ESCRITA por role (hoje qualquer autenticado escreve vendas/comissoes/colaboradores — a edge usa service_role, telas são admin/gerente, mas não há policy restritiva); (4) tirar credenciais Tenfront do alcance do cliente (editar via edge function); (5) validar app real logado como cada perfil (a lógica foi validada com usuários de teste).

**Como explicar em entrevista (30s):**
> "Segurança de menu não é segurança. Testei o que a chave anônima — que vai no bundle público — acessa sem login, e achei credenciais de API de terceiro e salários expostos por policies `USING(true)`, além de escrita anônima. Corrigi o crítico primeiro via Management API (porque o histórico de migrations estava em drift), confirmei que a edge function com service_role não foi afetada, e validei o fechamento re-rodando o teste anônimo. O resto do RLS virou fase 2 documentada."

**Fonte:** sessão 2026-06-15 com Ricalfiff (auditoria de segurança — fix crítico autorizado).

---

## 2026-06-15 — [acessos] Configuração de logins do zero (1 por colaborador + admin)

**Problema:** havia 24 colaboradores cadastrados mas só 10 logins (1 admin sem colaborador + 9 colaboradores); os 2 supervisores não tinham acesso. Pedido: configurar os acessos do zero.

**Opções consideradas:** escopo (recriar tudo × completar faltantes × só gestão); identidade (lista real × email gerado × adiar); senha (temporária única × individual × definir depois).

**Decisão (Ricalfiff):** recriar do zero + email gerado `slug(nome).slug(loja)@lidercelulares.local` + senha temporária única `LiderCel@2026`. Script `scripts/setup-acessos.mjs` (dry/run): backup do estado atual → wipe dos 10 logins → cria 25 (1 admin + 22 colaborador + 2 supervisao). Cargo define o role (`Supervisor`→`supervisao`, resto→`colaborador`; Gerente é derivado do cargo, como o app espera). Validado com `scripts/validate-acessos.mjs` logando como amostra real: admin/supervisor veem tudo, gerente-natal só natal, vendedor só as próprias 4 vendas.

**Por quê:** vincular cada login ao `colaborador_id` real faz o RLS por escopo (fase 2) funcionar de verdade — o vendedor vê só os próprios dados. Email gerado porque vendedores de loja não têm email corporativo; o `.local` serve como identificador de login (Supabase Auth aceita).

**Consequências:** 25 logins ativos, senha única temporária. CREDENCIAIS em `scripts/acessos-credenciais.csv` e backup em `scripts/acessos-backup.json` — **gitignored, nunca commitar**. PENDÊNCIAS: (1) trocar a senha temporária (não há fluxo "forçar troca no 1º acesso" — melhoria futura); (2) emails `.local` não recebem e-mail → recuperação de senha por e-mail não funciona, reset é via admin; (3) distribuir as credenciais aos funcionários por canal seguro.

**Como explicar em entrevista (30s):**
> "Configurei os acessos vinculando cada login ao colaborador real no banco — isso é o que faz o RLS por escopo funcionar: o vendedor só enxerga as próprias vendas porque a policy compara o colaborador_id do JWT. Gerei os emails a partir do nome+loja (lojistas não têm email corporativo), apliquei via Admin API com backup antes do wipe, e validei logando como cada perfil de verdade."

**Fonte:** sessão 2026-06-15 com Ricalfiff (config de acessos autorizada — recriar do zero).

---

## 2026-06-15 — [sync] Reprocessamento de junho: valores de serviço subcontados por dados não-recalculados

**Problema:** cliente reportou serviços de junho "incompletos" (print do Tenfront: Natal R$ 28.753,62 em serviços; banco tinha R$ 16.385). Suspeita de sync quebrado.

**Investigação (contra a fonte):** (1) cron roda a cada 30min, OK. (2) contagem de atendimentos junho bate 100% com a API (a "falta" aparente vinha da API Tenfront **ignorar o filtro de data** e devolver todo o histórico newest-first — artefato, não perda). (3) divergência real: valores de PROTEÇÃO LÍDER/GARANTIA subcontados ~43%. Causa: o **ID-stop** (decisão 2026-06-08) só processa atendimentos novos e **nunca reprocessa**; os de junho processados antes das correções de classificação (08-09/jun) ficaram com valor errado e não foram recalculados.

**Decisão:** reprocessar junho via `scripts/reprocessar-mes.mjs` (backup → limpa vendas/vendas_diarias/atendimentos_audit da loja+mês → re-sync força reconstrução com a lógica atual). Aplicado nas 5 lojas. Natal passou a bater EXATO (28.753,62 = print).

**Verificação adversarial:** `scripts/verificar-servicos.mjs` compara banco × API por loja. 3 lojas bateram exato; campina/monteiro tinham resíduo (~551/~473). Investigado: era atendimento **CANCELADO** (campina: concluída 4.253,18 = banco, cancelada 551,00). A edge function corretamente exclui cancelados; o resíduo era o script de auditoria somando tudo. **Banco correto nas 5 lojas.**

**Consequências:** valores de serviço de junho corretos. DÍVIDA/risco recorrente: **toda vez que a regra de classificação (`categorization.ts`) mudar, o histórico já sincronizado não recalcula** — é preciso reprocessar o período afetado. O full-sync diário só cobre os últimos dias. Melhoria futura: full-rebuild mensal agendado, ou versionar a lógica e reprocessar quando mudar.

**Como explicar em entrevista (30s):**
> "O cliente achou que o sync estava perdendo dados. Investiguei contra a fonte: a contagem de atendimentos batia 100% — a API do ERP é que ignora o filtro de data e devolve o histórico todo, o que confunde. A divergência real era de valor: a otimização de paginação por ID nunca reprocessa atendimentos antigos, então os de junho ficaram com a classificação velha. Reprocessei o mês e validei contra a API, inclusive descobrindo que o resíduo final eram vendas canceladas que o sistema corretamente exclui."

**Fonte:** sessão 2026-06-15 com Ricalfiff (reprocessamento autorizado).

---

## 2026-06-15 — [sync] Fix permanente: agregar vendas a partir de atendimentos_audit (não do ciclo)

**Problema:** o reprocessamento corrigia os valores, mas o cron incremental voltava a degradá-los. Causa-raiz (confirmada lendo o código + prova empírica): `vendas_diarias` era gravada com `upsert onConflict(loja,mes,data,vendedor)` montando o total do dia **só com os atendimentos do ciclo atual** — que o ID-stop limita aos novos. O upsert **sobrescrevia** o dia inteiro, perdendo os atendimentos anteriores do mesmo dia. `vendas` (mensal) somava dessas diárias corrompidas. Cada venda nova num dia já sincronizado zerava o dia para só ela.

**Opções:** A — recalcular `vendas_diarias` a partir de TODOS os `atendimentos_audit` do mês (idempotente por atendimento_id, já guarda os itens em `detalhes_brutos`); B — upsert virar merge idempotente com dedup por atendimento; C — abandonar ID-stop e buscar o mês todo sempre (estoura quota).

**Decisão:** A. Em `sync-loja.ts`: grava o audit dos novos PRIMEIRO, depois lê todos os audit do mês, reconstrói cada atendimento (`data_atendimento` ISO → "DD/MM/YYYY 12:00" para o `parseDate` sem disparar o corte das 4h; `detalhes_brutos` como "Informações do atendimento"; `pagamento`; `status`) e re-mapeia com a MESMA `mapAtendimentoToVenda` (zero duplicação de lógica). Agrega o mês completo → upsert. Mantém o ID-stop (otimiza só a BUSCA na API).

**Por quê:** o audit já é a fonte idempotente e completa; derivar dele torna a agregação correta independente de quantos atendimentos o ciclo trouxe. **Verificado em prod:** reproc natal → 28.753,62; removi 1 atendimento do audit (simula venda nova num dia existente — o cenário que degradava) + sync incremental → **manteve 28.753,62** (antes despencava). 5 lojas reprocessadas e estáveis.

**Consequências:** custo extra por ciclo: ler ~100 audits + re-mapear (CPU/DB, não quota API). Resolve a dívida da decisão anterior. A regra de classificação pode mudar livremente — basta reprocessar uma vez e o incremental mantém. `deno check` nos 4 erros baseline.

**Como explicar em entrevista (30s):**
> "A otimização de paginação por ID nunca reprocessa atendimentos antigos, e a agregação diária era montada só com o que o ciclo trazia, sobrescrevendo o dia — então qualquer venda nova zerava o resto do dia. Mudei a agregação para derivar da tabela de auditoria, que é idempotente e tem todos os atendimentos do mês, mantendo a otimização de busca. Provei o fix removendo um atendimento e rodando o ciclo incremental: o valor se manteve, quando antes despencava."

**Fonte:** sessão 2026-06-15 com Ricalfiff (fix autorizado, opção A).

---

## 2026-06-16 — [segurança] RLS de escrita por papel (fase 1 do plano de endurecimento)

**Problema:** após a fase 2 de ontem, a LEITURA estava por escopo, mas a ESCRITA seguia `authenticated USING(true)` — qualquer usuário logado podia INSERT/UPDATE/DELETE via API direta, contornando o gating de telas do frontend. Segurança de tela não é segurança.

**Decisão:** policies de escrita por papel (migration `20260616120000`), espelhando a UI:
- `colaboradores`, `configuracoes`, `vendedor_bloqueios`, `botons`, `comissoes` → escrita **admin** (`has_role(auth.uid(),'admin')`). `comissoes` inclui edição manual da Folha e o batch recalc, ambos rodando como admin no front.
- `dividas` → INSERT/DELETE admin; UPDATE admin **ou supervisão** (SupervisaoFolhaPage confirma pagamento de parcelas).
- `vendas`, `vendas_diarias`, `tabela_precos` → escrita removida do cliente; só `service_role` (edge functions) escreve.
- Tabelas com `*_auth_all` (FOR ALL) recriaram SELECT autenticado explícito para não bloquear leitura.
Também removidos 4 hooks de escrita sem caller (dead code): `useSaveVendas`, `useDeleteVendasByMonth`, `useSaveVendasDiarias`, `useCalculateBoton` (−189 linhas).

**Por quê:** o RLS é a única garantia real — a chave anon está no bundle. `service_role` (edge) bypassa RLS, então o sync não é afetado.

**Verificado:** `scripts/test-rls-write.mjs` logando como cada papel — vendedor/gerente/supervisão **bloqueados** ao inserir em `configuracoes` (`new row violates row-level security`); admin permitido; `sync-tenfront` force segue `success:true`. `tsc`+`build` verdes.

**Como explicar em entrevista (30s):**
> "Esconder o botão no front não impede um POST direto na API com a chave anon do bundle. Movi a autorização de escrita para o RLS: cada tabela aceita escrita só do papel certo (admin para cadastros/comissões, supervisão também para baixa de dívidas), e as tabelas alimentadas pelo sync só aceitam o service_role. Validei logando como cada papel e tentando escrever."

**Fonte:** sessão 2026-06-16 com Ricalfiff (plano de endurecimento aprovado, fase 1).

---

## 2026-06-16 — [arquitetura] Estoque cacheado em snapshot (fase 2)

**Problema:** `EstoquePage` puxava o estoque ao vivo da API Tenfront a cada abertura/clique (1–20 req por loja via `tenfront-stock`), sem cache. Consumia a quota escassa que o sync de vendas precisa.

**Decisão:** snapshot no banco. Tabela `estoque_snapshot` (RLS: SELECT por escopo de loja, escrita só service_role) + edge function `sync-estoque` (busca credenciais via service_role, pagina o estoque, faz **snapshot replace** por loja: delete+insert) + cron diário `sync-estoque-daily` (05:00 UTC) + `EstoquePage` agora lê do banco via `useEstoque`; botão "Atualizar" dispara `sync-estoque` server-side (`useSyncEstoque`) em vez de bater na API.

**Por quê:** estoque muda devagar — 1x/dia basta. Tirar a chamada ao vivo do cliente elimina o gasto de quota por navegação e remove o caminho que lia credenciais no browser (`fetchTenfrontStock`). Cron criado via `cron.schedule` SEM `unschedule` dos jobs de vendas.

**Verificado:** `sync-estoque` rodado nas 5 lojas (natal 96, caruaru 47, monteiro 38, soledade 31, campina 58); `estoque_snapshot` populado; `deno check`/`tsc`/`build` verdes.

**Consequências:** `fetchTenfrontStock`/`tenfront.ts` ficaram órfãos — removidos na fase 3 (credenciais). Snapshot replace não é transacional (delete+insert); se o insert falhar, a loja fica vazia até o próximo ciclo — aceitável para estoque.

**Como explicar em entrevista (30s):**
> "O estoque era puxado ao vivo do ERP a cada clique, gastando a quota diária que o sync de vendas precisa. Troquei por um snapshot no banco, sincronizado 1x/dia por uma edge function que busca as credenciais server-side. A tela passou a ler do banco; o botão atualizar dispara o sync no servidor. De quebra, removi o caminho que expunha credenciais no browser."

**Fonte:** sessão 2026-06-16 com Ricalfiff (plano aprovado, fase 2).

---

## 2026-06-16 — [segurança] Credenciais Tenfront fora do cliente (fase 3)

**Problema:** a tela de Configurações lia/editava as credenciais do ERP (`tenfront_*`) da tabela `lojas` no browser, e `useLojas` fazia `select('*')` (trazia as colunas no payload). Credenciais de terceiro nunca devem chegar ao cliente (já vazaram publicamente uma vez).

**Decisão:** remover todo acesso a credenciais no frontend. Deletados `src/lib/tenfront.ts` e `src/hooks/useStoreTenfrontConfig.ts`; removido o componente `TenfrontConfig` da `ConfiguracoesPage`; `useLojas` passou a `select('id, nome, created_at')`. A edição de credenciais virou operação administrativa via `scripts/set-loja-credenciais.mjs` (service_role, CLI). A edge function `tenfront-stock` (recebia credenciais no body) foi removida do repo — já estava substituída por `sync-estoque` (que busca credenciais server-side) e nem existia deployada.

**Por quê:** depois da fase 2 (estoque cacheado), `fetchTenfrontStock` ficou sem caller — nada no cliente precisa mais das credenciais. As edge functions (`sync-tenfront`, `sync-estoque`) buscam via service_role.

**Verificado:** `useLojas` logado como admin retorna 5 lojas SEM nenhum campo de credencial; `tsc`+`build` verdes; zero referências a `tenfront-stock` no código.

**Como explicar em entrevista (30s):**
> "As credenciais do ERP eram lidas e editadas no navegador. Tirei isso de vez: o estoque já vinha do banco (fase 2), então removi o código que lia credenciais no cliente, troquei o select('*') por colunas específicas pra nem trafegar, e movi a edição de credenciais para um script administrativo server-side. Confirmei que nenhuma resposta ao browser contém mais as chaves."

**Fonte:** sessão 2026-06-16 com Ricalfiff (plano aprovado, fase 3 — conclui o endurecimento).

---

## 2026-06-16 — [ux] Filtro de loja: default "Todas", persiste na sessão (não reseta ao navegar)

**Problema:** o filtro de loja resetava sozinho ao trocar de aba/página. Causas: (1) `selectedLoja` era persistido no localStorage; (2) default do admin era `'natal'`; (3) o `useEffect` de default re-rodava a cada mudança de dependência — e o re-foco da janela dispara `onAuthStateChange` do Supabase, recriando `user` e resetando a loja.

**Decisão:** `selectedLoja` deixa de ser persistido (sai do `partialize` do Zustand) e o `useEffect` passa a inicializar o default **uma vez por carga** via flag `useRef` (`lojaInicializada`). Default: admin/supervisão → `null` (Todas as Lojas); gerente/colaborador → sua loja (quando `colaboradorLojaId` chega).

**Por quê:** o pedido — abrir o app vem em "Todas", mas a escolha do usuário sobrevive à navegação e ao re-foco da aba; só uma nova abertura volta ao default. Não-persistir garante "abrir = Todas"; a flag garante "não reseta ao navegar/re-focar". (gerente segue preso à própria loja via `effectiveLoja = colaboradorLojaId || selectedLoja`.)

**Consequências:** os cards agregados refletem o filtro — "Todas" soma as 5 lojas (ex.: serviços R$ 43.535,59); "Natal" mostra só Natal (R$ 28.753,62 = Tenfront). Não havia bug de cálculo; era escopo + reset do filtro.

**Como explicar em entrevista (30s):**
> "O filtro de loja resetava ao trocar de aba porque o re-foco re-dispara o auth e um useEffect reaplicava o default. Tornei a inicialização idempotente com um useRef que roda uma vez por carga, e parei de persistir a seleção — assim abrir o app vem em 'Todas', mas navegar mantém a loja escolhida."

**Fonte:** sessão 2026-06-16 com Ricalfiff.

---

## 2026-06-16 — [ux] Navegação por função (não por loja) + seletor de loja global

**Problema:** a sidebar era `loja → função`: cada uma das 5 lojas expandia as mesmas 4 sub-páginas (Vendas Diárias, Folha, Configurações, Estoque) = ~20 itens repetidos, sem escalar e incoerente com o Dashboard (que já filtra por loja).

**Decisão:** inverter para `função → filtro de loja`. (1) Seletor de loja **global no Header** (admin/supervisão), visível em todas as telas — removido o duplicado do Dashboard. (2) Sidebar de admin/supervisão reagrupada por função (Operação / Financeiro / Relatórios / Gestão); cada função navega sem fixar loja (usa o `selectedLoja` global). (3) Gerente/colaborador mantidos com loja fixa (já eram função-primeiro). (4) Telas por-loja (Folha/Estoque/Configurações) mostram `<SelecioneLoja>` quando o filtro está em "Todas as Lojas" (antes caíam silenciosamente em 'soledade').

**Por quê:** ~20 itens viram ~6; abrir nova loja não adiciona item; um só modelo mental (função + filtro) em vez de dois. Implementado sem skill de design — reusa os tokens/`NavItem` existentes.

**Consequências/trade-off:** as bolinhas de alerta por-loja (`useLojaAlerts`) saíram do menu (não há mais item por loja). Regressão pequena assumida — reintroduzir como indicador no seletor/Dashboard depois. Vendas Diárias e Relatórios aceitam "Todas"; Folha/Estoque/Config exigem uma loja.

**Como explicar em entrevista (30s):**
> "A navegação repetia 4 funções dentro de cada loja — 20 itens que não escalavam. Inverti para navegar por função e escolher a loja num filtro global no header, alinhando com o dashboard. Telas que são por loja mostram um aviso quando o filtro está em 'Todas', em vez de cair numa loja aleatória."

**Fonte:** sessão 2026-06-16 com Ricalfiff (sem skill de design, a pedido).

---

## 2026-06-16 — [faturamento] Card decomposto: Líquido + Juros + Desconto = Bruto

**Problema:** o card mostrava só o líquido (valor vendido) e o Tenfront mostrava mais — a investigação provou que a diferença é juros de parcelamento (Natal +13K) e descontos concedidos (Campina +6,5K → preço cheio ≈ 95K). O banco não capturava nenhum dos dois (`valor_bruto` zerado, juros subcontado, audit sem desconto).

**Decisão:** capturar e exibir os dois componentes.
- `map-venda.ts`: juros = Σ max(0, "Valor com acréscimo" − "Valor informado") do Pagamento; desconto = "Total desconto" do atendimento. Novos campos `juros`/`desconto` em `MappedVenda`.
- `atendimentos_audit` ganha `total_desconto`; a reconstrução do audit passa esse campo ao re-map.
- Schema: colunas `juros`/`desconto` em `vendas`/`vendas_diarias` (migration `20260616140000`, via db query).
- `sync-loja.ts`: agrega juros/desconto por (data,vendedor) → vendas_diarias → vendas.
- `Dashboard.tsx`: card mostra Líquido (vendido) + Juros parcelam. + Descontos = **Bruto**.

**Verificado (5 lojas, reprocessadas):** Natal líquido 244.138 + juros 13.009 = 257K (≈ Total bruto Tenfront); desconto 12.948 (= "Total desconto" da API). Campina líquido 88.011 + desconto 6.469 = preço cheio 94,5K (≈ os 95K). `deno check` 4 baseline; `tsc`+`build` verdes.

**Incidente/lição:** o reprocessamento via `db query` falhou ao deletar **só** o `atendimentos_audit` — `getLastSyncDate` lê de `vendas_diarias`, então o sync fez early-stop por data e repopulou parcial. **Reprocessar exige deletar as 3 tabelas** (vendas + vendas_diarias + atendimentos_audit), como o `reprocessar-mes.mjs` faz. O sync full também pode estourar `WORKER_RESOURCE_LIMIT` na edge (transitório — 2ª tentativa completa). Fazer **uma loja por vez**.

**Como explicar em entrevista (30s):**
> "O faturamento do app batia menos que o ERP. Provei que a diferença era juros de parcelamento e descontos — dois componentes que o pipeline não capturava. Passei a extraí-los do Pagamento e do Total desconto, gravar no banco e decompor no card: líquido (base de comissão) + juros + desconto = bruto. Validei loja a loja contra a API do ERP."

**Fonte:** sessão 2026-06-16 com Ricalfiff (opção "completa" aprovada).

---

## 2026-06-17 — [faturamento] Bruto = Líquido + Juros (desconto não soma)

**Problema:** o card somava Líquido + Juros + Desconto = Bruto, inflando (Natal 283K nosso vs 267K Tenfront). O excedente (~16K) era exatamente o desconto.

**Decisão:** Bruto = Líquido + Juros (o que o cliente paga). Desconto é abatimento concedido, não receita — passa a aparecer como linha informativa ("abatido"), sem somar ao bruto. Mudança só no Dashboard (`totalBruto = totalVendas + juros` nos dois modos; card reorganizado). Dados no banco inalterados.

**Resultado:** Natal Bruto 269.658 ≈ Tenfront 267.253. NOTA: o "Faturamento" do **Dashboard** do Tenfront (102.518 campina) diverge do **Relatório Financeiro** do próprio Tenfront (~95K campina) e não é reproduzível com a API de atendimentos — o ERP é inconsistente entre telas. A referência auditável do nosso app é o LÍQUIDO (soma dos itens vendidos concluídos = base de comissão); juros/desconto são decomposições rastreáveis até o atendimento.

**Fonte:** sessão 2026-06-17 com Ricalfiff (prints natal 267K/283K e campina dashboard 102K).

---

## 2026-06-17 — [faturamento] Provado: Tenfront não tem endpoint de faturamento consolidado

**Problema:** ficou a hipótese de que o número do Dashboard do Tenfront (campina 102.518) viria de algum endpoint de relatório que a integração ainda não usava — valia confirmar antes de fechar a reconciliação.

**Investigação (contra a fonte, `scripts/probe-tenfront-endpoints.mjs`):** com credenciais reais da campina (saldo 294 req, auth OK; `listar-atendimentos` como controle positivo), sondei **29 endpoints candidatos** em 2 levas (`faturamento`, `relatorio`, `relatorio-financeiro`, `dashboard`, `resumo`, `vendas`, `listar-*`, `sales`/`revenue`/`billing`, etc.). **Todos retornaram `404 - Endpoint inexistente`** (mensagem genérica do Tenfront p/ rota desconhecida → negativos reais, não erro de auth). Além disso, o **envelope do topo** do `listar-atendimentos` só tem `Total pages`/`Page`/`Response` — nenhum total consolidado (o "Total bruto" do `diag-faturamento` é somado client-side, não vem da API).

**Decisão:** encerrar a caça ao 102.518. A API v1 do Tenfront expõe só 3 rotas (`listar-atendimentos`, `saldo-token`, `estoque-identificado-produto`); nenhuma devolve faturamento consolidado. O número do Dashboard é calculado dentro da UI do ERP, a partir de dados que a API não entrega, e é inconsistente com o próprio Relatório Financeiro deles. A verdade canônica e auditável do app é o **Líquido + Juros = Bruto** (decisão anterior), rastreável até o atendimento.

**Consequências:** não há caminho técnico para reproduzir o número do Dashboard do Tenfront — fica documentado como limitação do fornecedor, não dívida nossa. Se o cliente exigir esse número específico, é conversa de definição de negócio (qual tela do ERP é a verdade) ou pedido de docs/endpoint ao Tenfront — não código.

**Como explicar em entrevista (30s):** "O número do dashboard do ERP não batia. Em vez de chutar, sondei a API: provei com 29 testes que não existe endpoint que devolva esse total e que o próprio ERP se contradiz entre telas. Ancorei o app no líquido — soma auditável dos itens vendidos — com juros/desconto rastreáveis. Evidência, não achismo."

**Fonte:** sessão 2026-06-17 (continuação); probe empírico contra a API Tenfront.

---

## 2026-06-22 — [comissão] ANATEL como smartphone em Campina/Natal/Caruaru + VR meta prata nas 3 lojas grandes

**Problema:** auditoria do motor contra o documento "Regras de comissões lojas" revelou dois gaps de lógica (não de valor):
1. **ANATEL não comissionava** em Campina/Natal/Caruaru — `calcularComissaoCampinaNatal` somava só `BONIFICADO LC + SUPER BONIFICADO` e gravava comissão só para esses dois; vendas ANATEL nessas lojas geravam R$0, apesar de o documento definir o grupo "Smartphones = Bonificado + Super Bonificado + ANATEL" para todas as lojas (Soledade/Monteiro já faziam certo).
2. **Bônus VR de R$300 na meta prata** estava travado em `lojaId === 'campina-grande'` (`batchCalculateCommissions.ts`), mas o documento diz que Natal e Caruaru também pagam VR 300 quando a loja bate prata.

**Opções consideradas:**
- ANATEL — A: taxa própria (novos campos de config); B: espelhar a taxa do Bonificado LC e incluir no grupo de meta.
- VR prata — A: replicar o bloco por loja; B: remover a trava de loja (o branch `else` já é exclusivo das lojas grandes Campina/Natal/Caruaru).

**Decisão:** B nos dois casos. ANATEL entra em `valorSmartphones` (meta) e comissiona à `taxaBLC`, sendo zerado junto na penalidade de película. VR 300 prata passa a valer para todo o branch não-Soledade/Monteiro. VR fixo de R$200 em Soledade **mantido** (confirmado com Ricalfiff — não era o gap que o texto do PDF sugeria).

**Por quê:** o documento não define taxa separada para ANATEL — criar config órfã seria inventar regra. Espelhar o Bonificado alinha ao comportamento já correto de Soledade/Monteiro. Incluir ANATEL na meta só *aumenta* o atingimento (a soma cresce), então nenhuma comissão existente cai. A trava `campina-grande` no VR era resíduo — o branch inteiro já é das lojas que têm a regra.

**Consequências:** vendas ANATEL passam a pagar comissão e contar para a meta de smartphone nas lojas grandes; recálculos de meses com ANATEL vão subir. **Valores de config (metas, %) não foram tocados** — os números do documento são demonstrativos; a fonte da verdade é a tabela `configuracoes` por loja/mês.

**Como explicar em entrevista (30s):**
> "Auditando o motor de comissão contra a spec do cliente, achei que aparelhos ANATEL eram categoria smartphone na regra mas o cálculo das lojas grandes ignorava eles — não pagava comissão nem contava pra meta. Aliei ao comportamento já correto das lojas menores em vez de inventar uma taxa nova. E corrigi um bônus de função preso a uma loja por um if hardcoded quando a regra valia para três."

**Fonte:** sessão 2026-06-22 com Ricalfiff; documento "Regras de comissões lojas.pdf" (ANATEL→taxa BLC e VR Soledade mantido confirmados em conversa).

---

## 2026-06-22 — [comissão] Penalidade de película por loja (Caruaru não perde smartphone) + Assistência Técnica em Monteiro

**Problema:** auditoria de lógica completa loja-a-loja contra o documento revelou mais dois pontos onde o código tinha decisão deliberada conflitando com a spec:
1. **Penalidade de película zerava smartphone em Caruaru.** O documento é explícito por loja: Campina Grande e Natal — "não ganha nada de películas **e perde a comissão de Smartphones**"; Caruaru — "não ganha nada de películas" (sem perder smartphone). O código aplicava o zeramento de smartphone para todas as lojas do branch (`comissaoCalculator.ts`), porque `isLojaNatalLike` agrupa Natal **e** Caruaru.
2. **Assistência Técnica era ignorada em Monteiro.** O código pulava AT com `if (!isMonteiro)`, mas o documento lista Monteiro com "ASSISTÊNCIA TÉCNICA: 10%" e o print de config de Monteiro traz o campo preenchido.

**Decisão (confirmada com Ricalfiff):** "seguir estritamente a regra de cada loja, não é regra global" e "seguir o PDF".
1. Zeramento de smartphone por película passou a ser condicionado a `loja === 'campina-grande' || loja === 'natal'`. Caruaru continua zerando só a película (via `taxaPelicula = 0`), preservando a comissão de smartphone.
2. Removido o `if (!isMonteiro)` — Monteiro comissiona AT como as demais. Adicionado `assistencia_tecnica_comissao: 10.0` ao `DEFAULT_CONFIG_MONTEIRO` para evitar `NaN` quando o banco não tiver o campo (o valor da tabela `configuracoes` sempre prevalece).

**Por quê:** o documento trata as lojas como configurações distintas; assumir comportamento global onde a spec diferencia é inventar regra. A omissão da frase "perde smartphone" em Caruaru é deliberada (CG e Natal a têm, lado a lado). Para Monteiro, o cliente confirmou que a AT vale — a exclusão no código era resíduo.

**Consequências:** vendedores de Caruaru com película abaixo da mínima mantêm a comissão de smartphone; Monteiro passa a pagar AT. Recálculos de meses fechados nessas duas lojas podem mudar. Valores de config seguem intocados.

**Como explicar em entrevista (30s):** "Auditando o motor por loja, achei duas regras tratadas como globais que a spec diferencia: a penalidade de película que tira o smartphone existe em Campina e Natal mas não em Caruaru, e o código zerava as três porque agrupava Natal e Caruaru no mesmo helper. Separei a regra por loja. E reativei a Assistência Técnica em Monteiro, que estava excluída por um if antigo contra a spec atual do cliente."

**Fonte:** sessão 2026-06-22 com Ricalfiff; auditoria de lógica completa contra "Regras de comissões lojas.pdf" (decisões confirmadas em conversa).

---

## 2026-06-24 — [faturamento] Definição oficial do "Faturamento" do dashboard Tenfront (resposta do cliente)

**Problema:** desde 2026-06-17 ficou em aberto o que exatamente compõe o "Faturamento" do dashboard do Tenfront (provamos que não há endpoint consolidado e que o ERP se contradiz entre telas). O cliente respondeu formalmente as 5 perguntas.

**Definição confirmada pelo cliente:**
1. **Faturamento = "Total faturando em vendas" (resultado por atendimento) + faturamento de troca inteligente + faturamento de ordem de serviço.** Três componentes.
2. **Total bruto negativo** (compra de seminovo de fornecedor, ex. ATE-EE7SBAA / iPhone 17 Pro Max / "Leunivan" / −8.300): NÃO entra no faturamento; é **abatido do lucro** no dashboard. "Faturamento é composto apenas por entradas."
3. **GAR** (garantia, ex. GAR-P5NVFK7): NÃO fatura de novo — quando a garantia é acionada ela **substitui** o faturamento; só aumenta se o cliente **pagar a mais** na garantia.
4. **Faturamento ≠ "Total preço venda produto"**: o resultado por produto usa só preço de venda, **desconsidera as taxas**; o faturamento **inclui as taxas** (juros de parcelamento).
5. **Não há endpoint** que devolva o faturamento consolidado; dá para compor com os endpoints de **vendas realizadas + ordem de serviço**.

**Conferência contra o código (sync-tenfront/map-venda.ts):** as respostas **validam 4 dos 5 pontos** do nosso pipeline:
- Negativos excluídos (`if totalBruto < 0 return null`) ✓ = ponto 2.
- Cancelados excluídos ✓.
- Troca inteligente incluída (itens em `Troca` com `Valor de venda`) ✓ = parte do ponto 1.
- `valor_bruto = líquido + juros` ✓ = ponto 4 (faturamento inclui taxas; o ② líquido é a base de comissão sem taxas).
- **GAR já correto por construção** (ponto 3): o único GAR de junho (GAR-JR3ADO9, Caruaru, R$ 2.049,99) traz no `detalhes_brutos` apenas uma `Troca` com `"Proposta"` e **sem** `"Valor de venda"` → `valorTroca = 0` → atendimento descartado em `valorTotal <= 0`. Pagamento a mais na garantia entraria como item/pagamento positivo e seria capturado.

**Gap real (ponto 1, componente OS):** **Ordem de Serviço não chega no `listar-atendimentos`** — 0 registros OS em 312 atendimentos de junho (5 lojas), todos `ATE-` exceto 1 `GAR-`. Logo o nosso "bruto" cobre **vendas + troca**, mas **não inclui OS**. Por isso ele não bate (fica abaixo) com o "Faturamento" do dashboard. O probe de endpoints de 2026-06-17 testou faturamento/venda/sales/revenue/billing (todos 404) mas **não testou um endpoint de ordem de serviço** — caminho não explorado.

**Decisão:** documentar a definição e a limitação (comentário em `map-venda.ts` + este ADR). **Não** alterar o cálculo agora: incluir OS exige descobrir/validar um endpoint Tenfront de ordem de serviço (precisa de credencial para sondar) e medir a materialidade. Mantém-se o líquido (② / base de comissão) como verdade auditável do app; o "bruto" é vendas+troca+juros, explicitamente sem OS.

**Consequências / pendências:** (1) sondar endpoint de OS (`ordem-servico`, `listar-ordem-servico`, etc.) com credencial real; (2) se existir e for material, criar ingestão de OS e somar ao faturamento (sem afetar comissão — OS é faturamento, não necessariamente base de comissão); (3) decidir com o cliente se o app deve reproduzir o dashboard (vendas+troca+OS) ou manter o líquido auditável como referência.

**Como explicar em entrevista (30s):** "O cliente fechou a definição do faturamento do ERP: vendas + troca + ordem de serviço, só entradas, com taxas, e garantia não soma. Conferi contra nosso pipeline e 4 dos 5 pontos já batiam — inclusive a garantia, que é descartada naturalmente porque a troca de garantia não tem valor de venda. O único componente que falta é ordem de serviço, que provei não vir no endpoint de atendimentos. Documentei a limitação em vez de inventar o número."

**Fonte:** sessão 2026-06-24 com Ricalfiff; respostas formais do cliente (5 perguntas) + inspeção dos backups reais de junho (`scripts/reproc-backup-*.json`).

**Atualização (mesma sessão) — endpoint de OS encontrado, materialidade ZERO:** sondagem focada contra a API real (Campina, saldo 310) testou 15 nomes de rota e achou **`POST /ordem-de-servico`** (200, envelope `Total pages/Page/Response` igual ao listar-atendimentos). Os 14 demais (incl. `listar-vendas-realizadas`) → 404. Resultado por loja em junho: **Natal 3 OS, demais 0**. Estrutura: `ID OS`, `Tipo OS` (Interna/Externa), `Status` (Esteira/Concluída), `Serviços realizados[].Valor`, `Custos`. As 3 OS de Natal têm **Valor 0** (reparos internos/esteira sem cobrança) → **faturamento de OS = R$ 0,00**. Conclusão: o nosso "bruto" (vendas + troca + juros) **já cobre o faturamento real** dessas lojas no período; o gap histórico era só os juros (já tratados). **Nenhuma mudança de cálculo** — incluir OS adicionaria R$0 hoje (YAGNI). Caminho documentado em código para o futuro: ingerir `/ordem-de-servico` (status finalizado, `Serviços realizados[].Valor`) e somar ao faturamento — não entra na base de comissão.
