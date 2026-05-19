import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';
import { useVendasDiarias } from '@/hooks/useVendasDiarias';
import { useColaboradores } from '@/hooks/useColaboradores';
import { LOJAS } from '@/lib/constants';
import { Smartphone, Shield, TrendingUp } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface SmartServicosChartProps {
  lojaId?: string | null;
  mes: string;
  dataInicio?: string;
  dataFim?: string;
  forceAllLojas?: boolean;
}

interface VendedorData {
  nome: string;
  smartphones: number;
  servicos: number;
  total: number;
  aproveitamento: number;
  valorSmartphones: number;
  valorServicos: number;
}

const CORES = {
  smartphones: 'hsl(217, 91%, 60%)',
  servicos: 'hsl(142, 71%, 45%)',
};

const normalizeName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

const fmt = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const entry = payload[0]?.payload as VendedorData | undefined;
  const sm = payload.find((p: any) => p.dataKey === 'smartphones')?.value || 0;
  const sv = payload.find((p: any) => p.dataKey === 'servicos')?.value || 0;
  const total = sm + sv;
  const aproveitamento = sm > 0 ? ((sv / sm) * 100).toFixed(1) : '0';

  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-semibold mb-2">{label}</p>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-3 h-3 rounded" style={{ backgroundColor: CORES.smartphones }} />
        <span>Smartphones: <strong>{sm}</strong> un. <span className="text-muted-foreground">· {fmt(entry?.valorSmartphones || 0)}</span></span>
      </div>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-3 h-3 rounded" style={{ backgroundColor: CORES.servicos }} />
        <span>Serviços: <strong>{sv}</strong> un. <span className="text-muted-foreground">· {fmt(entry?.valorServicos || 0)}</span></span>
      </div>
      <p className="text-muted-foreground mt-1 border-t border-border pt-1">
        Total: <strong>{total}</strong> un. · {fmt((entry?.valorSmartphones || 0) + (entry?.valorServicos || 0))}
      </p>
      <p className="mt-1 flex items-center gap-1">
        <TrendingUp size={12} className="text-primary" />
        Aproveitamento: <strong>{aproveitamento}%</strong>
      </p>
    </div>
  );
};

