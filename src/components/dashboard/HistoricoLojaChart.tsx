import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { LOJAS, LOJAS_IDS, isIgnoredColumn } from '@/lib/constants';
import { formatCurrency } from '@/lib/formatters';

const LOJA_COLORS: Record<string, string> = {
  'soledade':       '#7048E8',
  'monteiro':       '#08C16A',
  'campina-grande': '#FF8C42',
  'natal':          '#E84855',
  'caruaru':        '#4ECDC4',
};

const MESES_PT = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function mesLabel(mes: string): string {
  const [year, month] = mes.split('-').map(Number);
  return `${MESES_PT[month]}/${String(year).slice(2)}`;
}

function computeTotal(detalhes: Record<string, number>): number {
  const realSjuros = Number(detalhes?.['VALOR REAL (S/ JUROS)'] || 0);
  if (realSjuros > 0) return realSjuros;
  return Object.entries(detalhes || {}).reduce((sum, [k, v]) => {
    if (k !== '_upload_source' && typeof v === 'number' && !isIgnoredColumn(k.toUpperCase())) return sum + v;
    return sum;
  }, 0);
}

interface HistoricoLojaChartProps {
  selectedMes: string;
  lojaId?: string | null;
}

export const HistoricoLojaChart = ({ selectedMes, lojaId }: HistoricoLojaChartProps) => {
  const lastSixMonths = useMemo(() => {
    const months: string[] = [];
    const [year, month] = selectedMes.split('-').map(Number);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return months;
  }, [selectedMes]);

  const { data: vendasHistorico, isLoading } = useQuery({
    queryKey: ['historico-lojas', lastSixMonths[0], lastSixMonths[lastSixMonths.length - 1], lojaId],
    queryFn: async () => {
      let query = supabase
        .from('vendas')
        .select('loja_id, mes, detalhes')
        .gte('mes', lastSixMonths[0])
        .lte('mes', lastSixMonths[lastSixMonths.length - 1]);

      if (lojaId) query = query.eq('loja_id', lojaId);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 10,
  });

  const chartData = useMemo(() => {
    if (!vendasHistorico) return [];

    const byMesLoja: Record<string, Record<string, number>> = {};
    for (const mes of lastSixMonths) {
      byMesLoja[mes] = {};
    }

    for (const v of vendasHistorico) {
      if (!byMesLoja[v.mes]) continue;
      const detalhes = (v.detalhes || {}) as Record<string, number>;
      byMesLoja[v.mes][v.loja_id] = (byMesLoja[v.mes][v.loja_id] || 0) + computeTotal(detalhes);
    }

    return lastSixMonths.map(mes => {
      const entry: Record<string, string | number> = { mes: mesLabel(mes), _raw: mes };
      const lojas = lojaId ? [lojaId] : LOJAS_IDS;
      for (const id of lojas) {
        entry[id] = byMesLoja[mes][id] || 0;
      }
      return entry;
    });
  }, [vendasHistorico, lastSixMonths, lojaId]);

  const lojas = lojaId ? [lojaId] : LOJAS_IDS;
  const hasAnyData = chartData.some(row => lojas.some(id => (row[id] as number) > 0));

  if (!hasAnyData && !isLoading) return null;

  const fmtTick = (v: number) =>
    v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`;

  const fmtTooltip = (v: number, name: string) => [
    formatCurrency(v),
    LOJAS[name as keyof typeof LOJAS] || name,
  ];

  return (
    <Card className="bg-card/40 border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp size={18} className="text-primary" />
          Histórico de Faturamento — 6 meses
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
            Carregando histórico...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <defs>
                {lojas.map(id => (
                  <linearGradient key={id} id={`grad-${id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={LOJA_COLORS[id] || '#888'} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={LOJA_COLORS[id] || '#888'} stopOpacity={0.03} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="mes" tick={{ fill: '#7A9BC4', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmtTick} tick={{ fill: '#7A9BC4', fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
              <Tooltip
                formatter={fmtTooltip as any}
                contentStyle={{ background: '#0F1829', border: '1px solid #1A2D47', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: '#E8EEFF', fontWeight: 600, marginBottom: 4 }}
              />
              {lojas.length > 1 && <Legend formatter={(v) => LOJAS[v as keyof typeof LOJAS] || v} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />}
              {lojas.map(id => (
                <Area
                  key={id}
                  type="monotone"
                  dataKey={id}
                  name={id}
                  stroke={LOJA_COLORS[id] || '#888'}
                  strokeWidth={2}
                  fill={`url(#grad-${id})`}
                  dot={{ r: 3, fill: LOJA_COLORS[id] || '#888', strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
