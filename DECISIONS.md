# DECISIONS — Líder Celulares

Registro de decisões técnicas datadas, em primeira pessoa. Material de defesa em entrevista.

> Regra (CLAUDE.md §ENSINAR EM CONTEXTO): toda mudança não-trivial vira entrada aqui no mesmo commit da feature.
>
> Decisões marcadas **[reconstruído]** vieram de evidência (git/memória/código). Decisões com `[reconstruir com Ricalfiff]` precisam de sessão dedicada — não decorar, é fato observado sem motivação confirmada.

---

## 2026-06-25 — [faturamento] Base própria reproduzível + conciliação anti-fantasma

**Problema:** O faturamento do app errava sempre "por mais" vs o Tenfront, e não dava pra calibrar porque o Tenfront tem 4+ números de faturamento divergentes pro mesmo mês (dashboard ~147k, relatório "Total faturado" 133.056,76, "Resultado por produto" 127.075,14, DRE "Vendas" 143.528,21).

**Investigação (Campina/jun 2026, do nosso próprio banco):** Reproduzi 2 relatórios do Tenfront centavo-a-centavo: faturamento = `Σ Total bruto` dos concluídos (incl. seminovo negativo) = 133.056,76; receita/lucro = `Σ Valor de venda` dos itens (s/ seminovo) = 127.075,14. Achei 2 causas do overshoot: (1) o `calcFaturamentoEspelho` somava juros que o `Total bruto` já contém; (2) o `atendimentos_audit` só faz upsert → atendimentos cancelados no Tenfront viravam fantasmas (Campina tinha 1 de R$700, ATE-VJE9SYD). A DRE completa não sai da API de vendas — `Compras`, `Despesas administrativas`, `Taxas` são lançamentos manuais do módulo financeiro.

**Decisão:** (a) Faturamento = `total_bruto` direto (= relatório); aposentei a calibração `bruto_inclui_juros` por loja. (b) `total_bruto` passa a incluir o seminovo negativo. (c) Regra de conciliação (`reconcileAudit`): no full-year sync (completo, `!wasPartial`), deletar do audit os atendimentos fora da API viva, com trava de conjunto-vazio.

**Por quê:** Ancorar no número auditável e reproduzível (relatório), não no instável (dashboard). A conciliação só dispara em fetch íntegro — um retorno degradado nunca apaga dado bom.

**Consequências:** App passa a bater o Tenfront por loja (pipeline já é por-loja → vale pras 5). Dívida: a DRE completa precisa de um módulo de despesas manuais (aluguel/contador/compras de estoque). Deploy do edge + verificação dependem do reset de cota da API (00:00 BRT).

**Como explicar em entrevista (30s):** "O ERP tinha 4 números de faturamento divergentes. Em vez de calibrar contra o instável, reproduzi o relatório auditável do meu próprio banco, centavo-a-centavo, e isolei duas causas de erro: juros somados em dobro e cache acumulando registros cancelados. Criei uma conciliação que só apaga quando a fonte veio íntegra — segura por construção."

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

## 2026-06-25 — [faturamento] Faturamento "espelho Tenfront" calibrado por loja (backend)

**Problema:** o cliente quer ver no app o mesmo "Faturamento" do dashboard do Tenfront. Validação contra 3 lojas (números reais do dashboard) provou que **nenhuma fórmula única reproduz** o número: o campo "Total bruto" do Tenfront **inclui juros em Natal, exclui em Campina/Caruaru** (inconsistência interna do ERP). Regras oficiais do cliente: Faturamento = vendas (com taxas) + troca inteligente (só quando revendida) + ordem de serviço (=0 hoje); negativos (compra de seminovo) abatidos do lucro; GAR só fatura se o cliente paga a mais.

**Decisão:** calibração por loja + isolar do cálculo de comissão.
- Nova tabela `faturamento_loja` (loja/mês): `liquido`, `juros`, `faturamento_extra` (GAR/troca revendida = Total bruto>0 sem item de Venda), `total_bruto` (campo cru), `atendimentos`. Alimentada pelo sync a partir do `atendimentos_audit` (sem chamada extra à API).
- Calibração no `configuracoes.config` (JSON, sem migration): `bruto_inclui_juros` (0/1) + `faturamento_tenfront_ref` (drift-guard).
- Espelho (no app) = `total_bruto + (bruto_inclui_juros ? 0 : juros)`. Validado: Natal −0,34%, Campina +0,48%, Caruaru +0,85%.
- `faturamentoCalculator.ts`: monta o espelho, o `ajusteErp` (resíduo explícito = espelho − líquido − juros − extra) e a divergência vs `tenfrontRef`; alerta se >2% (calibração desatualizada).

