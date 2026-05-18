import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/formatters';
import { Trophy, Target, Medal } from 'lucide-react';

interface MetaStatusCardProps {
  totalParaPrata: number;
  totalParaOuro: number;
  metaPrata: number;
  metaOuro: number;
  bonusPrata: number;
  bonusOuro: number;
}

export const MetaStatusCard = ({ 
  totalParaPrata,
  totalParaOuro, 
  metaPrata, 
  metaOuro,
  bonusPrata,
  bonusOuro 
}: MetaStatusCardProps) => {
  const atingiuOuro = metaOuro > 0 && totalParaOuro >= metaOuro;
  const atingiuPrata = metaPrata > 0 && totalParaPrata >= metaPrata;
  
  const progressoOuro = metaOuro > 0 ? Math.min((totalParaOuro / metaOuro) * 100, 100) : 0;
  const progressoPrata = metaPrata > 0 ? Math.min((totalParaPrata / metaPrata) * 100, 100) : 0;

  if (atingiuOuro) {
    return (
      <Card className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-yellow-500/50 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-400/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full">
              <Trophy className="text-black" size={28} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold text-yellow-400">🎉 Meta Ouro Atingida!</p>
              </div>
              <p className="text-sm text-muted-foreground">
                Parabéns! A loja alcançou {formatCurrency(totalParaOuro)} de {formatCurrency(metaOuro)}
              </p>
              <p className="text-sm text-yellow-400/80 mt-1">
                Bônus de R$ {bonusOuro.toFixed(2)} por funcionário
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-yellow-400">{progressoOuro.toFixed(0)}%</p>
            </div>
          </div>
          <Progress value={100} className="h-2 mt-4 bg-yellow-900/30" />
        </CardContent>
      </Card>
    );
  }

  if (atingiuPrata) {
    return (
      <Card className="bg-gradient-to-r from-gray-400/20 to-gray-500/20 border-gray-400/50 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-gray-300/20 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-gray-300 to-gray-500 rounded-full">
              <Medal className="text-black" size={28} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold text-gray-300">🥈 Meta Prata Atingida!</p>
              </div>
              <p className="text-sm text-muted-foreground">
                A loja alcançou {formatCurrency(totalParaPrata)}. Faltam {formatCurrency(metaOuro - totalParaOuro)} para Meta Ouro
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Bônus de R$ {bonusPrata.toFixed(2)} por funcionário
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-gray-300">{progressoOuro.toFixed(0)}%</p>
              <p className="text-xs text-muted-foreground">da meta ouro</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progresso Meta Ouro</span>
              <span>{formatCurrency(totalParaOuro)} / {formatCurrency(metaOuro)}</span>
            </div>
            <Progress value={progressoOuro} className="h-2 bg-gray-900/30" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Não atingiu nenhuma meta
  return (
    <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30">
      <CardContent className="p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-primary/20 rounded-full">
            <Target className="text-primary" size={24} />
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Progresso das Metas</p>
            <p className="text-xl font-bold">{formatCurrency(totalParaPrata)}</p>
            <p className="text-xs text-muted-foreground">Smartphones + Serviços</p>
          </div>
        </div>
        
        {/* Meta Prata */}
        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gradient-to-br from-gray-300 to-gray-500" />
              <span>Meta Prata</span>
            </div>
            <span>{progressoPrata.toFixed(1)}%</span>
          </div>
          <Progress value={progressoPrata} className="h-2 bg-gray-900/30" />
          <p className="text-xs text-muted-foreground">
            Faltam {formatCurrency(Math.max(0, metaPrata - totalParaPrata))} para atingir
          </p>
        </div>
        
        {/* Meta Ouro */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500" />
              <span>Meta Ouro</span>
            </div>
            <span>{progressoOuro.toFixed(1)}%</span>
          </div>
          <Progress value={progressoOuro} className="h-2 bg-yellow-900/30" />
          <p className="text-xs text-muted-foreground">
            Faltam {formatCurrency(Math.max(0, metaOuro - totalParaOuro))} para atingir
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
