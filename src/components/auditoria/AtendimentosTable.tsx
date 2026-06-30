import { Fragment, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { calcTotalReal, checkAlertaPreco, valorItem, isCancelada } from './auditoria-utils';
import type { AtendimentoAudit, TabelaPreco } from './types';

interface Props {
  atendimentos: AtendimentoAudit[];
  tabelaPrecos: TabelaPreco[];
  isLoading: boolean;
}

export const AtendimentosTable = ({ atendimentos, tabelaPrecos, isLoading }: Props) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-lg">Relatório Detalhado de Vendas ({atendimentos.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-10 text-center text-muted-foreground">Carregando dados da API...</div>
        ) : atendimentos.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">Nenhum atendimento sincronizado para este período/filtro.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Valor Real</TableHead>
                  <TableHead className="text-right">Valor Total (+Juros)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {atendimentos.map((a) => {
                  const aberto = expanded === a.atendimento_id;
                  const alerta = (a.alertas_preco || 0) > 0;
                  return (
                    <Fragment key={a.atendimento_id}>
                      <TableRow
                        className={`cursor-pointer hover:bg-muted/50 transition-colors ${alerta ? 'bg-destructive/5' : ''}`}
                        onClick={() => setExpanded(aberto ? null : a.atendimento_id)}
                      >
                        <TableCell className="text-sm font-medium">
                          <div className="flex items-center gap-2">
                            {alerta && <AlertCircle size={14} className="text-destructive animate-pulse" />}
                            {new Date(a.data_atendimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{a.atendimento_id}</TableCell>
                        <TableCell className="text-sm font-bold text-primary">{a.vendedor_nome}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(calcTotalReal(a.detalhes_brutos))}</TableCell>
                        <TableCell className="text-right font-bold flex flex-col items-end">
                          <span className="text-primary">{formatCurrency(a.valor_total || 0)}</span>
                          {alerta && <span className="text-[9px] text-destructive font-bold uppercase">Preço abaixo da tabela</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={isCancelada(a.status) ? 'destructive' : 'secondary'} className="text-[10px]">{a.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{aberto ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</TableCell>
                      </TableRow>
                      {aberto && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={7} className="p-4">
                            <AtendimentoExpandido atendimento={a} tabelaPrecos={tabelaPrecos} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const AtendimentoExpandido = ({ atendimento: a, tabelaPrecos }: { atendimento: AtendimentoAudit; tabelaPrecos: TabelaPreco[] }) => {
  const detalhes = Array.isArray(a.detalhes_brutos) ? a.detalhes_brutos : [];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase text-primary">Produtos Vendidos</h4>
        {detalhes.map((info, i) => (
          <div key={i} className="space-y-2">
            {(info.Venda || []).map((v, j) => {
              const valor = valorItem(v);
              const alerta = checkAlertaPreco(v.Produto || '', valor, a.loja_id, tabelaPrecos);
              return (
                <div key={j} className={`flex justify-between items-center p-2 rounded border text-sm ${alerta ? 'bg-destructive/10 border-destructive/50' : 'bg-background/50 border-border/50'}`}>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                      {alerta && <AlertCircle size={12} className="text-destructive" />}
                      <span className="font-medium">{v.Produto}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground uppercase">{v.Grupo} | {v.Subtipo || 'Sem Subtipo'}</span>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${alerta ? 'text-destructive' : ''}`}>{formatCurrency(valor)}</div>
                    <div className="text-[10px]">Qtd: {v.Quantidade}</div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase text-primary">Outros Detalhes</h4>
        <div className="bg-background/50 p-3 rounded border border-border/50 text-sm space-y-2">
          {detalhes.map((info, i) => (
            <div key={i}>
              {(info.Brinde || []).length > 0 && (
                <div className="mb-2">
                  <span className="text-xs font-bold text-success">Brindes: </span>
                  <span className="text-xs">{(info.Brinde || []).map((b) => b.Produto).join(', ')}</span>
                </div>
              )}
              {(info.Troca || []).length > 0 && (
                <div className="mb-2">
                  <span className="text-xs font-bold text-orange-400">Trocas: </span>
                  <span className="text-xs">{(info.Troca || []).map((t) => t.Produto).join(', ')}</span>
                </div>
              )}
            </div>
          ))}
          <div className="pt-2 border-t border-border/50 flex justify-between">
            <span className="text-xs text-muted-foreground">ID Tenfront:</span>
            <span className="text-xs font-mono">{a.atendimento_id}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
