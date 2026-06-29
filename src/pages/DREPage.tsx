import { useMemo } from 'react';
import { TrendingUp, Percent, DollarSign } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useAppStore } from '@/store/appStore';
import { useFaturamento } from '@/hooks/useFaturamento';
import { useComissoes } from '@/hooks/useComissoes';
import { somarDRE } from '@/lib/faturamentoCalculator';
import { formatCurrency, formatMonth } from '@/lib/formatters';
import { MargemPanel } from '@/components/dashboard/MargemPanel';

const formatPct = (v: number) =>
  `${(v * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const Kpi = ({ icon, label, valor, sub }: { icon: React.ReactNode; label: string; valor: string; sub?: string }) => (
  <Card className="relative overflow-hidden fx-tile">
    <div className="absolute left-0 top-0 right-0 h-[3px] gradient-primary" />
    <CardContent className="p-4">
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">{icon} {label}</p>
      <p className="text-xl sm:text-2xl font-bold tabular-nums truncate">{valor}</p>
      {sub && <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mt-1">{sub}</p>}
    </CardContent>
  </Card>
);

export const DREPage = () => {
  const { selectedMes } = useAppStore();
  const { data: faturamentos = [], isLoading } = useFaturamento(selectedMes);
  const { data: comissoes = [] } = useComissoes(undefined, selectedMes);

  const folhaPorLoja = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const c of comissoes) {
      acc[c.loja_id] = (acc[c.loja_id] || 0)
        + Number(c.comissao_base || 0) + Number(c.bonus_automatico || 0)
        + Number(c.bonus_manual || 0) + Number(c.salario || 0) + Number(c.ajuda_custo || 0);
    }
    return acc;
  }, [comissoes]);

  const total = useMemo(() => {
    const folhaTotal = faturamentos.reduce((s, f) => s + (folhaPorLoja[f.loja_id] ?? 0), 0);
    return somarDRE(faturamentos, folhaTotal);
  }, [faturamentos, folhaPorLoja]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">DRE — Demonstrativo de Resultado</h1>
        <p className="text-muted-foreground">{formatMonth(selectedMes)} · consolidado e por loja (dados da API)</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground animate-pulse">Carregando...</p>
      ) : faturamentos.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Sem dados para {formatMonth(selectedMes)}.</CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Kpi icon={<TrendingUp size={14} className="text-primary" />} label="Faturamento" valor={formatCurrency(total.faturamento)} sub="líquido + juros + GAR/troca" />
            <Kpi icon={<DollarSign size={14} className="text-primary" />} label="Receita (vendas)" valor={formatCurrency(total.receita)} sub="Σ preço de venda" />
            <Kpi icon={<DollarSign size={14} className="text-success" />} label="Lucro Bruto" valor={formatCurrency(total.lucroBruto)} sub={`margem ${formatPct(total.margemBruta)}`} />
            <Kpi icon={<Percent size={14} className="text-success" />} label="Resultado Operacional" valor={formatCurrency(total.resultadoOperacional)} sub={`− folha · margem ${formatPct(total.margemOperacional)}`} />
          </div>

          <MargemPanel faturamentos={faturamentos} effectiveLoja={null} folhaPorLoja={folhaPorLoja} />
        </>
      )}
    </div>
  );
};
