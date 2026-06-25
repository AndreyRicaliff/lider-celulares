import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Smartphone, Shield, ShoppingBag, Layers, Package, FileImage } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import type { RankingItem } from './RankingColaboradores';

interface Props {
  ranking: RankingItem[];
}

const Linha = ({ icon, label, valor }: { icon: React.ReactNode; label: string; valor: number }) => (
  <div className="flex items-center justify-between py-2 border-b border-border/30">
    <span className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</span>
    <span className="text-sm font-semibold tabular-nums">{formatCurrency(valor)}</span>
  </div>
);

export const ColaboradorTab = ({ ranking }: Props) => {
  const [sel, setSel] = useState('');
  const v = ranking.find((r) => r.nome === sel);

  return (
    <div className="space-y-4">
      <Select value={sel} onValueChange={setSel}>
        <SelectTrigger className="w-full sm:w-[340px]">
          <SelectValue placeholder="Selecione um colaborador" />
        </SelectTrigger>
        <SelectContent>
          {ranking.map((r) => (
            <SelectItem key={r.nome} value={r.nome}>{r.nome} · {r.loja}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {v ? (
        <Card className="fx-tile">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-baseline justify-between mb-4">
              <div className="min-w-0">
                <p className="text-lg font-bold truncate">{v.nome}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wide truncate">{v.loja}{v.vendas ? ` · ${v.vendas} vendas` : ''}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-2xl font-bold text-primary tabular-nums">{formatCurrency(v.total)}</p>
                <p className="text-[10px] text-muted-foreground uppercase">total vendido</p>
              </div>
            </div>
            <Linha icon={<Smartphone size={14} className="text-primary" />} label="Smartphones" valor={v.smartphones} />
            <Linha icon={<Shield size={14} className="text-emerald-400" />} label="Serviços" valor={v.servicos} />
            <Linha icon={<ShoppingBag size={14} className="text-teal-400" />} label="Acessórios" valor={v.acessorios} />
            {v.cases !== undefined && <Linha icon={<Layers size={14} className="text-cyan-400" />} label="Cases" valor={v.cases} />}
            {v.pelicula !== undefined && <Linha icon={<FileImage size={14} className="text-lime-400" />} label="Película" valor={v.pelicula} />}
            <Linha icon={<Package size={14} className="text-muted-foreground" />} label="Geral" valor={v.geral} />
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground py-8 text-center">Selecione um colaborador para ver o detalhe das vendas.</p>
      )}
    </div>
  );
};