**Por quê:** perseguir match exato com fórmula única é mirar num alvo que o ERP calcula inconsistentemente — vira manutenção eterna e quebra calado. A calibração por loja + drift-guard transforma quebra silenciosa em alerta visível; mora no banco (admin edita sem deploy). O líquido permanece intocado como base de comissão; o faturamento_extra (GAR/troca) **nunca** entra em comissão (atendimentos sem item de Venda já não comissionavam).

**Consequências:** captura o GAR-P5NVFK7 (8.800, Campina) e equivalentes que o pipeline dropava. Resíduo ~0,5–1% por loja (inconsistência de juros do ERP) fica explícito na linha "Ajuste ERP" do drill-down. Soledade/Monteiro sem número de referência ainda — calibração default `bruto_inclui_juros=false`, a confirmar quando o BPO passar o dashboard. PENDENTE: aplicar migration em prod (via `db query --linked`, drift de migrations), deploy da edge `sync-tenfront`, e UI (cards peso igual + pop-up drill-down + painel cross-loja).

**Como explicar em entrevista (30s):** "O cliente queria reproduzir o faturamento do ERP. Validei contra 3 lojas e provei que não existe fórmula única — o ERP inclui juros no 'Total bruto' de uma loja e não de outra. Em vez de chutar, fiz calibração por loja guardada no banco, com um guard de divergência que alerta se o ERP mudar, e isolei tudo do cálculo de comissão. O número auditável (líquido) continua sendo a base de comissão; o espelho é secundário e honesto sobre o resíduo."

**Fonte:** sessão 2026-06-25 com Ricalfiff (validação com dashboards de Natal/Campina/Caruaru + regras oficiais do cliente).

---

## 2026-06-28 — [faturamento] Verificação: frente "espelho Tenfront" concluída (registro de 25/06 estava desatualizado)

**Contexto:** retomada após migração de máquina (secrets restaurados via tarball cifrado). O registro de 25/06 listava como PENDENTE: migration em prod, deploy da edge `sync-tenfront` e UI (cards peso igual + drill-down + cross-loja).

**Verificado contra prod** (conta `sbcli`, projeto `ibpcexyrxwmknrfwifyy`):
- **Schema:** `faturamento_loja` existe com todas as colunas + `custo` — migrations `20260625130000` + `20260626160000` já aplicadas via query direta.
- **Dados:** `faturamento_loja` populada — 19 linhas, 5 lojas, meses mar→jun/2026 (edge produzindo).
- **Edge:** `sync-tenfront` deployada `v44`, status ACTIVE.
- **UI:** `Dashboard.tsx` usa `FaturamentoCards` (que abre `FaturamentoDrilldown` como pop-up filho) e `FaturamentoCrossLoja`. Sem stub/TODO. `bun run build` verde.

**Conclusão:** frente concluída em código + prod. O "PENDENTE" de 25/06 foi fechado nas sessões de 26/06+ sem atualizar este registro.

**Em aberto (dependência externa, não código):** calibração de **Soledade e Monteiro** — ainda sem número de referência do dashboard Tenfront; ambas no default `bruto_inclui_juros=false`. Confirmar quando o BPO passar o dashboard dessas lojas e ajustar `configuracoes.config` se divergir.

**Nota de processo (importante):** o histórico de migrations está em **drift total** (0 de 61 registradas como remote). **`db push` é proibido neste projeto** — ele tentaria reaplicar tudo do zero e quebraria. Aplicar DDL via `db query --linked` (ou query direta) e **conferir o schema real** com `information_schema`; nunca confiar no `migration list` aqui.

**Como explicar em entrevista (30s):** "Ao retomar o projeto, em vez de confiar no `migration list` — que mostrava tudo como não-aplicado por causa de drift no histórico — fui no schema real do banco de produção e confirmei tabela, colunas, dados e a edge deployada. Provei que a feature já estava entregue e só o registro de decisão tinha ficado para trás."

