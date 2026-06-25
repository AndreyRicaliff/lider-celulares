import { Smartphone, ShoppingBag, Shield, Percent } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';

export interface TotaisPorCategoria {
  smartphones: number;
  acessorios: number;
  cases: number;
  pelicula: number;
  servicos: number;
  geral: number;
  assistenciaTecnica: number;
}

interface Props {
  totais: TotaisPorCategoria;
  juros: number;
  totalBruto: number;
}

interface CategoriaItem {
  label: string;
  valor: number;
  cor: string;
  icon: React.ReactNode;
}

const CategoriaCard = ({ label, valor, cor, icon }: CategoriaItem) => (
  <Card className={`border-l-4 ${cor} fx-tile`}>
    <CardContent className="p-3 sm:p-4">
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="flex-shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground uppercase truncate">{label}</p>
          <p className="text-sm sm:text-lg font-bold tabular-nums truncate">{formatCurrency(valor)}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

export const CategoriaCards = ({ totais, juros, totalBruto }: Props) => {
  const itens: CategoriaItem[] = [
    { label: 'Smartphones', valor: totais.smartphones, cor: 'border-l-primary', icon: <Smartphone className="text-primary" size={18} /> },
    { label: 'Acessórios', valor: totais.acessorios, cor: 'border-l-emerald-500/70', icon: <ShoppingBag className="text-emerald-400" size={18} /> },
    { label: 'Cases', valor: totais.cases, cor: 'border-l-teal-500/70', icon: <ShoppingBag className="text-teal-400" size={18} /> },
    { label: 'Película', valor: totais.pelicula, cor: 'border-l-cyan-500/70', icon: <div className="w-[18px] h-[18px] rounded bg-cyan-500/15 flex items-center justify-center text-cyan-400 text-xs font-bold">P</div> },
    { label: 'Serviços', valor: totais.servicos, cor: 'border-l-lime-500/70', icon: <Shield className="text-lime-400" size={18} /> },
    { label: 'Geral', valor: totais.geral, cor: 'border-l-muted-foreground/40', icon: <ShoppingBag className="text-muted-foreground" size={18} /> },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {itens.map((it) => <CategoriaCard key={it.label} {...it} />)}
      {juros > 0 && (
        <Card className="border-l-4 border-l-amber-500 fx-tile">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <Percent className="text-amber-500 flex-shrink-0" size={18} />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground uppercase truncate">Juros Parcelamento</p>
                <p className="text-sm sm:text-lg font-bold tabular-nums truncate text-amber-400">{formatCurrency(juros)}</p>
                <p className="text-[10px] text-muted-foreground truncate">{totalBruto > 0 ? `${((juros / totalBruto) * 100).toFixed(1)}% do bruto` : ''}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
