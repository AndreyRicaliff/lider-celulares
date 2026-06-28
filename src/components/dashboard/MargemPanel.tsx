import { useMemo } from 'react';
import { Percent } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';
import { LOJAS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { FaturamentoLoja } from '@/lib/faturamentoCalculator';

interface Props {
  faturamentos: FaturamentoLoja[];
  effectiveLoja: string | null;
}

interface Linha {
  id: string;
  nome: string;
  faturamento: number;
  receita: number;
  cmv: number;
  lucro: number;
  margem: number;
}

const formatPct = (v: number) =>
  `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const montarLinha = (id: string, nome: string, fs: FaturamentoLoja[]): Linha => {
  const faturamento = fs.reduce((s, f) => s + f.total_bruto, 0);
  const receita = fs.reduce((s, f) => s + f.liquido, 0);
  const cmv = fs.reduce((s, f) => s + f.custo, 0);
  const lucro = receita - cmv;
  return { id, nome, faturamento, receita, cmv, lucro, margem: receita ? lucro / receita : 0 };
};

const Celula = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <td className={cn('px-3 py-2 text-right tabular-nums', className)}>{children}</td>
);

export const MargemPanel = ({ faturamentos, effectiveLoja }: Props) => {
  const { linhas, total } = useMemo(() => {
    const escopo = effectiveLoja ? faturamentos.filter((f) => f.loja_id === effectiveLoja) : faturamentos;
    const ls = escopo
      .map((f) => montarLinha(f.loja_id, LOJAS[f.loja_id as keyof typeof LOJAS] ?? f.loja_id, [f]))
      .sort((a, b) => b.lucro - a.lucro);
    return { linhas: ls, total: montarLinha('__total', 'Consolidado', escopo) };
  }, [faturamentos, effectiveLoja]);

  return (
    <Card className="relative overflow-hidden fx-tile">
      <div className="absolute left-0 top-0 right-0 h-[3px] gradient-primary" />
      <CardContent className="p-3 sm:p-5">
        <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <Percent size={15} className="text-primary" /> Margem por Loja
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="text-muted-foreground uppercase text-[10px] tracking-wide border-b border-border">
                <th className="px-3 py-2 text-left font-medium">Loja</th>
                <th className="px-3 py-2 text-right font-medium">Faturamento</th>
                <th className="px-3 py-2 text-right font-medium">Receita</th>
                <th className="px-3 py-2 text-right font-medium">CMV</th>
                <th className="px-3 py-2 text-right font-medium">Lucro bruto</th>
                <th className="px-3 py-2 text-right font-medium">Margem</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 text-left font-medium text-foreground">{l.nome}</td>
                  <Celula className="text-foreground/90">{formatCurrency(l.faturamento)}</Celula>
                  <Celula className="text-muted-foreground">{formatCurrency(l.receita)}</Celula>
                  <Celula className="text-muted-foreground">{formatCurrency(l.cmv)}</Celula>
                  <Celula className={l.lucro >= 0 ? 'text-success' : 'text-destructive'}>{formatCurrency(l.lucro)}</Celula>
                  <Celula className={cn('font-semibold', l.lucro >= 0 ? 'text-success' : 'text-destructive')}>{formatPct(l.margem)}</Celula>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-primary/40 font-bold text-foreground">
                <td className="px-3 py-2 text-left">{total.nome}</td>
                <Celula>{formatCurrency(total.faturamento)}</Celula>
                <Celula>{formatCurrency(total.receita)}</Celula>
                <Celula>{formatCurrency(total.cmv)}</Celula>
                <Celula className={total.lucro >= 0 ? 'text-success' : 'text-destructive'}>{formatCurrency(total.lucro)}</Celula>
                <Celula className={total.lucro >= 0 ? 'text-success' : 'text-destructive'}>{formatPct(total.margem)}</Celula>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mt-2">
          Faturamento = Σ Total bruto · Receita = Σ preço de venda · CMV = Σ custo · margem = lucro ÷ receita
        </p>
      </CardContent>
    </Card>
  );
};
