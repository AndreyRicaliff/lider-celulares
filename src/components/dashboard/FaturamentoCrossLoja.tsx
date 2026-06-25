import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/formatters';
import { LOJAS } from '@/lib/constants';
import {
  calcFaturamentoEspelho,
  lerCalibracao,
  calibracaoDesatualizada,
  type FaturamentoLoja,
} from '@/lib/faturamentoCalculator';

interface Props {
  faturamentos: FaturamentoLoja[];
  configs: Record<string, { numericConfig: Record<string, number> }>;
  somenteGrafico?: boolean;
}

const nomeLoja = (id: string) => LOJAS[id as keyof typeof LOJAS] ?? id;
const fmtTick = (v: number) => (v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`);

export const FaturamentoCrossLoja = ({ faturamentos, configs, somenteGrafico = false }: Props) => {
  const linhas = useMemo(
    () =>
      faturamentos
        .map((f) => ({
          id: f.loja_id,
          esp: calcFaturamentoEspelho(f, lerCalibracao(configs[f.loja_id]?.numericConfig ?? {}, f.loja_id)),
        }))
        .sort((a, b) => b.esp.espelho - a.esp.espelho),
    [faturamentos, configs],
  );

  if (linhas.length === 0) return null;

  const chartData = linhas.map(({ id, esp }) => ({ loja: nomeLoja(id), valor: esp.espelho }));

  return (
    <Card>
      <CardContent className="p-3 sm:p-4 space-y-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Faturamento por loja (espelho Tenfront)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="loja" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtTick} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
              <Tooltip
                cursor={{ fill: 'hsl(var(--primary) / 0.08)' }}
                formatter={(v: number) => [formatCurrency(v), 'Faturamento']}
                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Bar dataKey="valor" radius={[6, 6, 0, 0]} maxBarSize={56}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill="hsl(var(--primary))" fillOpacity={i === 0 ? 1 : 0.72} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {!somenteGrafico && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Loja</TableHead>
              <TableHead className="text-right">Líquido</TableHead>
              <TableHead className="text-right">Juros</TableHead>
              <TableHead className="text-right">Trocas/GAR</TableHead>
              <TableHead className="text-right">Faturamento</TableHead>
              <TableHead className="text-right">Δ Tenfront</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map(({ id, esp }) => {
              const drift = calibracaoDesatualizada(esp);
              return (
                <TableRow key={id} className="fx-tile">
                  <TableCell className="font-medium">{nomeLoja(id)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(esp.liquido)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(esp.juros)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{esp.extra > 0 ? formatCurrency(esp.extra) : '—'}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold text-primary">{formatCurrency(esp.espelho)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${esp.divergencia === null ? 'text-muted-foreground' : drift ? 'text-warning' : 'text-success'}`}>
                    {esp.divergencia === null ? '—' : `${(esp.divergencia * 100).toFixed(2)}%`}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        )}
      </CardContent>
    </Card>
  );
};
