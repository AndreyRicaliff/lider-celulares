import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useComissoes } from '@/hooks/useComissoes';
import { useVendas } from '@/hooks/useVendas';
import { useDividas } from '@/hooks/useColaboradores';
import { formatCurrency, formatMonth } from '@/lib/formatters';
import { supabase } from '@/integrations/supabase/client';
import { FileText, DollarSign, Calendar, Info, Store, Layers } from 'lucide-react';
import { LOJAS } from '@/lib/constants';
export const MeuRelatorioPage = () => {
  const [colaboradorId, setColaboradorId] = useState<string | null>(null);
  const [colaboradorNome, setColaboradorNome] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const { data: comissoes = [] } = useComissoes();
  const [allColaboradorIds, setAllColaboradorIds] = useState<string[]>([]);
  const { data: todasVendas = [] } = useVendas(undefined, undefined, colaboradorNome || undefined);
  // Para Gerentes/Supervisores, precisamos das vendas totais da loja (não só pessoais)
  // pois a comissão é calculada sobre o desempenho da loja inteira
  const { data: todasVendasLoja = [] } = useVendas();
  const { data: _dividas = [] } = useDividas(colaboradorId || undefined);

  useEffect(() => {
    const fetchColaboradorId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.rpc('get_colaborador_id', { _user_id: user.id });
        if (data) {
          setColaboradorId(data);
          // Fetch colaborador name and find all records with same name (multi-store)
          const { data: colab } = await supabase
            .from('colaboradores')
            .select('nome')
            .eq('id', data)
            .single();
          if (colab) {
            setColaboradorNome(colab.nome);
            // Fetch all collaborators to find those with the same normalized name
            const { data: allColabs } = await supabase
              .from('colaboradores')
              .select('id, nome');
            
            if (allColabs) {
              const normalizedCurrent = colab.nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              const samePeople = allColabs.filter(c => 
                c.nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === normalizedCurrent
              );
              setAllColaboradorIds(samePeople.map(c => c.id));
            } else {
              setAllColaboradorIds([data]);
            }
          }
        }
      }
    };
    fetchColaboradorId();
  }, []);

  const minhasComissoes = comissoes.filter(c => 
    allColaboradorIds.length > 0 
      ? allColaboradorIds.includes(c.colaborador_id || '')
      : c.colaborador_id === colaboradorId
  );
  const mesesDisponiveis = [...new Set(minhasComissoes.map(c => c.mes))].sort().reverse();

  const comissoesFiltradas = selectedMonth
    ? minhasComissoes.filter(c => c.mes === selectedMonth)
    : minhasComissoes;

  const groupedComissoes = useMemo(() => {
    const groups: Record<string, typeof comissoesFiltradas> = {};
    comissoesFiltradas.forEach(c => {
      if (!groups[c.mes]) groups[c.mes] = [];
      groups[c.mes].push(c);
    });
    return groups;
  }, [comissoesFiltradas]);

  const totalLiquido = Object.entries(groupedComissoes).reduce((acc, [_, coms]) => {
    const liqMes = coms.reduce((accMes, c) => {
      const bruto = c.salario + c.ajuda_custo + c.comissao_base + c.bonus_automatico + c.bonus_manual;
      
      // Exibe apenas as dívidas registradas especificamente nesta unidade para o vendedor
      const dEfetivo = c.descontos_dividas || 0;

      const descontos = dEfetivo + c.adiantamentos + c.descontos;
      return accMes + (bruto - descontos);
    }, 0);
    return acc + liqMes;
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meu Relatório</h1>
          <p className="text-muted-foreground">Olá, {colaboradorNome}</p>
        </div>
        <Select value={selectedMonth || "all"} onValueChange={(v) => setSelectedMonth(v === "all" ? "" : v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Todos os meses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os meses</SelectItem>
            {mesesDisponiveis.map(mes => (
              <SelectItem key={mes} value={mes}>{formatMonth(mes)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Comissões</p>
                <p className="text-xl font-bold">{comissoesFiltradas.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Líquido</p>
                <p className="text-xl font-bold text-green-500">{formatCurrency(totalLiquido)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Meses</p>
                <p className="text-xl font-bold">{mesesDisponiveis.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {Object.entries(groupedComissoes).length === 0 ? (
          <Card className="bg-card/50 border-border/50">
            <CardContent className="p-8 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma comissão encontrada</p>
            </CardContent>
          </Card>
        ) : (
          Object.entries(groupedComissoes)
            .sort(([mesA], [mesB]) => mesB.localeCompare(mesA))
            .map(([mes, comissoesDoMes]) => {
              const totalLiquidoMes = comissoesDoMes.reduce((acc, c) => {
                const bruto = c.salario + c.ajuda_custo + c.comissao_base + c.bonus_automatico + c.bonus_manual;
                
                // Exibe apenas as dívidas registradas especificamente nesta unidade para o vendedor
                const descontoDividasEfetivo = c.descontos_dividas || 0;

                const descontos = descontoDividasEfetivo + c.adiantamentos + c.descontos;
                return acc + (bruto - descontos);
              }, 0);

              return (
                <Card key={mes} className="bg-card/50 border-border/50 overflow-hidden">
                  <CardHeader className="bg-primary/5 pb-4 border-b border-border/50">
                    <CardTitle className="text-xl flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-primary" />
                        <span>{formatMonth(mes)}</span>
                        {comissoesDoMes.length > 1 && (
                          <span className="text-[10px] uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
                            {comissoesDoMes.length} lojas
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground font-normal uppercase tracking-wider">
                          {comissoesDoMes.length > 1 ? 'Total Consolidado (Todas as Lojas)' : 'Total do Mês'}
                        </p>
                        <p className="text-green-500 font-bold">{formatCurrency(totalLiquidoMes)}</p>
                      </div>
                    </CardTitle>
                    {comissoesDoMes.length > 1 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {comissoesDoMes.map(c => {
                          // Deduplicação de dívidas em multi-loja
                          const det = (c.detalhes || {}) as any;
                          const dInfo = (det.dividasInfo || []) as { id: string; valor: number }[];
                          let dEfetivo = 0;
                          
                          if (dInfo.length === 0) {
                            dEfetivo = c.id === comissoesDoMes[0]?.id ? (c.descontos_dividas || 0) : 0;
                          } else {
                            const claimed = new Set<string>();
                            for (const other of comissoesDoMes) {
                              if (other.id === c.id) break;
                              const otherInfo = (other.detalhes?.dividasInfo || []) as { id: string; valor: number }[];
                              otherInfo.forEach(d => { if (d.id) claimed.add(d.id); });
                            }
                            dInfo.forEach(d => {
                              if (d.id && !claimed.has(d.id)) {
                                dEfetivo += Number(d.valor) || 0;
                              }
                            });
                          }

                          const liq = c.salario + c.ajuda_custo + c.comissao_base + c.bonus_automatico + c.bonus_manual - dEfetivo - c.adiantamentos - c.descontos;
                          return (
                            <div key={c.id} className="flex items-center gap-1.5 text-[11px] bg-background/60 border border-border/50 rounded-md px-2 py-1">
                              <Store size={11} className="text-primary" />
                              <span className="font-semibold uppercase">{LOJAS[c.loja_id as keyof typeof LOJAS] || c.loja_id}:</span>
                              <span className="font-bold text-green-600">{formatCurrency(liq)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="divide-y divide-border/50">
                      {comissoesDoMes.map((comissao) => {
                        const totalBruto = comissao.salario + comissao.ajuda_custo + comissao.comissao_base + 
                                          comissao.bonus_automatico + comissao.bonus_manual;
                        // Exibe apenas as dívidas registradas especificamente nesta unidade para o vendedor
                        const descontoDividasEfetivo = comissao.descontos_dividas || 0;

                        const totalDescontos = descontoDividasEfetivo + comissao.adiantamentos + comissao.descontos;
                        const totalLiquido = totalBruto - totalDescontos;
                        const comissaoDetalhada = (comissao.comissao_detalhada || {}) as Record<string, number>;

                        const isGerencial = ['Gerente', 'Supervisor'].includes(comissao.cargo);

                        const getBaseVenda = (cat: string) => {
                          const upperCat = cat.toUpperCase();
                          const normalizedPrincipalName = colaboradorNome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

                          // Para Gerente/Supervisor, a comissão é sobre o total da loja.
                          // Categorias de "serviços pessoais" (12%) continuam usando apenas vendas próprias.
                          const isServicoPessoal = upperCat.includes('PESSOAIS') || upperCat.includes('PESSOAL');
                          const usarTotalLoja = isGerencial && !isServicoPessoal;

                          const fonte = usarTotalLoja ? todasVendasLoja : todasVendas;
                          const vendasDoMesLoja = fonte.filter(v =>
                            v.mes === comissao.mes &&
                            v.loja_id === comissao.loja_id &&
                            (usarTotalLoja || v.vendedor_nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === normalizedPrincipalName)
                          );
                          const totaisVendaLoja = vendasDoMesLoja.reduce((acc, v) => {
                            const d = (v.detalhes || {}) as Record<string, number>;
                            Object.entries(d).forEach(([k, val]) => {
                              acc[k.toUpperCase()] = (acc[k.toUpperCase()] || 0) + val;
                            });
                            return acc;
                          }, {} as Record<string, number>);

                          // Categoria especial "META PRATA (Smartphones)" / "META OURO (Smartphones)"
                          // representa a soma das categorias de smartphone da loja
                          const metaCats = ['META PRATA', 'META OURO', 'SMARTPHONES'];
                          if (metaCats.some(mc => upperCat.includes(mc))) {
                            return (totaisVendaLoja['BONIFICADO LC'] || 0) +
                                   (totaisVendaLoja['SUPER BONIFICADO'] || 0) +
                                   (totaisVendaLoja['ANATEL'] || 0);
                          }
                          
                          if (upperCat === 'SERVIÇOS') {
                            return (totaisVendaLoja['PROTEÇÃO LÍDER'] || 0) +
                                   (totaisVendaLoja['GARANTIA ESTENDIDA'] || 0);
                          }

                          if (upperCat === 'PROTEÇÃO LÍDER') return totaisVendaLoja['PROTEÇÃO LÍDER'] || 0;
                          if (upperCat === 'GARANTIA ESTENDIDA') return totaisVendaLoja['GARANTIA ESTENDIDA'] || 0;
                          if (upperCat === 'SUPER BONIFICADO') return totaisVendaLoja['SUPER BONIFICADO'] || 0;
                          if (upperCat === 'BONIFICADO LC') return totaisVendaLoja['BONIFICADO LC'] || 0;
                          if (upperCat === 'ANATEL') return totaisVendaLoja['ANATEL'] || 0;
                          if (upperCat === 'ACESSÓRIOS') return totaisVendaLoja['ACESSÓRIOS'] || 0;
                          if (upperCat === 'CASES') return totaisVendaLoja['CASES'] || 0;
                          if (upperCat === 'PELÍCULA') return totaisVendaLoja['PELÍCULA'] || 0;
                          if (upperCat === 'ASSISTÊNCIA TÉCNICA') return totaisVendaLoja['ASSISTÊNCIA TÉCNICA'] || 0;
                          if (upperCat === 'GERAL') return totaisVendaLoja['GERAL'] || 0;
                          // Mantém retrocompatibilidade com comissões antigas (agregadas)
                          if (upperCat === 'ASSIST. TÉCNICA') return totaisVendaLoja['ASSISTÊNCIA TÉCNICA'] || 0;
                          return totaisVendaLoja[upperCat] || 0;
                        };

                        return (
                          <div key={comissao.id} className="p-6 space-y-6">
                            <div className="flex items-center justify-between bg-primary/5 p-3 rounded-lg border border-primary/10">
                              <div className="flex items-center gap-2 text-primary font-bold">
                                <Store size={18} />
                                <span className="uppercase tracking-tight text-sm">
                                  {LOJAS[comissao.loja_id as keyof typeof LOJAS] || comissao.loja_id}
                                </span>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] text-muted-foreground uppercase font-medium">Líquido na Unidade</p>
                                <span className="text-lg font-black text-foreground">{formatCurrency(totalLiquido)}</span>
                              </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-8">
                                {/* Vendas */}
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2">
                                    <Layers size={14} className="text-primary" />
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Vendas e Alíquotas</h4>
                                  </div>
                                  <div className="rounded-lg border border-border/50 overflow-hidden">
                                    <Table>
                                      <TableHeader className="bg-muted/30">
                                        <TableRow>
                                          <TableHead className="h-8 text-[9px] uppercase">Categoria</TableHead>
                                          <TableHead className="h-8 text-right text-[9px] uppercase">Venda</TableHead>
                                          <TableHead className="h-8 text-right text-[9px] uppercase">Comissão</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {Object.entries(comissaoDetalhada)
                                          .filter(([key, v]) => 
                                            typeof v === 'number' && 
                                            v >= 0 && 
                                            !['VENDA DIÁRIA', 'VENDA DIARIA'].includes(key.toUpperCase())
                                          )
                                          .map(([key, value]) => {
                                            const vVenda = getBaseVenda(key);
                                            const perc = vVenda > 0 ? (value / vVenda) * 100 : 0;
                                            return (
                                              <TableRow key={key} className="text-xs">
                                                <TableCell className="py-2 capitalize">{key.toLowerCase()}</TableCell>
                                                <TableCell className="py-2 text-right">
                                                  <div className="flex flex-col">
                                                    <span>{formatCurrency(vVenda)}</span>
                                                    {perc > 0 && <span className="text-[9px] text-muted-foreground">{perc.toFixed(1)}%</span>}
                                                  </div>
                                                </TableCell>
                                                <TableCell className="py-2 text-right font-bold text-primary">{formatCurrency(value)}</TableCell>
                                              </TableRow>
                                            );
                                          })}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </div>

                                {/* Composição */}
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2">
                                    <DollarSign size={14} className="text-green-500" />
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Composição Salarial</h4>
                                  </div>
                                  <div className="space-y-2">
                                    <div className="flex justify-between text-xs py-1 border-b border-border/50">
                                      <span className="text-muted-foreground">Salário Fixo</span>
                                      <span className="font-medium">{formatCurrency(comissao.salario)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs py-1 border-b border-border/50">
                                      <span className="text-muted-foreground">Ajuda de Custo</span>
                                      <span className="font-medium">{formatCurrency(comissao.ajuda_custo)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs py-1 border-b border-border/50 bg-green-500/5 px-1 rounded">
                                      <span className="font-semibold text-green-600">Comissão Base</span>
                                      <span className="font-bold text-green-600">{formatCurrency(comissao.comissao_base)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs py-1 border-b border-border/50">
                                      <div className="flex items-center gap-1">
                                        <span className="text-muted-foreground">Bônus (Metas)</span>
                                        {comissao.bonus_automatico > 0 && (
                                          <Popover>
                                            <PopoverTrigger asChild>
                                              <button className="text-muted-foreground hover:text-foreground">
                                                <Info size={12} />
                                              </button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-64">
                                              <div className="space-y-2">
                                                <p className="font-bold text-[10px] uppercase text-primary">Detalhamento de Bônus</p>
                                                {(() => {
                                                  const d = comissao.detalhes as any;
                                                  const b = d?.bonusInfo || [];
                                                  if (b.length === 0) return <p className="text-[10px]">Bônus de meta de loja</p>;
                                                  return b.map((item: any, i: number) => (
                                                    <div key={i} className="flex justify-between text-[10px] py-1 border-b border-border/50 last:border-0">
                                                      <span>{item.descricao}</span>
                                                      <span className="font-bold">{formatCurrency(item.valor)}</span>
                                                    </div>
                                                  ));
                                                })()}
                                              </div>
                                            </PopoverContent>
                                          </Popover>
                                        )}
                                      </div>
                                      <span className="font-medium text-green-600">{formatCurrency(comissao.bonus_automatico + comissao.bonus_manual)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs py-1 border-b border-border/50">
                                      <div className="flex items-center gap-1">
                                        <span className="text-muted-foreground">Descontos / Adiant.</span>
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <button className="text-muted-foreground hover:text-foreground">
                                              <Info size={12} />
                                            </button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-80">
                                            <div className="space-y-2">
                                              <p className="font-bold text-xs uppercase text-destructive border-b border-destructive/20 pb-1">Detalhes dos Descontos</p>
                                              {(() => {
                                                const detalhes = comissao.detalhes as any;
                                                const allDividasInfo = detalhes?.dividasInfo || [];
                                                
                                                // Filtrar apenas as dívidas "owned" por esta comissão (deduplicação multi-loja)
                                                let dividasInfo = allDividasInfo;
                                                if (allDividasInfo.length > 0) {
                                                  const claimed = new Set<string>();
                                                  for (const other of comissoesDoMes) {
                                                    if (other.id === comissao.id) break;
                                                    const otherInfo = (other.detalhes?.dividasInfo || []) as { id: string; valor: number }[];
                                                    otherInfo.forEach(d => { if (d.id) claimed.add(d.id); });
                                                  }
                                                  dividasInfo = allDividasInfo.filter((d: any) => d.id && !claimed.has(d.id));
                                                }
                                                
                                                // Se não tem info detalhada, só mostra o desconto se for a primeira comissão
                                                const temDescontoSemDetalhe = allDividasInfo.length === 0 && comissao.id === comissoesDoMes[0]?.id && comissao.descontos_dividas > 0;
                                                const mostrarDescontoSemDetalhe = allDividasInfo.length === 0 && comissao.id === comissoesDoMes[0]?.id;

                                                if (dividasInfo.length === 0 && !temDescontoSemDetalhe && comissao.adiantamentos === 0 && comissao.descontos === 0) {
                                                  return <p className="text-xs text-muted-foreground italic">Sem descontos registrados</p>;
                                                }

                                                return (
                                                  <>
                                                    {dividasInfo.map((divida: any, idx: number) => (
                                                      <div key={idx} className="text-xs flex justify-between items-center py-1">
                                                        <span>Dívida: {divida.descricao}</span>
                                                        <span className="font-bold text-destructive">-{formatCurrency(divida.valor)}</span>
                                                      </div>
                                                    ))}
                                                    {allDividasInfo.length === 0 && comissao.id === comissoesDoMes[0]?.id && comissao.descontos_dividas > 0 && (
                                                      <div className="text-xs flex justify-between items-center py-1">
                                                        <span>Dívidas (Consolidado)</span>
                                                        <span className="font-bold text-destructive">-{formatCurrency(comissao.descontos_dividas)}</span>
                                                      </div>
                                                    )}
                                                    {comissao.adiantamentos > 0 && (
                                                      <div className="text-xs flex justify-between items-center py-1">
                                                        <span>Adiantamentos</span>
                                                        <span className="font-bold text-destructive">-{formatCurrency(comissao.adiantamentos)}</span>
                                                      </div>
                                                    )}
                                                    {comissao.descontos > 0 && (
                                                      <div className="text-xs flex justify-between items-center py-1">
                                                        <span>Outros Descontos</span>
                                                        <span className="font-bold text-destructive">-{formatCurrency(comissao.descontos)}</span>
                                                      </div>
                                                    )}
                                                  </>
                                                );
                                              })()}
                                            </div>
                                          </PopoverContent>
                                        </Popover>
                                      </div>
                                      <span className="font-bold text-destructive">-{formatCurrency(totalDescontos)}</span>
                                    </div>
                                  </div>
                                </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })
        )}
      </div>
    </div>
  );
};
