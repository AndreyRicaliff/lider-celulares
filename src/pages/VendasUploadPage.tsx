import { useState, useCallback, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { useAppStore } from '@/store/appStore';
import { useColaboradores } from '@/hooks/useColaboradores';
import { useSaveVendas, useVendas } from '@/hooks/useVendas';
import { useComissoes, useSaveComissoes } from '@/hooks/useComissoes';
import { useConfiguracao } from '@/hooks/useConfiguracoes';
import { useCalculateBoton } from '@/hooks/useBotons';
import { useVendasDiarias, useSaveVendasDiarias, calcularVendasDoDia } from '@/hooks/useVendasDiarias';
import { LOJAS, getDefaultConfig, isVendedorExcluido, getAjusteBonusPercentual, getVendorNameMapping, getVendorConfigOverrides, getFixedPayrollOverride, isIgnoredColumn, isLojaExcluidaBotons } from '@/lib/constants';
import { isLojaCampinaNatal, isLojaSoledadeMonteiro, isLojaNatalLike } from '@/lib/lojaRules';
import { formatCurrency, getDaysInMonth, getCurrentDayOfMonth, getCurrentMonth } from '@/lib/formatters';
import { getDiasUteisNoMes, getDiasUteisDecorridos } from '@/lib/dateUtils';
import { parseCurrency, calcularComissaoSoledadeMonteiro, calcularComissaoCampinaNatal, calcularComissaoGerente, calcularDescontosDividas, calcularBonusMetaLojaSoledadeMonteiro } from '@/lib/comissaoCalculator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, Calculator, Trash2, Save, BarChart3, Database, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { AnaliseMetasModal } from '@/components/vendas/AnaliseMetasModal';
import { PreVisualizacaoVendas } from '@/components/vendas/PreVisualizacaoVendas';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { format, lastDayOfMonth, parse, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';

interface StagedRow {
  VENDEDOR: string;
  _origem?: string;
  [key: string]: string | number | undefined;
}

interface VendasUploadPageProps {
  gerenteLojaId?: string;
  readOnly?: boolean;
  isVendedor?: boolean;
}

export const VendasUploadPage = ({ gerenteLojaId, readOnly, isVendedor }: VendasUploadPageProps) => {
  const queryClient = useQueryClient();
  const { selectedLoja, selectedMes, setSelectedMes } = useAppStore();
  const lojaId = gerenteLojaId || selectedLoja || 'soledade';
  const isSoledadeMonteiro = isLojaSoledadeMonteiro(lojaId);
  const isTenfrontLoja = false; // Natal Tenfront desabilitada
  const isNatalUnificada = false; // Desabilitada - Natal usa apenas upload
  
  const { ask: askConfirm, confirmDialogProps } = useConfirmDialog();

  const [stagedData, setStagedData] = useState<StagedRow[]>([]);
  const [stagedDataTenfront, setStagedDataTenfront] = useState<StagedRow[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isAnaliseOpen, setIsAnaliseOpen] = useState(false);
  const [isSyncingTenfront, setIsSyncingTenfront] = useState(false);
  const [vendedorNome, setVendedorNome] = useState<string | null>(null);
  
  const hasSegundoUpload = ['monteiro', 'soledade', 'natal', 'campina-grande'].includes(lojaId);
  
  const { data: colaboradores = [] } = useColaboradores(lojaId);
  const { data: config } = useConfiguracao(lojaId, selectedMes);
  const { data: vendasSalvas = [] } = useVendas(lojaId, selectedMes);
  const { data: comissoesExistentes = [] } = useComissoes(lojaId, selectedMes);
  const saveVendas = useSaveVendas();
  const saveComissoes = useSaveComissoes();
  const calculateBoton = useCalculateBoton();
  const { data: vendasDiariasAnteriores = [] } = useVendasDiarias(lojaId, selectedMes);
  const saveVendasDiarias = useSaveVendasDiarias();
  const { data: todosColaboradores = [] } = useColaboradores();


  // Limpa dados quando muda de loja ou mês
  useEffect(() => {
    setStagedData([]);
    setStagedDataTenfront([]);
  }, [lojaId, selectedMes]);

  // Fetch vendedor name when isVendedor
  useEffect(() => {
    if (!isVendedor) return;
    const fetchName = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: colabId } = await supabase.rpc('get_colaborador_id', { _user_id: user.id });
        if (colabId) {
          const { data: colab } = await supabase.from('colaboradores').select('nome').eq('id', colabId).single();
          if (colab) setVendedorNome(colab.nome);
        }
      }
    };
    fetchName();
  }, [isVendedor]);

  const normalizeName = useCallback((value: string) => (
    value
      .trim()
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  ), []);

  const STANDARD_CATEGORY_HEADERS = [
    'VENDEDOR',
    'BONIFICADO LC',
    'SUPER BONIFICADO',
    'ANATEL',
    'CASES',
    'PELÍCULA',
    'ACESSÓRIOS',
    'GERAL',
    'PROTEÇÃO LÍDER',
    'GARANTIA ESTENDIDA',
    'ASSISTÊNCIA TÉCNICA',
    'VALOR REAL (S/ JUROS)',
  ];

  const mapVendaToStagedRow = useCallback((venda: (typeof vendasSalvas)[number]): StagedRow => {
    const row: StagedRow = { VENDEDOR: venda.vendedor_nome };

    if (isNatalUnificada) {
      row._origem = 'Natal';
    }

    const detalhes = venda.detalhes as Record<string, unknown>;
    Object.entries(detalhes).forEach(([key, value]) => {
      const normalizedKey = key.toUpperCase();
      if (
        key !== '_upload_source' &&
        !normalizedKey.startsWith('__') &&
        typeof value === 'number' &&
        STANDARD_CATEGORY_HEADERS.includes(normalizedKey)
      ) {
        row[normalizedKey] = value;
      }
    });

    return row;
  }, [isNatalUnificada, vendasSalvas]);

  // Carrega dados do banco quando disponíveis, separando por origem de upload
  useEffect(() => {
    if (vendasSalvas.length > 0) {
      if (hasSegundoUpload) {
        const upload1 = vendasSalvas.filter(v => {
          const d = v.detalhes as Record<string, unknown>;
          return !d._upload_source || d._upload_source === 'upload1';
        });
        const upload2 = vendasSalvas.filter(v => {
          const d = v.detalhes as Record<string, unknown>;
          return d._upload_source === 'upload_tenfront';
        });
        setStagedData(upload1.map(mapVendaToStagedRow));
        setStagedDataTenfront(upload2.map(mapVendaToStagedRow));
      } else {
        setStagedData(vendasSalvas.map(mapVendaToStagedRow));
      }
    }
  }, [vendasSalvas, mapVendaToStagedRow, hasSegundoUpload]);

  // Dados combinados (soma) quando há segundo upload
  const combinedData = useMemo((): StagedRow[] => {
    if (!hasSegundoUpload || stagedDataTenfront.length === 0) return stagedData;
    
    const merged: Record<string, StagedRow> = {};
    
    const addRows = (rows: StagedRow[]) => {
      rows.forEach(row => {
        const nomeNormalizado = normalizeName(row.VENDEDOR);
        if (!merged[nomeNormalizado]) {
          merged[nomeNormalizado] = { VENDEDOR: row.VENDEDOR.trim() };
        }
        Object.entries(row).forEach(([key, value]) => {
          if (key !== 'VENDEDOR' && key !== '_origem' && typeof value === 'number') {
            merged[nomeNormalizado][key] = ((merged[nomeNormalizado][key] as number) || 0) + value;
          }
        });
      });
    };
    
    addRows(stagedData);
    addRows(stagedDataTenfront);
    
    return Object.values(merged);
  }, [stagedData, stagedDataTenfront, hasSegundoUpload]);

  // Para Natal unificada: se houver upload manual (sem origem Tenfront no stage),
  // agrega automaticamente os dados salvos da Tenfront para análise/comissões.
  const stagedDataUnificadaParaCalculo = useMemo(() => {
    // Se tem segundo upload, usar os dados combinados
    if (hasSegundoUpload && stagedDataTenfront.length > 0) return combinedData;
    
    if (!isNatalUnificada || stagedData.length === 0) return stagedData;

    const jaPossuiTenfront = stagedData.some(row => row._origem === 'Tenfront');
    if (jaPossuiTenfront) return stagedData;

    const rowsTenfront = vendasSalvas
      .filter(venda => false) // Natal Tenfront desativada
      .map(mapVendaToStagedRow);

    return rowsTenfront.length > 0 ? [...stagedData, ...rowsTenfront] : stagedData;
  }, [isNatalUnificada, hasSegundoUpload, stagedData, stagedDataTenfront, combinedData, vendasSalvas, mapVendaToStagedRow]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        
        const filteredRows = jsonData.filter(row => 
          row.VENDEDOR && String(row.VENDEDOR).trim().toLowerCase() !== 'total'
        );
        
        const processedData = filteredRows.map(row => {
          const processed: StagedRow = { VENDEDOR: '' };
          Object.entries(row).forEach(([key, value]) => {
            const upperKey = key.toUpperCase().trim();
            if (!['LOJA', 'VENDAS (A)', 'DEVOLUÇÕES (B)', 'TOTAL (A-B)'].includes(upperKey)) {
              if (upperKey === 'VENDEDOR') {
                // Aplicar mapeamento de nomes temporário
                const nomeOriginal = String(value);
                processed[upperKey] = getVendorNameMapping(lojaId, selectedMes, nomeOriginal);
              } else {
                processed[upperKey] = parseCurrency(value);
              }
            }
          });
          return processed;
        });
        
        setStagedData(processedData);
        toast.success(`${processedData.length} registros carregados para visualização`);
      } catch (error) {
        console.error('Erro ao processar arquivo:', error);
        toast.error('Erro ao processar o arquivo. Verifique o formato.');
      }
    };
    reader.readAsArrayBuffer(file);
  }, [lojaId, selectedMes]);

  const handleTenfrontFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        
        const filteredRows = jsonData.filter(row => 
          row.VENDEDOR && String(row.VENDEDOR).trim().toLowerCase() !== 'total'
        );
        
        const processedData = filteredRows.map(row => {
          const processed: StagedRow = { VENDEDOR: '' };
          Object.entries(row).forEach(([key, value]) => {
            const upperKey = key.toUpperCase().trim();
            if (!['LOJA', 'VENDAS (A)', 'DEVOLUÇÕES (B)', 'TOTAL (A-B)'].includes(upperKey)) {
              if (upperKey === 'VENDEDOR') {
                const nomeOriginal = String(value);
                processed[upperKey] = getVendorNameMapping(lojaId, selectedMes, nomeOriginal);
              } else {
                processed[upperKey] = parseCurrency(value);
              }
            }
          });
          return processed;
        });
        
        setStagedDataTenfront(processedData);
        toast.success(`${processedData.length} registros Tenfront carregados`);
      } catch (error) {
        console.error('Erro ao processar arquivo Tenfront:', error);
        toast.error('Erro ao processar o arquivo Tenfront. Verifique o formato.');
      }
    };
    reader.readAsArrayBuffer(file);
  }, [lojaId, selectedMes]);

  const clearData = () => {
    setStagedData([]);
    setStagedDataTenfront([]);
    toast.success('Dados limpos');
  };

  const syncTenfrontData = async () => {
    setIsSyncingTenfront(true);

    try {
      const { data, error } = await supabase.functions.invoke('sync-tenfront', {
        body: { mes: selectedMes },
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      await queryClient.invalidateQueries({ queryKey: ['vendas', lojaId, selectedMes] });
      await queryClient.refetchQueries({ queryKey: ['vendas', lojaId, selectedMes] });

      toast.success(`${data?.synced ?? 0} vendas sincronizadas da Tenfront.`);
      
      // Auto-recalculate commissions after sync if not in read-only mode
      if (!readOnly) {
        setTimeout(() => {
          calculateCommissions();
        }, 500);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao sincronizar vendas da Tenfront.';
      toast.error(message);
    } finally {
      setIsSyncingTenfront(false);
    }
  };

  const saveData = () => {
    const dataParaSalvar = hasSegundoUpload && stagedDataTenfront.length > 0
      ? combinedData
      : stagedData;

    if (dataParaSalvar.length === 0) {
      toast.warning('Não há dados para salvar');
      return;
    }

    askConfirm(
      `Substituir TODOS os dados de vendas de ${LOJAS[lojaId as keyof typeof LOJAS]} para ${selectedMes}?`,
      async () => {
    try {
      const now = new Date();
      const todayAtNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
      const currentMonthStr = format(todayAtNoon, 'yyyy-MM');
      let hoje = format(todayAtNoon, 'yyyy-MM-dd');
      
      const selectedMonthDate = parse(selectedMes, 'yyyy-MM', new Date());
      const monthEnd = endOfMonth(selectedMonthDate);
      
      // Se o mês selecionado não é o mês atual, fixar a data no último dia do mês selecionado
      if (selectedMes !== currentMonthStr) {
        hoje = format(monthEnd, 'yyyy-MM-dd');
        console.log(`Upload para mês retroativo (${selectedMes}). Ajustando data para o último dia: ${hoje}`);
      } else if (hoje > format(monthEnd, 'yyyy-MM-dd')) {
        // Se a data calculada (hoje) for maior que o último dia do mês selecionado (mesmo sendo mês atual)
        hoje = format(monthEnd, 'yyyy-MM-dd');
      }
      
      const vendasAtuaisPorVendedor: Record<string, { detalhes: Record<string, number>; colaborador_id: string | null; vendedor_nome_oficial?: string }> = {};
      
      // Construir lista de vendas: Upload 1 + Upload Tenfront (com marcador de origem)
      const vendas: Array<{
        loja_id: string;
        vendedor_nome: string;
        colaborador_id: string | null;
        mes: string;
        valor_total: number;
        detalhes: Record<string, unknown>;
      }> = [];

      const buildVendaRows = (rows: StagedRow[], uploadSource: string) => {
        rows.forEach(row => {
          const detalhes: Record<string, unknown> = { _upload_source: uploadSource };
          let valorTotal = 0;
          
          Object.entries(row).forEach(([key, value]) => {
            if (key !== 'VENDEDOR' && key !== '_origem' && typeof value === 'number') {
              detalhes[key] = value;
              if (!isIgnoredColumn(key)) valorTotal += value;
            }
          });
          
          const colaborador = todosColaboradores.find(c => 
            normalizeName(c.nome) === normalizeName(row.VENDEDOR)
          );

          
          vendas.push({
            loja_id: lojaId,
            vendedor_nome: colaborador?.nome || row.VENDEDOR.trim().toUpperCase(),
            colaborador_id: colaborador?.id || null,
            mes: selectedMes,
            valor_total: valorTotal,
            detalhes,
          });
        });
      };

      buildVendaRows(stagedData, 'upload1');
      if (hasSegundoUpload && stagedDataTenfront.length > 0) {
        buildVendaRows(stagedDataTenfront, 'upload_tenfront');
      }

      // Calcular totais combinados para vendas diárias
      dataParaSalvar.forEach(row => {
        const detalhes: Record<string, number> = {};
        Object.entries(row).forEach(([key, value]) => {
          if (key !== 'VENDEDOR' && key !== '_origem' && typeof value === 'number' && !isIgnoredColumn(key)) {
            detalhes[key] = value;
          }
        });
        const colaborador = todosColaboradores.find(c => 
          normalizeName(c.nome) === normalizeName(row.VENDEDOR)
        );
        vendasAtuaisPorVendedor[row.VENDEDOR.trim()] = {
          detalhes,
          colaborador_id: colaborador?.id || null,
          vendedor_nome_oficial: colaborador?.nome || row.VENDEDOR.trim().toUpperCase()
        };

      });

      await saveVendas.mutateAsync({ lojaId, mes: selectedMes, vendas: vendas as any });
      
      const vendasDoDia = calcularVendasDoDia(vendasAtuaisPorVendedor, vendasDiariasAnteriores, hoje);
      
      const vendasDiariasParaSalvar = Object.entries(vendasDoDia)
        .map(([vendedor, dados]) => ({
          loja_id: lojaId,
          mes: selectedMes,
          data: hoje,
          vendedor_nome: (vendasAtuaisPorVendedor[vendedor] as any).vendedor_nome_oficial || vendedor,

          colaborador_id: dados.colaborador_id,
          valor_total: dados.valor_total,
          smartphones: dados.smartphones,
          acessorios: dados.acessorios,
          servicos: dados.servicos,
          geral: dados.geral,
          detalhes: dados.detalhes,
        }));
      
      if (vendasDiariasParaSalvar.length > 0) {
        await saveVendasDiarias.mutateAsync({
          lojaId,
          mes: selectedMes,
          data: hoje,
          vendasDiarias: vendasDiariasParaSalvar,
        });
      }
      
      // Recalcular comissões automaticamente após salvar as vendas
      await calculateCommissions();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar vendas: ' + (error?.message || 'tente novamente'));
    }
      },
      { title: 'Substituir dados de vendas', confirmLabel: 'Substituir', destructive: true }
    );
  };

  const calculateCommissions = async () => {
    const dataToCalculate = stagedData.length > 0 
      ? stagedDataUnificadaParaCalculo 
      : vendasSalvas.map(mapVendaToStagedRow);

    if (dataToCalculate.length === 0) {
      toast.warning('Nenhum dado de vendas para calcular');
      return;
    }

    setIsCalculating(true);
    try {
      // SEGURANÇA: buscar config diretamente do banco para evitar usar defaults
      // quando o React Query ainda não carregou (causava metas erradas para gerentes)
      const lojaBaseConfig = lojaId; // mapLojaToSharedBase é identidade atualmente
      const { data: configRow } = await supabase
        .from('configuracoes')
        .select('config')
        .eq('loja_id', lojaBaseConfig)
        .eq('mes', selectedMes)
        .maybeSingle();

      let configToUse: Record<string, number>;
      if (configRow?.config) {
        const raw = configRow.config as Record<string, unknown>;
        const merged: Record<string, number> = { ...getDefaultConfig(lojaId) };
        Object.entries(raw).forEach(([k, v]) => {
          if (typeof v === 'number') merged[k] = v;
        });
        configToUse = merged;
      } else if (config?.numericConfig && Object.keys(config.numericConfig).length > 0) {
        configToUse = config.numericConfig;
      } else {
        toast.error('Configuração da loja não encontrada para este mês. Configure antes de calcular.');
        setIsCalculating(false);
        return;
      }
      const colaboradoresCalculaveis = colaboradores.filter(c => c.cargo !== 'Gerente');
      const gerente = colaboradores.find(c => c.cargo === 'Gerente');

      // Importante: em recálculos, não confie apenas no estado do React Query (pode estar refetching).
      // Busque do backend as comissões já salvas deste mês/loja para preservar descontos de dívidas.
      const { data: comissoesSalvasNoMes, error: comissoesSalvasError } = await supabase
        .from('comissoes')
        .select('colaborador_id, detalhes')
        .eq('loja_id', lojaId)
        .eq('mes', selectedMes);
      if (comissoesSalvasError) {
        console.warn('Falha ao buscar comissões salvas para recálculo seguro:', comissoesSalvasError);
      }
      const comissoesBaseParaPreservacao = (comissoesSalvasNoMes && comissoesSalvasNoMes.length > 0)
        ? comissoesSalvasNoMes
        : comissoesExistentes;
      
      // Filtra vendedores excluídos por regra especial antes de processar
      const stagedDataParaCalculo = dataToCalculate.filter(row => 
        !isVendedorExcluido(lojaId, selectedMes, row.VENDEDOR.trim())
      );
      
      const vendasPorVendedor: Record<string, Record<string, number>[]> = {};
      stagedDataParaCalculo.forEach(row => {
        const nome = row.VENDEDOR.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (!vendasPorVendedor[nome]) vendasPorVendedor[nome] = [];
        const detalhes: Record<string, number> = {};
        Object.entries(row).forEach(([key, value]) => {
          if (key !== 'VENDEDOR' && !isIgnoredColumn(key)) detalhes[key] = typeof value === 'number' ? value : 0;
        });
        vendasPorVendedor[nome].push(detalhes);
      });

      const comissoes: Array<{
        loja_id: string;
        colaborador_id: string | null;
        vendedor_nome: string;
        cargo: string;
        mes: string;
        salario: number;
        ajuda_custo: number;
        comissao_base: number;
        comissao_detalhada: Json;
        repostagem_venda: number;
        repostagem_comissao: number;
        bonus_automatico: number;
        bonus_manual: number;
        descontos_dividas: number;
        adiantamentos: number;
        descontos: number;
        detalhes: Json;
      }> = [];

      // Recalculation safety: se já existirem comissões salvas para este mês,
      // preserve dívidas já descontadas no mês para não “sumirem” ao recalcular.
      const dividasAplicadasPorColaborador = new Map<string, Array<{ id: string; parcelaAtual: number }>>();
      (comissoesBaseParaPreservacao || []).forEach((c: any) => {
        const colaboradorId = c?.colaborador_id as string | null | undefined;
        if (!colaboradorId) return;
        const detalhes = c?.detalhes as unknown as { dividasInfo?: Array<{ id: string; parcelaAtual?: number }> };
        const lista = Array.isArray(detalhes?.dividasInfo) ? detalhes.dividasInfo : [];
        const normalized = lista
          .filter((d) => !!d?.id)
          .map((d) => ({ id: d.id, parcelaAtual: d.parcelaAtual ?? 1 }));
        if (normalized.length > 0) dividasAplicadasPorColaborador.set(colaboradorId, normalized);
      });
      
      let totalGeralVendasLoja = 0;

      for (const colaborador of colaboradoresCalculaveis) {
        const nomeVendedor = colaborador.nome.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (!vendasPorVendedor[nomeVendedor]) continue;

        const totaisVendedor: Record<string, number> = {};
        let totalVendasColaborador = 0;
        
        vendasPorVendedor[nomeVendedor].forEach(venda => {
          Object.entries(venda).forEach(([coluna, valor]) => {
            const key = coluna.trim().toUpperCase();
            if (!isIgnoredColumn(key)) {
              totaisVendedor[key] = (totaisVendedor[key] || 0) + valor;
              totalVendasColaborador += valor;
            }
          });
        });

        const jaAplicadas = dividasAplicadasPorColaborador.get(colaborador.id);
        const { total: descontosDividas, dividasInfo } = calcularDescontosDividas(
          colaborador.dividas || [],
          selectedMes,
          jaAplicadas
        );

        totalGeralVendasLoja += totalVendasColaborador;

        // Verificar se o colaborador tem folha fixa
        const fixedPayroll = getFixedPayrollOverride(lojaId, selectedMes, nomeVendedor);
        
        if (fixedPayroll !== null) {
          comissoes.push({
            loja_id: lojaId,
            colaborador_id: colaborador.id,
            vendedor_nome: nomeVendedor,
            cargo: colaborador.cargo,
            mes: selectedMes,
            salario: fixedPayroll,
            ajuda_custo: 0,
            comissao_base: 0,
            comissao_detalhada: {} as unknown as Json,
            repostagem_venda: 0,
            repostagem_comissao: 0,
            bonus_automatico: 0,
            bonus_manual: 0,
            descontos_dividas: descontosDividas,
            adiantamentos: 0,
            descontos: 0,
            detalhes: {
              totais: totaisVendedor,
              info: { folhaFixa: true },
              bonusInfo: [],
              dividasInfo,
              vendedorId: colaborador.id,
            } as unknown as Json,
          });
          continue;
        }

        let res;
        // Verificar se há overrides de config para este vendedor
        const vendorOverrides = getVendorConfigOverrides(lojaId, selectedMes, nomeVendedor);
        const configForVendor = vendorOverrides ? { ...configToUse, ...vendorOverrides } : configToUse;
        
        if (lojaId === 'soledade' || lojaId === 'monteiro') {
          res = calcularComissaoSoledadeMonteiro(colaborador, totaisVendedor, configForVendor);
        } else {
          res = calcularComissaoCampinaNatal(colaborador, totaisVendedor, configForVendor, lojaId, selectedMes);
        }

        let bonusAutomatico = 0;
        const bonusInfo: Array<{ descricao: string; valor: number }> = [];
        
        // Bônus de Função VR: apenas para Soledade/Monteiro (não aplicável em Campina Grande/Natal)
        if (colaborador.cargo === 'VR' && (lojaId === 'soledade' || lojaId === 'monteiro')) {
          bonusAutomatico += 200;
          bonusInfo.push({ descricao: 'Bônus de Função (VR)', valor: 200 });
        }

        comissoes.push({
          loja_id: lojaId,
          colaborador_id: colaborador.id,
          vendedor_nome: nomeVendedor,
          cargo: colaborador.cargo,
          mes: selectedMes,
          salario: colaborador.salario,
          ajuda_custo: colaborador.ajuda_custo,
          comissao_base: Number.isFinite(res.comissao) ? Math.max(0, res.comissao) : 0,
          comissao_detalhada: (Object.fromEntries(
            Object.entries(res.comissaoDetalhada || {}).map(([k, v]) => [k, Number.isFinite(v as number) ? v : 0])
          )) as unknown as Json,
          repostagem_venda: 0,
          repostagem_comissao: 0,
          bonus_automatico: Number.isFinite(bonusAutomatico) ? bonusAutomatico : 0,
          bonus_manual: 0,
          descontos_dividas: descontosDividas,
          adiantamentos: 0,
          descontos: 0,
          detalhes: {
            totais: totaisVendedor,
            info: res.info,
            bonusInfo,
            dividasInfo,
            vendedorId: colaborador.id,
          } as unknown as Json,
        });
      }

      // Apply best service bonus
      if (configToUse.bonus_melhor_servico > 0) {
        const elegiveisServico = comissoes.filter(c => {
          const detalhes = c.detalhes as { info?: { atingiuFase3Servico?: boolean } };
          return detalhes?.info?.atingiuFase3Servico && c.cargo !== 'Trainee';
        });
        
        if (elegiveisServico.length > 0) {
          elegiveisServico.sort((a, b) => {
            const detalhesA = a.detalhes as { totais?: Record<string, number> };
            const detalhesB = b.detalhes as { totais?: Record<string, number> };
            const valorA = (detalhesA?.totais?.['PROTEÇÃO LÍDER'] || 0) + (detalhesA?.totais?.['GARANTIA ESTENDIDA'] || 0);
            const valorB = (detalhesB?.totais?.['PROTEÇÃO LÍDER'] || 0) + (detalhesB?.totais?.['GARANTIA ESTENDIDA'] || 0);
            return valorB - valorA;
          });
          
          const vencedor = comissoes.find(c => c.vendedor_nome === elegiveisServico[0].vendedor_nome);
          if (vencedor) {
            const bonusServico = configToUse.bonus_melhor_servico;
            vencedor.bonus_automatico += bonusServico;
            // Adicionar info do bônus serviço ao bonusInfo - modificar diretamente o objeto
            const detalhes = vencedor.detalhes as { bonusInfo?: Array<{ descricao: string; valor: number }> };
            if (!detalhes.bonusInfo) {
              detalhes.bonusInfo = [];
            }
            detalhes.bonusInfo.push({ descricao: 'Melhor Vendedor Serviço', valor: bonusServico });
            vencedor.detalhes = detalhes as unknown as Json;
          }
        }
      }

      // Apply best smartphone seller bonus
      const bonusMelhorSmartphone = (configToUse as Record<string, number>).bonus_melhor_smartphone || 0;
      if (bonusMelhorSmartphone > 0) {
        // Filter eligible sellers: must have hit individual smartphone meta and not be Trainee
        const elegiveisSmartphone = comissoes.filter(c => {
          if (c.cargo === 'Trainee' || c.cargo === 'Gerente') return false;
          const detalhes = c.detalhes as { totais?: Record<string, number>; info?: Record<string, any> };
          const totaisV = detalhes?.totais || {};
          const valorSm = (totaisV['BONIFICADO LC'] || 0) + (totaisV['SUPER BONIFICADO'] || 0) + (totaisV['ANATEL'] || 0);
          const colaborador = colaboradoresCalculaveis.find(col => col.nome.trim() === c.vendedor_nome);
          const proporcional = (colaborador?.proporcional_meta || 100) / 100;
          const metaSmartphones = configToUse.smartphones_meta * proporcional;
          // Check if seller hit their individual smartphone meta (smartphones alone or smartphones + serviços)
          const valorServicos = (totaisV['PROTEÇÃO LÍDER'] || 0) + (totaisV['GARANTIA ESTENDIDA'] || 0);
          return valorSm >= metaSmartphones || (valorSm + valorServicos) >= metaSmartphones;
        });

        if (elegiveisSmartphone.length > 0) {
          // Find the one with the most smartphones BY UNIT COUNT (__qtd_smartphones from vendas).
          // Fallback to monetary value only when unit counts are missing/equal.
          const qtdPorVendedor = new Map<string, number>();
          vendasSalvas.forEach(v => {
            const det = (v.detalhes || {}) as Record<string, unknown>;
            const qtd = Number(det['__qtd_smartphones']) || 0;
            const key = v.vendedor_nome.trim();
            qtdPorVendedor.set(key, (qtdPorVendedor.get(key) || 0) + qtd);
          });

          elegiveisSmartphone.sort((a, b) => {
            const qtdA = qtdPorVendedor.get(a.vendedor_nome.trim()) || 0;
            const qtdB = qtdPorVendedor.get(b.vendedor_nome.trim()) || 0;
            if (qtdB !== qtdA) return qtdB - qtdA;
            const detA = a.detalhes as { totais?: Record<string, number> };
            const detB = b.detalhes as { totais?: Record<string, number> };
            const smA = (detA?.totais?.['BONIFICADO LC'] || 0) + (detA?.totais?.['SUPER BONIFICADO'] || 0) + (detA?.totais?.['ANATEL'] || 0);
            const smB = (detB?.totais?.['BONIFICADO LC'] || 0) + (detB?.totais?.['SUPER BONIFICADO'] || 0) + (detB?.totais?.['ANATEL'] || 0);
            return smB - smA;
          });

          const vencedorSm = comissoes.find(c => c.vendedor_nome === elegiveisSmartphone[0].vendedor_nome);
          if (vencedorSm) {
            vencedorSm.bonus_automatico += bonusMelhorSmartphone;
            const detalhes = vencedorSm.detalhes as { bonusInfo?: Array<{ descricao: string; valor: number }> };
            if (!detalhes.bonusInfo) detalhes.bonusInfo = [];
            detalhes.bonusInfo.push({ descricao: 'Melhor Vendedor Smartphone', valor: bonusMelhorSmartphone });
            vencedorSm.detalhes = detalhes as unknown as Json;
          }
        }
      }

      // Apply store meta bonus (Soledade/Monteiro: prata/ouro não acumulativos; CG/Natal: só ouro)
      if (lojaId === 'soledade' || lojaId === 'monteiro') {
        // Calculate store totals for meta calculation
        const totaisLoja: Record<string, number> = {};
        stagedDataParaCalculo.forEach(row => {
          Object.entries(row).forEach(([coluna, valor]) => {
            if (coluna !== 'VENDEDOR') {
              const key = coluna.trim().toUpperCase();
              totaisLoja[key] = (totaisLoja[key] || 0) + (typeof valor === 'number' ? valor : 0);
            }
          });
        });
        
        const bonusMetaLoja = calcularBonusMetaLojaSoledadeMonteiro(totaisLoja, configToUse, lojaId);
        
        if (bonusMetaLoja > 0) {
          const tipoMeta = bonusMetaLoja === (configToUse.loja_bonus_meta_ouro || 300) ? 'Ouro' : 'Prata';
          toast.success(`Parabéns! A loja bateu a Meta ${tipoMeta}! Bônus de R$ ${bonusMetaLoja.toFixed(2)} aplicado.`);
          comissoes.forEach(c => {
            if (['Vendedor', 'VR', 'Trainee'].includes(c.cargo)) {
              c.bonus_automatico += bonusMetaLoja;
              // Adicionar info do bônus meta ao bonusInfo - modificar diretamente o objeto
              const detalhes = c.detalhes as { bonusInfo?: Array<{ descricao: string; valor: number }> };
              if (!detalhes.bonusInfo) {
                detalhes.bonusInfo = [];
              }
              detalhes.bonusInfo.push({ descricao: `Bônus Meta ${tipoMeta}`, valor: bonusMetaLoja });
              c.detalhes = detalhes as unknown as Json;
            }
          });
        }
      } else {
        // CG/Natal: meta ouro baseada em smartphones apenas (igual ao gerente)
        // Calcular total de smartphones e serviços da loja
        const totaisLojaParaMeta: Record<string, number> = {};
        stagedDataParaCalculo.forEach(row => {
          Object.entries(row).forEach(([coluna, valor]) => {
            if (coluna !== 'VENDEDOR') {
              const key = coluna.trim().toUpperCase();
              totaisLojaParaMeta[key] = (totaisLojaParaMeta[key] || 0) + (typeof valor === 'number' ? valor : 0);
            }
          });
        });
        
        const valorSmartphones = (totaisLojaParaMeta['BONIFICADO LC'] || 0) + (totaisLojaParaMeta['SUPER BONIFICADO'] || 0);
        const valorServicos = (totaisLojaParaMeta['PROTEÇÃO LÍDER'] || 0) + (totaisLojaParaMeta['GARANTIA ESTENDIDA'] || 0);
        const valorParaMetaPrata = valorSmartphones + valorServicos; // Meta Prata = smartphones + serviços
        
        const configRecord = configToUse as Record<string, number>;
        const metaPrata = configRecord.gerente_meta_prata || (lojaId === 'natal' ? 280000 : 190000);
        const acrescimoOuro = configRecord.gerente_meta_ouro_acrescimo || 10;
        
        // Priorizar loja_meta_ouro se estiver configurada, senão calcular
        const metaOuro = configRecord.loja_meta_ouro || (metaPrata * (1 + acrescimoOuro / 100));
        
        console.log(`[Store Meta Calculation] Loja: ${lojaId}, Smartphones: ${valorSmartphones}, Meta Prata: ${metaPrata}, Meta Ouro: ${metaOuro}`);
        
        // Verificar Meta Prata primeiro (Smartphones + Serviços)
        const batiuMetaPrata = valorParaMetaPrata >= metaPrata;
        // Meta Ouro: apenas smartphones deve atingir a meta
        const batiuMetaOuro = valorSmartphones >= metaOuro;
        
        // REGRA VR CAMPINA GRANDE: Bônus acumulativo
        // - Meta Prata: R$300
        // - Meta Ouro: R$300 (Prata) + R$200 (Ouro) = R$500
        if (lojaId === 'campina-grande' && batiuMetaPrata) {
          comissoes.forEach(c => {
            if (c.cargo === 'VR') {
              // VR sempre ganha R$300 ao bater Meta Prata
              const bonusVrPrata = 300;
              c.bonus_automatico += bonusVrPrata;
              const detalhes = c.detalhes as { bonusInfo?: Array<{ descricao: string; valor: number }> };
              if (!detalhes.bonusInfo) {
                detalhes.bonusInfo = [];
              }
              detalhes.bonusInfo.push({ descricao: 'Bônus VR Meta Prata', valor: bonusVrPrata });
              c.detalhes = detalhes as unknown as Json;
            }
          });
        }
        
        if (batiuMetaOuro) {
          const bonusValorBase = configToUse.loja_bonus_meta_ouro || 0;
          toast.success(`Parabéns! A loja bateu a Meta Ouro! Bônus aplicado.`);
          comissoes.forEach(c => {
            if (['Vendedor', 'VR', 'Trainee'].includes(c.cargo)) {
              // Aplicar ajuste proporcional se houver (ex: entrou no meio do mês)
              const percentualAjuste = getAjusteBonusPercentual(lojaId, selectedMes, c.vendedor_nome);
              const bonusValor = bonusValorBase * (percentualAjuste / 100);
              
              c.bonus_automatico += bonusValor;
              // Adicionar info do bônus meta ao bonusInfo
              const detalhes = c.detalhes as { bonusInfo?: Array<{ descricao: string; valor: number }> };
              if (!detalhes.bonusInfo) {
                detalhes.bonusInfo = [];
              }
              const descricaoBonus = percentualAjuste < 100 
                ? `Bônus Meta Ouro (${percentualAjuste}% proporcional)` 
                : 'Bônus Meta Ouro';
              detalhes.bonusInfo.push({ descricao: descricaoBonus, valor: bonusValor });
              c.detalhes = detalhes as unknown as Json;
            }
          });
        } else if (batiuMetaPrata && lojaId !== 'campina-grande') {
          // Para Natal: apenas toast informativo (não há bônus especial VR)
          toast.success(`Loja bateu Meta Prata!`);
        } else if (batiuMetaPrata && lojaId === 'campina-grande') {
          toast.success(`Loja bateu Meta Prata! Bônus VR aplicado.`);
        }
      }

      // Calculate manager commission for CG/Natal
      if (gerente && isLojaCampinaNatal(lojaId)) {
        const totaisLoja: Record<string, number> = {};
        stagedDataParaCalculo.forEach(row => {
          Object.entries(row).forEach(([coluna, valor]) => {
            if (coluna !== 'VENDEDOR') {
              const key = coluna.trim().toUpperCase();
              totaisLoja[key] = (totaisLoja[key] || 0) + (typeof valor === 'number' ? valor : 0);
            }
          });
        });
        
        // Verificar se o gerente tem folha fixa para este mês
        const fixedPayrollGerente = getFixedPayrollOverride(lojaId, selectedMes, gerente.nome);
        
        // Calcular dívidas do gerente
        const jaAplicadasGerente = dividasAplicadasPorColaborador.get(gerente.id);
        const { total: descontosDividasGerente, dividasInfo: dividasInfoGerente } = calcularDescontosDividas(
          gerente.dividas || [],
          selectedMes,
          jaAplicadasGerente
        );
        
        if (fixedPayrollGerente !== null) {
          // Folha fixa: valor fixo sem comissões/bônus, apenas descontos de dívidas
          comissoes.push({
            loja_id: lojaId,
            colaborador_id: gerente.id,
            vendedor_nome: gerente.nome,
            cargo: 'Gerente',
            mes: selectedMes,
            salario: fixedPayrollGerente,
            ajuda_custo: 0,
            comissao_base: 0,
            comissao_detalhada: {} as unknown as Json,
            repostagem_venda: 0,
            repostagem_comissao: 0,
            bonus_automatico: 0,
            bonus_manual: 0,
            descontos_dividas: descontosDividasGerente,
            adiantamentos: 0,
            descontos: 0,
            detalhes: {
              totais: totaisLoja,
              info: { folhaFixa: true },
              bonusInfo: [],
              dividasInfo: dividasInfoGerente,
              vendedorId: gerente.id,
            } as unknown as Json,
          });
        } else {
          const resGerente = calcularComissaoGerente(totaisLoja, configToUse, lojaId);
          
          // Comissão pessoal de serviços do gerente (12% sobre vendas pessoais de Proteção Líder + Garantia Estendida)
          // Apenas para loja Natal
          const nomeGerente = gerente.nome.trim();
          let servicosPessoaisGerente = 0;
          
          if (isLojaNatalLike(lojaId)) {
            // Buscar vendas pessoais do gerente - tentar match exato e também case-insensitive
            const vendasPessoaisGerente = vendasPorVendedor[nomeGerente] 
              || Object.entries(vendasPorVendedor).find(([k]) => k.trim().toUpperCase() === nomeGerente.toUpperCase())?.[1]
              || [];
            
            console.log(`[Gerente Serviços Pessoais] Nome: "${nomeGerente}", Vendas encontradas: ${vendasPessoaisGerente.length}, Keys no vendasPorVendedor:`, Object.keys(vendasPorVendedor));
            
            vendasPessoaisGerente.forEach((venda: Record<string, number>) => {
              Object.entries(venda).forEach(([coluna, valor]) => {
                const key = coluna.trim().toUpperCase();
                const isProtecaoLider = key.includes('PROTE') && key.includes('DER');
                const isGarantiaEstendida = key.includes('GARANTIA') && key.includes('ESTENDIDA');
                if (isProtecaoLider || isGarantiaEstendida) {
                  servicosPessoaisGerente += (typeof valor === 'number' ? valor : 0);
                }
              });
            });
            
            console.log(`[Gerente Serviços Pessoais] Total serviços pessoais: R$ ${servicosPessoaisGerente.toFixed(2)}, Comissão 12%: R$ ${(servicosPessoaisGerente * 0.12).toFixed(2)}`);
          }
          
          const comissaoServicoPessoal = servicosPessoaisGerente * 0.12;
          const comissaoDetalhadaGerente = { ...resGerente.comissaoDetalhada };
          if (comissaoServicoPessoal > 0) {
            comissaoDetalhadaGerente['SERVIÇOS PESSOAIS (12%)'] = comissaoServicoPessoal;
          }
          const comissaoTotalGerente = resGerente.comissao + comissaoServicoPessoal;
          
          comissoes.push({
            loja_id: lojaId,
            colaborador_id: gerente.id,
            vendedor_nome: gerente.nome,
            cargo: 'Gerente',
            mes: selectedMes,
            salario: gerente.salario,
            ajuda_custo: gerente.ajuda_custo,
            comissao_base: Number.isFinite(comissaoTotalGerente) ? Math.max(0, comissaoTotalGerente) : 0,
            comissao_detalhada: (Object.fromEntries(
              Object.entries(comissaoDetalhadaGerente || {}).map(([k, v]) => [k, Number.isFinite(v as number) ? v : 0])
            )) as unknown as Json,
            repostagem_venda: 0,
            repostagem_comissao: 0,
            bonus_automatico: Number.isFinite(resGerente.bonus) ? resGerente.bonus : 0,
            bonus_manual: 0,
            descontos_dividas: descontosDividasGerente,
            adiantamentos: 0,
            descontos: 0,
            detalhes: {
              totais: totaisLoja,
              info: resGerente.info,
              bonusInfo: [{ descricao: 'Bônus Gerencial', valor: resGerente.bonus }],
              dividasInfo: dividasInfoGerente,
              vendedorId: gerente.id,
            } as unknown as Json,
          });
        }
      }

      await saveComissoes.mutateAsync({ lojaId, mes: selectedMes, comissoes });

      // Calculate botons for each collaborator (exclui Gerentes, Trainees e lojas excluídas)
      const lojaExcluidaBotons = isLojaExcluidaBotons(lojaId, selectedMes);
      for (const comissao of comissoes) {
        if (lojaExcluidaBotons || comissao.cargo === 'Gerente' || comissao.cargo === 'Trainee' || !comissao.colaborador_id) continue;
        
        const detalhes = comissao.detalhes as { totais?: Record<string, number>; info?: Record<string, boolean> };
        const totais = detalhes?.totais || {};
        const proporcional = (colaboradores.find(c => c.id === comissao.colaborador_id)?.proporcional_meta || 100) / 100;
        // Usar config com overrides por vendedor para botons
        const vendorOverridesBoton = getVendorConfigOverrides(lojaId, selectedMes, comissao.vendedor_nome);
        const configRecord = vendorOverridesBoton ? { ...configToUse, ...vendorOverridesBoton } as Record<string, number> : configToUse as Record<string, number>;
        
        // Check if hit smartphones goal
        const valorSmartphones = (totais['BONIFICADO LC'] || 0) + (totais['SUPER BONIFICADO'] || 0) + (totais['ANATEL'] || 0);
        const valorAuxiliarServicos = (totais['PROTEÇÃO LÍDER'] || 0) + (totais['GARANTIA ESTENDIDA'] || 0);
        const metaSmartphonesValor = configRecord.smartphones_meta || 30000;
        const metaSmartphones = valorSmartphones >= (metaSmartphonesValor * proporcional) || 
                               (valorSmartphones + valorAuxiliarServicos) >= (metaSmartphonesValor * proporcional);
        
        // Check if hit services goal (fase 3)
        const valorServicos = (totais['PROTEÇÃO LÍDER'] || 0) + (totais['GARANTIA ESTENDIDA'] || 0);
        const metaServicosFase3 = configRecord.servicos_meta_fase3 || 2500;
        const metaServicos = valorServicos >= (metaServicosFase3 * proporcional);
        
        // Check if hit películas goal (meta estabelecida, não mínima) - para Tríplice Coroa
        const valorPeliculas = totais['PELÍCULA'] || 0;
        const metaPeliculasValor = configRecord.pelicula_meta || 1500;
        const metaPeliculas = valorPeliculas >= (metaPeliculasValor * proporcional);
        
        await calculateBoton.mutateAsync({
          colaboradorId: comissao.colaborador_id,
          lojaId,
          mes: selectedMes,
          metaSmartphones,
          metaServicos,
          metaPeliculas,
          vendedorNome: comissao.vendedor_nome
        });
      }

      toast.success(`${comissoes.length} folhas de comissão processadas com sucesso!`);
    } catch (error) {
      console.error('Erro ao calcular comissões:', error);
      toast.error('Erro ao calcular comissões');
    } finally {
      setIsCalculating(false);
    }
  };

  // Filtrar apenas vendedores cadastrados na visualização e excluídos por regra especial
  const stagedDataFiltrados = stagedData.filter(row => {
    const vendedorNome = row.VENDEDOR.trim();
    if (isVendedorExcluido(lojaId, selectedMes, vendedorNome)) {
      return false;
    }
    const colaborador = colaboradores.find(c => normalizeName(c.nome) === normalizeName(vendedorNome));
    return !!colaborador;
  });

  // GERAL é fixa: sempre exibida em todas as lojas, mesmo zerada
  const CATEGORIAS_FIXAS_HEADERS = new Set(['VENDEDOR', 'GERAL']);
  const dataHeaders = STANDARD_CATEGORY_HEADERS.filter(header => {
    if (CATEGORIAS_FIXAS_HEADERS.has(header)) return true;
    return stagedData.some(row => Number(row[header]) > 0 || row[header] !== undefined);
  });

  // Calcular dias para análise de metas
  const diasFechamento = config?.diasFechamento || [];
  // Aplicar dias de fechamento para todas as lojas
  const diasTotais = isSoledadeMonteiro 
    ? getDiasUteisNoMes(selectedMes, diasFechamento) 
    : getDaysInMonth(selectedMes) - diasFechamento.filter(d => d.startsWith(selectedMes)).length;
  
  // Para Soledade/Monteiro: se diasDecorridos (até ontem) for 0 mas já existem vendas, incluir hoje
  const diasDecorridosBase = selectedMes === getCurrentMonth() 
    ? (isSoledadeMonteiro 
        ? getDiasUteisDecorridos(selectedMes, diasFechamento) 
        : Math.max(0, getCurrentDayOfMonth() - diasFechamento.filter(d => d.startsWith(selectedMes) && d <= `${selectedMes}-${String(getCurrentDayOfMonth()).padStart(2, '0')}`).length))
    : diasTotais;
  
  // Fallback: se diasDecorridos for 0 no mês atual e há dados, incluir hoje para evitar projeção zerada
  const diasDecorridos = (diasDecorridosBase === 0 && selectedMes === getCurrentMonth() && stagedData.length > 0 && isSoledadeMonteiro)
    ? getDiasUteisDecorridos(selectedMes, diasFechamento, true)
    : diasDecorridosBase;

  // Obter metaPrata corretamente - CG/Natal não tem meta prata, usar 0
  const numericConfig = config?.numericConfig || {};
  const metaPrata = isSoledadeMonteiro ? (numericConfig?.loja_meta_prata || 0) : 0;
  const metaOuro = numericConfig?.loja_meta_ouro || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-light">
            {readOnly ? 'Análise de Metas' : 'Lançamento de Vendas'} - {LOJAS[lojaId as keyof typeof LOJAS]}
          </h1>
          <p className="text-sm text-muted-foreground">
            {readOnly
              ? 'Visualize a análise de metas da loja'
              : isTenfrontLoja
                ? 'Sincronize as vendas pela integração Tenfront (sem upload de Excel)'
                : 'Importe dados de vendas do Excel e calcule comissões'}
          </p>
          {isSoledadeMonteiro && (
            <p className="text-xs text-primary mt-1">
              * Dias úteis (sem domingos e feriados): {diasTotais} dias
            </p>
          )}
        </div>
        
        <div className="w-full sm:w-auto">
          <Label>Mês de Referência</Label>
          <Input 
            type="month" 
            value={selectedMes}
            onChange={e => setSelectedMes(e.target.value)}
            className="w-full sm:w-[180px]"
          />
        </div>
      </div>

      {!readOnly && (
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload size={18} />
              Coleta de Vendas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Upload + Sync lado a lado */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 p-4 rounded-xl border bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <Upload size={14} className="text-muted-foreground" />
                  <span className="text-sm font-medium">Upload Excel</span>
                </div>
                <Input 
                  type="file" 
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="cursor-pointer text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  Arquivo com coluna "VENDEDOR" e categorias de vendas
                </p>
              </div>

              <div className="space-y-2 p-4 rounded-xl border bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <RefreshCw size={14} className="text-muted-foreground" />
                  <span className="text-sm font-medium">Sincronização API</span>
                </div>
                <Button 
                  variant="outline" 
                  onClick={syncTenfrontData} 
                  disabled={isSyncingTenfront}
                  className="w-full"
                >
                  <RefreshCw size={14} className={`mr-2 ${isSyncingTenfront ? 'animate-spin' : ''}`} />
                  {isSyncingTenfront ? 'Sincronizando...' : 'Sincronizar Agora'}
                </Button>
                <p className="text-[11px] text-muted-foreground">
                  Atualizar dados via integração Tenfront
                </p>
              </div>
            </div>

            {vendasSalvas.length > 0 && stagedData.length === 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <Database size={16} className="text-primary" />
                <span className="text-sm">{vendasSalvas.length} vendas salvas para este mês. Carregando...</span>
              </div>
            )}
            
            {(stagedData.length > 0 || vendasSalvas.length > 0) && (
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={clearData}>
                  <Trash2 size={14} className="mr-1.5" /> Limpar
                </Button>
                <Button variant="outline" size="sm" onClick={saveData} disabled={saveVendas.isPending}>
                  <Save size={14} className="mr-1.5" /> Salvar Vendas
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setIsAnaliseOpen(true)} style={{ backgroundColor: '#f97316', color: '#fff', borderColor: '#ea580c' }} className="shadow-lg shadow-orange-500/40 font-bold border-2 hover:!bg-orange-600">
                  <BarChart3 size={14} className="mr-1.5" style={{ color: '#fff' }} /> Análise de Metas
                </Button>
                <Button size="sm" onClick={calculateCommissions} disabled={isCalculating}>
                  <Calculator size={14} className="mr-1.5" /> 
                  {isCalculating ? 'Calculando...' : 'Calcular Comissões'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Gerente read-only view - rich pre-visualization */}
      {readOnly && stagedData.length > 0 && (
        <>
          {!isVendedor && (
            <Card>
              <CardContent className="pt-6">
                <Button variant="ghost" onClick={() => setIsAnaliseOpen(true)} style={{ backgroundColor: '#f97316', color: '#fff', borderColor: '#ea580c' }} className="w-full sm:w-auto shadow-lg shadow-orange-500/40 font-bold border-2 hover:!bg-orange-600">
                  <BarChart3 size={16} className="mr-2" style={{ color: '#fff' }} /> Abrir Análise de Metas Detalhada
                </Button>
              </CardContent>
            </Card>
          )}

          <PreVisualizacaoVendas
            stagedData={stagedDataUnificadaParaCalculo}
            colaboradores={colaboradores}
            metaPrata={metaPrata}
            metaOuro={metaOuro}
            config={numericConfig && Object.keys(numericConfig).length > 0 ? numericConfig : getDefaultConfig(lojaId) as Record<string, number>}
            diasDecorridos={diasDecorridos}
            diasTotais={diasTotais}
            lojaNome={LOJAS[lojaId as keyof typeof LOJAS]}
            selectedMes={selectedMes}
            lojaId={lojaId}
            filtroVendedor={isVendedor ? vendedorNome : undefined}
          />
        </>
      )}
      
      {readOnly && stagedData.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhuma venda cadastrada para este mês ainda.
          </CardContent>
        </Card>
      )}

      {stagedData.length > 0 && !readOnly && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Database size={18} />
              Vendas Carregadas
              <Badge variant="secondary" className="ml-auto font-normal">
                {stagedDataFiltrados.length} de {stagedData.length} vendedores
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {dataHeaders.map(h => (
                      <TableHead key={h} className="whitespace-nowrap text-xs sm:text-sm">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stagedData.map((row, idx) => {
                    const isCadastrado = colaboradores.some(c => 
                      normalizeName(c.nome) === normalizeName(row.VENDEDOR)
                    );
                    return (
                      <TableRow key={idx} className={!isCadastrado ? 'opacity-50' : ''}>
                        {dataHeaders.map(h => (
                          <TableCell key={h} className="text-xs sm:text-sm whitespace-nowrap">
                            {h === 'VENDEDOR' ? (
                              <span className="flex items-center gap-2">
                                {row[h]}
                                {!isCadastrado && <span className="text-xs text-destructive/70">(não cadastrado)</span>}
                              </span>
                            ) : formatCurrency(Number(row[h]) || 0)}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
                <tfoot>
                  <TableRow className="bg-muted/50 font-bold border-t-2">
                    {dataHeaders.map(h => {
                      if (h === 'VENDEDOR') {
                        return (
                          <TableCell key={h} className="text-xs sm:text-sm whitespace-nowrap font-bold">
                            TOTAL
                          </TableCell>
                        );
                      }
                      const totalCategoria = stagedData.reduce(
                        (sum, row) => sum + (Number(row[h]) || 0),
                        0
                      );
                      return (
                        <TableCell key={h} className="text-xs sm:text-sm whitespace-nowrap font-bold">
                          {formatCurrency(totalCategoria)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </tfoot>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal de Análise de Metas */}
      <AnaliseMetasModal
        open={isAnaliseOpen}
        onOpenChange={setIsAnaliseOpen}
        dados={{
          lojaId,
          lojaNome: LOJAS[lojaId as keyof typeof LOJAS],
          mes: selectedMes,
          diasDecorridos,
          diasTotais,
          totalVendasLoja: stagedDataUnificadaParaCalculo.reduce((sum, row) => {
            return sum + Object.entries(row).reduce((rowSum, [key, value]) => {
              if (key !== 'VENDEDOR' && typeof value === 'number') return rowSum + value;
              return rowSum;
            }, 0);
          }, 0),
          totalSmartphones: stagedDataUnificadaParaCalculo.reduce((sum, row) => {
            return sum + (Number(row['BONIFICADO LC']) || 0) + (Number(row['SUPER BONIFICADO']) || 0) + (Number(row['ANATEL']) || 0);
          }, 0),
          totalServicos: stagedDataUnificadaParaCalculo.reduce((sum, row) => {
            return sum + (Number(row['PROTEÇÃO LÍDER']) || 0) + (Number(row['GARANTIA ESTENDIDA']) || 0);
          }, 0),
          totalAcessorios: stagedDataUnificadaParaCalculo.reduce((sum, row) => {
            return sum + (Number(row['ACESSÓRIOS']) || 0);
          }, 0),
          totalCases: stagedDataUnificadaParaCalculo.reduce((sum, row) => {
            return sum + (Number(row['CASES']) || 0);
          }, 0),
          totalPelicula: stagedDataUnificadaParaCalculo.reduce((sum, row) => {
            return sum + (Number(row['PELÍCULA']) || 0);
          }, 0),
          totalAssistenciaTecnica: stagedDataUnificadaParaCalculo.reduce((sum, row) => {
            return sum + (Number(row['ASSISTÊNCIA TÉCNICA']) || 0);
          }, 0),
          metaPrata,
          metaOuro,
          vendasPorVendedor: stagedDataUnificadaParaCalculo.reduce((acc, row) => {
            const nome = row.VENDEDOR.trim();
            if (!acc[nome]) {
              acc[nome] = {
                totais: {},
                colaborador: colaboradores.find(c => c.nome.trim().toLowerCase() === nome.toLowerCase())
              };
            }
            Object.entries(row).forEach(([key, value]) => {
              if (key !== 'VENDEDOR' && typeof value === 'number') {
                const upperKey = key.toUpperCase();
                acc[nome].totais[upperKey] = (acc[nome].totais[upperKey] || 0) + value;
              }
            });
            return acc;
          }, {} as Record<string, { totais: Record<string, number>; colaborador?: typeof colaboradores[0] }>),
          config: numericConfig && Object.keys(numericConfig).length > 0 
            ? numericConfig 
            : getDefaultConfig(lojaId) as Record<string, number>,
        }}
      />
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
};
