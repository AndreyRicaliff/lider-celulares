import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LOJAS, LOJAS_IDS, isVendaExcluida } from '@/lib/constants';
import { formatCurrency, formatMonth } from '@/lib/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FileText, Download, Users, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoLider from '@/assets/logo.jpg';
import { toast } from 'sonner';
import { SUPERVISORES_CONFIG, calcularFolhaSupervisor } from '@/lib/supervisorCalculator';
import { useAllConfiguracoes } from '@/hooks/useConfiguracoes';
import { useSupervisores } from '@/hooks/useColaboradores';
import { useSupervisorConfigs } from '@/hooks/useSupervisorConfig';
import * as XLSX from 'xlsx';

interface LojaResult {
  lojaId: string;
  lojaNome: string;
  totalGeral: number;
  porCategoria: Record<string, number>;
  vendedores: Array<{
    nome: string;
    cargo: string;
    totalCategorias: number;
    porCategoria: Record<string, number>;
  }>;
}

const formatCurrencyPdf = (value: number): string => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const LOJAS_SUPERVISAO = ['soledade', 'monteiro', 'campina-grande', 'natal', 'caruaru'] as const;

export const RelatoriosNumericos = () => {
  const [mes, setMes] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [selectedLojas, setSelectedLojas] = useState<string[]>([...LOJAS_IDS]);
  const [selectedCategorias, setSelectedCategorias] = useState<string[]>([]);
  const [selectedVendedores, setSelectedVendedores] = useState<string[]>([]);
  const [incluirSupervisao, setIncluirSupervisao] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const { data: allComissoes = [], isLoading } = useQuery({
    queryKey: ['comissoes-numericos', mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comissoes')
        .select('*')
        .eq('mes', mes);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch vendas for supervisor commission calculation
  const { data: allVendas = [] } = useQuery({
    queryKey: ['vendas-numericos', mes],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendas')
        .select('*')
        .eq('mes', mes);
      if (error) throw error;
      return (data || []).filter(v => !isVendaExcluida(v.loja_id, v.mes, v.vendedor_nome, v.valor_total));
    },
    enabled: incluirSupervisao,
  });

  const { data: allConfigs = {} } = useAllConfiguracoes(mes);
  const { data: supervisoresData = [] } = useSupervisores();
  const { data: supOverrides = {} } = useSupervisorConfigs();

  // Calculate supervisor service commissions per loja
  const supervisorComissoes = useMemo(() => {
    if (!incluirSupervisao || allVendas.length === 0) return [];

    const results: Array<{
      nome: string;
      cargo: string;
      lojaId: string;
      porCategoria: Record<string, number>;
    }> = [];

    // Organizar vendas por loja para o calculador
    const vendasPorLoja: Record<string, any[]> = {};
    LOJAS_IDS.forEach(id => {
      vendasPorLoja[id] = allVendas.filter(v => v.loja_id === id);
    });

    // Organizar configs por loja
    const configsPorLoja: Record<string, Record<string, number>> = {};
    Object.entries(allConfigs).forEach(([id, cfg]) => {
      configsPorLoja[id] = (cfg as any).numericConfig || {};
    });

    Object.entries(SUPERVISORES_CONFIG).forEach(([nome, config]) => {
      if (selectedVendedores.length > 0 && !selectedVendedores.includes(nome)) return;

      const supervisor = supervisoresData.find(s => s.nome.toLowerCase() === nome.toLowerCase());
      const dividas = supervisor?.dividas || [];

      // Usar a função oficial de cálculo
      const folha = calcularFolhaSupervisor(nome, vendasPorLoja, configsPorLoja, dividas, mes, [], supOverrides[nome] ?? {});

      if (folha) {
        folha.resultadosPorLoja.forEach(res => {
          if (!selectedLojas.includes(res.lojaId)) return;
          
          if (res.total > 0) {
            results.push({
              nome,
              cargo: 'Supervisor',
              lojaId: res.lojaId,
              // Mapear todas as colunas de ganho para o relatório numérico
              porCategoria: { 
                'SERVIÇOS': res.comissaoServicoLoja + res.comissaoServicoVendaPropria,
                'SALÁRIO': res.salario,
                'AJUDA DE CUSTO': res.ajudaCusto,
                'BÔNUS META': res.bonusMeta,
                'TAXA ADM.': res.taxaAdministrativa,
                'COMPLEMENTO': res.complemento,
                'DÍVIDAS': -res.descontoDividas
              },
            });
          }
        });
      }
    });

    return results;
  }, [incluirSupervisao, allVendas, allConfigs, supervisoresData, selectedLojas, selectedVendedores, mes, supOverrides]);

  const allVendedores = useMemo(() => {
    const vends = new Set<string>();
    allComissoes.forEach(c => vends.add(c.vendedor_nome));
    supervisorComissoes.forEach(sc => vends.add(sc.nome));
    return [...vends].sort();
  }, [allComissoes, supervisorComissoes]);

  const allCategorias = useMemo(() => {
    const cats = new Set<string>();
    allComissoes.forEach(c => {
      const det = c.comissao_detalhada as Record<string, number> | null;
      if (det) {
        Object.keys(det).forEach(k => {
          const upperK = k.toUpperCase().trim();
          if (!['VENDA DIÁRIA', 'VENDA DIARIA'].includes(upperK)) {
            cats.add(k);
          }
        });
      }
    });
    // Add categories from supervisor comissions
    supervisorComissoes.forEach(sc => {
      Object.keys(sc.porCategoria).forEach(k => {
        const upperK = k.toUpperCase().trim();
        if (!['VENDA DIÁRIA', 'VENDA DIARIA'].includes(upperK)) {
          cats.add(k);
        }
      });
    });
    return [...cats].sort();
  }, [allComissoes, supervisorComissoes]);

  const categorias = selectedCategorias.length > 0 ? selectedCategorias : allCategorias;

  const toggleLoja = (lojaId: string) => {
    setSelectedLojas(prev =>
      prev.includes(lojaId) ? prev.filter(l => l !== lojaId) : [...prev, lojaId]
    );
  };

  const toggleCategoria = (cat: string) => {
    setSelectedCategorias(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const toggleVendedor = (vend: string) => {
    setSelectedVendedores(prev =>
      prev.includes(vend) ? prev.filter(v => v !== vend) : [...prev, vend]
    );
  };

  const selectAllCategorias = () => setSelectedCategorias([...allCategorias]);
  const clearCategorias = () => setSelectedCategorias([]);
  const selectAllVendedores = () => setSelectedVendedores([...allVendedores]);
  const clearVendedores = () => setSelectedVendedores([]);

  const filtered = useMemo(() => {
    const expandedSelectedLojas = [...selectedLojas];

    // Exclude supervisors from comissoes table (their data has zeros, we calc separately)
    return allComissoes.filter(c => {
      if (!expandedSelectedLojas.includes(c.loja_id)) return false;
      if (c.cargo === 'Supervisor') return false; 
      if (selectedVendedores.length > 0 && !selectedVendedores.includes(c.vendedor_nome)) return false;
      return true;
    });
  }, [allComissoes, selectedLojas, selectedVendedores]);

  const resultsByLoja = useMemo(() => {
    const map: Record<string, LojaResult> = {};

    const ensureLoja = (lojaId: string) => {
      if (!map[lojaId]) {
        map[lojaId] = {
          lojaId,
          lojaNome: LOJAS[lojaId as keyof typeof LOJAS] || lojaId,
          totalGeral: 0,
          porCategoria: {},
          vendedores: [],
        };
      }
      return map[lojaId];
    };

    filtered.forEach(c => {
      // Agrupar Natal e Natal Tenfront
      const effectiveLojaId = c.loja_id;
      const loja = ensureLoja(effectiveLojaId);
      const det = c.comissao_detalhada as Record<string, number> | null;
      let totalVendedor = 0;
      const vendedorCats: Record<string, number> = {};

      categorias.forEach(cat => {
        const val = det?.[cat] || 0;
        vendedorCats[cat] = val;
        totalVendedor += val;
        loja.porCategoria[cat] = (loja.porCategoria[cat] || 0) + val;
      });

      loja.totalGeral += totalVendedor;
      loja.vendedores.push({
        nome: c.vendedor_nome,
        cargo: c.cargo,
        totalCategorias: totalVendedor,
        porCategoria: vendedorCats,
      });
    });

    // Inject supervisor commissions
    if (incluirSupervisao) {
      // Group supervisor comissoes by supervisor+loja
      const supervisorByLojaAndName: Record<string, Record<string, Record<string, number>>> = {};
      
      supervisorComissoes.forEach(sc => {
        // Agrupar Natal e Natal Tenfront para supervisores também
        const effectiveLojaId = sc.lojaId;
        const key = effectiveLojaId;
        if (!supervisorByLojaAndName[key]) supervisorByLojaAndName[key] = {};
        if (!supervisorByLojaAndName[key][sc.nome]) supervisorByLojaAndName[key][sc.nome] = {};
        
        Object.entries(sc.porCategoria).forEach(([cat, val]) => {
          supervisorByLojaAndName[key][sc.nome][cat] = (supervisorByLojaAndName[key][sc.nome][cat] || 0) + val;
        });
      });

      Object.entries(supervisorByLojaAndName).forEach(([lojaId, supervisors]) => {
        const loja = ensureLoja(lojaId);
        
        Object.entries(supervisors).forEach(([nome, cats]) => {
          let totalVendedor = 0;
          const vendedorCats: Record<string, number> = {};

          categorias.forEach(cat => {
            const val = cats[cat] || 0;
            vendedorCats[cat] = val;
            totalVendedor += val;
            loja.porCategoria[cat] = (loja.porCategoria[cat] || 0) + val;
          });

          loja.totalGeral += totalVendedor;
          loja.vendedores.push({
            nome: `${nome} (Sup.)`,
            cargo: 'Supervisor',
            totalCategorias: totalVendedor,
            porCategoria: vendedorCats,
          });
        });
      });
    }

    Object.values(map).forEach(l => {
      l.vendedores.sort((a, b) => b.totalCategorias - a.totalCategorias);
    });

    return Object.values(map).sort((a, b) => b.totalGeral - a.totalGeral);
  }, [filtered, categorias, incluirSupervisao, supervisorComissoes]);

  const grandTotal = resultsByLoja.reduce((s, l) => s + l.totalGeral, 0);

  const chartData = resultsByLoja.map(l => ({
    loja: l.lojaNome,
    total: l.totalGeral,
  }));

  // PDF Generation
  const gerarPdf = useCallback(() => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 15;

      const PRIMARY = [30, 58, 138] as [number, number, number];
      const ACCENT = [41, 128, 185] as [number, number, number];
      const DARK = [44, 62, 80] as [number, number, number];
      const LIGHT_BG = [245, 247, 250] as [number, number, number];
      const WHITE = [255, 255, 255] as [number, number, number];

      const addHeader = (pageNum: number, totalPages?: number) => {
        doc.setFillColor(...PRIMARY);
        doc.rect(0, 0, pageW, 3, 'F');

        try {
          doc.addImage(logoLider, 'JPEG', margin, 8, 28, 14);
        } catch { /* fallback */ }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(...PRIMARY);
        doc.text('LÍDER CELULARES', margin + 32, 15);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text('Sistema de Comissões', margin + 32, 21);

        doc.setFillColor(...LIGHT_BG);
        doc.roundedRect(pageW - margin - 90, 7, 90, 18, 3, 3, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...DARK);
        doc.text('Relatório de Comissões', pageW - margin - 85, 14);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...ACCENT);
        doc.text(formatMonth(mes), pageW - margin - 85, 21);

        doc.setDrawColor(...PRIMARY);
        doc.setLineWidth(0.5);
        doc.line(margin, 28, pageW - margin, 28);

        if (pageNum) {
          doc.setFontSize(7);
          doc.setTextColor(150, 150, 150);
          const pageText = totalPages ? `Página ${pageNum} de ${totalPages}` : `Página ${pageNum}`;
          doc.text(pageText, pageW - margin, pageH - 8, { align: 'right' });
        }
      };

      const addFooter = () => {
        doc.setFillColor(...PRIMARY);
        doc.rect(0, pageH - 4, pageW, 4, 'F');
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        const dataGeracao = new Date().toLocaleDateString('pt-BR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });
        doc.text(`Gerado em ${dataGeracao}`, margin, pageH - 8);
      };

      let pageCount = 1;
      addHeader(pageCount);

      let y = 35;

      // Summary card
      doc.setFillColor(...PRIMARY);
      doc.roundedRect(margin, y, pageW - 2 * margin, 22, 3, 3, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(...WHITE);
      doc.text('TOTAL GERAL EM COMISSÕES', margin + 8, y + 9);
      doc.setFontSize(16);
      doc.text(formatCurrencyPdf(grandTotal), margin + 8, y + 18);

      const badges = [
        `${resultsByLoja.length} loja(s)`,
        `${categorias.length} categoria(s)`,
        incluirSupervisao ? 'Com Supervisão' : 'Sem Supervisão',
      ];
      let badgeX = pageW - margin - 8;
      doc.setFontSize(8);
      badges.reverse().forEach(badge => {
        const w = doc.getTextWidth(badge) + 8;
        doc.setFillColor(255, 255, 255, 0.2);
        doc.roundedRect(badgeX - w, y + 12, w, 7, 2, 2, 'F');
        doc.setTextColor(220, 230, 255);
        doc.text(badge, badgeX - w + 4, y + 17);
        badgeX -= w + 4;
      });

      y += 30;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...DARK);
      doc.text('Resumo por Loja', margin, y);
      y += 6;

      autoTable(doc, {
        startY: y,
        head: [['Loja', ...categorias, 'TOTAL']],
        body: [
          ...resultsByLoja.map(l => [
            l.lojaNome,
            ...categorias.map(c => l.porCategoria[c] > 0 ? formatCurrencyPdf(l.porCategoria[c]) : '-'),
            formatCurrencyPdf(l.totalGeral),
          ]),
          [
            { content: 'TOTAL GERAL', styles: { fontStyle: 'bold' as const } },
            ...categorias.map(cat => {
              const total = resultsByLoja.reduce((s, l) => s + (l.porCategoria[cat] || 0), 0);
              return { content: total > 0 ? formatCurrencyPdf(total) : '-', styles: { fontStyle: 'bold' as const } };
            }),
            { content: formatCurrencyPdf(grandTotal), styles: { fontStyle: 'bold' as const } },
          ],
        ],
        margin: { left: margin, right: margin },
        theme: 'grid',
        headStyles: {
          fillColor: PRIMARY,
          textColor: WHITE,
          fontSize: 7,
          fontStyle: 'bold',
          halign: 'center',
          cellPadding: 3,
        },
        bodyStyles: {
          fontSize: 7,
          textColor: DARK,
          cellPadding: 2.5,
        },
        alternateRowStyles: {
          fillColor: LIGHT_BG,
        },
        columnStyles: {
          0: { fontStyle: 'bold', halign: 'left' },
          ...Object.fromEntries(
            categorias.map((_, i) => [i + 1, { halign: 'right' as const }])
          ),
          [categorias.length + 1]: { halign: 'right', fontStyle: 'bold', textColor: PRIMARY },
        },
      });

      addFooter();

      // Per-loja detail pages
      resultsByLoja.forEach(loja => {
        doc.addPage();
        pageCount++;
        addHeader(pageCount);

        let detailY = 35;

        doc.setFillColor(...ACCENT);
        doc.roundedRect(margin, detailY, pageW - 2 * margin, 14, 3, 3, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(...WHITE);
        doc.text(loja.lojaNome.toUpperCase(), margin + 6, detailY + 6);
        doc.setFontSize(10);
        doc.text(formatCurrencyPdf(loja.totalGeral), pageW - margin - 6, detailY + 6, { align: 'right' });

        doc.setFontSize(8);
        doc.setTextColor(220, 235, 255);
        doc.text(`${loja.vendedores.length} colaborador(es) • ${formatMonth(mes)}`, margin + 6, detailY + 12);

        detailY += 20;

        autoTable(doc, {
          startY: detailY,
          head: [['#', 'Vendedor', 'Cargo', ...categorias, 'TOTAL']],
          body: [
            ...loja.vendedores.map((v, idx) => [
              (idx + 1).toString(),
              v.nome,
              v.cargo,
              ...categorias.map(c => v.porCategoria[c] > 0 ? formatCurrencyPdf(v.porCategoria[c]) : '-'),
              formatCurrencyPdf(v.totalCategorias),
            ]),
            [
              '',
              { content: 'SUBTOTAL', styles: { fontStyle: 'bold' as const } },
              '',
              ...categorias.map(c => ({
                content: loja.porCategoria[c] > 0 ? formatCurrencyPdf(loja.porCategoria[c]) : '-',
                styles: { fontStyle: 'bold' as const },
              })),
              { content: formatCurrencyPdf(loja.totalGeral), styles: { fontStyle: 'bold' as const } },
            ],
          ],
          margin: { left: margin, right: margin },
          theme: 'grid',
          headStyles: {
            fillColor: DARK,
            textColor: WHITE,
            fontSize: 7,
            fontStyle: 'bold',
            halign: 'center',
            cellPadding: 3,
          },
          bodyStyles: {
            fontSize: 7,
            textColor: DARK,
            cellPadding: 2.5,
          },
          alternateRowStyles: {
            fillColor: LIGHT_BG,
          },
          columnStyles: {
            0: { halign: 'center', cellWidth: 8 },
            1: { fontStyle: 'bold', halign: 'left' },
            2: { halign: 'center', cellWidth: 18 },
            ...Object.fromEntries(
              categorias.map((_, i) => [i + 3, { halign: 'right' as const }])
            ),
            [categorias.length + 3]: { halign: 'right', fontStyle: 'bold', textColor: PRIMARY },
          },
        });

        addFooter();
      });

      // Update page numbers
      const total = doc.getNumberOfPages();
      for (let i = 1; i <= total; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`Página ${i} de ${total}`, pageW - margin, pageH - 8, { align: 'right' });
      }

      doc.save(`relatorio-comissoes-${mes}.pdf`);
      toast.success('PDF gerado com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar PDF');
    }
  }, [resultsByLoja, categorias, mes, grandTotal, incluirSupervisao]);

  const gerarExcel = useCallback(() => {
    try {
      const data: any[] = [];
      
      // Header for summary
      data.push(['RELATÓRIO DE COMISSÕES - ' + formatMonth(mes).toUpperCase()]);
      data.push(['GERADO EM: ' + new Date().toLocaleString('pt-BR')]);
      data.push(['TOTAL GERAL EM COMISSÕES: ', formatCurrency(grandTotal)]);
      data.push([]); // Empty row
      
      // Resumo por Loja
      data.push(['RESUMO POR LOJA']);
      const resumoHeader = ['Loja', ...categorias, 'TOTAL'];
      data.push(resumoHeader);
      
      resultsByLoja.forEach(l => {
        const row = [
          l.lojaNome,
          ...categorias.map(c => l.porCategoria[c] || 0),
          l.totalGeral
        ];
        data.push(row);
      });
      
      // Total Geral row
      const totalGeralRow = [
        'TOTAL GERAL',
        ...categorias.map(cat => resultsByLoja.reduce((s, l) => s + (l.porCategoria[cat] || 0), 0)),
        grandTotal
      ];
      data.push(totalGeralRow);
      data.push([]); // Empty row
      data.push([]); // Empty row
      
      // Detalhado por Loja
      resultsByLoja.forEach(loja => {
        data.push([loja.lojaNome.toUpperCase()]);
        const header = ['Vendedor', 'Cargo', ...categorias, 'TOTAL'];
        data.push(header);
        
        loja.vendedores.forEach(v => {
          const row = [
            v.nome,
            v.cargo,
            ...categorias.map(c => v.porCategoria[c] || 0),
            v.totalCategorias
          ];
          data.push(row);
        });
        
        // Subtotal row
        const subtotalRow = [
          'SUBTOTAL',
          '',
          ...categorias.map(cat => loja.porCategoria[cat] || 0),
          loja.totalGeral
        ];
        data.push(subtotalRow);
        data.push([]); // Empty row
      });
      
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Comissões");
      
      XLSX.writeFile(wb, `relatorio-comissoes-${mes}.xlsx`);
      toast.success('Excel gerado com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar Excel');
    }
  }, [resultsByLoja, categorias, mes, grandTotal]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-light">Relatórios Numéricos</h1>
        <p className="text-muted-foreground">Análise de comissões por categoria, loja e vendedor</p>
      </div>

      {/* Filtros */}
      <div className="space-y-4">
        {/* Mês + Ações */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <Label>Mês</Label>
                <Select value={mes} onValueChange={(v) => { setMes(v); setShowReport(false); }}>
                  <SelectTrigger className="w-[180px]">
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
                          <SelectItem key={valor} value={valor}>{formatMonth(valor)}</SelectItem>
                        );
                      }
                      return meses;
                    })()}
                  </SelectContent>
                </Select>
              </div>

              {/* Supervisão toggle */}
              <label className="flex items-center gap-2 cursor-pointer bg-muted/50 rounded-lg px-3 py-2 border border-border">
                <Checkbox
                  checked={incluirSupervisao}
                  onCheckedChange={(v) => setIncluirSupervisao(!!v)}
                />
                <span className="text-sm font-medium">Incluir Supervisão</span>
              </label>

              <div className="flex-1" />

              <Button onClick={() => setShowReport(true)} disabled={isLoading || selectedLojas.length === 0}>
                <FileText size={18} className="mr-2" />
                Gerar Relatório
              </Button>

              {showReport && resultsByLoja.length > 0 && (
                <div className="flex gap-2">
                  <Button onClick={gerarPdf} variant="outline" className="border-primary text-primary hover:bg-primary hover:text-primary-foreground">
                    <Download size={18} className="mr-2" />
                    Baixar PDF
                  </Button>
                  <Button onClick={gerarExcel} variant="outline" className="border-green-600 text-green-600 hover:bg-green-600 hover:text-foreground">
                    <FileSpreadsheet size={18} className="mr-2" />
                    Baixar Excel
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lojas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Lojas
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {LOJAS_IDS.map(lojaId => {
                const isSelected = selectedLojas.includes(lojaId);
                return (
                  <button
                    key={lojaId}
                    onClick={() => toggleLoja(lojaId)}
                    className={cn(
                      'px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border',
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
                        : 'bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                    )}
                  >
                    {LOJAS[lojaId]}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Vendedores */}
        {allVendedores.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Vendedores
                </CardTitle>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={selectAllVendedores} className="h-7 text-xs">
                    Selecionar todos
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearVendedores} className="h-7 text-xs">
                    Limpar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                {allVendedores.map(vend => {
                  const isSelected = selectedVendedores.length === 0 || selectedVendedores.includes(vend);
                  return (
                    <button
                      key={vend}
                      onClick={() => toggleVendedor(vend)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border',
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
                      )}
                    >
                      {vend}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Categorias */}
        {allCategorias.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                  Categorias de Comissão
                </CardTitle>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={selectAllCategorias} className="h-7 text-xs">
                    Selecionar todas
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearCategorias} className="h-7 text-xs">
                    Limpar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap gap-2">
                {allCategorias.map(cat => {
                  const isSelected = selectedCategorias.length === 0 || selectedCategorias.includes(cat);
                  return (
                    <button
                      key={cat}
                      onClick={() => toggleCategoria(cat)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border',
                        isSelected
                          ? 'bg-accent text-accent-foreground border-accent shadow-sm'
                          : 'bg-card text-muted-foreground border-border hover:border-accent/50 hover:text-foreground'
                      )}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Resultados */}
      {isLoading && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Carregando...</CardContent></Card>
      )}

      {showReport && !isLoading && resultsByLoja.length === 0 && (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhuma comissão encontrada para os filtros selecionados.</CardContent></Card>
      )}

      {showReport && !isLoading && resultsByLoja.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="font-light">
                Resumo de Comissões — {formatMonth(mes)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-card/50 border border-border/50 rounded-lg p-4 inline-block">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Geral em Comissões</p>
                <p className="text-2xl font-semibold text-primary">{formatCurrency(grandTotal)}</p>
                <p className="text-xs text-muted-foreground mt-1">{categorias.join(', ')}</p>
              </div>

              {chartData.length > 1 && (
                <div className="bg-card/50 rounded-lg p-4">
                  <h4 className="font-medium mb-3 text-center">Comissões por Loja</h4>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="loja" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Comissão" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {resultsByLoja.map(loja => (
                <div key={loja.lojaId} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-lg">{loja.lojaNome}</h4>
                    <span className="text-primary font-semibold">{formatCurrency(loja.totalGeral)}</span>
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Vendedor</TableHead>
                          <TableHead>Cargo</TableHead>
                          {categorias.map(cat => (
                            <TableHead key={cat} className="text-right text-xs whitespace-nowrap">{cat}</TableHead>
                          ))}
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loja.vendedores.map(v => (
                          <TableRow key={v.nome} className={v.cargo === 'Supervisor' ? 'bg-accent/20' : ''}>
                            <TableCell className="whitespace-nowrap">{v.nome}</TableCell>
                            <TableCell className="text-muted-foreground text-xs">{v.cargo}</TableCell>
                            {categorias.map(cat => (
                              <TableCell key={cat} className="text-right text-sm">
                                {v.porCategoria[cat] > 0 ? formatCurrency(v.porCategoria[cat]) : '-'}
                              </TableCell>
                            ))}
                            <TableCell className="text-right font-medium text-primary">
                              {formatCurrency(v.totalCategorias)}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/30 font-medium">
                          <TableCell colSpan={2}>Subtotal</TableCell>
                          {categorias.map(cat => (
                            <TableCell key={cat} className="text-right text-sm">
                              {loja.porCategoria[cat] > 0 ? formatCurrency(loja.porCategoria[cat]) : '-'}
                            </TableCell>
                          ))}
                          <TableCell className="text-right text-primary font-bold">
                            {formatCurrency(loja.totalGeral)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
