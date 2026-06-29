import { useMemo } from 'react';
import { Percent } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';
import { LOJAS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { calcDRE, somarDRE, type DRE, type FaturamentoLoja } from '@/lib/faturamentoCalculator';

interface Props {
  faturamentos: FaturamentoLoja[];
  effectiveLoja: string | null;
}

interface Linha extends DRE {
  id: string;
  nome: string;
}

const formatPct = (v: number) =>
  `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const corLucro = (v: number) => (v >= 0 ? 'text-success' : 'text-destructive');

const Celula = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <td className={cn('px-3 py-2 text-right tabular-nums', className)}>{children}</td>
);

const ColunasDRE = ({ d }: { d: DRE }) => (
  <>
    <Celula className="text-foreground/90">{formatCurrency(d.receita)}</Celula>
    <Celula className="text-muted-foreground">{formatCurrency(d.cmv)}</Celula>
    <Celula className={corLucro(d.lucroBruto)}>{formatCurrency(d.lucroBruto)}</Celula>
    <Celula className={cn('font-semibold', corLucro(d.lucroBruto))}>{formatPct(d.margemBruta)}</Celula>
    <Celula className="text-muted-foreground">{formatCurrency(d.receitaFinanceira)}</Celula>
    <Celula className="text-muted-foreground">{d.outrasEntradas > 0 ? formatCurrency(d.outrasEntradas) : '—'}</Celula>
    <Celula className={cn('font-semibold', corLucro(d.resultado))}>{formatCurrency(d.resultado)}</Celula>
  </>
);

export const MargemPanel = ({ faturamentos, effectiveLoja }: Props) => {
  const { linhas, total } = useMemo(() => {
    const escopo = effectiveLoja ? faturamentos.filter((f) => f.loja_id === effectiveLoja) : faturamentos;
    const ls: Linha[] = escopo
      .map((f) => ({ id: f.loja_id, nome: LOJAS[f.loja_id as keyof typeof LOJAS] ?? f.loja_id, ...calcDRE(f) }))
      .sort((a, b) => b.resultado - a.resultado);
    return { linhas: ls, total: somarDRE(escopo) };
  }, [faturamentos, effectiveLoja]);

  return (
    <Card className="relative overflow-hidden fx-tile">
      <div className="absolute left-0 top-0 right-0 h-[3px] gradient-primary" />
      <CardContent className="p-3 sm:p-5">
        <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <Percent size={15} className="text-primary" /> Resultado por Loja <span className="text-muted-foreground/50 normal-case">(DRE — dados da API)</span>
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="text-muted-foreground uppercase text-[10px] tracking-wide border-b border-border">
                <th className="px-3 py-2 text-left font-medium">Loja</th>
                <th className="px-3 py-2 text-right font-medium">Receita</th>
                <th className="px-3 py-2 text-right font-medium">CMV</th>
                <th className="px-3 py-2 text-right font-medium">Lucro bruto</th>
                <th className="px-3 py-2 text-right font-medium">Margem</th>
                <th className="px-3 py-2 text-right font-medium">+ Juros</th>
                <th className="px-3 py-2 text-right font-medium">+ GAR/Troca</th>
                <th className="px-3 py-2 text-right font-medium">Resultado</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 text-left font-medium text-foreground">{l.nome}</td>
                  <ColunasDRE d={l} />
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-primary/40 font-bold text-foreground">
                <td className="px-3 py-2 text-left">Consolidado</td>
                <ColunasDRE d={total} />
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mt-2">
          Receita = Σ preço de venda · CMV = Σ custo · Lucro bruto = Receita − CMV · Juros = receita financeira (parcelamento) · Resultado = Lucro bruto + Juros + GAR/Troca. Tudo item-a-item da API; o "Total faturado" do ERP fica fora por divergir entre telas.
        </p>
      </CardContent>
    </Card>
  );
};
