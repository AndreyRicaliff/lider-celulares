import { useState, useEffect } from 'react';
import { Bell, CheckCircle, AlertCircle, X, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface SyncLog {
  id: string;
  loja_id: string;
  mes: string;
  synced: number;
  source_rows: number;
  vendedores_atualizados: string[];
  sem_colaborador: string[];
  success: boolean;
  error_message: string | null;
  created_at: string;
  lido: boolean;
}

export const SyncNotifications = () => {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [open, setOpen] = useState(false);

  const unreadCount = logs.filter((l) => !l.lido).length;

  const fetchLogs = async () => {
    const { data } = await supabase
      .from('sync_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setLogs(data as unknown as SyncLog[]);
  };

  useEffect(() => {
    fetchLogs();

    const channel = supabase
      .channel('sync-logs-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sync_logs' },
        (payload) => {
          setLogs((prev) => [payload.new as unknown as SyncLog, ...prev].slice(0, 20));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const markAllRead = async () => {
    const unreadIds = logs.filter((l) => !l.lido).map((l) => l.id);
    if (unreadIds.length === 0) return;

    const { error } = await supabase
      .from('sync_logs')
      .update({ lido: true })
      .in('id', unreadIds);

    if (error) {
      toast.error('Erro ao marcar notificações como lidas');
      return;
    }

    setLogs((prev) => prev.map((l) => ({ ...l, lido: true })));
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && unreadCount > 0) {
      markAllRead();
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10 overflow-visible rounded-full hover:bg-accent/80 transition-all duration-200">
          <Bell size={20} className="text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 flex h-5 w-5 translate-x-full -translate-y-full items-center justify-center rounded-full bg-destructive text-[10px] font-bold leading-none text-destructive-foreground shadow-lg ring-2 ring-background animate-bounce z-10">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h4 className="text-sm font-semibold text-foreground">Sincronizações</h4>
          <RefreshCw size={14} className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors" onClick={fetchLogs} />
        </div>
        <ScrollArea className="max-h-80">
          {logs.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Nenhuma sincronização registrada
            </div>
          ) : (
            <div className="divide-y divide-border">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`px-4 py-3 transition-colors ${!log.lido ? 'bg-accent/30' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    {log.success ? (
                      <CheckCircle size={16} className="mt-0.5 shrink-0 text-green-500" />
                    ) : (
                      <AlertCircle size={16} className="mt-0.5 shrink-0 text-destructive" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">
                        {log.success
                          ? `Sync concluída • ${log.synced} vendedor${log.synced !== 1 ? 'es' : ''}`
                          : 'Erro na sincronização'}
                      </p>
                      {log.success && log.vendedores_atualizados.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {log.vendedores_atualizados.map((v) => (
                            <Badge key={v} variant="secondary" className="text-[10px] px-1.5 py-0">
                              {v}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {log.success && log.sem_colaborador.length > 0 && (
                        <p className="mt-1 text-[10px] text-amber-500">
                          ⚠ Sem cadastro: {log.sem_colaborador.join(', ')}
                        </p>
                      )}
                      {!log.success && log.error_message && (
                        <p className="mt-1 text-[10px] text-destructive truncate">
                          {log.error_message}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(log.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                        {' • '}Ref: {log.mes}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