**Fonte:** sessão 2026-06-28 com Ricalfiff (verificação pós-migração, frente A).

---

## 2026-06-28 — [faturamento] Monteiro custo=0 era agregação velha, não chave inválida

**Problema:** `faturamento_loja.custo = 0` para Monteiro em todos os meses; suspeita de chave Tenfront inválida.

**Investigação:** o JSON cru no `atendimentos_audit` do Monteiro **tem o campo `Custo` em 100% dos itens** (jun: 161 itens, ΣCusto ≈ R$ 38k). Logo o Tenfront manda o custo — a chave funciona (líquido e atendimentos também estavam populados). As outras 4 lojas tinham custo; só Monteiro 0.

**Causa raiz:** o último sync do Monteiro (06-26) gravou o `custo` agregado como 0 — rodou antes da lógica de custo entrar na edge (as outras lojas foram sincronizadas depois). Não era credencial.

**Decisão:** recomputar `custo` direto do `atendimentos_audit` (fórmula oficial: exclui cancelados e `valor_total<0`, soma `Custo` de Venda+Brinde), via `UPDATE ... FROM` derivado — **zero cota Tenfront**. Valores: mar 40.395 · abr 95.990 · mai 53.075 · jun 36.911. O próximo sync mantém (a edge já calcula custo).

**Como explicar em entrevista (30s):** "Antes de pedir credencial nova, fui no dado cru no banco e provei que o ERP já mandava o custo — o zero era um valor velho de um sync antigo. Recomputei do próprio audit, sem gastar cota de API."

**Fonte:** sessão 2026-06-28 com Ricalfiff.

---

## 2026-06-28 — [faturamento] DRE por loja sobre dados confiáveis da API (não o espelho do ERP)

**Problema:** o `custo` estava na `faturamento_loja` mas nenhuma tela mostrava lucro/margem de forma completa; o que existia (`MargemPanel`) usava `Faturamento = Σ total_bruto`, que espelha o "Total faturado" do ERP — inconsistente entre telas (inclui juros numa loja e não em outra, abate seminovo negativo).

**Decisão:** construir o DRE só sobre campos **item-a-item auditáveis** da API:
- `calcDRE`/`somarDRE` em `faturamentoCalculator.ts`: Receita = `liquido` (Σ preço de venda) · CMV = `custo` (Σ custo) · Lucro Bruto = Receita − CMV · Margem Bruta = LB/Receita · Receita Financeira = `juros` (Σ acréscimo do Pagamento) · Outras = `faturamento_extra` (GAR/troca) · **Resultado** = LB + Juros + Outras.
- `MargemPanel` reescrito como DRE (colunas Receita/CMV/Lucro Bruto/Margem/+Juros/+GAR-Troca/Resultado, por loja + consolidado).
- **`total_bruto`/`ajusteErp` ficam de fora** do DRE (não auditáveis).

**Por quê:** `liquido` e `custo` reconciliam item a item; `total_bruto` é um espelho de ERP inconsistente. Para análise financeira, base auditável > paridade com um número que o próprio ERP calcula de forma instável. Juros entram como **receita financeira separada** (separação receita operacional × financeira). Comissão/folha **não** entram — não vêm da API; ficam para uma camada de resultado operacional futura.

**Verificado:** `tsc --noEmit` limpo, `bun run build` verde, e os 5 DREs de jun/2026 conferidos contra o banco (Natal margem 41,3% · Soledade 43,0% · Monteiro 37,8% após o fix de custo).

**Como explicar em entrevista (30s):** "Montei o DRE sobre o que reconcilia item a item — preço de venda e custo do produto — e tratei juros como receita financeira separada, em vez de espelhar o 'total faturado' do ERP, que diverge entre as telas dele. Base auditável vale mais que paridade com um número instável."

**Fonte:** sessão 2026-06-28 com Ricalfiff ("construção financeira completa usando apenas dados confiáveis das APIs").

---

## 2026-06-29 — [comissão] Comissão é gated por config mensal; replicada p/ o ano (metas estáveis)

