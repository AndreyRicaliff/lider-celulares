import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, AlertCircle, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { LOJAS, LOJAS_IDS } from '@/lib/constants';
import { Divida, Colaborador } from '@/types/database';
import { useCreateDivida, useDeleteDivida } from '@/hooks/useColaboradores';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';

interface DividasManagerProps {
  colaborador: Colaborador;
  dividas: Divida[];
  selectedLoja: string;
}

const ITEMS_PER_PAGE = 5;

export const DividasManager = ({ colaborador, dividas, selectedLoja }: DividasManagerProps) => {
  const { ask: askConfirm, confirmDialogProps } = useConfirmDialog();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentPageAbertas, setCurrentPageAbertas] = useState(1);
  const [currentPagePagas, setCurrentPagePagas] = useState(1);

  const createDivida = useCreateDivida();
  const deleteDivida = useDeleteDivida();
  
  const [dividaForm, setDividaForm] = useState({
    descricao: '',
    valor_total: 0,
    parcelas_totais: 1,
    mes_inicio: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    loja_id: (selectedLoja && selectedLoja !== 'all' ? selectedLoja : null) as string | null,
  });

  // Separar dívidas abertas e pagas
  const { dividasAbertas, dividasPagas } = useMemo(() => {
    const abertas: Divida[] = [];
    const pagas: Divida[] = [];
    
    dividas.forEach(divida => {
      if (divida.parcelas_pagas >= divida.parcelas_totais) {
        pagas.push(divida);
      } else {
        abertas.push(divida);
      }
    });
    
    // Ordenar abertas por parcelas restantes (mais urgentes primeiro)
    abertas.sort((a, b) => {
      const restantesA = a.parcelas_totais - a.parcelas_pagas;
      const restantesB = b.parcelas_totais - b.parcelas_pagas;
      return restantesA - restantesB;
    });
    
    // Ordenar pagas por data de criação (mais recentes primeiro)
    pagas.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return { dividasAbertas: abertas, dividasPagas: pagas };
  }, [dividas]);

  // Paginação
  const totalPagesAbertas = Math.ceil(dividasAbertas.length / ITEMS_PER_PAGE);
  const totalPagesPagas = Math.ceil(dividasPagas.length / ITEMS_PER_PAGE);
  
  const dividasAbertasPaginadas = dividasAbertas.slice(
    (currentPageAbertas - 1) * ITEMS_PER_PAGE,
    currentPageAbertas * ITEMS_PER_PAGE
  );
  
  const dividasPagasPaginadas = dividasPagas.slice(
    (currentPagePagas - 1) * ITEMS_PER_PAGE,
    currentPagePagas * ITEMS_PER_PAGE
  );

  const handleAddDivida = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const isSupervisor = colaborador.cargo === 'Supervisor';
    const lojaIdParaDivida = isSupervisor
      ? dividaForm.loja_id
      : (selectedLoja && selectedLoja !== 'all'
          ? selectedLoja
          : (colaborador.loja_id ?? null));

    if (isSupervisor && !lojaIdParaDivida) {
      return;
    }

    await createDivida.mutateAsync({
      colaborador_id: colaborador.id,
      parcelas_pagas: 0,
      ...dividaForm,
      loja_id: lojaIdParaDivida,
    });

    setDividaForm({
      descricao: '',
      valor_total: 0,
      parcelas_totais: 1,
      mes_inicio: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
      loja_id: (selectedLoja && selectedLoja !== 'all' ? selectedLoja : null),
    });
  };

  const Pagination = ({ 
    currentPage, 
    totalPages, 
    onPageChange 
  }: { 
    currentPage: number; 
    totalPages: number; 
    onPageChange: (page: number) => void;
  }) => {
    if (totalPages <= 1) return null;
    
    return (
      <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft size={16} />
        </Button>
        <span className="text-sm text-muted-foreground">
          Página {currentPage} de {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <ChevronRight size={16} />
        </Button>
      </div>
    );
  };

  const DividaCard = ({ divida, canDelete }: { divida: Divida; canDelete: boolean }) => {
    const isPaga = divida.parcelas_pagas >= divida.parcelas_totais;
    const valorParcela = divida.valor_total / divida.parcelas_totais;
    
    return (
      <div className={`flex justify-between items-center p-3 rounded-lg ${isPaga ? 'bg-muted/30' : 'bg-muted/50'}`}>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium">{divida.descricao || 'Sem descrição'}</p>
            {isPaga ? (
              <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600">
                <CheckCircle2 size={12} className="mr-1" />
                Quitada
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                {divida.parcelas_pagas}/{divida.parcelas_totais} pagas
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Total: {formatCurrency(divida.valor_total)} • Parcela: {formatCurrency(valorParcela)}
          </p>
          <div className="flex gap-2 text-xs text-muted-foreground mt-1">
            <span>Início: {divida.mes_inicio}</span>
            {divida.loja_id && (
              <span>• Loja: {LOJAS[divida.loja_id as keyof typeof LOJAS]}</span>
            )}
          </div>
        </div>
        {(canDelete || isPaga) && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              askConfirm(
                'Deseja realmente excluir esta dívida?',
                () => deleteDivida.mutate(divida.id),
                { title: 'Excluir dívida', confirmLabel: 'Excluir', destructive: true }
              );
            }}
            className="ml-2"
            title={isPaga ? "Excluir dívida quitada" : "Excluir dívida"}
          >
            <Trash2 size={16} className="text-destructive" />
          </Button>
        )}
      </div>
    );
  };

  return (
    <>
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <AlertCircle size={16} className="mr-1" />
          <span className="hidden sm:inline">Gerenciar</span>
          {dividasAbertas.length > 0 && (
            <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
              {dividasAbertas.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Dívidas de {colaborador.nome}</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="abertas" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="abertas" className="flex items-center gap-2">
              Abertas
              {dividasAbertas.length > 0 && (
                <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                  {dividasAbertas.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pagas" className="flex items-center gap-2">
              Quitadas
              {dividasPagas.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {dividasPagas.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="abertas" className="flex-1 overflow-auto mt-4">
            <div className="space-y-4">
              {/* Formulário de nova dívida */}
              <form onSubmit={handleAddDivida} className="space-y-3 p-3 bg-muted/30 rounded-lg border">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Plus size={16} />
                  Nova Dívida
                </h4>

                {colaborador.cargo === 'Supervisor' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Cobrar na loja</Label>
                    <Select
                      value={dividaForm.loja_id ?? ''}
                      onValueChange={(value) => setDividaForm({ ...dividaForm, loja_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a loja" />
                      </SelectTrigger>
                      <SelectContent>
                        {LOJAS_IDS.map((id) => (
                          <SelectItem key={id} value={id}>
                            {LOJAS[id]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <Input
                  placeholder="Descrição"
                  value={dividaForm.descricao}
                  onChange={e => setDividaForm({ ...dividaForm, descricao: e.target.value })}
                />
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Valor Total</Label>
                    <Input 
                      type="number" 
                      step="0.01"
                      value={dividaForm.valor_total}
                      onChange={e => setDividaForm({ ...dividaForm, valor_total: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Parcelas</Label>
                    <Input 
                      type="number" 
                      min="1"
                      value={dividaForm.parcelas_totais}
                      onChange={e => setDividaForm({ ...dividaForm, parcelas_totais: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs">Mês de Início</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        value={dividaForm.mes_inicio.split('-')[1] || '01'}
                        onValueChange={(month) => {
                          const year = dividaForm.mes_inicio.split('-')[0] || new Date().getFullYear().toString();
                          setDividaForm({ ...dividaForm, mes_inicio: `${year}-${month}` });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Mês" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="01">Janeiro</SelectItem>
                          <SelectItem value="02">Fevereiro</SelectItem>
                          <SelectItem value="03">Março</SelectItem>
                          <SelectItem value="04">Abril</SelectItem>
                          <SelectItem value="05">Maio</SelectItem>
                          <SelectItem value="06">Junho</SelectItem>
                          <SelectItem value="07">Julho</SelectItem>
                          <SelectItem value="08">Agosto</SelectItem>
                          <SelectItem value="09">Setembro</SelectItem>
                          <SelectItem value="10">Outubro</SelectItem>
                          <SelectItem value="11">Novembro</SelectItem>
                          <SelectItem value="12">Dezembro</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select
                        value={dividaForm.mes_inicio.split('-')[0] || new Date().getFullYear().toString()}
                        onValueChange={(year) => {
                          const month = dividaForm.mes_inicio.split('-')[1] || '01';
                          setDividaForm({ ...dividaForm, mes_inicio: `${year}-${month}` });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Ano" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2025">2025</SelectItem>
                          <SelectItem value="2026">2026</SelectItem>
                          <SelectItem value="2027">2027</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <Button type="submit" size="sm" className="w-full" disabled={createDivida.isPending}>
                  <Plus size={16} className="mr-2" />
                  Adicionar Dívida
                </Button>
              </form>

              {/* Lista de dívidas abertas */}
              {dividasAbertas.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">
                    Dívidas em aberto ({dividasAbertas.length})
                  </h4>
                  {dividasAbertasPaginadas.map(divida => (
                    <DividaCard key={divida.id} divida={divida} canDelete={true} />
                  ))}
                  <Pagination 
                    currentPage={currentPageAbertas}
                    totalPages={totalPagesAbertas}
                    onPageChange={setCurrentPageAbertas}
                  />
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4 text-sm">
                  Nenhuma dívida em aberto
                </p>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="pagas" className="flex-1 overflow-auto mt-4">
            {dividasPagas.length > 0 ? (
              <div className="space-y-2">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-medium text-sm text-muted-foreground">
                    Dívidas quitadas ({dividasPagas.length})
                  </h4>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-[10px] h-7 text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      askConfirm(
                        `Deseja excluir TODAS as ${dividasPagas.length} dívidas quitadas? Esta ação não pode ser desfeita.`,
                        async () => {
                          for (const d of dividasPagas) {
                            await deleteDivida.mutateAsync(d.id);
                          }
                          toast.success('Dívidas quitadas excluídas com sucesso');
                        },
                        { title: 'Excluir dívidas quitadas', confirmLabel: 'Excluir Todas', destructive: true }
                      );
                    }}
                  >
                    <Trash2 size={12} className="mr-1" />
                    Excluir Todas
                  </Button>
                </div>
                {dividasPagasPaginadas.map(divida => (
                  <DividaCard key={divida.id} divida={divida} canDelete={true} />
                ))}
                <Pagination 
                  currentPage={currentPagePagas}
                  totalPages={totalPagesPagas}
                  onPageChange={setCurrentPagePagas}
                />
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8 text-sm">
                Nenhuma dívida quitada registrada
              </p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
    <ConfirmDialog {...confirmDialogProps} />
    </>
  );
};
