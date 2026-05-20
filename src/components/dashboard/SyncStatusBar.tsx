import { useSyncStatus } from '@/hooks/useSyncStatus';
import { LOJAS } from '@/lib/constants';
import { RefreshCw, AlertTriangle, CheckCircle2, Clock, WifiOff } from 'lucide-react';

const lojaNome = (id: string) =>
  (LOJAS[id as keyof typeof LOJAS] || id).split(' ')[0];

const formatTime = (iso: string | null) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch { return '—'; }
};

export const SyncStatusBar = () => {
  const { data: statuses, isLoading } = useSyncStatus();

  if (isLoading || !statuses || statuses.length === 0) return null;

  const limitedCount = statuses.filter(s => s.dailyLimitHit).length;
  const allOk = limitedCount === 0;

  return (
    <div className="rounded-lg border border-border/40 bg-card/30 px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          <RefreshCw size={10} />
          API Tenfront
        </span>

        {statuses.map(s => {
          const nome = lojaNome(s.lojaId);
          const total = s.okToday + s.failToday;

          if (s.dailyLimitHit) {
            return (
              <span
                key={s.lojaId}
                title={`Limite diário atingido. Último sync OK: ${formatTime(s.lastOkTime)}. ${s.okToday} chamadas OK / ${total} total hoje.`}
                className="flex items-center gap-1 text-[10px] text-amber-400 font-medium cursor-default"
              >
                <AlertTriangle size={10} className="flex-shrink-0" />
                {nome}
                <span className="text-amber-400/60">{s.okToday}/{total}</span>
              </span>
            );
          }

          if (s.okToday === 0) {
            return (
              <span
                key={s.lojaId}
                title={`Nenhum sync hoje. ${s.failToday > 0 ? s.lastError || 'Erros: ' + s.failToday : 'Aguardando.'}`}
                className="flex items-center gap-1 text-[10px] text-muted-foreground/50 cursor-default"
              >
                <WifiOff size={10} className="flex-shrink-0" />
                {nome}
              </span>
            );
          }

          return (
            <span
              key={s.lojaId}
              title={`Último sync: ${formatTime(s.lastOkTime)}. ${s.okToday} chamadas OK hoje.`}
              className="flex items-center gap-1 text-[10px] text-green-400/80 font-medium cursor-default"
            >
              <CheckCircle2 size={10} className="flex-shrink-0" />
              {nome}
              <span className="text-green-400/50">{formatTime(s.lastOkTime)}</span>
            </span>
          );
        })}

        {limitedCount > 0 && (
          <span className="ml-auto text-[10px] text-amber-400/70 flex items-center gap-1">
            <Clock size={10} />
            {limitedCount} loja{limitedCount > 1 ? 's' : ''} retoma{limitedCount > 1 ? 'm' : ''} à meia-noite (00h BRT)
          </span>
        )}
      </div>
    </div>
  );
};