**Problema:** comissões só refletiam maio no dashboard. Investigação provou que **vendas estão sincronizadas até junho** (cron a cada 30min), mas o motor de comissão exige uma linha em `configuracoes` por `(loja, mês)` com as metas/% — e essa config **só existia para maio**. Sem config → `calculateCommissionsForLoja` retorna "config não encontrada".

**Decisão:** com Ricalfiff confirmando que **as metas são estáveis mês a mês**, replicar a config de maio para mar/abr/jun (`INSERT…SELECT` idempotente) e recalcular o ano rodando a **lógica real do app headless** (bun + shim de `localStorage` + login admin, reusando `calculateCommissionsForLoja` — zero drift vs reimplementar em SQL/Deno).

**Resultado:** mar 16 / abr 24 / mai 19 / jun 19 folhas. **Maio mudou de R$15.584 → R$30.613** porque o cálculo anterior (20/05) era de meio do mês; recalculado com o mês fechado.

**Consequência/dívida:** comissão é **snapshot manual** — sem cron. O auto-cálculo do dashboard só dispara quando o mês está vazio, então junho vai defasar conforme novas vendas sincronizam. Pendente: automação de recálculo.

**Como explicar em entrevista (30s):** "As comissões dependiam de uma config mensal que só existia para um mês. Em vez de reimplementar o cálculo em SQL e arriscar divergência, rodei a própria lógica do app de forma headless, com login de serviço, reusando o código que já é a fonte da verdade."

**Fonte:** sessão 2026-06-29 com Ricalfiff.

---

## 2026-06-29 — [faturamento] Resultado Operacional no DRE (Lucro Bruto − Folha)

**Decisão:** estender o DRE (`calcDRE(f, folha)`) e o `MargemPanel` com **Folha** (comissão + salário + ajuda de custo, por loja, vinda da tabela `comissoes`) e **Resultado Operacional = Lucro Bruto + Juros + GAR/Troca − Folha**, com margem operacional. `Dashboard` agrega `folhaPorLoja` das `comissoes` e passa ao painel.

**Nota:** vendas/custo/juros são item-a-item da API (auditável); folha vem do cálculo de comissões (regra interna) — distinção sinalizada no rodapé do painel. Verificado: `tsc`+`build` verdes; Result. Op. de jun conferido por loja (Natal 40,4% · Caruaru 37,1% · Monteiro 32,6%).

**Fonte:** sessão 2026-06-29 com Ricalfiff ("os dois": resultado operacional + automação).

---

## 2026-06-29 — [comissão] Regras hardcoded viram config editável (gestor edita limites/metas/%)

**Problema:** auditoria do motor vs o PDF de regras (valores são exemplo; importam regras/cálculos) achou 4 regras **hardcoded** no código, não editáveis pelo gestor: (1) Monteiro sem assist. técnica (`if (!isMonteiro)`); (2) penalidade de película que zera smartphone fixa em 3 lojas; (3) Monteiro bônus prata = 0 hardcoded; (4) VR 200 fixo / VR 300 prata hardcoded.

**Decisão:** parametrizar as 4 na `configuracoes` (JSONB, sem migration), **default = comportamento atual**:
- assist. técnica: guard por `config.assistencia_tecnica_comissao` (Monteiro sem o campo = 0); input liberado pra todas as lojas.
- `pelicula_penaliza_smartphone` (0/1, default 1) por loja → toggle.
- bônus prata: usar `config.loja_bonus_meta_prata ?? 200` (Monteiro já tem 0 em prod) → remove hardcode.
- `vr_bonus_fixo` (?? 200) / `vr_bonus_prata` (?? 300) → campos.
- Defaults semeados explicitamente na config de prod (pro input mostrar valor real, não 0 enganoso).

**Verificação (A/B na mesma data):** recalc jun com código antigo vs novo — 4 lojas **byte-idênticas**; Monteiro **+R$5,18**, que é uma **correção**: o supervisor LUIZ (`loja_id ≠ monteiro`) caía no `!isMonteiro`=true e multiplicava por `config.assistencia_tecnica_comissao` ausente → `valor*(undefined/100)`=NaN → `Number.isFinite` zerava a comissão inteira dele. O guard por config eliminou o NaN. `tsc`+`build` verdes.

