import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { FileSearch, FileSpreadsheet, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/appStore';
import { LOJAS } from '@/lib/constants';
import { useAuditoriaData } from '@/components/auditoria/useAuditoriaData';
import { AuditoriaFiltros } from '@/components/auditoria/AuditoriaFiltros';
import { ResumoVendedoresTable } from '@/components/auditoria/ResumoVendedoresTable';
import { AtendimentosTable } from '@/components/auditoria/AtendimentosTable';
import { matchCategoria } from '@/components/auditoria/categorias';
import { calcTotalReal, isConcluida } from '@/components/auditoria/auditoria-utils';
import type { AtendimentoAudit, ResumoVendedor, CategoriaId } from '@/components/auditoria/types';

const itemNaCategoria = (a: AtendimentoAudit, categoria: CategoriaId): boolean =>
  (a.detalhes_brutos || []).some((info) => (info.Venda || []).some((v) => matchCategoria(v, categoria)));

export const AuditoriaVendasPage = () => {
  const { selectedLoja, selectedMes, setSelectedLoja, setSelectedMes } = useAppStore();
  const [vendedorFiltro, setVendedorFiltro] = useState('todos');
  const [categoriaFiltro, setCategoriaFiltro] = useState<CategoriaId>('geral');
  const [apenasConcluidas, setApenasConcluidas] = useState(true);

  const { atendimentos, tabelaPrecos, isLoading, syncMutation } = useAuditoriaData({ selectedLoja, selectedMes });

  const vendedores = useMemo(
    () => ['todos', ...Array.from(new Set(atendimentos.map((a) => a.vendedor_nome))).sort()],
    [atendimentos],
  );

  const base = useMemo(
    () => (apenasConcluidas ? atendimentos.filter((a) => isConcluida(a.status)) : atendimentos),
    [atendimentos, apenasConcluidas],
  );

  const filteredAtendimentos = useMemo(() => {
    let result = base;
    if (vendedorFiltro !== 'todos') result = result.filter((a) => a.vendedor_nome === vendedorFiltro);
    if (categoriaFiltro !== 'geral') result = result.filter((a) => itemNaCategoria(a, categoriaFiltro));
    return result;
  }, [base, vendedorFiltro, categoriaFiltro]);

  const resumoVendedores = useMemo(() => {
    const summary: Record<string, ResumoVendedor> = {};
    base.forEach((a) => {
      const nome = a.vendedor_nome;
      summary[nome] ??= { nome, atendimentos: 0, total: 0, totalReal: 0, alertas: 0, qtdCategoria: 0 };
      summary[nome].atendimentos += 1;
      summary[nome].total += a.valor_total || 0;
      summary[nome].totalReal += calcTotalReal(a.detalhes_brutos);
      summary[nome].alertas += a.alertas_preco || 0;
      if (categoriaFiltro !== 'geral') {
        (a.detalhes_brutos || []).forEach((info) =>
          (info.Venda || []).forEach((v) => {
            if (matchCategoria(v, categoriaFiltro)) summary[nome].qtdCategoria += Number(v.Quantidade) || 1;
          }),
        );
      }
    });
    return Object.values(summary).sort((x, y) => y.total - x.total);
  }, [base, categoriaFiltro]);

  const exportarExcel = () => {
    if (filteredAtendimentos.length === 0) return;
    const data = filteredAtendimentos.map((a) => ({
      Data: a.data_atendimento,
      ID: a.atendimento_id,
      Vendedor: a.vendedor_nome,
      Loja: LOJAS[a.loja_id as keyof typeof LOJAS] || a.loja_id,
      Valor: a.valor_total,
      Status: a.status,
      Itens: (a.detalhes_brutos || [])
        .map((info) => (info.Venda || []).map((v) => `${v.Produto} (${v.Quantidade}x)`).join(', '))
        .join(' | '),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Atendimentos');
    XLSX.writeFile(wb, `auditoria_vendas_${selectedMes}_${selectedLoja || 'todas'}.xlsx`);
    toast.success('Relatório exportado com sucesso!');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileSearch className="text-primary" size={28} />
            Auditoria de Vendas Detalhada
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Conferência de atendimentos originais importados do Tenfront</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} className="flex-1 md:flex-none">
            {syncMutation.isPending ? <Loader2 className="mr-2 animate-spin" size={18} /> : <RefreshCw className="mr-2" size={18} />}
            Forçar Sincronização
          </Button>
          <Button onClick={exportarExcel} disabled={filteredAtendimentos.length === 0} className="flex-1 md:flex-none">
            <FileSpreadsheet className="mr-2" size={18} />
            Exportar Excel
          </Button>
        </div>
      </div>

      <AuditoriaFiltros
        selectedLoja={selectedLoja}
        setSelectedLoja={setSelectedLoja}
        selectedMes={selectedMes}
        setSelectedMes={setSelectedMes}
        vendedorFiltro={vendedorFiltro}
        setVendedorFiltro={setVendedorFiltro}
        vendedores={vendedores}
        categoriaFiltro={categoriaFiltro}
        setCategoriaFiltro={setCategoriaFiltro}
        apenasConcluidas={apenasConcluidas}
        setApenasConcluidas={setApenasConcluidas}
      />

      {atendimentos.length > 0 && (
        <ResumoVendedoresTable resumo={resumoVendedores} categoriaFiltro={categoriaFiltro} onFiltrarVendedor={setVendedorFiltro} />
      )}

      <AtendimentosTable atendimentos={filteredAtendimentos} tabelaPrecos={tabelaPrecos} isLoading={isLoading} />
    </div>
  );
};
