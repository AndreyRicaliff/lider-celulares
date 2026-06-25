import { useMemo, useState } from 'react';
import { TrendingUp, Receipt, ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';
import {
  calcFaturamentoEspelho,
  lerCalibracao,
  somarEspelhos,
  type FaturamentoLoja,
} from '@/lib/faturamentoCalculator';
import { FaturamentoDrilldown } from './FaturamentoDrilldown';

interface Props {
  faturamentos: FaturamentoLoja[];
  configs: Record<string, { numericConfig: Record<string, number> }>;
  effectiveLoja: string | null;
  titulo: string;
}

export const FaturamentoCards = ({ faturamentos, configs, effectiveLoja, titulo }: Props) => {
  const [open, setOpen] = useState(false);

  const total = useMemo(() => {
    const porLoja = faturamentos.map((f) =>
      calcFaturamentoEspelho(f, lerCalibracao(configs[f.loja_id]?.numericConfig ?? {}, f.loja_id)),
    );
    const escopo = effectiveLoja
      ? faturamentos
          .map((f, i) => ({ id: f.loja_id, esp: porLoja[i] }))
          .filter((p) => p.id === effectiveLoja)
          .map((p) => p.esp)
      : porLoja;
    return somarEspelhos(escopo);
  }, [faturamentos, configs, effectiveLoja]);

  return (
    <>
      <Card className="relative overflow-hidden fx-tile">
        <div className="absolute left-0 top-0 right-0 h-[3px] gradient-primary" />
        <CardContent className="p-3 sm:p-6">
          <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
            <TrendingUp size={15} className="text-primary" /> Líquido (vendido)
          </p>
          <p className="text-xl sm:text-2xl font-bold text-gradient tabular-nums truncate">{formatCurrency(total.liquido)}</p>
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mt-1">base de comissão</p>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden fx-tile">
        <div className="absolute left-0 top-0 right-0 h-[3px] bg-primary/60" />
        <button type="button" onClick={() => setOpen(true)} className="w-full text-left">
          <CardContent className="p-3 sm:p-6">
            <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
              <Receipt size={15} className="text-primary" /> Faturamento <span className="text-muted-foreground/50 normal-case">(≈ Tenfront)</span>
            </p>
            <p className="text-xl sm:text-2xl font-bold text-primary tabular-nums truncate">{formatCurrency(total.espelho)}</p>
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mt-1 flex items-center gap-1">
              líquido + juros + trocas <ChevronDown size={11} />
            </p>
          </CardContent>
        </button>
      </Card>

      <FaturamentoDrilldown open={open} onOpenChange={setOpen} esp={total} titulo={`Faturamento — ${titulo}`} />
    </>
  );
};
