import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Smartphone, Shield, ShoppingBag, Package } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

export interface RankingItem {
  nome: string;
  loja: string;
  lojaId: string;
  total: number;
  smartphones: number;
  servicos: number;
  acessorios: number;
  geral: number;
  cases?: number;
  pelicula?: number;
  vendas?: number;
}

interface Props {
  ranking: RankingItem[];
  allConfigs?: Record<string, { numericConfig: Record<string, number> }>;
}

const medalha = (i: number) =>
  i === 0 ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-background'
    : i === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-background'
      : i === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-800 text-foreground'
        : 'bg-muted border border-border text-muted-foreground';

const faseServico = (cfg: Record<string, number> | undefined, s: number) => {
  if (!cfg) return null;
  const f1 = cfg.servicos_meta_fase1 || 1500;
  const f2 = cfg.servicos_meta_fase2 || 2000;
  const f3 = cfg.servicos_meta_fase3 || 2500;
  if (s >= f3) return { label: 'F3 — Máximo', color: 'text-success' };
  if (s >= f2) return { label: `F2 · falta ${formatCurrency(f3 - s)} p/ F3`, color: 'text-warning' };
  if (s >= f1) return { label: `F1 · falta ${formatCurrency(f2 - s)} p/ F2`, color: 'text-warning/70' };
  return { label: `Falta ${formatCurrency(f1 - s)} p/ F1`, color: 'text-destructive/70' };
};

export const RankingColaboradores = ({ ranking, allConfigs }: Props) => (
  <Card>
    <CardHeader className="pb-4 border-b border-border/50 p-4 sm:p-6">
      <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
        <span className="text-primary">#</span> Top Colaboradores (Vendas)
      </CardTitle>
    </CardHeader>
    <CardContent className="p-0">
      {ranking.length === 0 ? (
        <p className="text-center text-muted-foreground py-8 text-sm">Nenhum dado de colaboradores cadastrados para o período.</p>
      ) : (
        <div className="divide-y divide-border/50">
          {ranking.slice(0, 10).map((item, index) => {
            const faltaFase = faseServico(allConfigs?.[item.lojaId]?.numericConfig, item.servicos);
            return (
              <div key={item.nome} className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-accent/50 transition-colors">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm flex-shrink-0 ${medalha(index)}`}>{index + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm sm:text-base truncate">{item.nome}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">{item.loja}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs mt-1 text-muted-foreground tabular-nums">
                    <span className="flex items-center gap-1"><Smartphone size={12} className="text-primary" /> {formatCurrency(item.smartphones)}</span>
                    <span className="flex items-center gap-1"><Shield size={12} className="text-emerald-400" /> {formatCurrency(item.servicos)}</span>
                    <span className="flex items-center gap-1"><ShoppingBag size={12} className="text-teal-400" /> {formatCurrency(item.acessorios)}</span>
                    {item.geral > 0 && <span className="flex items-center gap-1"><Package size={12} /> {formatCurrency(item.geral)}</span>}
                  </div>
                  {faltaFase && <p className={`text-[10px] font-semibold mt-0.5 ${faltaFase.color}`}>Serv: {faltaFase.label}</p>}
                </div>
                <p className="text-sm sm:text-lg font-semibold text-primary flex-shrink-0 tabular-nums">{formatCurrency(item.total)}</p>
              </div>
            );
          })}
        </div>
      )}
    </CardContent>
  </Card>
);
