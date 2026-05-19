import { useMemo, useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/store/appStore';
import { useVendas } from '@/hooks/useVendas';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useComissoes } from '@/hooks/useComissoes';
import { calculateCommissionsForLoja } from '@/lib/batchCalculateCommissions';
import { useColaboradores } from '@/hooks/useColaboradores';
import { useConfiguracao, useAllConfiguracoes } from '@/hooks/useConfiguracoes';
import { useVendasDiarias } from '@/hooks/useVendasDiarias';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { LoadingOverlay } from '@/components/ui/loading';
import { formatCurrency } from '@/lib/formatters';
import { LOJAS, LOJAS_IDS, isIgnoredColumn } from '@/lib/constants';
import { isLojaCampinaNatal, isLojaSoledadeMonteiro } from '@/lib/lojaRules';
import { TrendingUp, Users, DollarSign, Award, ShoppingBag, Smartphone, Shield, CalendarIcon, RefreshCw, Percent } from 'lucide-react';
import { RankingBotons } from '@/components/ranking/RankingBotons';
import { MetaStatusCard } from './MetaStatusCard';
import { VendasDiariasChart } from './VendasDiariasChart';
import { SmartServicosChart } from './SmartServicosChart';
import { DailyStoreSalesCards } from './DailyStoreSalesCards';
import { LojaComparativoTable } from './LojaComparativoTable';
import { HistoricoLojaChart } from './HistoricoLojaChart';
import { SyncStatusBar } from './SyncStatusBar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface DashboardProps {
  colaboradorLojaId?: string | null;
}

