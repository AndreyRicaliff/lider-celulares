import { useMemo } from 'react';
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
}

const nomeLoja = (id: string) => LOJAS[id as keyof typeof LOJAS] ?? id;

export const FaturamentoCrossLoja = ({ faturamentos, configs }: Props) => {
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

  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">Faturamento por loja (espelho Tenfront)</p>
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
                  <TableCell className="text-right tabular-nums font-semibold text-warning">{formatCurrency(esp.espelho)}</TableCell>
                  <TableCell className={`text-right tabular-nums ${esp.divergencia === null ? 'text-muted-foreground' : drift ? 'text-warning' : 'text-success'}`}>
                    {esp.divergencia === null ? '—' : `${(esp.divergencia * 100).toFixed(2)}%`}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
