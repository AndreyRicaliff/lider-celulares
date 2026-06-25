import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useVendasDiarias } from '@/hooks/useVendasDiarias';
import { useColaboradores } from '@/hooks/useColaboradores';
import { useConfiguracao } from '@/hooks/useConfiguracoes';
import { formatCurrency } from '@/lib/formatters';
import { LOJAS } from '@/lib/constants';
import { TrendingUp, Filter } from 'lucide-react';
import { format, parseISO, isSunday, getDaysInMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface VendasDiariasChartProps {
  lojaId: string;
  mes: string;
  dataInicio?: string;
  dataFim?: string;
}

type FiltroCategoria = 'geral' | 'smartphones' | 'servicos' | 'acessorios' | 'categoria_geral';

export const VendasDiariasChart = ({ lojaId, mes, dataInicio, dataFim }: VendasDiariasChartProps) => {
  const [filtroCategoria, setFiltroCategoria] = useState<FiltroCategoria>('geral');
  const [filtroVendedor, setFiltroVendedor] = useState<string>('todos');
  
  const { data: vendasDiarias = [], isLoading } = useVendasDiarias(lojaId || undefined, mes);
  const { data: colaboradores = [] } = useColaboradores(lojaId || undefined);
  const { data: config } = useConfiguracao(lojaId || 'soledade', mes);
  
  const isSoledadeMonteiro = lojaId === 'soledade' || lojaId === 'monteiro';
  const diasFechamento = useMemo(() => config?.diasFechamento || [], [config?.diasFechamento]);
  
  // Filtrar apenas vendedores cadastrados
  const vendedoresCadastrados = useMemo(() => {
    const nomes = new Set(colaboradores.map(c => c.nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
    return Array.from(new Set(vendasDiarias.filter(v => {
      const normalized = v.vendedor_nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return nomes.size === 0 || nomes.has(normalized);
    }).map(v => v.vendedor_nome.trim().toUpperCase())));
  }, [vendasDiarias, colaboradores]);
  
  // Processar dados para o gráfico
  const chartData = useMemo(() => {
    if (vendasDiarias.length === 0) return [];
    
    const nomesCadastrados = new Set(colaboradores.map(c => c.nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
    
    // Agrupar por data
    const porData: Record<string, { 
      data: string; 
      geral: number; 
      categoria_geral: number;
      smartphones: number; 
      servicos: number; 
      acessorios: number;
      ehDomingo: boolean;
    }> = {};
    
    // Criar todos os dias do mês
    const [ano, mesNum] = mes.split('-').map(Number);
    const diasNoMes = getDaysInMonth(new Date(ano, mesNum - 1));
    
    for (let dia = 1; dia <= diasNoMes; dia++) {
      const dataStr = `${mes}-${String(dia).padStart(2, '0')}`;
      const dataObj = parseISO(dataStr);
      const ehDomingo = isSunday(dataObj);
      const ehDiaFechamento = diasFechamento.includes(dataStr);
      
      // Soledade e Monteiro não funcionam domingo
      // Todas as lojas excluem dias de fechamento configurados
      if ((isSoledadeMonteiro && ehDomingo) || ehDiaFechamento) {
        continue;
      }
      
      porData[dataStr] = {
        data: dataStr,
        geral: 0,
        categoria_geral: 0,
        smartphones: 0,
        servicos: 0,
        acessorios: 0,
        ehDomingo,
      };
    }
    
    // Preencher com dados reais
    vendasDiarias.forEach(v => {
      const normalizedVendedor = v.vendedor_nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      // Filtrar apenas cadastrados (se houver colaboradores cadastrados)
      if (nomesCadastrados.size > 0 && !nomesCadastrados.has(normalizedVendedor)) return;
      
      // Filtrar por vendedor se selecionado
      if (filtroVendedor !== 'todos' && v.vendedor_nome.trim().toUpperCase() !== filtroVendedor.toUpperCase()) return;
      
      const dataStr = v.data;
      if (!porData[dataStr]) return;
      
      const detalhes = (v.detalhes || {}) as Record<string, number>;
      const smVal = (Number(detalhes['BONIFICADO LC']) || 0) + (Number(detalhes['SUPER BONIFICADO']) || 0) + (Number(detalhes['ANATEL']) || 0);
      const svcVal = (Number(detalhes['PROTEÇÃO LÍDER']) || 0) + (Number(detalhes['GARANTIA ESTENDIDA']) || 0);
      const accVal = (Number(detalhes['ACESSÓRIOS']) || 0) + (Number(detalhes['CASES']) || 0) + (Number(detalhes['PELÍCULA']) || 0);
      const atVal = (Number(detalhes['ASSISTÊNCIA TÉCNICA']) || 0);
      const catGerVal = (Number(detalhes['GERAL']) || Number((v as any).geral) || 0);
      const vtVal = (Number(detalhes['VALOR REAL (S/ JUROS)']) || 0);
      
      porData[dataStr].geral += vtVal || (smVal + svcVal + accVal + atVal + catGerVal);
      porData[dataStr].categoria_geral += catGerVal;
      porData[dataStr].smartphones += smVal;
      porData[dataStr].servicos += svcVal;
      porData[dataStr].acessorios += accVal;
    });
    
    return Object.values(porData)
      .filter(d => {
        if (dataInicio && d.data < dataInicio) return false;
        if (dataFim && d.data > dataFim) return false;
        return true;
      })
      .sort((a, b) => a.data.localeCompare(b.data));
  }, [vendasDiarias, colaboradores, mes, filtroVendedor, isSoledadeMonteiro, diasFechamento, dataInicio, dataFim]);
  
  const getValorPorCategoria = (item: typeof chartData[0]) => {
    switch (filtroCategoria) {
      case 'smartphones': return item.smartphones;
      case 'servicos': return item.servicos;
      case 'acessorios': return item.acessorios;
      case 'categoria_geral': return item.categoria_geral;
      default: return item.geral;
    }
  };
  
  const getCor = () => {
    switch (filtroCategoria) {
      case 'smartphones': return 'hsl(var(--primary))';
      case 'servicos': return 'hsl(142, 76%, 36%)'; // green
      case 'acessorios': return 'hsl(280, 87%, 65%)'; // purple
      case 'categoria_geral': return 'hsl(215, 25%, 27%)'; // slate
      default: return 'hsl(var(--primary))';
    }
  };
  
  const getNomeCategoria = () => {
    switch (filtroCategoria) {
      case 'smartphones': return 'Smartphones';
      case 'servicos': return 'Serviços';
      case 'acessorios': return 'Acessórios';
      case 'categoria_geral': return 'Categoria Geral';
      default: return 'Vendas Totais';
    }
  };

  const lojaLabel = lojaId && LOJAS[lojaId as keyof typeof LOJAS] ? LOJAS[lojaId as keyof typeof LOJAS] : 'Todas as Lojas';

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center h-[400px]">
          <p className="text-muted-foreground">Carregando gráfico...</p>
        </CardContent>
      </Card>
    );
  }

  if (vendasDiarias.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="text-primary" size={20} />
            Vendas Diárias - {lojaLabel}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 flex items-center justify-center h-[300px]">
          <p className="text-muted-foreground text-center">
            Nenhum dado de vendas diárias disponível.<br/>
            <span className="text-sm">Os dados serão registrados automaticamente ao fazer upload das vendas.</span>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="text-primary" size={20} />
            Vendas Diárias - {lojaLabel}
          </CardTitle>
          
          <div className="flex flex-wrap gap-2 items-center">
            <Filter size={16} className="text-muted-foreground" />
            
            {/* Filtro de categoria */}
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value as FiltroCategoria)}
              className="h-8 px-2 text-xs rounded border border-border bg-card text-foreground"
            >
              <option value="geral">Vendas Totais</option>
              <option value="categoria_geral">Categoria Geral</option>
              <option value="smartphones">Smartphones</option>
              <option value="servicos">Serviços</option>
              <option value="acessorios">Acessórios</option>
            </select>
            
            {/* Filtro de vendedor */}
            <select
              value={filtroVendedor}
              onChange={(e) => setFiltroVendedor(e.target.value)}
              className="h-8 px-2 text-xs rounded border border-border bg-card text-foreground max-w-[150px]"
            >
              <option value="todos">Todos Vendedores</option>
              {vendedoresCadastrados.map(nome => (
                <option key={nome} value={nome}>{nome}</option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-4">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="data" 
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(value) => {
                try {
                  return format(parseISO(value), 'dd', { locale: ptBR });
                } catch {
                  return value;
                }
              }}
            />
            <YAxis 
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(value) => {
                if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
                return value;
              }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--card))', 
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              itemStyle={{ color: 'hsl(var(--foreground))' }}
              labelFormatter={(value) => {
                try {
                  return format(parseISO(value as string), "dd 'de' MMMM", { locale: ptBR });
                } catch {
                  return value;
                }
              }}
              formatter={(value: number) => [formatCurrency(value), getNomeCategoria()]}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey={(item) => getValorPorCategoria(item)}
              name={getNomeCategoria()}
              stroke={getCor()}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
        
        {/* Resumo */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="bg-muted/50 rounded p-2 text-center">
            <p className="text-muted-foreground">Total do Mês</p>
            <p className="font-bold text-foreground">
              {formatCurrency(chartData.reduce((sum, d) => sum + getValorPorCategoria(d), 0))}
            </p>
          </div>
          <div className="bg-muted/50 rounded p-2 text-center">
            <p className="text-muted-foreground">Média/Dia</p>
            <p className="font-bold text-foreground">
              {formatCurrency(
                chartData.length > 0 
                  ? chartData.reduce((sum, d) => sum + getValorPorCategoria(d), 0) / chartData.filter(d => getValorPorCategoria(d) > 0).length || 0
                  : 0
              )}
            </p>
          </div>
          <div className="bg-muted/50 rounded p-2 text-center">
            <p className="text-muted-foreground">Melhor Dia</p>
            <p className="font-bold text-foreground">
              {formatCurrency(Math.max(...chartData.map(d => getValorPorCategoria(d)), 0))}
            </p>
          </div>
          <div className="bg-muted/50 rounded p-2 text-center">
            <p className="text-muted-foreground">Dias c/ Vendas</p>
            <p className="font-bold text-foreground">
              {chartData.filter(d => getValorPorCategoria(d) > 0).length}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};