export const Dashboard = ({ colaboradorLojaId }: DashboardProps = {}) => {
  const { selectedLoja, selectedMes, setSelectedMes, setSelectedLoja } = useAppStore();
  const { isGerente, isAdmin } = useAuth();
  const [dataInicio, setDataInicio] = useState<Date | undefined>(undefined);
  const [dataFim, setDataFim] = useState<Date | undefined>(undefined);
  // Se é colaborador, usa a loja dele; caso contrário usa a selecionada
  const effectiveLoja = colaboradorLojaId || selectedLoja;
  
  const { data: vendas, isLoading: loadingVendas } = useVendas(effectiveLoja || undefined, selectedMes);
  const { data: comissoes, isLoading: loadingComissoes } = useComissoes(effectiveLoja || undefined, selectedMes);
  const { data: colaboradores } = useColaboradores();
  const { data: config } = useConfiguracao(effectiveLoja || 'soledade', selectedMes);
  const { data: vendasDiarias = [] } = useVendasDiarias(effectiveLoja || undefined, selectedMes, { forceAllLojas: isGerente || isAdmin });
  const { data: allConfigs } = useAllConfiguracoes(selectedMes);

  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();
  const autoCalcTriggered = useRef(false);

  // Auto-calculate commissions when admin loads dashboard with vendas but no commissions
  useEffect(() => {
    if (!isAdmin) return;
    if (loadingVendas || loadingComissoes) return;
    if (autoCalcTriggered.current) return;
    const hasVendas = (vendas?.length ?? 0) > 0;
    const hasComissoes = (comissoes?.length ?? 0) > 0;
    if (!hasVendas || hasComissoes) return;

    autoCalcTriggered.current = true;
    toast.info('Calculando comissões automaticamente...');
    Promise.allSettled(
      LOJAS_IDS.map(lid => calculateCommissionsForLoja(lid, selectedMes))
    ).then(results => {
      const total = results.reduce((sum, r) => sum + (r.status === 'fulfilled' ? r.value.count : 0), 0);
      if (total > 0) {
        toast.success(`${total} folhas de comissão calculadas.`);
        queryClient.invalidateQueries({ queryKey: ['comissoes'] });
      }
    });
  }, [isAdmin, loadingVendas, loadingComissoes, vendas, comissoes, selectedMes, queryClient]);

  const registeredNames = useMemo(() => {
    const names = new Set(colaboradores?.map(c => c.nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")) || []);
    return names;
  }, [colaboradores]);
  
  const filteredVendas = useMemo(() => vendas?.filter(v => {
    const normalizedName = v.vendedor_nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return registeredNames.has(normalizedName);
  }) || [], [vendas, registeredNames]);
  
  const filteredComissoes = useMemo(() => comissoes?.filter(c => {
    const normalizedName = c.vendedor_nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return registeredNames.has(normalizedName);
  }) || [], [comissoes, registeredNames]);

  const temFiltroPeriodo = !!(dataInicio || dataFim);
  const dataInicioStr = dataInicio ? format(dataInicio, 'yyyy-MM-dd') : undefined;
  const dataFimStr = dataFim ? format(dataFim, 'yyyy-MM-dd') : undefined;

  // Vendas diárias filtradas pelo período
  const vendasDiariasFiltradas = useMemo(() => {
    if (!temFiltroPeriodo) return [];
    return vendasDiarias.filter(v => {
      if (dataInicioStr && v.data < dataInicioStr) return false;
      if (dataFimStr && v.data > dataFimStr) return false;
      return true;
    });
  }, [vendasDiarias, temFiltroPeriodo, dataInicioStr, dataFimStr]);

  // Métricas do período (quando filtro ativo, usa vendas_diarias; senão, usa vendas mensais)
  const { totalVendas, totalBruto, juros, totaisPorCategoria, totalComissoes, totalVendedores, mediaComissao, ranking } = useMemo(() => {
    if (temFiltroPeriodo) {
      // Usar vendas diárias filtradas
      const nomesCadastrados = registeredNames;
      
      let smartphones = 0, acessorios = 0, servicos = 0, cases = 0, pelicula = 0, assistenciaTecnica = 0, geral = 0, totalGeral = 0;
      const vendedorTotals: Record<string, { nome: string; loja: string; lojaId: string; total: number; vendas: number; smartphones: number; acessorios: number; cases: number; pelicula: number; servicos: number; geral: number }> = {};
      
      vendasDiariasFiltradas.forEach(v => {
        const normalizedName = v.vendedor_nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const detalhes = ((v as any).detalhes || {}) as Record<string, number>;
        
        // Usar as categorias granulares do detalhes JSON para consistência com o mensal
        const smVal = (Number(detalhes['BONIFICADO LC']) || 0) + (Number(detalhes['SUPER BONIFICADO']) || 0) + (Number(detalhes['ANATEL']) || 0);
        const accVal = Number(detalhes['ACESSÓRIOS']) || 0;
        const casesVal = Number(detalhes['CASES']) || 0;
        const pelVal = Number(detalhes['PELÍCULA']) || 0;
        const svcVal = (Number(detalhes['PROTEÇÃO LÍDER']) || 0) + (Number(detalhes['GARANTIA ESTENDIDA']) || 0);
        const atVal = Number(detalhes['ASSISTÊNCIA TÉCNICA']) || 0;
        const gerVal = (Number(detalhes['GERAL']) || (Number((v as any).geral) || 0));
        
        // Usar VALOR REAL (S/ JUROS) se disponível, caso contrário usar a soma das categorias
        const vtVal = (Number(detalhes['VALOR REAL (S/ JUROS)']) || 0) || (smVal + accVal + casesVal + pelVal + svcVal + atVal + gerVal);
        
        totalGeral += vtVal;
        smartphones += smVal;
        acessorios += accVal;
        cases += casesVal;
        servicos += svcVal;
        pelicula += pelVal;
        assistenciaTecnica += atVal;
        geral += gerVal;
        
        // No ranking, incluímos o vendedor mesmo que não esteja "cadastrado" como colaborador formal
        // (Isso garante que o IGOR apareça se houver filtro de data, por exemplo)
        const key = v.vendedor_nome.trim().toUpperCase();
        if (!vendedorTotals[key]) {
          vendedorTotals[key] = { nome: key, loja: LOJAS[v.loja_id as keyof typeof LOJAS] || v.loja_id, lojaId: v.loja_id, total: 0, vendas: 0, smartphones: 0, acessorios: 0, cases: 0, pelicula: 0, servicos: 0, geral: 0 };
        }
        vendedorTotals[key].total += vtVal;
        vendedorTotals[key].vendas += 1;
        vendedorTotals[key].smartphones += smVal;
        vendedorTotals[key].acessorios += accVal;
        vendedorTotals[key].cases += casesVal;
        vendedorTotals[key].pelicula += pelVal;
        vendedorTotals[key].servicos += svcVal;
        vendedorTotals[key].geral += gerVal;
      });
      
      const registeredVendedores = new Set(vendasDiariasFiltradas.filter(v => {
        const normalizedName = v.vendedor_nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return nomesCadastrados.has(normalizedName);
      }).map(v => v.vendedor_nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
      
      // Quando filtrado por período, as comissões não podem ser filtradas por dia na DB
      // Para manter precisão, mostramos 0 ou avisamos que é mensal
      const totalComissoesVal = filteredComissoes.reduce((sum, c) => sum + Number(c.comissao_base) + Number(c.bonus_automatico) + Number(c.bonus_manual), 0); 
      
      const totalBrutoFiltrado = vendasDiariasFiltradas.reduce((sum, v) => sum + (Number((v as any).valor_bruto) || 0), 0);
      return {
        totalVendas: totalGeral,
        totalBruto: totalBrutoFiltrado,
        juros: Math.max(0, totalBrutoFiltrado - totalGeral),
        totaisPorCategoria: { smartphones, acessorios, cases, servicos, pelicula, assistenciaTecnica, geral },
        totalComissoes: totalComissoesVal,
        totalVendedores: registeredVendedores.size,
        mediaComissao: 0,
        ranking: Object.values(vendedorTotals).sort((a, b) => b.total - a.total).slice(0, 10),
      };
    }
    
    // Sem filtro de período: usar vendas mensais (comportamento original)
    const allVendasList = vendas || [];
    const tv = allVendasList.reduce((sum, v) => {
      const detalhes = v.detalhes as Record<string, number>;
      // Preferir o VALOR REAL (S/ JUROS) se disponível no JSON de detalhes
      const valorReal = Number(detalhes['VALOR REAL (S/ JUROS)']);
      if (detalhes && !isNaN(valorReal) && valorReal > 0) {
        return sum + valorReal;
      }
      // Se não tiver VALOR REAL, somar as categorias (incluindo GERAL)
      return sum + Object.entries(detalhes || {}).reduce((s, [key, val]) => {
        const upperKey = key.toUpperCase();
        if (key !== '_upload_source' && typeof val === 'number' && !isIgnoredColumn(upperKey)) return s + val;
        return s;
      }, 0);
    }, 0);
    const tc = filteredComissoes.reduce((sum, c) => sum + Number(c.comissao_base) + Number(c.bonus_automatico) + Number(c.bonus_manual), 0);
    const tvCount = new Set(filteredVendas.map(v => v.vendedor_nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""))).size;
    
    const catTotals = allVendasList.reduce((acc, v) => {
      const detalhes = v.detalhes as Record<string, number>;
      return {
        smartphones: acc.smartphones + (Number(detalhes?.['BONIFICADO LC']) || 0) + (Number(detalhes?.['SUPER BONIFICADO']) || 0) + (Number(detalhes?.['ANATEL']) || 0),
        acessorios: acc.acessorios + (Number(detalhes?.['ACESSÓRIOS']) || 0),
        cases: acc.cases + (Number(detalhes?.['CASES']) || 0),
        servicos: acc.servicos + (Number(detalhes?.['PROTEÇÃO LÍDER']) || 0) + (Number(detalhes?.['GARANTIA ESTENDIDA']) || 0),
        pelicula: acc.pelicula + (Number(detalhes?.['PELÍCULA']) || 0),
        assistenciaTecnica: acc.assistenciaTecnica + (Number(detalhes?.['ASSISTÊNCIA TÉCNICA']) || 0),
        geral: acc.geral + (Number(detalhes?.['GERAL']) || (Number((v as any).geral) || 0)),
      };
    }, { smartphones: 0, acessorios: 0, cases: 0, servicos: 0, pelicula: 0, assistenciaTecnica: 0, geral: 0 });
    
    const vTotals: Record<string, { nome: string; lojas: Set<string>; total: number; vendas: number; smartphones: number; acessorios: number; cases: number; pelicula: number; servicos: number; geral: number; primaryLojaId: string }> = {};
    filteredVendas.forEach(v => {
      const key = v.vendedor_nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const detalhes = v.detalhes as Record<string, number>;
      if (!vTotals[key]) {
        vTotals[key] = { nome: key, lojas: new Set([v.loja_id]), total: 0, vendas: 0, smartphones: 0, acessorios: 0, cases: 0, pelicula: 0, servicos: 0, geral: 0, primaryLojaId: v.loja_id };
      } else {
        vTotals[key].lojas.add(v.loja_id);
      }
      const valorRealVendedor = Number(detalhes?.['VALOR REAL (S/ JUROS)']);
      const calculatedTotal = (!isNaN(valorRealVendedor) && valorRealVendedor > 0) ? valorRealVendedor : Object.entries(detalhes || {}).reduce((s, [k, val]) => {
        const upperK = k.toUpperCase();
        if (k !== '_upload_source' && typeof val === 'number' && !isIgnoredColumn(upperK)) return s + val;
        return s;
      }, 0);
      vTotals[key].total += calculatedTotal;
      vTotals[key].vendas += 1;
      vTotals[key].smartphones += (Number(detalhes?.['BONIFICADO LC']) || 0) + (Number(detalhes?.['SUPER BONIFICADO']) || 0) + (Number(detalhes?.['ANATEL']) || 0);
      vTotals[key].acessorios += (Number(detalhes?.['ACESSÓRIOS']) || 0);
      vTotals[key].cases += (Number(detalhes?.['CASES']) || 0);
      vTotals[key].pelicula += (Number(detalhes?.['PELÍCULA']) || 0);
      vTotals[key].servicos += (Number(detalhes?.['PROTEÇÃO LÍDER']) || 0) + (Number(detalhes?.['GARANTIA ESTENDIDA']) || 0);
      vTotals[key].geral += (Number(detalhes?.['GERAL']) || (Number((v as any).geral) || 0));
    });
    
    const totalBrutoMensal = allVendasList.reduce((sum, v) => sum + (Number((v as any).valor_bruto) || 0), 0);
    return {
      totalVendas: tv,
      totalBruto: totalBrutoMensal,
      juros: Math.max(0, totalBrutoMensal - tv),
      totaisPorCategoria: catTotals,
      totalComissoes: tc,
      totalVendedores: tvCount,
      mediaComissao: tvCount > 0 ? tc / tvCount : 0,
      ranking: Object.values(vTotals).map(item => ({
        ...item,
        loja: item.lojas.size > 1 ? 'Multiloja' : (LOJAS[Array.from(item.lojas)[0] as keyof typeof LOJAS] || Array.from(item.lojas)[0]),
        lojaId: item.lojas.size > 1 ? 'multiloja' : item.primaryLojaId,
      })).sort((a, b) => b.total - a.total).slice(0, 10),
    };
  }, [temFiltroPeriodo, vendasDiariasFiltradas, vendas, filteredVendas, filteredComissoes, colaboradores]);

  // Metas da loja
  const isSoledadeMonteiro = isLojaSoledadeMonteiro(effectiveLoja);
  const isCampinaNatal = isLojaCampinaNatal(effectiveLoja);
  
  // Extrair config numérica do hook
  const numericConfig = config?.numericConfig || {};
  
  // Soledade/Monteiro: Meta Prata = tudo exceto GERAL, Meta Ouro = tudo exceto GERAL e Serviços
  // Campina/Natal: Meta Prata = gerente_meta_prata, Meta Ouro = prata + X%
  const metaPrata = isSoledadeMonteiro 
    ? (numericConfig?.loja_meta_prata || 55000)
    : isCampinaNatal 
      ? (numericConfig?.gerente_meta_prata || 0)
      : 0;
  const metaOuro = isSoledadeMonteiro 
    ? (numericConfig?.loja_meta_ouro || 65000)
    : isCampinaNatal 
      ? metaPrata * (1 + (numericConfig?.gerente_meta_ouro_acrescimo || 10) / 100)
      : 0;
  const bonusPrata = numericConfig?.loja_bonus_meta_prata || 200;
  const bonusOuro = numericConfig?.loja_bonus_meta_ouro || 300;
  
  // Total para comparação com metas
  // Soledade/Monteiro: Meta Prata = smartphones + serviços + acessórios + cases + película + assistência (sem GERAL)
  // Soledade/Monteiro: Meta Ouro = smartphones + acessórios + cases + película + assistência (sem serviços e sem GERAL)
  // Campina/Natal: Meta Prata = smartphones + serviços; Meta Ouro = apenas smartphones
  const totalParaMetaPrata = isSoledadeMonteiro 
    ? totaisPorCategoria.smartphones + totaisPorCategoria.servicos + totaisPorCategoria.acessorios + totaisPorCategoria.cases + totaisPorCategoria.pelicula + totaisPorCategoria.assistenciaTecnica
    : isCampinaNatal
      ? totaisPorCategoria.smartphones + totaisPorCategoria.servicos // Natal meta prata: SMART + SERVICO (sem pelicula)
      : totaisPorCategoria.smartphones + totaisPorCategoria.servicos;
  const totalParaMetaOuro = isSoledadeMonteiro
    ? totaisPorCategoria.smartphones + totaisPorCategoria.acessorios + totaisPorCategoria.cases + totaisPorCategoria.pelicula + totaisPorCategoria.assistenciaTecnica
    : totaisPorCategoria.smartphones;

  const mesBounds = useMemo(() => {
    if (!selectedMes) return { start: undefined, end: undefined };
    const [ano, mesNum] = selectedMes.split('-').map(Number);
    const start = new Date(ano, mesNum - 1, 1);
    const end = new Date(ano, mesNum, 0);
    return { start, end };
  }, [selectedMes]);

  const temFiltroAtivo = dataInicio || dataFim;
  const periodoLabel = useMemo(() => {
    if (dataInicio && dataFim) return `${format(dataInicio, 'dd/MM')} até ${format(dataFim, 'dd/MM')}`;
    if (dataInicio) return `A partir de ${format(dataInicio, 'dd/MM')}`;
    if (dataFim) return `Até ${format(dataFim, 'dd/MM')}`;
    return '';
  }, [dataInicio, dataFim]);

  const limparFiltros = () => { setDataInicio(undefined); setDataFim(undefined); };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const { error } = await supabase.functions.invoke('sync-tenfront', {
        body: {},
      });
      if (error) throw error;
      toast.success('Sincronização iniciada com sucesso! Os dados serão atualizados em alguns instantes.');
    } catch (error) {
      console.error('Erro na sincronização manual:', error);
      toast.error('Falha ao iniciar sincronização.');
    } finally {
      setIsSyncing(false);
    }
  };

  if (loadingVendas || loadingComissoes) {
    return <LoadingOverlay />;
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in">
      {/* Indicador de consumo da API Tenfront — apenas admin/supervisão */}
      {isAdmin && <SyncStatusBar />}

      {/* Filters - apenas para admin */}
      {!colaboradorLojaId && (
        <Card className="!animate-none">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
              <select
                value={selectedLoja || ''}
                onChange={(e) => setSelectedLoja(e.target.value || null)}
                className="h-10 px-4 rounded-lg border border-border bg-card/50 text-foreground text-sm focus:ring-2 focus:ring-primary/30 w-full sm:w-auto"
              >
                <option value="">Todas as Lojas</option>
                {LOJAS_IDS.map(id => (
                  <option key={id} value={id}>{LOJAS[id]}</option>
                ))}
              </select>
              <Input
                type="month"
                value={selectedMes}
                onChange={(e) => setSelectedMes(e.target.value)}
                className="w-full sm:max-w-[200px]"
              />
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Filtro de mês para colaborador */}
      {colaboradorLojaId && (
        <Card className="!animate-none">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
              <span className="text-sm text-muted-foreground">Loja: <strong className="text-foreground">{LOJAS[colaboradorLojaId as keyof typeof LOJAS]}</strong></span>
              <Input
                type="month"
                value={selectedMes}
                onChange={(e) => setSelectedMes(e.target.value)}
                className="w-full sm:max-w-[200px]"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtro de Período */}
      <Card className="!animate-none">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Período:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal text-sm border-border/60 bg-card/50", !dataInicio && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                  {dataInicio ? format(dataInicio, 'dd/MM/yyyy') : 'Data início'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dataInicio} onSelect={setDataInicio}
                  disabled={(date) => {
                    if (mesBounds.start && date < mesBounds.start) return true;
                    if (mesBounds.end && date > mesBounds.end) return true;
                    if (dataFim && date > dataFim) return true;
                    return false;
                  }}
                  defaultMonth={mesBounds.start} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            <span className="text-sm text-muted-foreground">até</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal text-sm border-border/60 bg-card/50", !dataFim && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                  {dataFim ? format(dataFim, 'dd/MM/yyyy') : 'Data fim'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dataFim} onSelect={setDataFim}
                  disabled={(date) => {
                    if (mesBounds.start && date < mesBounds.start) return true;
                    if (mesBounds.end && date > mesBounds.end) return true;
                    if (dataInicio && date < dataInicio) return true;
                    return false;
                  }}
                  defaultMonth={mesBounds.start} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            {temFiltroAtivo && (
              <>
                <Button variant="ghost" size="sm" onClick={limparFiltros} className="text-xs">Limpar filtros</Button>
                <Badge variant="secondary" className="text-xs">{periodoLabel}</Badge>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Status das Metas */}
      {effectiveLoja && isSoledadeMonteiro && (
        <MetaStatusCard
          totalParaPrata={totalParaMetaPrata}
          totalParaOuro={totalParaMetaOuro}
          metaPrata={metaPrata}
          metaOuro={metaOuro}
          bonusPrata={bonusPrata}
          bonusOuro={bonusOuro}
          totalFaturado={totalVendas}
          totalBruto={totalBruto > 0 ? totalBruto : undefined}
        />
      )}

      {effectiveLoja && isCampinaNatal && (
        <MetaStatusCard
          totalParaPrata={totalParaMetaPrata}
          totalParaOuro={totalParaMetaOuro}
          metaPrata={metaPrata}
          metaOuro={metaOuro}
          bonusPrata={0}
          bonusOuro={numericConfig?.loja_bonus_meta_ouro || 200}
          totalFaturado={totalVendas}
          totalBruto={totalBruto > 0 ? totalBruto : undefined}
        />
      )}

      {/* Vendas do Dia por Loja */}
      <DailyStoreSalesCards 
        vendasDiarias={vendasDiarias} 
        selectedMes={selectedMes} 
        allConfigs={allConfigs}
      />

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 gradient-primary" />
          <CardContent className="p-3 sm:p-6">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wide mb-1 sm:mb-2 truncate">Faturamento</p>
                <div className="space-y-1.5">
                  <div>
                    <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">Líquido (s/ juros)</p>
                    <p className="text-lg sm:text-2xl font-bold text-gradient truncate">{formatCurrency(totalVendas)}</p>
                  </div>
                  {totalBruto > 0 && juros > 0 && (
                    <div className="border-t border-border/30 pt-1.5">
                      <p className="text-[10px] text-amber-400/80 uppercase tracking-wide">Bruto (c/ juros)</p>
                      <p className="text-base sm:text-xl font-bold text-amber-400 truncate">{formatCurrency(totalBruto)}</p>
                      <p className="text-[10px] text-muted-foreground/60 truncate">+{formatCurrency(juros)} ({((juros / totalBruto) * 100).toFixed(1)}%)</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-1.5 sm:p-2 bg-muted rounded-lg flex-shrink-0"><TrendingUp className="text-primary" /></div>
            </div>
          </CardContent>
        </Card>
        <MetricCard
          icon={<DollarSign className="text-success" />}
          label="Total Comissões"
          value={temFiltroAtivo ? '---' : formatCurrency(totalComissoes)}
          subtitle={temFiltroAtivo ? 'Disponível apenas no mensal' : (totalComissoes === 0 ? 'Execute o cálculo' : undefined)}
        />
        <MetricCard
          icon={<Users className="text-primary" />}
          label="Vendedores"
          value={String(totalVendedores)}
        />
        <MetricCard
          icon={<Award className="text-warning" />}
          label="Comissão Média"
          value={temFiltroAtivo ? '---' : formatCurrency(mediaComissao)}
          subtitle={temFiltroAtivo ? 'Disponível apenas no mensal' : (mediaComissao === 0 ? 'Execute o cálculo' : undefined)}
        />
      </div>

      {/* Totais por Categoria */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <Smartphone className="text-blue-500 flex-shrink-0" size={18} />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground uppercase truncate">Smartphones</p>
                <p className="text-sm sm:text-lg font-bold truncate">{formatCurrency(totaisPorCategoria.smartphones)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <ShoppingBag className="text-green-500 flex-shrink-0" size={18} />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground uppercase truncate">Acessórios</p>
                <p className="text-sm sm:text-lg font-bold truncate">{formatCurrency(totaisPorCategoria.acessorios)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-pink-500">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <ShoppingBag className="text-pink-500 flex-shrink-0" size={18} />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground uppercase truncate">Cases</p>
                <p className="text-sm sm:text-lg font-bold truncate">{formatCurrency(totaisPorCategoria.cases)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-[18px] h-[18px] rounded bg-orange-500/20 flex items-center justify-center text-orange-500 text-xs font-bold flex-shrink-0">P</div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground uppercase truncate">Película</p>
                <p className="text-sm sm:text-lg font-bold truncate">{formatCurrency(totaisPorCategoria.pelicula)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <Shield className="text-purple-500 flex-shrink-0" size={18} />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground uppercase truncate">Serviços</p>
                <p className="text-sm sm:text-lg font-bold truncate">{formatCurrency(totaisPorCategoria.servicos)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-slate-500">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <ShoppingBag className="text-slate-500 flex-shrink-0" size={18} />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground uppercase truncate">Geral</p>
                <p className="text-sm sm:text-lg font-bold truncate">{formatCurrency(totaisPorCategoria.geral)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        {juros > 0 && (
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <Percent className="text-amber-500 flex-shrink-0" size={18} />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground uppercase truncate">Juros Parcelamento</p>
                  <p className="text-sm sm:text-lg font-bold truncate text-amber-400">{formatCurrency(juros)}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {totalBruto > 0 ? `${((juros / totalBruto) * 100).toFixed(1)}% do bruto` : ''}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Gráfico de Vendas Diárias */}
      {effectiveLoja ? (
        <VendasDiariasChart lojaId={effectiveLoja} mes={selectedMes} dataInicio={dataInicioStr} dataFim={dataFimStr} />
      ) : (
        LOJAS_IDS.map(lojaId => (
          <VendasDiariasChart key={lojaId} lojaId={lojaId} mes={selectedMes} dataInicio={dataInicioStr} dataFim={dataFimStr} />
        ))
      )}

      {/* Gráfico Smartphones vs Serviços */}
      {effectiveLoja ? (
        <SmartServicosChart lojaId={effectiveLoja} mes={selectedMes} dataInicio={dataInicioStr} dataFim={dataFimStr} />
      ) : (
        LOJAS_IDS.map(lojaId => (
          <SmartServicosChart key={lojaId} lojaId={lojaId} mes={selectedMes} dataInicio={dataInicioStr} dataFim={dataFimStr} />
        ))
      )}

      {/* Histórico 6 meses */}
      <HistoricoLojaChart selectedMes={selectedMes} lojaId={effectiveLoja} />

      {/* Comparativo de Lojas (só quando todas as lojas estão selecionadas) */}
      {!effectiveLoja && (
        <LojaComparativoTable
          selectedMes={selectedMes}
          allConfigs={allConfigs}
          vendasMensais={(vendas || []) as any}
          vendasDiarias={vendasDiarias}
        />
      )}

      {/* Ranking Vendas */}
      <Card>
        <CardHeader className="pb-4 border-b border-border/50 p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <span className="text-primary">#</span> Top Colaboradores (Vendas)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {ranking.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">
              Nenhum dado de colaboradores cadastrados para o período.
            </p>
          ) : (
            <div className="divide-y divide-border/50">
              {ranking.map((item, index) => {
                const lojaConfig = allConfigs?.[item.lojaId]?.numericConfig;
                const faltaFase = lojaConfig ? (() => {
                  const f1 = lojaConfig.servicos_meta_fase1 || 1500;
                  const f2 = lojaConfig.servicos_meta_fase2 || 2000;
                  const f3 = lojaConfig.servicos_meta_fase3 || 2500;
                  const s = item.servicos;
                  if (s >= f3) return { label: '✓ F3 — Máximo', color: 'text-success' };
                  if (s >= f2) return { label: `✓F2 · Falta ${formatCurrency(f3 - s)} p/ F3`, color: 'text-amber-400' };
                  if (s >= f1) return { label: `✓F1 · Falta ${formatCurrency(f2 - s)} p/ F2`, color: 'text-amber-400/70' };
                  return { label: `Falta ${formatCurrency(f1 - s)} p/ F1`, color: 'text-destructive/70' };
                })() : null;

                return (
                  <div key={item.nome} className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-accent/50 transition-colors">
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 ${
                      index === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-black' :
                      index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-black' :
                      index === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-white' :
                      'bg-muted border border-border text-muted-foreground'
                    }`}>
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm sm:text-base truncate">{item.nome}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">{item.loja}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs mt-1">
                        <span className="text-blue-400 font-medium">📱 {formatCurrency(item.smartphones)}</span>
                        <span className="text-purple-400 font-medium">🛡️ {formatCurrency(item.servicos)}</span>
                        <span className="text-green-400">🛍️ {formatCurrency(item.acessorios)}</span>
                        {item.geral > 0 && <span className="text-slate-400 font-medium">📦 GERAL: {formatCurrency(item.geral)}</span>}
                      </div>
                      {faltaFase && (
                        <p className={`text-[10px] font-semibold mt-0.5 ${faltaFase.color}`}>
                          Serv: {faltaFase.label}
                        </p>
                      )}
                    </div>
                    <p className="text-sm sm:text-lg font-semibold text-primary flex-shrink-0">{formatCurrency(item.total)}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ranking Botons */}
      <RankingBotons />
    </div>
  );
};

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
}

const MetricCard = ({ icon, label, value, subtitle }: MetricCardProps) => (
  <Card className="relative overflow-hidden">
    <div className="absolute left-0 top-0 bottom-0 w-1 gradient-primary" />
    <CardContent className="p-3 sm:p-6">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wide mb-1 sm:mb-2 truncate">{label}</p>
          {subtitle && <p className="text-xs text-muted-foreground/70 italic mb-1">{subtitle}</p>}
          <p className="text-lg sm:text-2xl font-bold text-gradient truncate">{value}</p>
        </div>
        <div className="p-1.5 sm:p-2 bg-muted rounded-lg flex-shrink-0">{icon}</div>
      </div>
    </CardContent>
  </Card>
);
