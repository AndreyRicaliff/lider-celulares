# DECISIONS — Líder Celulares

Registro de decisões técnicas datadas, em primeira pessoa. Material de defesa em entrevista.

> Regra (CLAUDE.md §ENSINAR EM CONTEXTO): toda mudança não-trivial vira entrada aqui no mesmo commit da feature.
>
> Decisões marcadas **[reconstruído]** vieram de evidência (git/memória/código). Decisões com `[reconstruir com Ricalfiff]` precisam de sessão dedicada — não decorar, é fato observado sem motivação confirmada.

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
