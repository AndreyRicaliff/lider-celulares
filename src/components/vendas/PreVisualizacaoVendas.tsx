import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/formatters';
import { CATEGORY_COLUMNS, isIgnoredColumn } from '@/lib/constants';
import { isLojaCampinaNatal, isLojaSoledadeMonteiro } from '@/lib/lojaRules';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { AlertTriangle, TrendingUp, Target, ShoppingBag, Wrench, Smartphone, Award } from 'lucide-react';

interface PreVisualizacaoVendasProps {
  stagedData: Array<Record<string, string | number | undefined>>;
  colaboradores: Array<{ id: string; nome: string; cargo: string }>;
  metaPrata: number;
  metaOuro: number;
  config: Record<string, number>;
  diasDecorridos: number;
  diasTotais: number;
  lojaNome: string;
  selectedMes: string;
  lojaId: string;
  filtroVendedor?: string | null;
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 160 60% 45%))',
  'hsl(var(--chart-3, 30 80% 55%))',
  'hsl(var(--chart-4, 280 65% 60%))',
  'hsl(var(--chart-5, 340 75% 55%))',
];

export const PreVisualizacaoVendas = ({
  stagedData: rawStagedData,
  colaboradores,
  metaPrata,
  metaOuro,
  config,
  diasDecorridos,
  diasTotais,
  lojaNome,
  selectedMes,
  lojaId,
  filtroVendedor,
}: PreVisualizacaoVendasProps) => {
  const isCampinaNatal = isLojaCampinaNatal(lojaId);
  const isSoledadeMonteiro = isLojaSoledadeMonteiro(lojaId);
  const normalizeName = (value: string) =>
    value
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  // Filter data to individual vendedor if filtroVendedor is set
  const stagedData = useMemo(() => {
    if (!filtroVendedor) return rawStagedData;
    return rawStagedData.filter(row => 
      normalizeName(String(row.VENDEDOR || '')) === normalizeName(filtroVendedor)
    );
  }, [rawStagedData, filtroVendedor]);

  const analysis = useMemo(() => {
    const totalSmartphones = stagedData.reduce((sum, row) => {
      return sum + CATEGORY_COLUMNS.smartphones.reduce((catSum, col) => catSum + (Number(row[col]) || 0), 0);
    }, 0);

    const totalServicos = stagedData.reduce((sum, row) => {
      return sum + CATEGORY_COLUMNS.servicos.reduce((catSum, col) => catSum + (Number(row[col]) || 0), 0);
    }, 0);

    const totalAcessorios = stagedData.reduce((sum, row) => {
      return sum + (Number(row['ACESSÓRIOS']) || 0);
    }, 0);

    const totalCases = stagedData.reduce((sum, row) => sum + (Number(row['CASES']) || 0), 0);
    const totalPelicula = stagedData.reduce((sum, row) => sum + (Number(row['PELÍCULA']) || 0), 0);
    const totalAssistencia = stagedData.reduce((sum, row) => sum + (Number(row['ASSISTÊNCIA TÉCNICA']) || 0), 0);

    const totalGeral = stagedData.reduce((sum, row) => {
      return sum + Object.entries(row).reduce((rowSum, [key, value]) => {
        if (key !== 'VENDEDOR' && key !== '_origem' && typeof value === 'number' && !isIgnoredColumn(key)) return rowSum + value;
        return rowSum;
      }, 0);
    }, 0);

    // Projeção
    const projecao = diasDecorridos > 0 ? (totalGeral / diasDecorridos) * diasTotais : 0;

    // Todas as categorias explícitas na tabela
    const ALL_CATEGORIES = ['BONIFICADO LC', 'SUPER BONIFICADO', 'ANATEL', 'CASES', 'PELÍCULA', 'ACESSÓRIOS', 'GERAL', 'PROTEÇÃO LÍDER', 'GARANTIA ESTENDIDA', 'ASSISTÊNCIA TÉCNICA', 'VALOR REAL (S/ JUROS)'];

    const CATEGORY_VARIANTS: Record<string, string[]> = {
      'SUPER BONIFICADO': ['SUPER BONIFICADO', 'SUPERBONIFICADO'],
      'PROTEÇÃO LÍDER': ['PROTEÇÃO LÍDER', 'PROTEÇÃO LIDER'],
      'ASSISTÊNCIA TÉCNICA': ['ASSISTÊNCIA TÉCNICA', 'ASSISTENCIA TECNICA'],
    };

    const getCatVal = (row: Record<string, string | number | undefined>, cat: string): number => {
      const variants = CATEGORY_VARIANTS[cat] || [cat];
      for (const v of variants) {
        if (row[v] !== undefined) return Number(row[v]) || 0;
      }
      return 0;
    };

    // Por vendedor com todas as categorias
    type VendedorData = { smartphones: number; protecaoLider: number; garantiaEstendida: number; acessorios: number; total: number; categorias: Record<string, number> };
    const porVendedor: Record<string, VendedorData> = {};
    stagedData.forEach(row => {
      const nome = String(row.VENDEDOR || '').trim();
      const isCadastrado = colaboradores.some(c => normalizeName(c.nome) === normalizeName(nome));
      if (!isCadastrado) return;

      if (!porVendedor[nome]) porVendedor[nome] = { smartphones: 0, protecaoLider: 0, garantiaEstendida: 0, acessorios: 0, total: 0, categorias: {} };

      CATEGORY_COLUMNS.smartphones.forEach(col => {
        porVendedor[nome].smartphones += Number(row[col]) || 0;
      });
      porVendedor[nome].protecaoLider += Number(row['PROTEÇÃO LÍDER']) || 0;
      porVendedor[nome].garantiaEstendida += Number(row['GARANTIA ESTENDIDA']) || 0;
      porVendedor[nome].acessorios += (Number(row['ACESSÓRIOS']) || 0) + (Number(row['CASES']) || 0) + (Number(row['PELÍCULA']) || 0);

      // Todas as categorias explícitas
      ALL_CATEGORIES.forEach(cat => {
        const val = getCatVal(row, cat);
        porVendedor[nome].categorias[cat] = (porVendedor[nome].categorias[cat] || 0) + val;
      });

      Object.entries(row).forEach(([key, value]) => {
        if (key !== 'VENDEDOR' && key !== '_origem' && typeof value === 'number' && !isIgnoredColumn(key)) {
          porVendedor[nome].total += value;
        }
      });
    });

    // Detectar quais categorias têm dados (GERAL é sempre fixa, mesmo zerada)
    const CATEGORIAS_FIXAS = new Set(['GERAL']);
    const categoriasComDados = ALL_CATEGORIES.filter(cat =>
      CATEGORIAS_FIXAS.has(cat) ||
      Object.values(porVendedor).some(v => (v.categorias[cat] || 0) > 0)
    );

    return {
      totalSmartphones, totalServicos, totalAcessorios, totalCases, totalPelicula, totalAssistencia, totalGeral,
      projecao, porVendedor, categoriasComDados,
    };
  }, [stagedData, colaboradores, diasDecorridos, diasTotais]);

  // ===== METAS DA LOJA (store-level) =====
  // Para Campina/Natal: Meta Prata = gerente_meta_prata (smartphones + serviços), Meta Ouro = prata + X%
  // Para Soledade/Monteiro: Meta Prata = loja_meta_prata, Meta Ouro = loja_meta_ouro
  let metaPrataReal: number;
  let metaOuroReal: number;
  let totalParaMetaPrata: number;
  let totalParaMetaOuro: number;

  if (isCampinaNatal) {
    metaPrataReal = config.gerente_meta_prata || (lojaId === 'natal' ? 280000 : 190000);
    const acrescimo = config.gerente_meta_ouro_acrescimo || 10;
    metaOuroReal = config.loja_meta_ouro || (metaPrataReal * (1 + acrescimo / 100));
    totalParaMetaPrata = analysis.totalSmartphones + analysis.totalServicos;
    totalParaMetaOuro = analysis.totalSmartphones;
  } else if (isSoledadeMonteiro) {
    metaPrataReal = metaPrata > 0 ? metaPrata : (config.loja_meta_prata || 50000);
    metaOuroReal = metaOuro > 0 ? metaOuro : (config.loja_meta_ouro || 65000);
    // Prata: tudo exceto GERAL; Ouro: tudo exceto GERAL e Serviços
    totalParaMetaPrata = analysis.totalSmartphones + analysis.totalServicos + analysis.totalAcessorios + analysis.totalCases + analysis.totalPelicula + analysis.totalAssistencia;
    totalParaMetaOuro = analysis.totalSmartphones + analysis.totalAcessorios + analysis.totalCases + analysis.totalPelicula + analysis.totalAssistencia;
  } else {
    metaPrataReal = metaPrata;
    metaOuroReal = metaOuro;
    totalParaMetaPrata = analysis.totalSmartphones + analysis.totalServicos;
    totalParaMetaOuro = analysis.totalSmartphones;
  }

  const percentualPrata = metaPrataReal > 0 ? (totalParaMetaPrata / metaPrataReal) * 100 : 0;
  const percentualOuro = metaOuroReal > 0 ? (totalParaMetaOuro / metaOuroReal) * 100 : 0;
  const faltaPrata = Math.max(0, metaPrataReal - totalParaMetaPrata);
  const faltaOuro = Math.max(0, metaOuroReal - totalParaMetaOuro);

  // Gráfico de barras: volume realizado por categoria (sem comparar com meta individual de vendedor)
  const categoryData = [
    { name: 'Smartphones', valor: analysis.totalSmartphones, icon: Smartphone },
    { name: 'Serviços', valor: analysis.totalServicos, icon: Wrench },
    { name: 'Acessórios', valor: analysis.totalAcessorios, icon: ShoppingBag },
    { name: 'Cases', valor: analysis.totalCases, icon: ShoppingBag },
    { name: 'Película', valor: analysis.totalPelicula, icon: ShoppingBag },
  ].filter(c => c.valor > 0);

  const chartData = categoryData.map(c => ({
    name: c.name,
    Vendido: c.valor,
  }));

  const pieData = categoryData.filter(c => c.valor > 0).map(c => ({
    name: c.name,
    value: c.valor,
  }));

  // Alertas baseados em metas de LOJA (não de vendedor individual)
  const alerts: Array<{ message: string; type: 'warning' | 'success' }> = [];
  
  if (metaPrataReal > 0) {
    if (percentualPrata >= 100) {
      alerts.push({ message: `Meta Prata atingida! (${percentualPrata.toFixed(1)}%)`, type: 'success' });
    } else if (percentualPrata >= 80) {
      alerts.push({ message: `Faltam ${formatCurrency(faltaPrata)} para a Meta Prata (${percentualPrata.toFixed(1)}%)`, type: 'warning' });
    }
  }
  if (metaOuroReal > 0) {
    if (percentualOuro >= 100) {
      alerts.push({ message: `Meta Ouro atingida! (${percentualOuro.toFixed(1)}%)`, type: 'success' });
    } else if (percentualOuro >= 80) {
      alerts.push({ message: `Faltam ${formatCurrency(faltaOuro)} para a Meta Ouro (${percentualOuro.toFixed(1)}%)`, type: 'warning' });
    }
  }

  const vendedorRows = Object.entries(analysis.porVendedor)
    .sort((a, b) => b[1].total - a[1].total);

  const isIndividual = !!filtroVendedor;

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {!isIndividual && alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${
              alert.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
            }`}>
              {alert.type === 'warning' ? <AlertTriangle size={16} /> : <Award size={16} />}
              <span className="text-sm font-medium">{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Summary Cards */}
      <div className={`grid ${isIndividual ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'} gap-4`}>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Smartphone size={14} />
              <span>Smartphones</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(analysis.totalSmartphones)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Wrench size={14} />
              <span>Serviços</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(analysis.totalServicos)}</p>
          </CardContent>
        </Card>

        {isIndividual && (
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                <ShoppingBag size={14} />
                <span>Total Geral</span>
              </div>
              <p className="text-xl font-bold">{formatCurrency(analysis.totalGeral)}</p>
            </CardContent>
          </Card>
        )}

        {!isIndividual && (
          <>
            {/* Meta Prata Progress */}
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Target size={14} />
                  <span>Meta Prata</span>
                </div>
                <p className="text-xl font-bold">{Math.min(percentualPrata, 999).toFixed(1)}%</p>
                <Progress value={Math.min(percentualPrata, 100)} className="mt-2 h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(totalParaMetaPrata)} / {formatCurrency(metaPrataReal)}
                </p>
              </CardContent>
            </Card>

            {/* Meta Ouro Progress */}
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <TrendingUp size={14} />
                  <span>Meta Ouro</span>
                </div>
                <p className="text-xl font-bold">{Math.min(percentualOuro, 999).toFixed(1)}%</p>
                <Progress value={Math.min(percentualOuro, 100)} className="mt-2 h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(totalParaMetaOuro)} / {formatCurrency(metaOuroReal)}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{isIndividual ? 'Minhas Vendas por Categoria' : 'Volume por Categoria'}</CardTitle>
            <CardDescription>{isIndividual ? 'Seu volume vendido por categoria' : 'Volume vendido por categoria de produto'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Bar dataKey="Vendido" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{isIndividual ? 'Minha Distribuição' : 'Distribuição de Vendas'}</CardTitle>
            <CardDescription>{isIndividual ? 'Proporção das suas vendas' : 'Proporção entre categorias'}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value">
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend 
                    formatter={(value) => <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-Vendor Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{isIndividual ? 'Meu Desempenho' : 'Desempenho por Vendedor'}</CardTitle>
          <CardDescription>{isIndividual ? 'Detalhamento das suas vendas por categoria' : 'Ranking por volume total de vendas'}</CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                   {!isIndividual && <TableHead className="text-xs">#</TableHead>}
                   <TableHead className="text-xs">VENDEDOR</TableHead>
                   {analysis.categoriasComDados.map(cat => (
                     <TableHead key={cat} className="text-xs text-right whitespace-nowrap">{cat}</TableHead>
                   ))}
                   <TableHead className="text-xs text-right">TOTAL</TableHead>
                   {!isIndividual && <TableHead className="text-xs text-right">%</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendedorRows.map(([nome, dados], idx) => (
                  <TableRow key={nome}>
                    {!isIndividual && (
                      <TableCell className="text-xs font-medium">
                        {idx < 3 ? (
                          <Badge variant={idx === 0 ? 'default' : 'secondary'} className="text-[10px] px-1.5">
                            {idx + 1}º
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">{idx + 1}º</span>
                        )}
                      </TableCell>
                    )}
                    <TableCell className="text-sm font-medium">{nome}</TableCell>
                    {analysis.categoriasComDados.map(cat => (
                      <TableCell key={cat} className="text-xs text-right">
                        {formatCurrency(dados.categorias[cat] || 0)}
                      </TableCell>
                    ))}
                    <TableCell className="text-sm text-right font-bold">{formatCurrency(dados.total)}</TableCell>
                    {!isIndividual && (
                      <TableCell className="text-xs text-right text-muted-foreground">
                        {analysis.totalGeral > 0 ? ((dados.total / analysis.totalGeral) * 100).toFixed(1) : 0}%
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {!isIndividual && (
        <Card>
          <CardContent className="pt-5 pb-4">
            <p className="text-xs text-muted-foreground">
              <strong>Como interpretar:</strong> Os cards superiores mostram o volume vendido e o progresso em relação às metas da loja (Prata e Ouro).
              {isCampinaNatal && ' Meta Prata = Smartphones + Serviços. Meta Ouro = apenas Smartphones.'}
              {isSoledadeMonteiro && ' Meta Prata = todas categorias exceto GERAL. Meta Ouro = todas exceto GERAL e Serviços.'}
              {' '}A projeção estima o total do mês com base no ritmo atual ({diasDecorridos} de {diasTotais} dias).
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};