**Em aberto:** (a) recalcular mar–abr–mai com o código novo restablece (corrige) comissões de supervisores por centavos — decisão de negócio (restatement). (b) VR-prata no código só aplica a Campina; PDF cita Natal/Caruaru também — gap conhecido, não alterado.

**Como explicar em entrevista (30s):** "Transformei regras hardcoded em configuração editável sem mudar nenhum resultado (provei com A/B na mesma base). No caminho, a parametrização eliminou um NaN latente que zerava a comissão de supervisores que atuam em loja sem aquele campo."

**Fonte:** sessão 2026-06-29 com Ricalfiff (modelo de permissão (a): admin/gestor edita).

---

## 2026-06-29 — [comissão] Exclusões gerenciáveis pelo gestor (híbrido: legado em código + DB)

**Problema:** as regras de invalidação de comissão por (loja, mês, vendedor) — vendedor não comissiona, venda excluída, fora do serviço do supervisor, loja fora dos botons — eram **listas hardcoded em `constants.ts`**, não editáveis pelo gestor.

**Decisão (híbrido, por segurança/dinheiro):** em vez de migrar as ~8 entradas legadas (risco no cálculo de meses fechados), manter o legado imutável em código e adicionar a tabela `exclusoes` (admin-write via RLS) que o gestor gerencia. O cálculo lê a **união** (constante legada OR DB). Default-preserving por construção: DB vazio = resultado idêntico.

**Implementação:** tabela `exclusoes` (migration `20260629120000`); `batchCalculateCommissions` busca exclusões da loja/mês e faz OR com `isVendedorExcluido`/`isLojaExcluidaBotons`; hook `useExclusoes` + `ExclusoesCard` na `ConfiguracoesPage` (CRUD admin). Flag morto `penalidadeAcessorios` removido.

**Verificado:** `tsc`+`build` verdes; recalc jun com DB vazio = idêntico (default-preserving); RLS testada (admin INSERT ✓ / DELETE 204).

**Consequência/limitação:** as ~8 exclusões legadas (meses fechados de 2025/início 2026) seguem no código, não editáveis — intencional. As novas, 100% pelo gestor. Supervisor_servico no cálculo do supervisor (página) ainda lê só o legado — ampliar para o DB quando necessário.

**Como explicar em entrevista (30s):** "Tornei as regras de invalidação editáveis sem arriscar o histórico: mantive o legado imutável e o cálculo passou a ler a união com uma tabela que o gestor gerencia. Provei que com a tabela vazia o resultado é idêntico — mudança aditiva e segura."

**Fonte:** sessão 2026-06-29 com Ricalfiff.

---

## 2026-06-29 — [faturamento] Faturamento = fórmula própria (abandona o espelho do ERP)

**Decisão (reverte 2026-06-25):** o "Faturamento" deixa de espelhar o "Total faturado" do ERP. Passa a ser a **fórmula própria** = `líquido + juros + GAR/troca` (tudo que entra), **derivada** dos componentes item-a-item — um dos únicos valores **não puxados direto da API**. Removido `ajusteErp`/`total_bruto`/calibração `tenfront_ref` da UI (Cards, Drilldown, CrossLoja) e do `calcFaturamentoEspelho`; o DRE ganhou KPI `faturamento`.

**Por quê:** o `total_bruto` do ERP é inconsistente entre telas do Tenfront (inclui juros numa loja e não em outra; abate seminovo negativo). Perseguir paridade vira manutenção eterna. A fórmula própria é auditável e bate com cada registro.

**Acurácia garantida:** reconciliação recomputando `líquido` e `juros` do JSON cru de cada atendimento (`atendimentos_audit`) = **exatamente** os valores armazenados, nas 5 lojas (jun/2026). Seminovo negativo (compra) deixa de distorcer — não é entrada.

**Como explicar (30s):** "Troquei o faturamento-espelho do ERP, que era inconsistente, pela nossa própria soma item-a-item de tudo que entra. É um valor derivado e auditável — provei que bate com cada registro puxado da API."

**Fonte:** sessão 2026-06-29 com Ricalfiff.

---

## 2026-06-29 — [supervisor] Config do supervisor editável (salário/comissões/bônus)

