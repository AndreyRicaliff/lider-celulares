import { useState, useMemo } from 'react';
import { useAppStore } from '@/store/appStore';
import { useComissoes, useUpdateComissao } from '@/hooks/useComissoes';
import { useConfiguracao } from '@/hooks/useConfiguracoes';
import { LOJAS } from '@/lib/constants';
import { formatCurrency } from '@/lib/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Save, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Comissao } from '@/types/database';

interface FolhaPagamentoPageProps {
  gerenteLojaId?: string;
  readOnly?: boolean;
}

export const FolhaPagamentoPage = ({ gerenteLojaId, readOnly }: FolhaPagamentoPageProps) => {
  const { selectedLoja, selectedMes, setSelectedMes } = useAppStore();
  const lojaId = gerenteLojaId || selectedLoja || 'soledade';
  
  const { data: comissoes = [], isLoading } = useComissoes(lojaId, selectedMes);
  const updateComissao = useUpdateComissao();
  
  const [editedValues, setEditedValues] = useState<Record<string, Partial<Comissao>>>({});
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  const isReadOnly = readOnly || !!gerenteLojaId;

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const handleInputChange = (id: string, field: keyof Comissao, value: number) => {
    setEditedValues(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const getValue = (comissao: Comissao, field: keyof Comissao): number => {
    if (editedValues[comissao.id]?.[field] !== undefined) {
      return editedValues[comissao.id][field] as number;
    }
    return comissao[field] as number;
  };

  const calculateFinalValue = (comissao: Comissao): number => {
    const salario = comissao.salario;
    const ajudaCusto = comissao.ajuda_custo;
    const comissaoBase = comissao.comissao_base;
    const bonusAutomatico = comissao.bonus_automatico;
    const bonusManual = getValue(comissao, 'bonus_manual');
    const descontosDividas = comissao.descontos_dividas;
    const adiantamentos = getValue(comissao, 'adiantamentos');
    const descontos = getValue(comissao, 'descontos');

    return salario + ajudaCusto + comissaoBase + bonusAutomatico + bonusManual - descontosDividas - adiantamentos - descontos;
  };

  const saveChanges = async () => {
    const idsToSave = Object.keys(editedValues);
    if (idsToSave.length === 0) {
      toast.info('Nenhuma alteração para salvar');
      return;
    }

    for (const id of idsToSave) {
      const changes = editedValues[id];
      const comissao = comissoes.find(c => c.id === id);
      if (!comissao) continue;

      const dataToSave: { id: string } & Partial<Comissao> = { id };
      
      if (changes.bonus_manual !== undefined) dataToSave.bonus_manual = changes.bonus_manual;
      if (changes.adiantamentos !== undefined) dataToSave.adiantamentos = changes.adiantamentos;
      if (changes.descontos !== undefined) dataToSave.descontos = changes.descontos;

      await updateComissao.mutateAsync(dataToSave);
    }

    setEditedValues({});
    toast.success('Alterações salvas com sucesso!');
  };

  const sortedComissoes = [...comissoes].sort((a, b) => b.comissao_base - a.comissao_base);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-light">
            Folha de Pagamento - {LOJAS[lojaId as keyof typeof LOJAS]}
          </h1>
          <p className="text-muted-foreground">Visualize e edite as comissões calculadas</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
          <div className="flex-1 sm:flex-none">
            <Label>Mês de Referência</Label>
            <Input 
              type="month" 
              value={selectedMes}
              onChange={e => setSelectedMes(e.target.value)}
              className="w-full sm:w-[180px]"
            />
          </div>
          {!isReadOnly && (
            <Button onClick={saveChanges} disabled={Object.keys(editedValues).length === 0} className="w-full sm:w-auto">
              <Save size={16} className="mr-2" /> Salvar Alterações
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Carregando...</CardContent></Card>
      ) : sortedComissoes.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhuma comissão calculada para este mês</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-6 sm:w-8"></TableHead>
                  <TableHead className="whitespace-nowrap text-xs sm:text-sm">Vendedor</TableHead>
                  <TableHead className="text-right whitespace-nowrap text-xs sm:text-sm">Comissão</TableHead>
                  <TableHead className="text-right whitespace-nowrap text-xs sm:text-sm hidden md:table-cell">Bônus Auto</TableHead>
                  <TableHead className="text-right whitespace-nowrap text-xs sm:text-sm">Bônus Manual</TableHead>
                  <TableHead className="text-right whitespace-nowrap text-xs sm:text-sm hidden lg:table-cell">Salário</TableHead>
                  <TableHead className="text-right whitespace-nowrap text-xs sm:text-sm hidden lg:table-cell">Ajuda Custo</TableHead>
                  <TableHead className="text-right whitespace-nowrap text-xs sm:text-sm text-destructive hidden md:table-cell">Dívidas</TableHead>
                  <TableHead className="text-right whitespace-nowrap text-xs sm:text-sm">Adiant.</TableHead>
                  <TableHead className="text-right whitespace-nowrap text-xs sm:text-sm">Desc.</TableHead>
                  <TableHead className="text-right whitespace-nowrap text-xs sm:text-sm font-bold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedComissoes.map(comissao => {
                  const isExpanded = expandedRows.has(comissao.id);
                  const finalValue = calculateFinalValue(comissao);
                  
                  return (
                    <Collapsible key={comissao.id} open={isExpanded} asChild>
                      <>
                        <TableRow className="cursor-pointer hover:bg-muted/50" onClick={() => toggleRow(comissao.id)}>
                          <TableCell className="p-2 sm:p-4">
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </TableCell>
                          <TableCell className="font-medium p-2 sm:p-4 text-xs sm:text-sm">
                            <span className="block truncate max-w-[80px] sm:max-w-none">{comissao.vendedor_nome}</span>
                            <span className="text-xs text-muted-foreground">({comissao.cargo})</span>
                          </TableCell>
                          <TableCell className="text-right text-primary font-medium p-2 sm:p-4 text-xs sm:text-sm">
                            {formatCurrency(comissao.comissao_base)}
                          </TableCell>
                          <TableCell className="text-right p-2 sm:p-4 text-xs sm:text-sm hidden md:table-cell">{formatCurrency(comissao.bonus_automatico)}</TableCell>
                          <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                            {isReadOnly ? (
                              <span>{formatCurrency(getValue(comissao, 'bonus_manual'))}</span>
                            ) : (
                              <Input
                                type="number"
                                step="0.01"
                                className="w-20 sm:w-24 text-right h-8 text-xs sm:text-sm"
                                value={getValue(comissao, 'bonus_manual')}
                                onChange={e => handleInputChange(comissao.id, 'bonus_manual', parseFloat(e.target.value) || 0)}
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-right p-2 sm:p-4 text-xs sm:text-sm hidden lg:table-cell">{formatCurrency(comissao.salario)}</TableCell>
                          <TableCell className="text-right p-2 sm:p-4 text-xs sm:text-sm hidden lg:table-cell">{formatCurrency(comissao.ajuda_custo)}</TableCell>
                          <TableCell className="text-right text-destructive font-medium p-2 sm:p-4 text-xs sm:text-sm hidden md:table-cell">
                            {formatCurrency(comissao.descontos_dividas)}
                          </TableCell>
                          <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                            {isReadOnly ? (
                              <span>{formatCurrency(getValue(comissao, 'adiantamentos'))}</span>
                            ) : (
                              <Input
                                type="number"
                                step="0.01"
                                className="w-20 sm:w-24 text-right h-8 text-xs sm:text-sm"
                                value={getValue(comissao, 'adiantamentos')}
                                onChange={e => handleInputChange(comissao.id, 'adiantamentos', parseFloat(e.target.value) || 0)}
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                            {isReadOnly ? (
                              <span>{formatCurrency(getValue(comissao, 'descontos'))}</span>
                            ) : (
                              <Input
                                type="number"
                                step="0.01"
                                className="w-20 sm:w-24 text-right h-8 text-xs sm:text-sm"
                                value={getValue(comissao, 'descontos')}
                                onChange={e => handleInputChange(comissao.id, 'descontos', parseFloat(e.target.value) || 0)}
                              />
                            )}
                          </TableCell>
                          <TableCell className="text-right font-bold text-green-500">
                            {formatCurrency(finalValue)}
                          </TableCell>
                        </TableRow>
                        <CollapsibleContent asChild>
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={12} className="p-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
                                {Object.entries(comissao.comissao_detalhada || {}).map(([key, value]) => (
                                  <div key={key}>
                                    <span className="text-muted-foreground">{key}:</span>
                                    <span className="ml-2 font-medium">{formatCurrency(value as number)}</span>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
