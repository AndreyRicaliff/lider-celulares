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
  folhaPorLoja?: Record<string, number>;
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
    <Celula className={cn('font-medium', corLucro(d.lucroBruto))}>{formatPct(d.margemBruta)}</Celula>
    <Celula className="text-muted-foreground">{formatCurrency(d.receitaFinanceira)}</Celula>
    <Celula className="text-muted-foreground">{formatCurrency(d.folha)}</Celula>
    <Celula className={cn('font-semibold', corLucro(d.resultadoOperacional))}>{formatCurrency(d.resultadoOperacional)}</Celula>
    <Celula className={cn('font-semibold', corLucro(d.resultadoOperacional))}>{formatPct(d.margemOperacional)}</Celula>
  </>
);

export const MargemPanel = ({ faturamentos, effectiveLoja, folhaPorLoja = {} }: Props) => {
  const { linhas, total } = useMemo(() => {
    const escopo = effectiveLoja ? faturamentos.filter((f) => f.loja_id === effectiveLoja) : faturamentos;
    const ls: Linha[] = escopo
      .map((f) => ({ id: f.loja_id, nome: LOJAS[f.loja_id as keyof typeof LOJAS] ?? f.loja_id, ...calcDRE(f, folhaPorLoja[f.loja_id] ?? 0) }))
      .sort((a, b) => b.resultadoOperacional - a.resultadoOperacional);
    const folhaTotal = escopo.reduce((s, f) => s + (folhaPorLoja[f.loja_id] ?? 0), 0);
    return { linhas: ls, total: somarDRE(escopo, folhaTotal) };
  }, [faturamentos, effectiveLoja, folhaPorLoja]);

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
                <th className="px-3 py-2 text-right font-medium">− Folha</th>
                <th className="px-3 py-2 text-right font-medium">Result. Op.</th>
                <th className="px-3 py-2 text-right font-medium">Margem Op.</th>
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
          Receita = Σ preço de venda · CMV = Σ custo · Lucro bruto = Receita − CMV · Folha = comissão + salário + ajuda de custo · Result. Op. = Lucro bruto + Juros + GAR/Troca − Folha. Vendas/custo/juros vêm item-a-item da API; folha vem do cálculo de comissões.
        </p>
      </CardContent>
    </Card>
  );
};
