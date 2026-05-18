import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useComissoes } from '@/hooks/useComissoes';
import { useVendas } from '@/hooks/useVendas';
import { useColaboradores, useDividas } from '@/hooks/useColaboradores';
import { useAppStore } from '@/store/appStore';
import { useAuth } from '@/hooks/useAuth';
import { LOJAS, LOJAS_IDS } from '@/lib/constants';
import { getLojaIdsForQuery } from '@/lib/lojaRules';
import { formatCurrency, formatMonth, calcularTotalFromDetalhes } from '@/lib/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Comissao, Divida } from '@/types/database';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { FileText, Info, Store, Layers, DollarSign } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

const CHART_COLORS = ['#3498db', '#2ecc71', '#9b59b6', '#f1c40f', '#e74c3c', '#34495e', '#1abc9c', '#e67e22'];

interface RelatoriosPageProps {
  gerenteLojaId?: string;
}

export const RelatoriosPage = ({ gerenteLojaId }: RelatoriosPageProps) => {
  const { selectedLoja } = useAppStore();
  const { isAdmin, isSupervisao, colaboradorId: loggedColaboradorId } = useAuth();
  const [loja, setLoja] = useState(gerenteLojaId || selectedLoja || LOJAS_IDS[0]);
  const [mes, setMes] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [colaboradorSelecionado, setColaboradorSelecionado] = useState<string>('todos');

  const [showReport, setShowReport] = useState(false);
  
  const isGerenteView = !!gerenteLojaId;

  const { data: comissoes = [], isLoading } = useComissoes(loja === 'todas' ? undefined : loja, mes);
  const { data: todasComissoesMes = [] } = useComissoes(undefined, mes);
  const { data: colaboradoresDaLoja = [] } = useColaboradores(loja === 'todas' ? undefined : loja);

  
  // Mês anterior para comparação
  const mesAnterior = useMemo(() => {
    const date = new Date(mes + '-15');
    date.setMonth(date.getMonth() - 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }, [mes]);

  // Buscar todas as vendas do mês para garantir relatórios individuais consolidados
  const { data: todasVendasMesAtual = [] } = useVendas(undefined, mes);
  const { data: todasVendasMesAnterior = [] } = useVendas(undefined, mesAnterior);

  const vendasMesAtual = useMemo(() => {
    const lojaIds = getLojaIdsForQuery(loja === 'todas' ? null : loja);
    if (loja === 'todas') return todasVendasMesAtual;
    return todasVendasMesAtual.filter(v => lojaIds.includes(v.loja_id));
  }, [todasVendasMesAtual, loja]);

  // Buscar comissões do vendedor selecionado em TODAS as lojas
  // Considera correspondência por nome normalizado E também por colaborador_id (multi-loja robusto)
  const comissoesVendedorSelecionado = useMemo(() => {
    if (colaboradorSelecionado === 'todos') return [];
    const normalizedSelected = colaboradorSelecionado.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Primeiro identifica o colaborador_id pelo nome
    const colabIds = new Set(
      todasComissoesMes
        .filter(c => c.vendedor_nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === normalizedSelected)
        .map(c => c.colaborador_id)
        .filter(Boolean)
    );
    
    // Retorna todas as comissões que batem por nome OU por colaborador_id (em qualquer loja)
    return todasComissoesMes.filter(c => {
      const nomeMatch = c.vendedor_nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === normalizedSelected;
      const idMatch = c.colaborador_id && colabIds.has(c.colaborador_id);
      return nomeMatch || idMatch;
    }).sort((a, b) => (LOJAS[a.loja_id as keyof typeof LOJAS] || a.loja_id).localeCompare(LOJAS[b.loja_id as keyof typeof LOJAS] || b.loja_id));
  }, [todasComissoesMes, colaboradorSelecionado]);
  
  // Detectar lojas com vendas mas sem comissão calculada (alerta multi-loja)
  const lojasSemComissaoCalculada = useMemo(() => {
    if (colaboradorSelecionado === 'todos' || comissoesVendedorSelecionado.length === 0) return [];
    const normalizedSelected = colaboradorSelecionado.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const lojasComComissao = new Set(comissoesVendedorSelecionado.map(c => c.loja_id));
    const lojasComVendas = new Set(
      todasVendasMesAtual
        .filter(v => v.vendedor_nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === normalizedSelected)
        .map(v => v.loja_id)
    );
    return Array.from(lojasComVendas).filter(l => !lojasComComissao.has(l));
  }, [comissoesVendedorSelecionado, todasVendasMesAtual, colaboradorSelecionado]);
  
  const comissaoSelecionada = comissoesVendedorSelecionado.length > 0 ? comissoesVendedorSelecionado[0] : null;
  
  const colaboradorId = comissaoSelecionada?.colaborador_id || undefined;
  const { data: dividas = [] } = useDividas(colaboradorId);

  const colaboradores = useMemo(() => {
    const list = new Map<string, string>(); // Map to store normalized -> display name
    
    // 1. Pessoas que têm comissões nesta loja/mês
    comissoes.forEach(c => {
      const normalized = c.vendedor_nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (!list.has(normalized)) list.set(normalized, c.vendedor_nome);
    });
    
    // 2. Pessoas que estão cadastradas nesta loja (mesmo sem comissão este mês)
    colaboradoresDaLoja.forEach(c => {
      const normalized = c.nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (!list.has(normalized)) list.set(normalized, c.nome);
    });
    
    // 3. Se o usuário logado tiver comissões em outras lojas, garantir que o nome dele apareça na lista
    const meuVendedor = todasComissoesMes.find(c => c.colaborador_id === loggedColaboradorId);
    if (meuVendedor) {
      const normalized = meuVendedor.vendedor_nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (!list.has(normalized)) list.set(normalized, meuVendedor.vendedor_nome);
    }
    
    return Array.from(list.values()).sort();
  }, [comissoes, colaboradoresDaLoja, todasComissoesMes, loggedColaboradorId]);


  useEffect(() => {
    setColaboradorSelecionado('todos');
    setShowReport(false);
  }, [loja, mes]);

  const handleGerarRelatorio = () => {
    setShowReport(true);
  };


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-light">Relatórios</h1>
        <p className="text-muted-foreground">Visualize relatórios detalhados de comissões</p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            {(!isGerenteView && (isAdmin || isSupervisao)) && (
              <div>
                <Label>Loja</Label>
                <Select value={loja} onValueChange={setLoja}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(isAdmin || isSupervisao) && (
                      <SelectItem value="todas">Todas as Lojas</SelectItem>
                    )}
                    {LOJAS_IDS.map(id => (
                      <SelectItem key={id} value={id}>{LOJAS[id]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            
            <div>
              <Label>Mês</Label>
              <Select value={mes} onValueChange={setMes}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue>{formatMonth(mes)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const meses = [];
                    const hoje = new Date();
                    for (let i = 0; i < 24; i++) {
                      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
                      const valor = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                      meses.push(
                        <SelectItem key={valor} value={valor}>
                          {formatMonth(valor)}
                        </SelectItem>
                      );
                    }
                    return meses;
                  })()}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Colaborador</Label>
              <Select 
                value={colaboradorSelecionado} 
                onValueChange={setColaboradorSelecionado}
                disabled={colaboradores.length === 0}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={colaboradores.length === 0 ? "Sem dados" : "Selecione"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Visão Geral da Loja</SelectItem>
                  {colaboradores.map(nome => (
                    <SelectItem key={nome} value={nome}>{nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleGerarRelatorio} 
              disabled={colaboradorSelecionado === 'todos' ? comissoes.length === 0 : comissoesVendedorSelecionado.length === 0}
            >
              <FileText size={18} className="mr-2" />
              Gerar Relatório
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Carregando...
          </CardContent>
        </Card>
      ) : (loja !== 'todas' && comissoes.length === 0 && colaboradorSelecionado === 'todos') ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhuma comissão calculada para este período nesta loja.
          </CardContent>
        </Card>
      ) : showReport && (
        colaboradorSelecionado === 'todos' 
          ? <StoreReport comissoes={comissoes} loja={loja} mes={mes} vendas={vendasMesAtual} todasComissoes={todasComissoesMes} />
          : comissoesVendedorSelecionado.length > 0 ? (
            <>
              {lojasSemComissaoCalculada.length > 0 && (
                <Card className="border-yellow-500/40 bg-yellow-500/5">
                  <CardContent className="py-3 px-4 flex items-start gap-2 text-xs">
                    <Info size={14} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-bold text-yellow-500">Atenção: </span>
                      <span className="text-foreground">
                        Este vendedor possui vendas em {lojasSemComissaoCalculada.map(l => LOJAS[l as keyof typeof LOJAS] || l).join(', ')} sem comissão calculada para {formatMonth(mes)}. Vá até <strong>Lançamento de Vendas</strong> destas lojas e recalcule a folha para incluir no relatório consolidado.
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
              <IndividualReport 
                comissoes={comissoesVendedorSelecionado} 
                vendasMesAnterior={todasVendasMesAnterior}
                vendasMesAtual={todasVendasMesAtual}
                dividas={dividas}
                mes={mes}
              />
            </>
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Nenhuma comissão encontrada para este colaborador no mês selecionado.
              </CardContent>
            </Card>
          )
      )}
    </div>
  );
};

// Relatório da Loja (Visão Geral)
const StoreReport = ({ comissoes, loja, mes, vendas, todasComissoes }: { 
  comissoes: Comissao[], 
  loja: string, 
  mes: string, 
  vendas: { vendedor_nome: string; valor_total: number; detalhes?: Record<string, unknown> }[],
  todasComissoes: Comissao[]
}) => {
  // Calcular total real a partir dos detalhes para evitar duplicação
  const totalVendas = vendas.reduce((sum, v) => sum + (v.detalhes ? calcularTotalFromDetalhes(v.detalhes) : v.valor_total), 0);

  
  const totalComissao = comissoes.reduce((sum, c) => 
    sum + c.comissao_base + c.repostagem_comissao + c.bonus_automatico + c.bonus_manual, 0
  );
  
  const numColaboradores = comissoes.length;
  const comissaoMedia = numColaboradores > 0 ? totalComissao / numColaboradores : 0;

  // Dados para o gráfico de pizza
  const chartData = comissoes.map(c => ({
    name: c.vendedor_nome,
    value: c.comissao_base + c.bonus_automatico + c.bonus_manual
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-light">
          {loja === 'todas' ? 'Visão Consolidada de Todas as Lojas' : `Visão Geral da Loja: ${LOJAS[loja as keyof typeof LOJAS]}`}
        </CardTitle>

        <p className="text-muted-foreground">
          Mês de Referência: {formatMonth(mes)}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Métricas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Vendas Totais" value={formatCurrency(totalVendas)} />
          <MetricCard label="Comissões Totais" value={formatCurrency(totalComissao)} />
          <MetricCard label="Colaboradores" value={numColaboradores.toString()} />
          <MetricCard label="Comissão Média" value={formatCurrency(comissaoMedia)} />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Tabela de Resumo */}
          <div>
            <h4 className="font-medium mb-3">Resumo da Folha</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="text-right">Comissão Base</TableHead>
                  <TableHead className="text-right">Bônus</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comissoes.map(c => {
                  const bonusTotal = c.bonus_automatico + c.bonus_manual;
                  const totalPagar = c.salario + c.ajuda_custo + c.comissao_base + c.repostagem_comissao + 
                    bonusTotal - c.descontos_dividas - c.adiantamentos - c.descontos;
                  
                  // Verificar se o vendedor aparece em outras lojas
                  const outrasLojas = todasComissoes.filter(tc => tc.vendedor_nome === c.vendedor_nome && tc.loja_id !== c.loja_id);
                  const isMultiLoja = outrasLojas.length > 0;

                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span>{c.vendedor_nome}</span>
                            {(loja === 'natal' || loja === 'caruaru') && (
                              <Badge variant="secondary" className="text-[10px] py-0 h-4 bg-primary/10 text-primary border-primary/20">
                                {LOJAS[c.loja_id as keyof typeof LOJAS] || c.loja_id}
                              </Badge>
                            )}
                          </div>
                          {isMultiLoja && (
                            <Badge variant="outline" className="w-fit mt-1 text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/30 flex items-center gap-1">
                              <Layers size={10} />
                              Multiloja
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.cargo}</TableCell>
                      <TableCell className="text-right">{formatCurrency(c.comissao_base)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(bonusTotal)}</TableCell>
                      <TableCell className="text-right font-medium text-green-400">
                        {formatCurrency(totalPagar)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>

            </Table>
          </div>

          {/* Gráfico de Pizza */}
          <div className="bg-card/50 rounded-lg p-4">
            <h4 className="font-medium mb-3 text-center">Distribuição de Comissões</h4>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))', 
                    color: 'white' 
                  }}
                  labelStyle={{ color: 'white' }}
                  itemStyle={{ color: 'white' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Relatório Individual
const IndividualReport = ({ 
  comissoes, 
  vendasMesAnterior,
  vendasMesAtual,
  dividas,
  mes
}: { 
  comissoes: Comissao[], 
  vendasMesAnterior: { vendedor_nome: string; valor_total: number; detalhes?: Record<string, unknown>; loja_id: string }[],
  vendasMesAtual: { vendedor_nome: string; valor_total: number; detalhes?: Record<string, unknown>; loja_id: string }[],
  dividas: Divida[],
  mes: string
}) => {

  const comissaoPrincipal = comissoes[0];

  // Deduplicação de dívidas em multi-loja: cada dívida (id) só deve ser descontada
  // UMA vez no relatório consolidado, mesmo aparecendo em comissões de várias lojas.
  // Atribuímos cada dívida à PRIMEIRA comissão (por ordem) onde ela aparece.
  const dividaOwnerByComissao = useMemo(() => {
    const owner = new Map<string, Set<string>>(); // comissaoId -> Set<dividaId>
    const claimed = new Set<string>();
    comissoes.forEach((c) => {
      const ids = new Set<string>();
      const info = (c.detalhes as { dividasInfo?: { id: string; valor: number }[] } | null)?.dividasInfo || [];
      info.forEach((d) => {
        if (d?.id && !claimed.has(d.id)) {
          claimed.add(d.id);
          ids.add(d.id);
        }
      });
      owner.set(c.id, ids);
    });
    return owner;
  }, [comissoes]);

  // Calcula o desconto efetivo de dívidas por comissão (somente as dívidas "owned" por ela)
  const descontoDividasEfetivo = (c: Comissao): number => {
    const info = (c.detalhes as { dividasInfo?: { id: string; valor: number }[] } | null)?.dividasInfo || [];
    if (info.length === 0) {
      // Sem detalhes: só conta na primeira comissão para evitar duplicação
      return c.id === comissoes[0]?.id ? c.descontos_dividas : 0;
    }
    const owned = dividaOwnerByComissao.get(c.id) || new Set<string>();
    return info
      .filter((d) => owned.has(d.id))
      .reduce((sum, d) => sum + (Number(d.valor) || 0), 0);
  };

  const totalGeralAPagar = comissoes.reduce((acc, c) => {
    return acc + c.salario + c.ajuda_custo + c.comissao_base + 
      c.bonus_automatico + c.bonus_manual - 
      descontoDividasEfetivo(c) - c.adiantamentos - c.descontos;
  }, 0);

  const totalComissoesBase = comissoes.reduce((acc, c) => acc + c.comissao_base, 0);
  const totalSalarios = comissoes.reduce((acc, c) => acc + c.salario, 0);
  const totalAjudas = comissoes.reduce((acc, c) => acc + c.ajuda_custo, 0);
  const totalBonus = comissoes.reduce((acc, c) => acc + c.bonus_automatico + c.bonus_manual, 0);
  const totalDescontos = comissoes.reduce((acc, c) => acc + descontoDividasEfetivo(c) + c.adiantamentos + c.descontos, 0);

  // Calcular total real a partir dos detalhes para evitar duplicação
  const normalizedPrincipalName = comissaoPrincipal.vendedor_nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const vendasColabMesAtual = vendasMesAtual
    .filter(v => v.vendedor_nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === normalizedPrincipalName)
    .reduce((sum, v) => sum + (v.detalhes ? calcularTotalFromDetalhes(v.detalhes) : v.valor_total), 0);
  
  // Vendas do colaborador no mês anterior
  const vendasColabMesAnterior = vendasMesAnterior
    .filter(v => v.vendedor_nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === normalizedPrincipalName)
    .reduce((sum, v) => sum + (v.detalhes ? calcularTotalFromDetalhes(v.detalhes) : v.valor_total), 0);

  // Dados para gráfico de barras (comparação meses)
  const mesAnteriorDate = new Date(mes + '-15');
  mesAnteriorDate.setMonth(mesAnteriorDate.getMonth() - 1);
  const mesAnteriorLabel = mesAnteriorDate.toLocaleDateString('pt-BR', { month: 'long' });
  const mesAtualLabel = new Date(mes + '-15').toLocaleDateString('pt-BR', { month: 'long' });

  const barChartData = [
    { name: mesAnteriorLabel, vendas: vendasColabMesAnterior },
    { name: mesAtualLabel, vendas: vendasColabMesAtual }
  ];

  // Calcular dívidas ativas no mês
  const dividasAtivas = dividas.filter(divida => {
    const mesInicio = new Date(divida.mes_inicio + '-02');
    const mesAtual = new Date(mes + '-02');
    if (mesAtual < mesInicio) return false;
    const diffMonths = (mesAtual.getFullYear() - mesInicio.getFullYear()) * 12 
      + (mesAtual.getMonth() - mesInicio.getMonth());
    return diffMonths < divida.parcelas_totais;
  });

  return (
    <Card className="border-primary/20 bg-card/30 backdrop-blur-sm">
      <CardHeader className="border-b border-border/50 bg-primary/5">
        <CardTitle className="font-light flex flex-wrap justify-between items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">{comissaoPrincipal.vendedor_nome}</h2>
            <p className="text-muted-foreground text-sm uppercase tracking-wider">{comissaoPrincipal.cargo}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase font-normal tracking-widest">Valor Total a Receber</p>
            <p className="text-3xl font-black text-green-500">{formatCurrency(totalGeralAPagar)}</p>
          </div>
        </CardTitle>
        <p className="text-muted-foreground text-xs mt-2">
          Relatório Consolidado de Comissões • {formatMonth(mes)}
        </p>
      </CardHeader>
      <CardContent className="space-y-12 py-8">
        {comissoes.map((comissao, idx) => {
          const dividasEfetivas = descontoDividasEfetivo(comissao);
          const totalAPagar = comissao.salario + comissao.ajuda_custo + comissao.comissao_base + 
            comissao.bonus_automatico + comissao.bonus_manual - 
            dividasEfetivas - comissao.adiantamentos - comissao.descontos;
          const comissaoDetalhada = comissao.comissao_detalhada || {};
          
          // Buscar vendas desta loja para detalhamento
          const vendasDaLoja = vendasMesAtual.filter(v => 
            v.loja_id === comissao.loja_id && 
            v.vendedor_nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === normalizedPrincipalName
          );
          
          const totaisVendaLoja = vendasDaLoja.reduce((acc, v) => {
            const d = (v.detalhes || {}) as Record<string, number>;
            Object.entries(d).forEach(([k, val]) => {
              const key = k.toUpperCase();
              acc[key] = (acc[key] || 0) + val;
            });
            return acc;
          }, {} as Record<string, number>);

          const getBaseVenda = (cat: string) => {
            const upperCat = cat.toUpperCase();
            if (upperCat === 'ASSIST. TÉCNICA') return totaisVendaLoja['ASSISTÊNCIA TÉCNICA'] || 0;
            return totaisVendaLoja[upperCat] || 0;
          };

          return (
            <div key={comissao.id} className={cn("space-y-8 pt-8", idx > 0 && "border-t-2 border-dashed border-border")}>
              <div className="flex items-center justify-between bg-muted/30 p-4 rounded-lg">
                <div className="flex items-center gap-3 text-primary">
                  <div className="bg-primary/20 p-2 rounded-full">
                    <Store size={20} />
                  </div>
                  <div>
                    <span className="uppercase font-black text-lg tracking-tighter">
                      {LOJAS[comissao.loja_id as keyof typeof LOJAS] || comissao.loja_id}
                    </span>
                    <p className="text-xs text-muted-foreground uppercase">Unidade de Venda</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Líquido na Loja</p>
                  <span className="text-2xl font-black text-foreground">{formatCurrency(totalAPagar)}</span>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-8">
                {/* Vendas e Alíquotas */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Layers className="w-4 h-4 text-primary" />
                    <h4 className="font-bold uppercase text-sm tracking-widest text-muted-foreground">Vendas e Comissionamento</h4>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-border/50 bg-card/20">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="h-9 text-[10px] uppercase font-bold">Categoria</TableHead>
                          <TableHead className="h-9 text-right text-[10px] uppercase font-bold">Valor Venda</TableHead>
                          <TableHead className="h-9 text-right text-[10px] uppercase font-bold">%</TableHead>
                          <TableHead className="h-9 text-right text-[10px] uppercase font-bold">Comissão</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(comissaoDetalhada)
                          .filter(([key, value]) => 
                            typeof value === 'number' && 
                            value >= 0 && 
                            !['VENDA DIÁRIA', 'VENDA DIARIA'].includes(key.toUpperCase().trim())
                          )
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([key, value]) => {
                            const valorVenda = getBaseVenda(key);
                            const percentual = valorVenda > 0 ? (Number(value) / valorVenda) * 100 : 0;
                            return (
                              <TableRow key={key} className="hover:bg-muted/20 transition-colors">
                                <TableCell className="py-2 capitalize font-medium">{key.toLowerCase()}</TableCell>
                                <TableCell className="py-2 text-right">{formatCurrency(valorVenda)}</TableCell>
                                <TableCell className="py-2 text-right text-muted-foreground text-xs">
                                  {percentual > 0 ? `${percentual.toFixed(1)}%` : '-'}
                                </TableCell>
                                <TableCell className="py-2 text-right font-bold text-primary">{formatCurrency(value as number)}</TableCell>
                              </TableRow>
                            );
                          })}
                        <TableRow className="bg-primary/5">
                          <TableCell colSpan={3} className="py-2 font-bold uppercase text-xs">Total Comissão Base</TableCell>
                          <TableCell className="py-2 text-right font-bold text-primary">{formatCurrency(comissao.comissao_base)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Remuneração / Descontos */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-green-500" />
                    <h4 className="font-bold uppercase text-sm tracking-widest text-muted-foreground">Composição Salarial</h4>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-border/50 bg-card/20">
                    <Table>
                      <TableBody>
                        <TableRow className="hover:bg-muted/10 transition-colors">
                          <TableCell className="py-2">Salário Fixo</TableCell>
                          <TableCell className="py-2 text-right font-medium">{formatCurrency(comissao.salario)}</TableCell>
                        </TableRow>
                        <TableRow className="hover:bg-muted/10 transition-colors">
                          <TableCell className="py-2">Ajuda de Custo</TableCell>
                          <TableCell className="py-2 text-right font-medium">{formatCurrency(comissao.ajuda_custo)}</TableCell>
                        </TableRow>
                        <TableRow className="hover:bg-muted/10 transition-colors bg-green-500/5">
                          <TableCell className="py-2 font-semibold">(+) Comissão Base</TableCell>
                          <TableCell className="py-2 text-right font-bold text-green-500">{formatCurrency(comissao.comissao_base)}</TableCell>
                        </TableRow>
                        <TableRow className="hover:bg-muted/10 transition-colors">
                          <TableCell className="py-2">
                            <div className="flex items-center gap-1">
                              (+) Bônus Automático
                              {comissao.bonus_automatico > 0 && (
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button className="text-muted-foreground hover:text-foreground">
                                      <Info size={12} />
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-80">
                                    <div className="space-y-2">
                                      <p className="font-bold text-xs uppercase text-primary border-b border-primary/20 pb-1">Detalhes do Bônus</p>
                                      {(() => {
                                        const detalhes = comissao.detalhes as Record<string, unknown>;
                                        const bonusInfo = (detalhes?.bonusInfo as Array<{descricao: string; valor: number}>) || [];
                                        if (bonusInfo.length === 0) return <p className="text-xs">Bônus de meta da loja</p>;
                                        return bonusInfo.map((bonus, idx) => (
                                          <div key={idx} className="text-xs flex justify-between items-center py-1">
                                            <span>{bonus.descricao}</span>
                                            <span className="font-bold">{formatCurrency(bonus.valor)}</span>
                                          </div>
                                        ));
                                      })()}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-2 text-right font-medium text-green-500">{formatCurrency(comissao.bonus_automatico)}</TableCell>
                        </TableRow>
                        <TableRow className="hover:bg-muted/10 transition-colors">
                          <TableCell className="py-2">(+) Bônus Manual</TableCell>
                          <TableCell className="py-2 text-right font-medium text-green-500">{formatCurrency(comissao.bonus_manual)}</TableCell>
                        </TableRow>
                        <TableRow className="hover:bg-muted/10 transition-colors border-t border-border">
                          <TableCell className="py-2">
                            <div className="flex items-center gap-1">
                              (-) Descontos (Dívidas/Adiant.)
                              {(() => {
                                const owned = dividaOwnerByComissao.get(comissao.id) || new Set<string>();
                                const dividasDestaLoja = dividasAtivas.filter(d => owned.has(d.id));
                                const temAlgo = dividasDestaLoja.length > 0 || comissao.adiantamentos > 0 || comissao.descontos > 0;
                                if (!temAlgo) return null;
                                return (
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button className="text-muted-foreground hover:text-foreground">
                                        <Info size={12} />
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80">
                                      <div className="space-y-2">
                                        <p className="font-bold text-xs uppercase text-destructive border-b border-destructive/20 pb-1">Detalhes dos Descontos</p>
                                        {dividasDestaLoja.map(divida => (
                                          <div key={divida.id} className="text-xs flex justify-between items-center py-1">
                                            <span>Dívida: {divida.descricao}</span>
                                            <span className="font-bold text-destructive">-{formatCurrency(divida.valor_total / divida.parcelas_totais)}</span>
                                          </div>
                                        ))}
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
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                );
                              })()}
                            </div>
                          </TableCell>
                          <TableCell className="py-2 text-right font-bold text-destructive">-{formatCurrency(dividasEfetivas + comissao.adiantamentos + comissao.descontos)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Resumo Consolidado Final */}
        {comissoes.length > 1 && (
          <div className="mt-12 bg-primary/5 p-8 rounded-2xl border-2 border-primary/20 space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-primary p-2 rounded-lg text-primary-foreground">
                <FileText size={24} />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight">Resumo Consolidado de Todas as Lojas</h3>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Salários + Ajudas</p>
                <p className="text-lg font-bold">{formatCurrency(totalSalarios + totalAjudas)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Comissões</p>
                <p className="text-lg font-bold text-green-500">{formatCurrency(totalComissoesBase)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Bônus</p>
                <p className="text-lg font-bold text-green-500">{formatCurrency(totalBonus)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Descontos</p>
                <p className="text-lg font-bold text-destructive">-{formatCurrency(totalDescontos)}</p>
              </div>
              <div className="space-y-1 bg-green-500/10 p-3 rounded-xl border border-green-500/20 col-span-2 md:col-span-1">
                <p className="text-[10px] text-green-600 uppercase font-black">Líquido Geral</p>
                <p className="text-2xl font-black text-green-500">{formatCurrency(totalGeralAPagar)}</p>
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8 pt-8">
          {/* Gráfico de Evolução de Vendas */}
          <div className="bg-card/50 rounded-2xl p-6 border border-border/50">
            <h4 className="font-black uppercase text-xs tracking-[0.2em] mb-6 text-center text-muted-foreground">Evolução de Performance Individual</h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground)/0.1)" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v/1000}k`} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: 'hsl(var(--primary))', fontWeight: 'bold' }}
                />
                <Bar dataKey="vendas" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} barSize={60} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-primary/5 rounded-2xl p-6 border border-primary/10 flex flex-col justify-center text-center space-y-4">
             <Info className="w-12 h-12 text-primary mx-auto opacity-50" />
             <h4 className="font-bold text-lg">Informações Importantes</h4>
             <p className="text-sm text-muted-foreground">
               Este relatório consolida todas as suas atividades em diferentes unidades de venda para o mês de {formatMonth(mes)}. 
               Em caso de dúvidas sobre os valores, entre em contato com a supervisão ou gerência de cada loja.
             </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const MetricCard = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-card/50 border border-border/50 rounded-lg p-4">
    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
    <p className="text-xl font-semibold text-primary">{value}</p>
  </div>
);
