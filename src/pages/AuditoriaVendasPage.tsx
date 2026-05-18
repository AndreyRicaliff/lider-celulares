import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAppStore } from '@/store/appStore';
import { LOJAS, LOJAS_IDS } from '@/lib/constants';
import { formatCurrency } from '@/lib/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileSearch, Download, Filter, FileSpreadsheet, ChevronDown, ChevronUp, RefreshCw, Loader2, Users, AlertCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

export const AuditoriaVendasPage = () => {
  const { selectedLoja, selectedMes, setSelectedLoja, setSelectedMes } = useAppStore();
  const [vendedorFiltro, setVendedorFiltro] = useState<string>('todos');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('geral');
  const [apenasConcluidas, setApenasConcluidas] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-tenfront', {
        body: { 
          mes: selectedMes,
          loja_id: selectedLoja || undefined 
        }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Sincronização concluída com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['atendimentos-audit'] });
      queryClient.invalidateQueries({ queryKey: ['daily-sales'] });
      queryClient.invalidateQueries({ queryKey: ['vendas'] });
    },
    onError: (error: any) => {
      console.error('Erro na sincronização:', error);
      toast.error(`Erro ao sincronizar: ${error.message || 'Verifique os logs'}`);
    }
  });

  const { data: atendimentos = [], isLoading } = useQuery({
    queryKey: ['atendimentos-audit', selectedLoja, selectedMes],
    queryFn: async () => {
      let query = supabase
        .from('atendimentos_audit')
        .select('*')
        .eq('mes', selectedMes);
      
      if (selectedLoja) {
        query = query.eq('loja_id', selectedLoja);
      }

      const { data, error } = await query.order('data_atendimento', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedMes,
  });

  const { data: tabelaPrecos = [] } = useQuery({
    queryKey: ['tabela-precos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tabela_precos').select('*');
      if (error) throw error;
      return data || [];
    }
  });

  const checkAlert = (produto: string, valor: number, lojaId: string) => {
    if (!produto || valor <= 0) return false;
    const p = produto.toUpperCase();
    const regiaoLoja = (lojaId === 'natal' || lojaId === 'caruaru') ? 'RN_PE' : 'PB';
    
    // Ordenar tabela: versões PRO primeiro e nomes mais longos primeiro
    const sortedTable = [...tabelaPrecos].sort((a, b) => {
      const aUpper = a.modelo.toUpperCase();
      const bUpper = b.modelo.toUpperCase();
      const aHasPro = aUpper.includes('PRO');
      const bHasPro = bUpper.includes('PRO');
      if (aHasPro && !bHasPro) return -1;
      if (!aHasPro && bHasPro) return 1;
      return bUpper.length - aUpper.length;
    });

    const match = sortedTable.find(t => {
      if (t.regiao !== regiaoLoja) return false;
      const m = t.modelo.toUpperCase();
      const mem = (t.memoria || '').toUpperCase();
      
      if (!p.includes(m)) return false;
      if (m.includes('PRO') !== p.includes('PRO')) return false;

      if (mem !== '') {
        const tableMemParts = mem.match(/\d+/g) || [];
        const productMemParts = p.match(/\d+/g) || [];
        if (!tableMemParts.every((part) => (productMemParts as any[]).includes(part))) return false;
      }
      return true;
    });

    if (match) {
      const minPrice = Number(match.preco_tabela) - Number(match.desconto_livre || 0);
      return valor < (minPrice - 0.01);
    }
    return false;
  };





  const vendedores = useMemo(() => {
    const vends = new Set<string>();
    atendimentos.forEach(a => {
      // Filtrar apenas vendedores que possuem atendimentos no mês selecionado
      if (a.mes === selectedMes) {
        vends.add(a.vendedor_nome);
      }
    });
    return ['todos', ...Array.from(vends).sort()];
  }, [atendimentos, selectedMes]);

  const filteredAtendimentos = useMemo(() => {
    // Garantir que os atendimentos filtrados pertencem ao mês selecionado
    let result = atendimentos.filter(a => a.mes === selectedMes);
    
    if (apenasConcluidas) {
      result = result.filter(a => (a.status || '').toLowerCase().includes('concl') || !(a.status || '').toLowerCase().includes('cancel'));
    }
    
    if (vendedorFiltro !== 'todos') {
      result = result.filter(a => a.vendedor_nome === vendedorFiltro);
    }

    if (categoriaFiltro !== 'geral') {
      result = result.filter(a => {
        const detalhes = (a.detalhes_brutos || []) as any[];
        return detalhes.some(info => {
          const vendas = (info.Venda || []) as any[];
          return vendas.some(v => {
            const grupo = (v.Grupo || '').toUpperCase();
            const subtipo = (v.Subtipo || '').toUpperCase();
            const produto = (v.Produto || '').toUpperCase();
            
            if (categoriaFiltro === 'aparelhos') {
              return (grupo.includes('CELULAR') || grupo.includes('IPHONE') || grupo.includes('IPAD') || grupo.includes('WATCH') || grupo.includes('MACBOOK') || subtipo.includes('APARELHO')) && !grupo.includes('SERVIÇO');
            }
            if (categoriaFiltro === 'servico') {
              return grupo.includes('SERVIÇO') || grupo.includes('GARANTIA') || grupo.includes('PROTEÇÃO');
            }
            if (categoriaFiltro === 'bonificado_lc') {
              return subtipo.includes('BONIFICADO LC') || produto.includes('BONIFICADO LC');
            }
            if (categoriaFiltro === 'super_bonificado') {
              return subtipo.includes('SUPER BONIFICADO') || produto.includes('SUPER BONIFICADO');
            }
            if (categoriaFiltro === 'cases') {
              return grupo.includes('CASE') || grupo.includes('CAPA');
            }
            if (categoriaFiltro === 'peliculas') {
              return grupo.includes('PELICULA') || produto.includes('PELICULA');
            }
            if (categoriaFiltro === 'anatel') {
              return subtipo.includes('ANATEL') || produto.includes('ANATEL');
            }
            if (categoriaFiltro === 'acessorios') {
              return (grupo.includes('ACESSORIO') || grupo.includes('CABO') || grupo.includes('CARREGADOR') || grupo.includes('FONE')) && 
                     !grupo.includes('CASE') && !grupo.includes('PELICULA');
            }
            return false;
          });
        });
      });
    }
    
    return result;
  }, [atendimentos, vendedorFiltro, categoriaFiltro, apenasConcluidas]);

  const resumoVendedores = useMemo(() => {
    const summary: Record<string, { atendimentos: number; total: number; totalReal: number; alertas: number; qtdCategoria: number }> = {};
    
    // Usamos filteredAtendimentos para que o resumo respeite os filtros de categoria e vendedor
    // Porém, para o resumo geral, queremos todos os vendedores, então filtramos apenas por categoria e conclusão
    let baseParaResumo = atendimentos.filter(a => a.mes === selectedMes);
    if (apenasConcluidas) {
      baseParaResumo = baseParaResumo.filter(a => (a.status || '').toLowerCase().includes('concl') || !(a.status || '').toLowerCase().includes('cancel'));
    }

    baseParaResumo.forEach(a => {
      const nome = a.vendedor_nome;
      if (!summary[nome]) {
        summary[nome] = { atendimentos: 0, total: 0, totalReal: 0, alertas: 0, qtdCategoria: 0 };
      }
      
      summary[nome].atendimentos += 1;
      summary[nome].total += a.valor_total || 0;
      summary[nome].alertas += a.alertas_preco || 0;

      // Calcular valor real somando itens
      const detalhesAtendimento = (a.detalhes_brutos || []) as any[];
      detalhesAtendimento.forEach(info => {
        (info.Venda || []).forEach((v: any) => {
          summary[nome].totalReal += Number(v['Valor de venda'] || v.Valor || 0);
        });
      });

      // Calcular quantidade na categoria selecionada para este atendimento
      if (categoriaFiltro !== 'geral') {
        const detalhes = (a.detalhes_brutos || []) as any[];
        detalhes.forEach(info => {
          const vendas = (info.Venda || []) as any[];
          vendas.forEach(v => {
            const grupo = (v.Grupo || '').toUpperCase();
            const subtipo = (v.Subtipo || '').toUpperCase();
            const produto = (v.Produto || '').toUpperCase();
            const qtd = Number(v.Quantidade) || 1;
            
            let match = false;
            if (categoriaFiltro === 'aparelhos') {
              match = (grupo.includes('CELULAR') || grupo.includes('IPHONE') || grupo.includes('IPAD') || grupo.includes('WATCH') || grupo.includes('MACBOOK') || subtipo.includes('APARELHO')) && !grupo.includes('SERVIÇO');
            } else if (categoriaFiltro === 'servico') {
              match = grupo.includes('SERVIÇO') || grupo.includes('GARANTIA') || grupo.includes('PROTEÇÃO');
            } else if (categoriaFiltro === 'bonificado_lc') {
              match = subtipo.includes('BONIFICADO LC') || produto.includes('BONIFICADO LC');
            } else if (categoriaFiltro === 'super_bonificado') {
              match = subtipo.includes('SUPER BONIFICADO') || produto.includes('SUPER BONIFICADO');
            } else if (categoriaFiltro === 'cases') {
              match = grupo.includes('CASE') || grupo.includes('CAPA');
            } else if (categoriaFiltro === 'peliculas') {
              match = grupo.includes('PELICULA') || produto.includes('PELICULA');
            } else if (categoriaFiltro === 'anatel') {
              match = subtipo.includes('ANATEL') || produto.includes('ANATEL');
            } else if (categoriaFiltro === 'acessorios') {
              match = (grupo.includes('ACESSORIO') || grupo.includes('CABO') || grupo.includes('CARREGADOR') || grupo.includes('FONE')) && 
                      !grupo.includes('CASE') && !grupo.includes('PELICULA');
            }

            if (match) {
              summary[nome].qtdCategoria += qtd;
            }
          });
        });
      }
    });

    return Object.entries(summary)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([nome, stats]) => ({ nome, ...stats }));
  }, [atendimentos, apenasConcluidas, categoriaFiltro]);


  const exportarExcel = () => {
    if (filteredAtendimentos.length === 0) return;

    const data = filteredAtendimentos.map(a => ({
      Data: a.data_atendimento,
      ID: a.atendimento_id,
      Vendedor: a.vendedor_nome,
      Loja: LOJAS[a.loja_id as keyof typeof LOJAS] || a.loja_id,
      Valor: a.valor_total,
      Status: a.status,
      Itens: Array.isArray(a.detalhes_brutos) 
        ? a.detalhes_brutos.map((info: any) => 
            (info.Venda || []).map((v: any) => `${v.Produto} (${v.Quantidade}x)`).join(', ')
          ).join(' | ')
        : ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Atendimentos");
    XLSX.writeFile(wb, `auditoria_vendas_${selectedMes}_${selectedLoja || 'todas'}.xlsx`);
    toast.success("Relatório exportado com sucesso!");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileSearch className="text-primary" size={28} />
            Auditoria de Vendas Detalhada
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Conferência de atendimentos originais importados do Tenfront
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button 
            variant="outline"
            onClick={() => syncMutation.mutate()} 
            disabled={syncMutation.isPending}
            className="flex-1 md:flex-none"
          >
            {syncMutation.isPending ? (
              <Loader2 className="mr-2 animate-spin" size={18} />
            ) : (
              <RefreshCw className="mr-2" size={18} />
            )}
            Forçar Sincronização
          </Button>
          <Button onClick={exportarExcel} disabled={filteredAtendimentos.length === 0} className="flex-1 md:flex-none">
            <FileSpreadsheet className="mr-2" size={18} />
            Exportar Excel
          </Button>
        </div>
      </div>

      <Card className="glass-card">
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase">Loja</label>
            <Select value={selectedLoja || 'todas'} onValueChange={(v) => setSelectedLoja(v === 'todas' ? null : v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Lojas</SelectItem>
                {LOJAS_IDS.map(id => (
                  <SelectItem key={id} value={id}>{LOJAS[id]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase">Mês</label>
            <input 
              type="month" 
              value={selectedMes} 
              onChange={(e) => setSelectedMes(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase">Vendedor</label>
            <Select value={vendedorFiltro} onValueChange={setVendedorFiltro}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {vendedores.map(v => (
                  <SelectItem key={v} value={v}>{v === 'todos' ? 'Todos os Vendedores' : v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase">Categoria</label>
            <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="geral">Todas as Categorias</SelectItem>
                <SelectItem value="aparelhos">Geral (Aparelhos)</SelectItem>
                <SelectItem value="servico">Serviços</SelectItem>
                <SelectItem value="bonificado_lc">Bonificado LC</SelectItem>
                <SelectItem value="super_bonificado">Super Bonificado</SelectItem>
                <SelectItem value="cases">Cases / Capas</SelectItem>
                <SelectItem value="peliculas">Películas</SelectItem>
                <SelectItem value="anatel">Anatel</SelectItem>
                <SelectItem value="acessorios">Acessórios</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2 pb-2">
            <Checkbox 
              id="concluidas" 
              checked={apenasConcluidas} 
              onCheckedChange={(checked) => setApenasConcluidas(!!checked)}
            />
            <Label htmlFor="concluidas" className="text-xs font-medium cursor-pointer">
              Apenas concluídas
            </Label>
          </div>
        </CardContent>
      </Card>

      {atendimentos.length > 0 && (
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
                    <TableHead className="text-center">
                      {categoriaFiltro === 'geral' ? 'Qtd. Atendimentos' : `Qtd. ${categoriaFiltro.replace('_', ' ')}`}
                    </TableHead>
                    <TableHead className="text-right">Total Real</TableHead>
                    <TableHead className="text-right text-primary">Total com Juros</TableHead>
                    <TableHead className="text-right w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resumoVendedores.map((vend) => (
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
                      <TableCell className="text-center">{categoriaFiltro === 'geral' ? vend.atendimentos : vend.qtdCategoria}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(vend.totalReal)}</TableCell>
                      <TableCell className="text-right font-bold text-primary">{formatCurrency(vend.total)}</TableCell>

                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setVendedorFiltro(vend.nome)}
                          className="h-8 text-xs"
                        >
                          Filtrar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Relatório Detalhado de Vendas ({filteredAtendimentos.length})</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center text-muted-foreground">Carregando dados da API...</div>
          ) : filteredAtendimentos.length === 0 ? (
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
                    <TableHead className="text-right w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAtendimentos.map((a) => (
                    <React.Fragment key={a.atendimento_id}>
                      <TableRow 
                        className={`cursor-pointer hover:bg-muted/50 transition-colors ${a.alertas_preco > 0 ? 'bg-destructive/5' : ''}`}
                        onClick={() => setExpandedRow(expandedRow === a.atendimento_id ? null : a.atendimento_id)}
                      >
                        <TableCell className="text-sm font-medium">
                          <div className="flex items-center gap-2">
                            {a.alertas_preco > 0 && <AlertCircle size={14} className="text-destructive animate-pulse" />}
                            {new Date(a.data_atendimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{a.atendimento_id}</TableCell>
                        <TableCell className="text-sm font-bold text-primary">{a.vendedor_nome}</TableCell>
                        <TableCell className="text-right font-medium">
                          {(() => {
                            const detalhes = Array.isArray(a.detalhes_brutos) ? a.detalhes_brutos : [];
                            let totalReal = 0;
                            detalhes.forEach((info: any) => {
                              (info.Venda || []).forEach((v: any) => {
                                totalReal += Number(v['Valor de venda'] || v.Valor || 0);
                              });
                            });
                            return formatCurrency(totalReal);
                          })()}
                        </TableCell>
                        <TableCell className="text-right font-bold flex flex-col items-end">
                          <span className="text-primary">{formatCurrency(a.valor_total)}</span>
                          {a.alertas_preco > 0 && <span className="text-[9px] text-destructive font-bold uppercase">Preço abaixo da tabela</span>}
                        </TableCell>

                        <TableCell>
                          <Badge variant={a.status?.toLowerCase().includes('cancel') ? 'destructive' : 'secondary'} className="text-[10px]">
                            {a.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {expandedRow === a.atendimento_id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </TableCell>
                      </TableRow>
                      {expandedRow === a.atendimento_id && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={6} className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-3">
                                <h4 className="text-xs font-bold uppercase text-primary">Produtos Vendidos</h4>
                                {Array.isArray(a.detalhes_brutos) && a.detalhes_brutos.map((info: any, i: number) => (
                                  <div key={i} className="space-y-2">
                                    {(info.Venda || []).map((v: any, j: number) => {
                                      const hasAlert = checkAlert(v.Produto, Number(v['Valor de venda'] || v.Valor || 0), a.loja_id);
                                      return (
                                        <div key={j} className={`flex justify-between items-center p-2 rounded border text-sm ${hasAlert ? 'bg-destructive/10 border-destructive/50' : 'bg-background/50 border-border/50'}`}>
                                          <div className="flex flex-col">
                                            <div className="flex items-center gap-1">
                                              {hasAlert && <AlertCircle size={12} className="text-destructive" />}
                                              <span className="font-medium">{v.Produto}</span>
                                            </div>
                                            <span className="text-[10px] text-muted-foreground uppercase">{v.Grupo} | {v.Subtipo || 'Sem Subtipo'}</span>
                                          </div>
                                          <div className="text-right">
                                            <div className={`font-bold ${hasAlert ? 'text-destructive' : ''}`}>{formatCurrency(Number(v['Valor de venda'] || v.Valor || 0))}</div>
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
                                  {Array.isArray(a.detalhes_brutos) && a.detalhes_brutos.map((info: any, i: number) => (
                                    <div key={i}>
                                      {(info.Brinde || []).length > 0 && (
                                        <div className="mb-2">
                                          <span className="text-xs font-bold text-success">Brindes: </span>
                                          <span className="text-xs">{info.Brinde.map((b: any) => b.Produto).join(', ')}</span>
                                        </div>
                                      )}
                                      {(info.Troca || []).length > 0 && (
                                        <div className="mb-2">
                                          <span className="text-xs font-bold text-orange-400">Trocas: </span>
                                          <span className="text-xs">{info.Troca.map((t: any) => t.Produto).join(', ')}</span>
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
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