**Problema:** `SUPERVISORES_CONFIG` (salário, ajuda, % serviço, bônus, taxa adm) era hardcoded — o cliente pediu poder editar o próprio salário/config.

**Decisão (híbrido default-preserving):** tabela `supervisor_config` (nome PK, config JSONB, RLS admin) guarda **overrides**; `calcularFolhaSupervisor` faz `{ ...hardcoded, ...override }`. Vazio = hardcoded (idêntico). Card "Config dos Supervisores" na Config admin edita os escalares (salário base/mínimo, ajuda, % serviço loja/própria, bônus meta/super, taxa adm). Lojas de rateio/ajuda seguem o padrão.

**Wiring:** `SupervisaoFolhaPage` e `RelatoriosNumericos` buscam `useSupervisorConfigs` e passam o override ao cálculo. `tsc`+`build` verdes; tabela criada vazia → folha de supervisão inalterada (default-preserving).

**Dívidas/contas fora do ERP:** já cobertas pelo `DividasManager` existente (descrição, valor, parcelas, loja, mês início, histórico) — são manuais por natureza.

**Fonte:** sessão 2026-06-29 com Ricalfiff (pedido do cliente via WhatsApp: editar salário/dívidas/contas fora da Tenfront).

---

## 2026-06-29 — [categorização] Confiar no `Grupo` do ERP (não re-classificar smartphone por nome)

**Problema (cliente):** split Bonificado × Super Bonificado divergia da Tenfront. Total batia (João/Soledade: 27.109,91), mas BLC/SB diferia em R$1.849,99.

**Causa:** `mapGrupoToCategory` decidia BLC/SB por **nome do produto + preço** (`classifySmartphone`), ignorando o campo **`Grupo`** que a Tenfront já entrega. O REALME C85 @ 1.849,99 vinha `Grupo=SUPER BONIFICADO` na API, mas `realme + valor≥1000` → BONIFICADO LC.

**Decisão:** na prioridade 1 do `mapGrupoToCategory`, checar também o `Grupo` (`super bonificado`/`bonificado`) — fonte oficial. Keyword/preço só como fallback quando o Grupo vier vazio/genérico.

**Verificado:** edge `sync-tenfront` deployada + Soledade/jun reprocessada → João **BLC 23.739,92 / SB 3.369,99 = exatamente a Tenfront**. Para Soledade a comissão não muda (taxa única no total); para Campina/Natal/Caruaru o split altera comissão (taxas BLC≠SB) → reprocessar essas lojas.

**Pendente:** reprocessar demais lojas/meses + assistência técnica de itens com `Grupo` vazio (ex.: FRONTAL/tela) precisa de keyword/lançamento manual.

**Fonte:** sessão 2026-06-29 com Ricalfiff (divergência reportada pelo cliente via WhatsApp).

## 2026-06-29 — [categorização] Grupo do ERP como fonte da verdade + modo remapOnly

**Problema:** o split BONIFICADO LC vs SUPER BONIFICADO divergia do coletor do cliente (ex.: REALME C85 com Grupo=SUPER caía em BLC). Causa: `classifySmartphone` decidia por nome/preço, sobrescrevendo o campo `Grupo` do ERP.

**Discovery (docs/DISCOVERY_GRUPOS.md):** o ERP usa `CELULARES` genérico em mar–mai (split depende de heurística) e migrou para `BONIFICADO`/`SUPER BONIFICADO`/`ANATEL` explícitos em jun. Grupos variam por loja (`PELICULAS`/`PELÍCULAS`, `CAIXAS JBL`, `ANATEL`, `∅`+PEÇA DE MANUTENÇÃO).

**Decisão:**
1. `mapGrupoToCategory` passa a ser **grupo-first**: grupo específico do ERP decide direto; `classifySmartphone` (nome/preço) só para `CELULARES` genérico e itens sem grupo.
2. `Grupo=GERAL`/`(GERAL)` no nome (iPhone LACRADO, Apple Pencil, JBL) → **GERAL** (honra o ERP — comissão à taxa `geral`, não bonificado). Aprovado pelo Ricaliff.
3. `Grupo=ANATEL` explícito → ANATEL; JBL/caixa de som → GERAL (não é celular); `∅`+PEÇA DE MANUTENÇÃO → ASSISTÊNCIA.
4. Novo modo **`remapOnly`** no edge: reprocessa categorização a partir do `atendimentos_audit` existente, **sem chamar a API** (zero quota) — reprocessou todas as lojas/meses, inclusive monteiro (chave 402 inválida).

