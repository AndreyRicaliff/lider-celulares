import { useSyncStatus } from '@/hooks/useSyncStatus';
import { LOJAS } from '@/lib/constants';
import { RefreshCw, AlertTriangle, CheckCircle2, Clock, WifiOff, Moon } from 'lucide-react';

// Janelas de sync por loja (BRT). Fora desses horários os dados não são atualizados.
const SYNC_WINDOWS: Record<string, { start: number; end: number; interval: number }> = {
  'caruaru':        { start: 10, end: 23, interval: 30 },
  'campina-grande': { start: 10, end: 23, interval: 30 },
  'natal':          { start: 10, end: 23, interval: 30 },
  'monteiro':       { start: 8,  end: 20, interval: 30 },
  'soledade':       { start: 8,  end: 20, interval: 30 },
};

const nowBRTHour = () => {
  const now = new Date();
  return parseInt(now.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }));
};

const isWithinWindow = (lojaId: string) => {
  const w = SYNC_WINDOWS[lojaId];
  if (!w) return true;
  const h = nowBRTHour();
  return h >= w.start && h < w.end;
};

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

  return (
    <div className="rounded-lg border border-border/40 bg-card/30 px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          <RefreshCw size={10} />
          Dados ao vivo
        </span>

        {statuses.map(s => {
          const nome = lojaNome(s.lojaId);
          const total = s.okToday + s.failToday;
          const win = SYNC_WINDOWS[s.lojaId];
          const winLabel = win ? `${win.start}h–${win.end}h` : '';
          const activeNow = isWithinWindow(s.lojaId);

          if (s.dailyLimitHit) {
            return (
              <span
                key={s.lojaId}
                title={`Cota diária esgotada. Retoma às 00h BRT.\nÚltimo sync: ${formatTime(s.lastOkTime)}\nJanela: ${winLabel} (a cada ${win?.interval}min)`}
                className="flex items-center gap-1 text-[10px] text-amber-400 font-medium cursor-default"
              >
                <AlertTriangle size={10} className="flex-shrink-0" />
                {nome}
                <span className="text-amber-400/50">cota</span>
              </span>
            );
          }

          if (!activeNow && s.okToday === 0) {
            return (
              <span
                key={s.lojaId}
                title={`Fora do horário de sync.\nJanela: ${winLabel} (a cada ${win?.interval}min)\nNenhum sync hoje ainda.`}
                className="flex items-center gap-1 text-[10px] text-muted-foreground/40 cursor-default"
              >
                <Moon size={10} className="flex-shrink-0" />
                {nome}
                <span className="text-muted-foreground/30">{winLabel}</span>
              </span>
            );
          }

          if (!activeNow && s.okToday > 0) {
            return (
              <span
                key={s.lojaId}
                title={`Janela encerrada às ${win?.end}h BRT.\nDados atualizados até: ${formatTime(s.lastOkTime)}\nPróxima atualização: amanhã às ${win?.start}h BRT`}
                className="flex items-center gap-1 text-[10px] text-muted-foreground/60 cursor-default"
              >
                <Moon size={10} className="flex-shrink-0" />
                {nome}
                <span className="text-muted-foreground/40">até {formatTime(s.lastOkTime)}</span>
              </span>
            );
          }

          if (s.okToday === 0) {
            return (
              <span
                key={s.lojaId}
                title={`Aguardando primeiro sync do dia.\nJanela: ${winLabel} (a cada ${win?.interval}min)`}
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
              title={`Sincronizando a cada ${win?.interval}min • Janela: ${winLabel}\nÚltimo sync: ${formatTime(s.lastOkTime)} • ${s.okToday} ciclos OK hoje`}
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
            {limitedCount} loja{limitedCount > 1 ? 's' : ''} retoma{limitedCount > 1 ? 'm' : ''} às 00h BRT
          </span>
        )}
      </div>
    </div>
  );
};
