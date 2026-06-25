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
    { label: 'Smartphones', valor: totais.smartphones, cor: 'border-l-blue-500', icon: <Smartphone className="text-blue-500" size={18} /> },
    { label: 'Acessórios', valor: totais.acessorios, cor: 'border-l-green-500', icon: <ShoppingBag className="text-green-500" size={18} /> },
    { label: 'Cases', valor: totais.cases, cor: 'border-l-pink-500', icon: <ShoppingBag className="text-pink-500" size={18} /> },
    { label: 'Película', valor: totais.pelicula, cor: 'border-l-orange-500', icon: <div className="w-[18px] h-[18px] rounded bg-orange-500/20 flex items-center justify-center text-orange-500 text-xs font-bold">P</div> },
    { label: 'Serviços', valor: totais.servicos, cor: 'border-l-purple-500', icon: <Shield className="text-purple-500" size={18} /> },
    { label: 'Geral', valor: totais.geral, cor: 'border-l-slate-500', icon: <ShoppingBag className="text-slate-500" size={18} /> },
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