export const SmartServicosChart = ({ lojaId, mes, dataInicio, dataFim, forceAllLojas }: SmartServicosChartProps) => {
  const { data: vendasDiariasSingle = [] } = useVendasDiarias(lojaId || undefined, mes, { forceAllLojas });
  const { data: colaboradores = [] } = useColaboradores(forceAllLojas ? undefined : (lojaId || undefined));

  const vendedorData = useMemo(() => {
    const nomesCadastrados = new Set(colaboradores.map(c => normalizeName(c.nome)));
    const vendedorMap: Record<string, { smartphones: number; servicos: number }> = {};

    vendasDiariasSingle.forEach(v => {
      const vendedorNormalizado = normalizeName(v.vendedor_nome);
      // Incluir vendedores cadastrados OU qualquer vendedor que tenha vendido smartphones/serviços (como o IGOR)
      // para garantir que o total da loja esteja correto.
      if (dataInicio && v.data < dataInicio) return;
      if (dataFim && v.data > dataFim) return;

      const key = v.vendedor_nome.trim();
      if (!vendedorMap[key]) vendedorMap[key] = { smartphones: 0, servicos: 0, valorSmartphones: 0, valorServicos: 0 };
      const det = (v.detalhes || {}) as Record<string, number>;
      const qtdSm = Number(det['__qtd_smartphones']) || 0;
      const qtdSv = Number(det['__qtd_servicos']) || 0;
      vendedorMap[key].smartphones += qtdSm;
      vendedorMap[key].servicos += qtdSv;
      vendedorMap[key].valorSmartphones += Number(v.smartphones) || 0;
      vendedorMap[key].valorServicos += Number(v.servicos) || 0;
    });

    return Object.entries(vendedorMap)
      .map(([nome, vals]): VendedorData => {
        const total = vals.smartphones + vals.servicos;
        const aproveitamento = vals.smartphones > 0 ? (vals.servicos / vals.smartphones) * 100 : 0;
        return { nome, smartphones: vals.smartphones, servicos: vals.servicos, total, aproveitamento, valorSmartphones: vals.valorSmartphones, valorServicos: vals.valorServicos };
      })
      .filter(v => v.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [vendasDiariasSingle, colaboradores, dataInicio, dataFim]);

  const totais = useMemo(() => {
    const sm = vendedorData.reduce((s, v) => s + v.smartphones, 0);
    const sv = vendedorData.reduce((s, v) => s + v.servicos, 0);
    const total = sm + sv;
    const aproveitamento = sm > 0 ? ((sv / sm) * 100).toFixed(1) : '0';
    const valorSm = vendedorData.reduce((s, v) => s + v.valorSmartphones, 0);
    const valorSv = vendedorData.reduce((s, v) => s + v.valorServicos, 0);
    return { smartphones: sm, servicos: sv, total, aproveitamento, valorSmartphones: valorSm, valorServicos: valorSv };
  }, [vendedorData]);

  const chartHeight = Math.max(300, vendedorData.length * 45 + 80);
  const lojaLabel = forceAllLojas ? 'Todas as Unidades' : (lojaId ? LOJAS[lojaId as keyof typeof LOJAS] : 'Todas as Lojas');

  if (vendedorData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="text-blue-500" size={20} />
            Smartphones vs Serviços — {lojaLabel}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          Nenhum dado de vendas diárias disponível para o período.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Smartphone className="text-blue-500" size={20} />
          Smartphones vs Serviços — {lojaLabel}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 text-center">
            <Smartphone className="mx-auto text-blue-500 mb-1" size={18} />
            <p className="text-xs text-muted-foreground">Smartphones</p>
            <p className="text-lg font-bold text-blue-500">{totais.smartphones} un.</p>
            <p className="text-xs text-blue-400/80">{fmt(totais.valorSmartphones)}</p>
          </div>
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-center">
            <Shield className="mx-auto text-green-500 mb-1" size={18} />
            <p className="text-xs text-muted-foreground">Serviços</p>
            <p className="text-lg font-bold text-green-500">{totais.servicos} un.</p>
            <p className="text-xs text-green-400/80">{fmt(totais.valorServicos)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground mt-1">Total</p>
            <p className="text-lg font-bold">{totais.total} un.</p>
            <p className="text-xs text-muted-foreground">{vendedorData.length} vendedores</p>
          </div>
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-center">
            <TrendingUp className="mx-auto text-primary mb-1" size={18} />
            <p className="text-xs text-muted-foreground">Aproveitamento</p>
            <p className="text-lg font-bold text-primary">{totais.aproveitamento}%</p>
            <p className="text-xs text-muted-foreground">serv/smart</p>
          </div>
        </div>

        {/* Horizontal bar chart */}
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={vendedorData} layout="vertical" margin={{ top: 5, right: 50, left: 80, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis
              type="category"
              dataKey="nome"
              tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
              width={75}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="smartphones" name="Smartphones" fill={CORES.smartphones} radius={[0, 4, 4, 0]} barSize={16}>
              <LabelList dataKey="smartphones" position="right" fill="hsl(var(--foreground))" fontSize={10} fontWeight="bold" formatter={(v: number) => v > 0 ? v : ''} />
            </Bar>
            <Bar dataKey="servicos" name="Serviços" fill={CORES.servicos} radius={[0, 4, 4, 0]} barSize={16}>
              <LabelList dataKey="servicos" position="right" fill="hsl(var(--foreground))" fontSize={10} fontWeight="bold" formatter={(v: number) => v > 0 ? v : ''} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Detailed table */}
        <div className="mt-4">
          <p className="text-sm font-semibold mb-2">Detalhamento por Vendedor</p>
          <div className="rounded-md border overflow-auto max-h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Vendedor</TableHead>
                  <TableHead className="text-xs text-center">📱 Smart (un.)</TableHead>
                  <TableHead className="text-xs text-center">📱 Smart (R$)</TableHead>
                  <TableHead className="text-xs text-center">🛡️ Serv. (un.)</TableHead>
                  <TableHead className="text-xs text-center">🛡️ Serv. (R$)</TableHead>
                  <TableHead className="text-xs text-center">Aproveitamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendedorData.map(v => (
                  <TableRow key={v.nome}>
                    <TableCell className="text-xs font-medium">{v.nome}</TableCell>
                    <TableCell className="text-xs text-center text-blue-500 font-semibold">{v.smartphones}</TableCell>
                    <TableCell className="text-xs text-center text-blue-400">{fmt(v.valorSmartphones)}</TableCell>
                    <TableCell className="text-xs text-center text-green-500 font-semibold">{v.servicos}</TableCell>
                    <TableCell className="text-xs text-center text-green-400">{fmt(v.valorServicos)}</TableCell>
                    <TableCell className="text-xs text-center">
                      <span className={`font-semibold ${v.aproveitamento >= 50 ? 'text-green-500' : v.aproveitamento >= 30 ? 'text-yellow-500' : 'text-red-500'}`}>
                        {v.aproveitamento.toFixed(0)}%
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell className="text-xs">TOTAL</TableCell>
                  <TableCell className="text-xs text-center text-blue-500">{totais.smartphones}</TableCell>
                  <TableCell className="text-xs text-center text-blue-400">{fmt(totais.valorSmartphones)}</TableCell>
                  <TableCell className="text-xs text-center text-green-500">{totais.servicos}</TableCell>
                  <TableCell className="text-xs text-center text-green-400">{fmt(totais.valorServicos)}</TableCell>
                  <TableCell className="text-xs text-center text-primary">{totais.aproveitamento}%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
