import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Users, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import type { ResumoVendedor, CategoriaId } from './types';

interface Props {
  resumo: ResumoVendedor[];
  categoriaFiltro: CategoriaId;
  onFiltrarVendedor: (nome: string) => void;
}

export const ResumoVendedoresTable = ({ resumo, categoriaFiltro, onFiltrarVendedor }: Props) => {
  const geral = categoriaFiltro === 'geral';
  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="bg-primary/5 pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users size={20} className="text-primary" />
          Resumo por Vendedor
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-center">{geral ? 'Qtd. Atendimentos' : `Qtd. ${categoriaFiltro.replace('_', ' ')}`}</TableHead>
                <TableHead className="text-right">Total Real</TableHead>
                <TableHead className="text-right text-primary">Total com Juros</TableHead>
                <TableHead className="text-right w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {resumo.map((vend) => (
                <TableRow key={vend.nome} className="hover:bg-muted/30">
                  <TableCell className="font-bold flex items-center gap-2">
                    {vend.nome}
                    {vend.alertas > 0 && (
                      <div className="relative">
                        <AlertCircle className="text-destructive h-4 w-4" />
                        <span className="absolute -top-1 -right-1 bg-destructive text-white text-[8px] rounded-full w-3 h-3 flex items-center justify-center font-bold">
                          {vend.alertas}
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-center">{geral ? vend.atendimentos : vend.qtdCategoria}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(vend.totalReal)}</TableCell>
                  <TableCell className="text-right font-bold text-primary">{formatCurrency(vend.total)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => onFiltrarVendedor(vend.nome)} className="h-8 text-xs">Filtrar</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
