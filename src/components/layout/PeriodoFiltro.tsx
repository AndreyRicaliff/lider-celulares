import { useEffect, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { CalendarIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/appStore';

// Filtro de período global (vive no Header). O mês deriva do "Início"; default = mês atual.
export const PeriodoFiltro = () => {
  const { selectedMes, setSelectedMes, periodoInicio, periodoFim, setPeriodoInicio, setPeriodoFim } = useAppStore();
  const di = periodoInicio;
  const df = periodoFim;

  const defaultMonth = useMemo(() => {
    if (di) return di;
    if (!selectedMes) return undefined;
    const [a, m] = selectedMes.split('-').map(Number);
    return new Date(a, m - 1, 1);
  }, [di, selectedMes]);

  useEffect(() => {
    if (di) {
      const m = format(di, 'yyyy-MM');
      if (m !== selectedMes) setSelectedMes(m);
    }
  }, [di]); // eslint-disable-line react-hooks/exhaustive-deps

  const temFiltro = !!(di || df);

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground hidden lg:inline">Período</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn('h-8 sm:h-9 w-[96px] sm:w-[120px] justify-start text-left font-normal text-xs', !di && 'text-muted-foreground')}>
            <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-primary" />{di ? format(di, 'dd/MM/yy') : 'Início'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar mode="single" selected={di ?? undefined} onSelect={(d) => setPeriodoInicio(d ?? null)}
            disabled={(date) => (df ? date > df : false)} defaultMonth={defaultMonth} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
      <span className="text-xs text-muted-foreground hidden sm:inline">até</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={cn('h-8 sm:h-9 w-[96px] sm:w-[120px] justify-start text-left font-normal text-xs', !df && 'text-muted-foreground')}>
            <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-primary" />{df ? format(df, 'dd/MM/yy') : 'Fim'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar mode="single" selected={df ?? undefined} onSelect={(d) => setPeriodoFim(d ?? null)}
            disabled={(date) => (di ? date < di : false)} defaultMonth={df ?? defaultMonth} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
      {temFiltro && (
        <Button variant="ghost" size="icon" onClick={() => { setPeriodoInicio(null); setPeriodoFim(null); }} className="h-8 w-8" title="Limpar período">
          <X size={14} />
        </Button>
      )}
    </div>
  );
};
