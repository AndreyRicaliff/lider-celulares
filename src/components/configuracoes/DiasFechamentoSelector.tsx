import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, X } from 'lucide-react';
import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DiasFechamentoSelectorProps {
  mes: string;
  diasFechamento: string[];
  onChange: (dias: string[]) => void;
}

export const DiasFechamentoSelector = ({ mes, diasFechamento, onChange }: DiasFechamentoSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Converter mes (YYYY-MM) para Date range do mês
  const [ano, mesNum] = mes.split('-').map(Number);
  const primeiroDia = new Date(ano, mesNum - 1, 1);
  const ultimoDia = new Date(ano, mesNum, 0);
  
  // Converter strings de data para objetos Date
  const selectedDates = diasFechamento.map(d => parse(d, 'yyyy-MM-dd', new Date()));
  
  const handleSelect = (date: Date | undefined) => {
    if (!date) return;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    
    if (diasFechamento.includes(dateStr)) {
      // Remover se já está selecionado
      onChange(diasFechamento.filter(d => d !== dateStr));
    } else {
      // Adicionar
      onChange([...diasFechamento, dateStr].sort());
    }
  };
  
  const removerDia = (dateStr: string) => {
    onChange(diasFechamento.filter(d => d !== dateStr));
  };
  
  const limparTodos = () => {
    onChange([]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-start text-left font-normal border-border/60 bg-card/50">
              <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
              Selecionar dias de fechamento
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={undefined}
              onSelect={handleSelect}
              disabled={(date) => date < primeiroDia || date > ultimoDia}
              modifiers={{
                selected: selectedDates,
              }}
              modifiersStyles={{
                selected: {
                  backgroundColor: 'hsl(var(--destructive))',
                  color: 'hsl(var(--destructive-foreground))',
                },
              }}
              locale={ptBR}
              defaultMonth={primeiroDia}
            />
          </PopoverContent>
        </Popover>
        
        {diasFechamento.length > 0 && (
          <Button variant="ghost" size="sm" onClick={limparTodos} className="text-destructive">
            <X className="h-4 w-4 mr-1" /> Limpar todos
          </Button>
        )}
      </div>
      
      {diasFechamento.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {diasFechamento.map(dateStr => {
            const date = parse(dateStr, 'yyyy-MM-dd', new Date());
            return (
              <Badge 
                key={dateStr} 
                variant="secondary" 
                className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                onClick={() => removerDia(dateStr)}
              >
                {format(date, "dd 'de' MMMM", { locale: ptBR })}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            );
          })}
        </div>
      )}
      
      {diasFechamento.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum dia de fechamento selecionado. Clique no calendário para adicionar feriados locais.
        </p>
      )}
    </div>
  );
};
