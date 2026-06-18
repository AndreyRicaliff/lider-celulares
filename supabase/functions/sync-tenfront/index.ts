import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { corsHeaders, MIN_INTERVAL_MINUTES, MIN_SALDO_THRESHOLD } from './constants.ts';
import { getErrorMessage, getRequestedMonth } from './utils.ts';
import { checkSaldo } from './tenfront-api.ts';
import { syncLoja } from './sync-loja.ts';
import type { LojaConfig } from './types.ts';

// ===== Main handler =====

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: Record<string, unknown> = {};
    if (req.method === 'POST') {
      body = await req.json().catch(() => ({}));
    }

    const dryRun = Boolean(body.dryRun);
    const force = Boolean(body.force);
    const fullYear = Boolean(body.fullYear);
    // reprocess = refetch completo do mês corrente (sem ID-stop), para reaplicar mudanças
    // de mapeamento a atendimentos já gravados. Combinar com loja_id para limitar quota.
    const reprocess = Boolean(body.reprocess);
    const mes = getRequestedMonth(req, body);
    const onlyLojaId = typeof body.loja_id === 'string' ? body.loja_id : null;
    const onlyLojaIds = Array.isArray(body.loja_ids) ? (body.loja_ids as string[]) : null;

    const internalClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Guard de intervalo mínimo (ignora se for force, dryRun ou loja específica)
    // Usa qualquer sync (success ou parcial) para evitar que falhas parciais bloqueiem retries
    if (!force && !dryRun && !onlyLojaId && !onlyLojaIds) {
      const { data: lastSync } = await internalClient
        .from('sync_logs')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastSync) {
        const minutesAgo = (Date.now() - new Date(lastSync.created_at).getTime()) / 60000;
        if (minutesAgo < MIN_INTERVAL_MINUTES) {
          return new Response(
            JSON.stringify({ skipped: true, reason: `último sync há ${minutesAgo.toFixed(1)} min (mínimo: ${MIN_INTERVAL_MINUTES} min)` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
      }
    }

    // Group-specific interval guard (prevents double-firing within same group)
    if (!force && !dryRun && (onlyLojaId || onlyLojaIds)) {
      const filterIds = onlyLojaIds ?? (onlyLojaId ? [onlyLojaId] : []);
      const { data: lastGroupSync } = await internalClient
        .from('sync_logs')
        .select('created_at')
        .in('loja_id', filterIds)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastGroupSync) {
        const minutesAgo = (Date.now() - new Date(lastGroupSync.created_at).getTime()) / 60000;
        if (minutesAgo < MIN_INTERVAL_MINUTES) {
          return new Response(
            JSON.stringify({ skipped: true, reason: `último sync do grupo há ${minutesAgo.toFixed(1)} min (mínimo: ${MIN_INTERVAL_MINUTES} min)` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }
      }
    }

    // Buscar lojas com credenciais
    let query = internalClient
      .from('lojas')
      .select('id, nome, tenfront_bearer_token, tenfront_consumer_key, tenfront_consumer_secret');
    if (onlyLojaId) query = query.eq('id', onlyLojaId);
    else if (onlyLojaIds && onlyLojaIds.length > 0) query = query.in('id', onlyLojaIds);
    const { data: lojasData, error: lojasError } = await query;
    if (lojasError) throw lojasError;

    const lojas: LojaConfig[] = (lojasData ?? [])
      .filter((l: any) => l.tenfront_bearer_token && l.tenfront_consumer_key && l.tenfront_consumer_secret)
      .map((l: any) => ({
        id: l.id,
        nome: l.nome,
        bearer: l.tenfront_bearer_token,
        consumerKey: l.tenfront_consumer_key,
        consumerSecret: l.tenfront_consumer_secret,
      }));

    if (lojas.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhuma loja com credenciais Tenfront encontrada.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Identify lojas that already hit their daily rate limit today (BRT day).
    // Tenfront resets at midnight BRT = 03:00 UTC. Use that as the day boundary
    // so skips lift at 03:00 UTC instead of 00:00 UTC (which caused 21h+ blocks).
    const now = new Date();
    const brtMidnight = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 3, 0, 0, 0
    ));
    if (now.getUTCHours() < 3) brtMidnight.setUTCDate(brtMidnight.getUTCDate() - 1);

    const { data: todayFailLogs } = await internalClient
      .from('sync_logs')
      .select('loja_id')
      .gte('created_at', brtMidnight.toISOString())
      .ilike('error_message', '%diário%');
    const dailyLimitedLojas = new Set((todayFailLogs || []).map((r: { loja_id: string }) => r.loja_id));

    // Full-year mode: syncs all months from Jan to (current-1), most recent first.
    // Processes as many months as fit in a 110s budget; resumes next Sunday naturally.
    if (fullYear && !dryRun) {
      const startTime = Date.now();
      const TIME_BUDGET_MS = 110_000;
      const [yearStr] = mes.split('-');
      const currentMonthNum = parseInt(mes.split('-')[1]);
      const allResults: unknown[] = [];
      let processedMonths = 0;

      for (let m = currentMonthNum - 1; m >= 1; m--) {
        if (Date.now() - startTime > TIME_BUDGET_MS) {
          console.log(`[annual] Budget esgotado após ${processedMonths} meses.`);
          break;
        }
        const targetMes = `${yearStr}-${String(m).padStart(2, '0')}`;
        console.log(`[annual] Sync ${targetMes} (${processedMonths + 1}/${currentMonthNum - 1})`);
        for (const loja of lojas) {
          try {
            const result = await syncLoja(internalClient, loja, targetMes, false, true);
            allResults.push({ ...result, mes: targetMes });
          } catch (err) {
            allResults.push({ loja_id: loja.id, mes: targetMes, error: getErrorMessage(err) });
          }
        }
        processedMonths++;
      }

      return new Response(
        JSON.stringify({ success: true, fullYear: true, year: yearStr, processedMonths, results: allResults }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Verificar saldo uma única vez para todas as lojas (economiza N-1 req por ciclo)
    // Roda sempre — inclusive quando force=true (cron) — para não desperdiçar saldo checando por loja
    let sharedSaldo: number | undefined;
    if (!dryRun && lojas.length > 0) {
      sharedSaldo = await checkSaldo(lojas[0]);
      console.log(`[global] Saldo compartilhado: ${sharedSaldo} req restantes`);
      if (sharedSaldo < MIN_SALDO_THRESHOLD) {
        const results = lojas.map(l => ({ loja_id: l.id, skipped: true, reason: `saldo_insuficiente (${sharedSaldo})` }));
        for (const loja of lojas) {
          await internalClient.from('sync_logs').insert({
            loja_id: loja.id, mes, synced: 0, source_rows: 0,
            vendedores_atualizados: [], sem_colaborador: [],
            success: false,
            error_message: `Saldo diário insuficiente: ${sharedSaldo} req restantes (mínimo ${MIN_SALDO_THRESHOLD}) — aguardando reset às 00:00 BRT`,
            api_calls_made: 1,
          });
        }
        return new Response(
          JSON.stringify({ skipped: true, saldo: sharedSaldo, results }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    const results = [];
    for (const loja of lojas) {
      if (!force && dailyLimitedLojas.has(loja.id)) {
        console.log(`[${loja.id}] Rate limit diário já atingido hoje (BRT) — pulando até 03:00 UTC.`);
        results.push({ loja_id: loja.id, skipped: true, reason: 'daily_rate_limit_today' });
        continue;
      }
      try {
        // force só bypassa o guard de intervalo — NÃO força full fetch (forceFullFetch fica false)
        // para que lastSyncDate seja sempre usado e o early-stop funcione nos ciclos incrementais.
        // reprocess=true força o refetch completo do mês (reaplica mapeamento ao histórico).
        const result = await syncLoja(internalClient, loja, mes, dryRun, reprocess, sharedSaldo);
        results.push(result);
      } catch (err) {
        const msg = getErrorMessage(err);
        console.error(`[${loja.id}] erro:`, msg);
        results.push({ loja_id: loja.id, error: msg });
        if (!dryRun) {
          await internalClient.from('sync_logs').insert({
            loja_id: loja.id,
            mes,
            synced: 0,
            source_rows: 0,
            vendedores_atualizados: [],
            sem_colaborador: [],
            success: false,
            error_message: msg,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, mes, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const msg = getErrorMessage(error);
    console.error('sync-tenfront error:', msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
