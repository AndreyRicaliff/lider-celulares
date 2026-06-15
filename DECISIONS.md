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
- Modularização da edge function `sync-tenfront/index.ts` (1295 linhas) — A: fazer junto, agora; B: adiar para PR dedicado com `deno check` + verificação pós-deploy.

**Decisão:** B em tudo. Removidos 5 arquivos inteiros mortos (`NavLink`, `OptimizedCategorySelector`, `apiOptimization`, `useOptimization`, `cache`) + 18 símbolos mortos (hooks `useComissao`/`useSaveComissoes`/`useColaborador`/`useUpdateColaborador`/`useUpdateDivida`/`useCreateColaborador`, funções de `formatters`, `parseCurrency` duplicado, `calcularDescontosDividasSupervisor`, `CargoType`, campos do store) + dep órfã `react-router-dom`. Scripts one-off deletados, `sync-now.mjs` movido para `scripts/` (paths corrigidos para `../`). **Modularização do `index.ts` adiada.**

**Por quê:** `tsc` não acusa export não-usado (trata como API pública), então a contagem de referências foi o que deu confiança real — não a intuição. A modularização da edge function foi adiada porque ela está em produção e há **precedente documentado de regressão por modularização** (PULSAR-RH perdeu 37 símbolos e quebrou prod, memória `pulsar_rh_modularizacao_regressao`); fundir limpeza segura com refactor arriscado num só PR esconderia a causa se algo quebrasse.

**Consequências:** −633 linhas em `src/`, raiz sem scripts soltos, anon keys hardcoded saíram do working tree (seguem no histórico — anon key é pública por design, risco baixo; rotacionar se o repo virar público). `tsc` e `build` verdes. Dívida que permanece: 102 erros de lint pré-existentes (`any`/`require`) e o `index.ts` monolítico.

**Como explicar em entrevista (30s):**
> "Antes de remover qualquer código, contei as referências de cada símbolo no projeto inteiro — porque o TypeScript não reclama de export não-usado, ele assume que é API pública. Trabalhei em branch com typecheck e build como rede de segurança e revisei o diff. E separei deliberadamente a limpeza segura da modularização da edge function de produção, que tem precedente de regressão: misturar as duas num PR esconderia a causa de uma eventual quebra."

**Fonte:** sessão 2026-06-15 com Ricalfiff (`/revisao` — dead code + modularização).