**Por quê:** o campo estruturado `Grupo` é a categorização oficial do lojista; heurística por nome é palpite e só deve agir quando o ERP não classifica. `remapOnly` desacopla "corrigir regra de categoria" de "buscar dados novos".

**Consequências:** comissão de Campina/Natal muda (lacrados saem de bonificado). Validado: João bate centavo a centavo com o coletor; GERAL/SUPER conferem exato no diff todos-os-meses. Caminho p/ 100%: lojista sempre usar grupos explícitos no Tenfront.

**Como explicar em entrevista (30s):** "O ERP já categoriza o produto num campo estruturado (Grupo). O bug era o código adivinhar a categoria por nome/preço e ignorar esse campo. Inverti a prioridade: fonte estruturada manda, heurística é só fallback para o grupo genérico. E criei um modo de reprocessamento que reaplica as regras sobre os dados já salvos, sem reconsumir a API."

## 2026-06-30 — [auditoria] Página de Dados Crus (API) ressuscitada

**Problema:** verificar se o sync puxa fielmente do Tenfront, vendo o dado cru por atendimento/produto, sem cálculo do dashboard.
**Opções consideradas:** (A) gerar HTML único offline via script; (B) reconstruir página do zero; (C) ressuscitar a `AuditoriaVendasPage` removida em cb153c0.
**Decisão:** (C) — a tabela `atendimentos_audit` (2.959 linhas, `detalhes_brutos` por produto) continua populada; a página antiga já a lia com expandir-por-produto, filtros, alerta de preço, export Excel, realtime e botão de reprocessar (invoca `sync-tenfront`).
**Por quê:** dado e UI já existiam e casam com o formato atual; reaproveitar > reconstruir. Periodização já vem do seletor de mês global (`selectedMes`).
**Consequências:** religado em MainLayout (admin+supervisão) e Sidebar (grupo "Auditoria"). Monteiro aparece congelado em 26/06 até a chave ser corrigida — então o "reprocessar" da página passa a refletir a correção.
**Como explicar em entrevista (30s):** "Em vez de reconstruir, recuperei do histórico git uma página que já lia a tabela de auditoria crua; validei que o formato do JSON (`detalhes_brutos`) ainda batia e religuei no roteamento por estado (Zustand `currentView`), com build e typecheck verdes."

## 2026-06-30 — [lojas] Caruaru 2 (loja secundária) + toggle "Agrupar Caruaru"

**Problema:** o shopping de Caruaru cobra taxa sobre faturamento acima de um teto; pra não estourar, as vendas são divididas em 2 lojas (caruaru + caruaru-2). São uma operação só, partida contabilmente.
**Opções consideradas:** (A) agrupar via seam global `getLojaIdsForQuery` (usado por 7 hooks); (B) loja separada + agrupamento opt-in local à auditoria.
**Decisão:** (B). caruaru-2 é loja **separada** (entra em LOJAS/LOJAS_IDS, região PE=RN_PE, regras de comissão = caruaru via lojaRules). O **toggle "Agrupar Caruaru"** vive só na auditoria (query `.in([caruaru, caruaru-2])`), via `components/auditoria/grupos.ts`.
**Por quê:** mexer no seam global fundiria as duas lojas em TODO o app (vendas, comissões, DRE) — o oposto de "separada com toggle". Local é cirúrgico e reversível.
**Consequências:** caruaru-2 aparece como 6ª loja em todos os filtros/telas. PENDENTE (financeiro, não toquei): linha em `configuracoes` p/ comissão calcular; avaliar inclusão em `LOJAS_SUPERVISAO`; vincular vendedores (ALMIR/LUIZ/FELIPE) a caruaru-2. Teto: Ricaliff envia depois (vira alerta).
**Como explicar em entrevista (30s):** "Modelei a loja-espelho como entidade separada e fiz o agrupamento opt-in e local à feature, em vez de no seam global de query — assim não contamino os cálculos financeiros das outras telas."
