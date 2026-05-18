import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatMonth } from '@/lib/formatters';
import { getDefaultConfig, getVendorConfigOverrides } from '@/lib/constants';
import { isLojaCampinaNatal, isLojaSoledadeMonteiro } from '@/lib/lojaRules';
import { Target, TrendingUp, Calendar, Users, AlertCircle, CheckCircle2, Download, Share2, Sparkles, Loader2 } from 'lucide-react';
import { Colaborador } from '@/types/database';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';

interface AnaliseMetasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dados: {
    lojaId: string;
    lojaNome: string;
    mes: string;
    diasDecorridos: number;
    diasTotais: number;
    totalVendasLoja: number;
    totalSmartphones: number;
    totalServicos: number;
    totalAcessorios: number;
    totalCases: number;
    totalPelicula: number;
    totalAssistenciaTecnica: number;
    metaPrata: number;
    metaOuro: number;
    vendasPorVendedor: Record<string, { totais: Record<string, number>; colaborador?: Colaborador }>;
    config: Record<string, number>;
  };
}

export const AnaliseMetasModal = ({ open, onOpenChange, dados }: AnaliseMetasModalProps) => {
  const cardPrataRef = useRef<HTMLDivElement>(null);
  const cardOuroRef = useRef<HTMLDivElement>(null);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);

  const {
    lojaId,
    lojaNome,
    diasDecorridos,
    diasTotais,
    totalSmartphones,
    totalServicos,
    totalAcessorios,
    totalCases,
    totalPelicula,
    totalAssistenciaTecnica,
    metaPrata,
    metaOuro,
    vendasPorVendedor,
    config
  } = dados;

  const isSoledadeMonteiro = isLojaSoledadeMonteiro(lojaId);
  const isCampinaNatal = isLojaCampinaNatal(lojaId);

  // Fallback defensivo (evita "sumir" meta prata se por algum motivo a config vier incompleta)
  const defaultConfig = getDefaultConfig(lojaId) as Record<string, number>;

  // Soledade/Monteiro:
  // Meta Prata: TODAS as categorias, EXCETO GERAL
  // Meta Ouro: TODAS as categorias, EXCETO Serviços e GERAL
  const totalSemGeralSemServicos = totalSmartphones + totalAcessorios + totalCases + totalPelicula + totalAssistenciaTecnica;
  const totalSemGeral = totalSemGeralSemServicos + totalServicos;

  const totalParaMetaPrata = isSoledadeMonteiro ? totalSemGeral : (totalSmartphones + totalServicos);
  const totalParaMetaOuro = isSoledadeMonteiro ? totalSemGeralSemServicos : totalSmartphones;

  // Campina Grande/Natal: Meta Prata vem do gerente_meta_prata, Meta Ouro = Prata + X%
  const metaPrataReal = isCampinaNatal
    ? (config.gerente_meta_prata || (lojaId === 'natal' ? 280000 : 190000))
    : metaPrata;
  const acrescimoOuro = isCampinaNatal
    ? (config.gerente_meta_ouro_acrescimo || 10)
    : 0;
  const metaOuroReal = isCampinaNatal 
    ? (config.loja_meta_ouro || (metaPrataReal * (1 + acrescimoOuro / 100))) 
    : metaOuro;

  const proporcaoDias = diasTotais > 0 ? diasDecorridos / diasTotais : 0;

  // Cálculos de meta da loja (usando metas reais)
  const percentualPrata = metaPrataReal > 0 ? (totalParaMetaPrata / metaPrataReal) * 100 : 0;
  const percentualOuro = metaOuroReal > 0 ? (totalParaMetaOuro / metaOuroReal) * 100 : 0;
  const faltaPrata = Math.max(0, metaPrataReal - totalParaMetaPrata);
  const faltaOuro = Math.max(0, metaOuroReal - totalParaMetaOuro);

  // Meta diária inicial (considerando mês completo)
  const metaDiariaInicialPrata = metaPrataReal / diasTotais;
  const metaDiariaInicialOuro = metaOuroReal / diasTotais;

  // Meta diária atual (considerando dias restantes incluindo HOJE)
  // - Soledade/Monteiro: diasDecorridos conta ATÉ ONTEM (dias úteis)
  // - Campina/Natal: diasDecorridos é o DIA ATUAL (dias corridos - fechamentos)
  const diasRestantes = Math.max(
    1,
    isSoledadeMonteiro ? (diasTotais - diasDecorridos) : (diasTotais - diasDecorridos + 1)
  );
  const metaDiariaAtualPrata = faltaPrata / diasRestantes;
  const metaDiariaAtualOuro = faltaOuro / diasRestantes;

  // Proporção esperada vs realizada
  // Soledade/Monteiro: baseado em todas categorias exceto GERAL (totalParaMetaPrata)
  // Campina/Natal: baseado em smartphones + serviços (totalParaMetaPrata)
  const totalParaProjetado = totalParaMetaPrata;
  const metaParaProjetado = metaPrataReal;
  const metaEsperadaHoje = metaParaProjetado * proporcaoDias;
  const diferencaProjetada = totalParaProjetado - metaEsperadaHoje;

  // Projeções de vendas mantendo o ritmo atual
  const projecaoPrata = diasDecorridos > 0 ? (totalParaMetaPrata / diasDecorridos) * diasTotais : 0;
  const projecaoOuro = diasDecorridos > 0 ? (totalParaMetaOuro / diasDecorridos) * diasTotais : 0;
  const projecaoAtingePrata = projecaoPrata >= metaPrataReal;
  const projecaoAtingeOuro = projecaoOuro >= metaOuroReal;

  // Análise por vendedor - APENAS vendedores cadastrados
  const analiseVendedores = Object.entries(vendasPorVendedor)
    .filter(([nome, data]) => {
      // Excluir explicitamente o Marcelo (solicitado pelo usuário)
      if (nome.toUpperCase().includes('MARCELO')) return false;

      // Prioridade: se temos dados de colaborador vinculado, usamos ele
      if (data.colaborador) return true;
      
      // Fallback: se não há colaborador vinculado mas há vendas, verificamos se o nome bate com algum cadastrado
      // (Isso resolve casos onde o vinculador falhou por pequenas diferenças de espaço ou case)
      return true; 
    })
    .map(([nome, data]) => {
      const colaborador = data.colaborador;
      const proporcional = (colaborador?.proporcional_meta || 100) / 100;
      const totais = data.totais;

      const smartphones = (totais['BONIFICADO LC'] || 0) + (totais['SUPER BONIFICADO'] || 0) + (totais['ANATEL'] || 0);
      const protecaoLider = totais['PROTEÇÃO LÍDER'] || 0;
      const garantiaEstendida = totais['GARANTIA ESTENDIDA'] || 0;
      const servicos = protecaoLider + garantiaEstendida;
      const acessorios = totais['ACESSÓRIOS'] || 0;
      const pelicula = totais['PELÍCULA'] || 0;
      const geral = totais['GERAL'] || 0;

      // Aplicar overrides de config por vendedor (metas customizadas)
      const vendorOverrides = getVendorConfigOverrides(lojaId, dados.mes, nome);
      const vendorConfig = vendorOverrides ? { ...config, ...vendorOverrides } : config;

      const metaSmartphones = (vendorConfig.smartphones_meta || 30000) * proporcional;
      const metaServicosFase1 = (vendorConfig.servicos_meta_fase1 || 1500) * proporcional;
      const metaServicosFase2 = (vendorConfig.servicos_meta_fase2 || 2000) * proporcional;
      const metaServicosFase3 = (vendorConfig.servicos_meta_fase3 || 2500) * proporcional;
      const metaPelicula = (vendorConfig.pelicula_meta || 1000) * proporcional;

      // Total para a meta do vendedor: smartphones + serviços podem auxiliar
      const smartphonesComServicos = smartphones + servicos;
      
      // A meta de smartphones é atingida se:
      // 1. Smartphones sozinhos >= meta OU
      // 2. Smartphones + Serviços >= meta
      const atingiuMetaSmartphones = smartphones >= metaSmartphones || smartphonesComServicos >= metaSmartphones;
      
      // Para exibição do percentual, usamos o maior valor entre smartphones e smartphones+serviços
      // até o limite da meta (já que serviços só "auxiliam" para atingir, não passam da meta)
      const totalParaMeta = atingiuMetaSmartphones 
        ? Math.max(smartphones, Math.min(smartphonesComServicos, metaSmartphones))
        : smartphonesComServicos;
      const percentualMeta = metaSmartphones > 0 ? (totalParaMeta / metaSmartphones) * 100 : 0;

      // Meta diária do vendedor - considera o que falta
      const faltaParaMeta = Math.max(0, metaSmartphones - totalParaMeta);
      const metaDiariaVendedor = metaSmartphones / diasTotais;
      const metaDiariaVendedorAtual = diasRestantes > 0 ? faltaParaMeta / diasRestantes : 0;

      // Quanto falta para cada patamar de serviço
      const faltaServFase1 = Math.max(0, metaServicosFase1 - servicos);
      const faltaServFase2 = Math.max(0, metaServicosFase2 - servicos);
      const faltaServFase3 = Math.max(0, metaServicosFase3 - servicos);

      return {
        nome,
        cargo: colaborador?.cargo || (nome.toUpperCase().includes('FLAVIO') ? 'VR' : 'Vendedor'),
        smartphones,
        servicos,
        protecaoLider,
        garantiaEstendida,
        acessorios,
        pelicula,
        geral,
        metaPelicula,
        faltaPelicula: Math.max(0, metaPelicula - pelicula),
        atingiuMetaPelicula: pelicula >= metaPelicula,
        totalParaMeta,
        metaSmartphones,
        percentualMeta,
        faltaParaMeta,
        metaDiariaVendedor,
        metaDiariaVendedorAtual,
        faltaServFase1,
        faltaServFase2,
        faltaServFase3,
        atingiuFase1: servicos >= metaServicosFase1,
        atingiuFase2: servicos >= metaServicosFase2,
        atingiuFase3: servicos >= metaServicosFase3,
        atingiuMeta: atingiuMetaSmartphones,
      };
    })
    // EXCLUIR Trainee da análise de metas (Manter Gerente, VR e Vendedores específicos)
    .filter(v => {
      const nomeUpper = v.nome.toUpperCase();
      const isTargetVendedor = nomeUpper.includes('CELIO') || nomeUpper.includes('FLAVIO');
      
      // Se for Celio ou Flavio, SEMPRE mantém
      if (isTargetVendedor) return true;
      
      // Caso contrário, exclui Trainee e Supervisor (conforme lógica da loja)
      return v.cargo !== 'Trainee' && v.cargo !== 'Supervisor';
    })
    .sort((a, b) => b.totalParaMeta - a.totalParaMeta);

  const handleAiAnalysis = async () => {
    setIsAnalyzing(true);
    setShowAiAnalysis(true);
    setAiAnalysis('');

    const dadosAnalise = {
      lojaNome,
      mes: formatMonth(dados.mes),
      diasDecorridos,
      diasTotais,
      proporcaoMes: (proporcaoDias * 100).toFixed(0),
      totalParaMetaPrata,
      metaPrata: metaPrataReal,
      percentualPrata,
      faltaPrata,
      metaDiariaAtualPrata,
      projecaoPrata,
      projecaoAtingePrata,
      totalParaMetaOuro: totalParaMetaOuro,
      metaOuro: metaOuroReal,
      percentualOuro,
      faltaOuro,
      metaDiariaAtualOuro,
      projecaoOuro,
      projecaoAtingeOuro,
      diferencaProjetada,
      vendedores: analiseVendedores.map(v => ({
        nome: v.nome,
        cargo: v.cargo,
        smartphones: v.smartphones,
        servicos: v.servicos,
        metaSmartphones: v.metaSmartphones,
        percentualMeta: v.percentualMeta,
        metaDiariaVendedor: v.metaDiariaVendedor,
        metaDiariaVendedorAtual: v.metaDiariaVendedorAtual,
        atingiuMeta: v.atingiuMeta,
        atingiuFase1: v.atingiuFase1,
        atingiuFase2: v.atingiuFase2,
        atingiuFase3: v.atingiuFase3,
      })),
    };

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-metas`;
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ dadosAnalise }),
      });

      if (!resp.ok || !resp.body) {
        const errorData = await resp.json().catch(() => null);
        toast.error(errorData?.error || 'Erro ao gerar análise IA');
        setIsAnalyzing(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullText = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullText += content;
              setAiAnalysis(fullText);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error('AI analysis error:', e);
      toast.error('Erro ao conectar com a IA');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(0, 150, 136);
    doc.text('Análise de Metas', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`${lojaNome} - ${formatMonth(dados.mes)}`, pageWidth / 2, 28, { align: 'center' });
    doc.text(`Dia ${diasDecorridos} de ${diasTotais} (${(proporcaoDias * 100).toFixed(0)}% do mês)`, pageWidth / 2, 35, { align: 'center' });
    
    // Status
    doc.setFontSize(14);
    doc.setTextColor(diferencaProjetada >= 0 ? 34 : 200, diferencaProjetada >= 0 ? 139 : 120, diferencaProjetada >= 0 ? 34 : 50);
    const statusText = diferencaProjetada >= 0 
      ? `Acima do esperado em ${formatCurrency(diferencaProjetada)}`
      : `Abaixo do esperado em ${formatCurrency(Math.abs(diferencaProjetada))}`;
    doc.text(statusText, pageWidth / 2, 48, { align: 'center' });
    
    // Projeções
    doc.setFontSize(11);
    doc.setTextColor(projecaoAtingePrata ? 34 : 200, projecaoAtingePrata ? 139 : 120, projecaoAtingePrata ? 34 : 50);
    doc.text(`Projeção Prata: ${formatCurrency(projecaoPrata)} (Meta: ${formatCurrency(metaPrataReal)}) ${projecaoAtingePrata ? '✓' : '✗'}`, 14, 58);
    doc.setTextColor(projecaoAtingeOuro ? 34 : 200, projecaoAtingeOuro ? 139 : 120, projecaoAtingeOuro ? 34 : 50);
    doc.text(`Projeção Ouro: ${formatCurrency(projecaoOuro)} (Meta: ${formatCurrency(metaOuroReal)}) ${projecaoAtingeOuro ? '✓' : '✗'}`, 14, 65);
    
    // Metas da Loja
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text('Metas da Loja', 14, 75);
    
    const metasData = [];
    if (metaPrataReal > 0) {
      metasData.push([
        'Meta Prata',
        formatCurrency(totalParaMetaPrata),
        formatCurrency(metaPrataReal),
        `${percentualPrata.toFixed(1)}%`,
        formatCurrency(faltaPrata),
        formatCurrency(metaDiariaAtualPrata)
      ]);
    }
    metasData.push([
      'Meta Ouro',
      formatCurrency(totalParaMetaOuro),
      formatCurrency(metaOuroReal),
      `${percentualOuro.toFixed(1)}%`,
      formatCurrency(faltaOuro),
      formatCurrency(metaDiariaAtualOuro)
    ]);
    
    autoTable(doc, {
      startY: 81,
      head: [['Meta', 'Realizado', 'Alvo', '%', 'Falta', 'Meta Diária Atual']],
      body: metasData,
      theme: 'striped',
      headStyles: { fillColor: [0, 150, 136] },
    });
    
    // Análise por Vendedor
    const finalY = (doc as any).lastAutoTable.finalY || 90;
    doc.setFontSize(16);
    doc.text('Análise por Vendedor', 14, finalY + 15);
    
    const vendedoresData = analiseVendedores.map(v => [
      v.nome,
      formatCurrency(v.smartphones),
      formatCurrency(v.metaSmartphones),
      `${v.percentualMeta.toFixed(1)}%`,
      formatCurrency(v.servicos),
      v.atingiuMeta ? 'Meta ✓' : (v.atingiuFase3 ? '3º ✓' : v.atingiuFase2 ? '2º ✓' : v.atingiuFase1 ? '1º ✓' : '-')
    ]);
    
    autoTable(doc, {
      startY: finalY + 20,
      head: [['Vendedor', 'Smartphones', 'Meta', '%', 'Serviços', 'Status']],
      body: vendedoresData,
      theme: 'striped',
      headStyles: { fillColor: [0, 150, 136] },
    });
    
    // Footer
    const finalY2 = (doc as any).lastAutoTable.finalY || 150;
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, finalY2 + 10, { align: 'center' });
    
    doc.save(`analise-metas-${lojaId}-${dados.mes}.pdf`);
  };

  const getThemeColor = (token: '--background' | '--foreground') => {
    const tokenValue = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
    return `hsl(${tokenValue})`;
  };

  const normalizeCaptureStyles = (root: HTMLElement) => {
    root.style.animation = 'none';
    root.style.transition = 'none';
    root.style.opacity = '1';

    root.querySelectorAll<HTMLElement>('*').forEach((el) => {
      el.style.animation = 'none';
      el.style.transition = 'none';
      el.style.opacity = '1';

      const computedColor = window.getComputedStyle(el).color;
      if (computedColor.includes('rgba')) {
        const rgbaParts = computedColor.replace('rgba(', '').replace(')', '').split(',');
        const alpha = Number(rgbaParts[3] ?? '1');
        if (!Number.isNaN(alpha) && alpha < 0.9) {
          el.style.color = getThemeColor('--foreground');
        }
      }
    });
  };

  const handleShareWhatsApp = async (tipo: 'prata' | 'ouro') => {
    const ref = tipo === 'prata' ? cardPrataRef.current : cardOuroRef.current;
    if (!ref) return;

    let wrapper: HTMLDivElement | null = null;

    try {
      if (document.fonts?.ready) await document.fonts.ready;

      const sourceRect = ref.getBoundingClientRect();
      const sourceWidth = Math.max(320, Math.round(sourceRect.width));
      const targetWidth = 900;
      const layoutScale = targetWidth / sourceWidth;
      const targetHeight = Math.max(1, Math.round(sourceRect.height * layoutScale));

      const clone = ref.cloneNode(true) as HTMLElement;
      const cloneShareBtn = clone.querySelector('[data-share-btn]');
      if (cloneShareBtn) cloneShareBtn.remove();

      clone.style.width = `${sourceWidth}px`;
      clone.style.maxWidth = 'none';
      clone.style.margin = '0';
      clone.style.transformOrigin = 'top left';
      clone.style.transform = `scale(${layoutScale})`;
      clone.style.boxSizing = 'border-box';

      normalizeCaptureStyles(clone);

      wrapper = document.createElement('div');
      wrapper.style.position = 'fixed';
      wrapper.style.left = '-10000px';
      wrapper.style.top = '0';
      wrapper.style.width = `${targetWidth}px`;
      wrapper.style.height = `${targetHeight}px`;
      wrapper.style.padding = '0';
      wrapper.style.margin = '0';
      wrapper.style.overflow = 'hidden';
      wrapper.style.boxSizing = 'border-box';
      wrapper.style.background = getThemeColor('--background');
      wrapper.style.zIndex = '-9999';
      wrapper.style.opacity = '0';
      wrapper.style.pointerEvents = 'none';

      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);

      // Restore opacity for html2canvas to render, but keep offscreen
      wrapper.style.opacity = '1';
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

      const canvas = await html2canvas(wrapper, {
        backgroundColor: getThemeColor('--background'),
        scale: Math.min(3, Math.max(2, window.devicePixelRatio || 2)),
        useCORS: true,
        logging: false,
        width: targetWidth,
        height: targetHeight,
        windowWidth: targetWidth,
        windowHeight: targetHeight,
        removeContainer: true,
      });

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Falha ao gerar imagem'));
        }, 'image/png', 1.0);
      });

      const file = new File([blob], `meta-${tipo}-${lojaNome}-${dados.mes}.png`, { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Meta ${tipo === 'prata' ? 'Prata' : 'Ouro'} - ${lojaNome}`,
        });
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
      alert('Imagem salva! Envie pelo WhatsApp.');
    } catch (err) {
      console.error('Erro ao compartilhar:', err);
      alert('Não foi possível gerar a imagem.');
    } finally {
      if (wrapper && document.body.contains(wrapper)) {
        document.body.removeChild(wrapper);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Target className="text-primary" size={20} />
                Análise Proporcional de Metas - {lojaNome}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Dia {diasDecorridos} de {diasTotais} ({(proporcaoDias * 100).toFixed(0)}% do mês)
              </p>
            </div>
            <div className="flex gap-2 mr-8">
              <Button 
                onClick={handleAiAnalysis} 
                disabled={isAnalyzing}
                variant="outline"
                className="border-primary/50 hover:bg-primary/10 transition-all"
              >
                {isAnalyzing ? (
                  <Loader2 size={16} className="mr-2 animate-spin" />
                ) : (
                  <Sparkles size={16} className="mr-2 text-primary" />
                )}
                {isAnalyzing ? 'Analisando...' : 'Análise IA'}
              </Button>
              <Button 
                onClick={handleDownloadPDF} 
                className="gradient-primary text-primary-foreground shadow-glow hover:shadow-glow-lg transition-all"
              >
                <Download size={16} className="mr-2" />
                Baixar PDF
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Geral da Loja */}
          <Card className={diferencaProjetada >= 0 ? 'border-green-500/50' : 'border-orange-500/50'}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                {diferencaProjetada >= 0 ? (
                  <CheckCircle2 className="text-green-500" size={18} />
                ) : (
                  <AlertCircle className="text-orange-500" size={18} />
                )}
                Status Projetado {isSoledadeMonteiro ? '(Todas categorias - Geral)' : '(Smartphones + Serviços)'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                {diferencaProjetada >= 0 ? (
                  <span className="text-green-400">
                    Acima do esperado em {formatCurrency(diferencaProjetada)}
                  </span>
                ) : (
                  <span className="text-orange-400">
                    Abaixo do esperado em {formatCurrency(Math.abs(diferencaProjetada))}
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Esperado até hoje: {formatCurrency(metaEsperadaHoje)} | Realizado: {formatCurrency(totalParaProjetado)}
              </p>
              <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={16} className="text-primary" />
                  <span className="text-sm font-medium">Projeção Fim do Mês (mantendo ritmo atual)</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className={`p-2 rounded ${projecaoAtingePrata ? 'bg-green-500/20' : 'bg-orange-500/20'}`}>
                    <p className="text-muted-foreground">Projeção Prata</p>
                    <p className={`font-semibold ${projecaoAtingePrata ? 'text-green-400' : 'text-orange-400'}`}>
                      {formatCurrency(projecaoPrata)} {projecaoAtingePrata ? '✓' : '✗'}
                    </p>
                    <p className="text-muted-foreground">Meta: {formatCurrency(metaPrataReal)}</p>
                  </div>
                  <div className={`p-2 rounded ${projecaoAtingeOuro ? 'bg-green-500/20' : 'bg-orange-500/20'}`}>
                    <p className="text-muted-foreground">Projeção Ouro</p>
                    <p className={`font-semibold ${projecaoAtingeOuro ? 'text-green-400' : 'text-orange-400'}`}>
                      {formatCurrency(projecaoOuro)} {projecaoAtingeOuro ? '✓' : '✗'}
                    </p>
                    <p className="text-muted-foreground">Meta: {formatCurrency(metaOuroReal)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Metas da Loja */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Meta Prata - todas as lojas que tiverem */}
            {metaPrataReal > 0 && (
              <Card ref={cardPrataRef} className="border-gray-400/50">
                <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-gradient-to-br from-gray-300 to-gray-500" />
                      Meta Prata {isSoledadeMonteiro ? '(Tudo exceto Geral)' : '(Smartphones + Serviços)'}
                    </CardTitle>
                    <Button
                      data-share-btn
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleShareWhatsApp('prata')}
                      title="Compartilhar no WhatsApp"
                    >
                      <Share2 size={16} className="text-green-500" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{formatCurrency(totalParaMetaPrata)}</span>
                      <span>{formatCurrency(metaPrataReal)}</span>
                    </div>
                    <Progress value={Math.min(percentualPrata, 100)} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-1">{percentualPrata.toFixed(1)}%</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-muted/50">
                      <p className="text-muted-foreground">Falta</p>
                      <p className="font-semibold">{formatCurrency(faltaPrata)}</p>
                    </div>
                    <div className="p-2 rounded bg-muted/50">
                      <p className="text-muted-foreground">Meta Diária Atual</p>
                      <p className="font-semibold">{formatCurrency(metaDiariaAtualPrata)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Meta diária inicial: {formatCurrency(metaDiariaInicialPrata)}/dia
                  </p>
                  {isCampinaNatal && (
                    <p className="text-xs text-muted-foreground italic">
                      Meta Ouro = Meta Prata + {acrescimoOuro}%
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Meta Ouro */}
            <Card ref={cardOuroRef} className="border-yellow-500/50">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500" />
                    Meta Ouro {isSoledadeMonteiro ? '(Tudo exceto Serviços e Geral)' : '(Apenas Smartphones)'}
                  </CardTitle>
                  <Button
                    data-share-btn
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleShareWhatsApp('ouro')}
                    title="Compartilhar no WhatsApp"
                  >
                    <Share2 size={16} className="text-green-500" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{formatCurrency(totalParaMetaOuro)}</span>
                    <span>{formatCurrency(metaOuroReal)}</span>
                  </div>
                  <Progress value={Math.min(percentualOuro, 100)} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">{percentualOuro.toFixed(1)}%</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-muted/50">
                    <p className="text-muted-foreground">Falta</p>
                    <p className="font-semibold">{formatCurrency(faltaOuro)}</p>
                  </div>
                  <div className="p-2 rounded bg-muted/50">
                    <p className="text-muted-foreground">Meta Diária Atual</p>
                    <p className="font-semibold">{formatCurrency(metaDiariaAtualOuro)}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Meta diária inicial: {formatCurrency(metaDiariaInicialOuro)}/dia
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Análise por Vendedor */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users size={18} />
                Análise por Vendedor (Apenas Cadastrados)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analiseVendedores.map((vendedor) => (
                  <div key={vendedor.nome} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium">{vendedor.nome}</p>
                        <p className="text-xs text-muted-foreground">{vendedor.cargo}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${vendedor.atingiuMeta ? 'text-green-400' : 'text-primary'}`}>
                          {vendedor.percentualMeta.toFixed(1)}% da meta
                          {vendedor.atingiuMeta && ' ✓'}
                        </p>
                      </div>
                    </div>
                    
                    <Progress value={Math.min(vendedor.percentualMeta, 100)} className="h-1.5 mb-3" />
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                      <div className="p-2 rounded bg-background/50">
                        <p className="text-muted-foreground">Meta Diária Inicial</p>
                        <p className="font-medium">{formatCurrency(vendedor.metaDiariaVendedor)}</p>
                      </div>
                      <div className="p-2 rounded bg-background/50">
                        <p className="text-muted-foreground">Meta Diária Atual</p>
                        <p className="font-medium">{formatCurrency(vendedor.metaDiariaVendedorAtual)}</p>
                      </div>
                      <div className="p-2 rounded bg-background/50">
                        <p className="text-muted-foreground">Smartphones (meta)</p>
                        <p className="font-medium">{formatCurrency(vendedor.smartphones)}</p>
                        <p className="text-muted-foreground mt-0.5">Meta: {formatCurrency(vendedor.metaSmartphones)}</p>
                        {vendedor.faltaParaMeta > 0 ? (
                          <p className="text-orange-400 font-semibold mt-0.5">Falta: {formatCurrency(vendedor.faltaParaMeta)}</p>
                        ) : (
                          <p className="text-green-400 font-semibold mt-0.5">Meta atingida ✓</p>
                        )}
                      </div>
                      <div className="p-2 rounded bg-background/50">
                        <p className="text-muted-foreground">Proteção Líder</p>
                        <p className="font-medium">{formatCurrency(vendedor.protecaoLider)}</p>
                      </div>
                      <div className="p-2 rounded bg-background/50">
                        <p className="text-muted-foreground">Garantia Estendida</p>
                        <p className="font-medium">{formatCurrency(vendedor.garantiaEstendida)}</p>
                      </div>
                      <div className="p-2 rounded bg-background/50">
                        <p className="text-muted-foreground">Película (meta)</p>
                        <p className="font-medium">{formatCurrency(vendedor.pelicula)}</p>
                        <p className="text-muted-foreground mt-0.5">Meta: {formatCurrency(vendedor.metaPelicula)}</p>
                        {vendedor.atingiuMetaPelicula ? (
                          <p className="text-green-400 font-semibold mt-0.5">Meta atingida ✓</p>
                        ) : (
                          <p className="text-orange-400 font-semibold mt-0.5">Falta: {formatCurrency(vendedor.faltaPelicula)}</p>
                        )}
                      </div>
                      <div className="p-2 rounded bg-background/50">
                        <p className="text-muted-foreground">Vendas Gerais</p>
                        <p className="font-medium">{formatCurrency(vendedor.geral)}</p>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-border/50">
                      <p className="text-xs text-muted-foreground mb-2">
                        Serviços (total: {formatCurrency(vendedor.servicos)}) — Patamares para atingir:
                      </p>
                      <div className="flex gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-1 rounded ${vendedor.atingiuFase1 ? 'bg-green-500/20 text-green-400' : 'bg-muted'}`}>
                          1º Patamar: {vendedor.atingiuFase1 ? '✓' : `+${formatCurrency(vendedor.faltaServFase1)}`}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${vendedor.atingiuFase2 ? 'bg-green-500/20 text-green-400' : 'bg-muted'}`}>
                          2º Patamar: {vendedor.atingiuFase2 ? '✓' : `+${formatCurrency(vendedor.faltaServFase2)}`}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${vendedor.atingiuFase3 ? 'bg-green-500/20 text-green-400' : 'bg-muted'}`}>
                          3º Patamar: {vendedor.atingiuFase3 ? '✓' : `+${formatCurrency(vendedor.faltaServFase3)}`}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {analiseVendedores.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    Nenhum vendedor cadastrado encontrado nos dados carregados
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Análise IA */}
          {showAiAnalysis && (
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles size={18} className="text-primary" />
                  Análise Inteligente
                  {isAnalyzing && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {aiAnalysis ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none text-sm whitespace-pre-wrap leading-relaxed">
                    {aiAnalysis}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
                    <Loader2 size={16} className="animate-spin" />
                    Gerando análise detalhada...
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
