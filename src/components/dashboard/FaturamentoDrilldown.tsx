import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/formatters';
import { type FaturamentoEspelho } from '@/lib/faturamentoCalculator';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  esp: FaturamentoEspelho;
  titulo: string;
}

interface Linha {
  rotulo: string;
  valor: number;
  nota?: string;
}

const Componente = ({ rotulo, valor, nota }: Linha) => (
  <div className="flex items-baseline justify-between gap-4 py-2 border-b border-border/30">
    <div className="min-w-0">
      <p className="text-sm truncate">{rotulo}</p>
      {nota && <p className="text-[11px] text-muted-foreground truncate">{nota}</p>}
    </div>
    <p className="text-sm font-semibold tabular-nums whitespace-nowrap">{formatCurrency(valor)}</p>
  </div>
);

export const FaturamentoDrilldown = ({ open, onOpenChange, esp, titulo }: Props) => {
  const linhas: Linha[] = [
    { rotulo: 'Líquido (vendido)', valor: esp.liquido, nota: 'base de comissão' },
    { rotulo: '+ Juros de parcelamento', valor: esp.juros, nota: 'receita financeira' },
    { rotulo: '+ Trocas / GAR revendida', valor: esp.extra, nota: 'entradas sem item de venda' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        <div className="mt-1">
          {linhas.map((l) => <Componente key={l.rotulo} {...l} />)}
          <div className="flex items-baseline justify-between gap-4 pt-3">
            <p className="text-sm font-bold uppercase tracking-wide">Faturamento</p>
            <p className="text-lg font-bold tabular-nums text-primary whitespace-nowrap">{formatCurrency(esp.espelho)}</p>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">Fórmula própria (tudo que entra), somada item-a-item da API — não espelha o ERP.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
