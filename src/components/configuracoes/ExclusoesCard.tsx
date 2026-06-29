import { useState } from 'react';
import { Trash2, Ban, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useExclusoes, useExclusaoMutations, type Exclusao } from '@/hooks/useExclusoes';

const TIPOS: { value: Exclusao['tipo']; label: string; precisaNome: boolean; precisaValor: boolean }[] = [
  { value: 'vendedor', label: 'Vendedor não comissiona', precisaNome: true, precisaValor: false },
  { value: 'venda', label: 'Venda excluída (valor)', precisaNome: true, precisaValor: true },
  { value: 'supervisor_servico', label: 'Fora do serviço do supervisor', precisaNome: true, precisaValor: false },
  { value: 'botons_loja', label: 'Loja fora dos botons', precisaNome: false, precisaValor: false },
];

interface Props {
  lojaId: string;
  mes: string;
}

export const ExclusoesCard = ({ lojaId, mes }: Props) => {
  const { data: exclusoes = [] } = useExclusoes(lojaId, mes);
  const { adicionar, remover } = useExclusaoMutations(lojaId, mes);
  const [tipo, setTipo] = useState<Exclusao['tipo']>('vendedor');
  const [nome, setNome] = useState('');
  const [valor, setValor] = useState('');

  const meta = TIPOS.find((t) => t.value === tipo)!;

  const handleAdd = () => {
    if (meta.precisaNome && !nome.trim()) { toast.error('Informe o vendedor'); return; }
    adicionar.mutate(
      { tipo, vendedor_nome: meta.precisaNome ? nome : undefined, valor: meta.precisaValor ? Number(valor) || 0 : undefined },
      { onSuccess: () => { toast.success('Exclusão adicionada'); setNome(''); setValor(''); }, onError: (e) => toast.error((e as Error).message) },
    );
  };

  const rotulo = (t: Exclusao['tipo']) => TIPOS.find((x) => x.value === t)?.label ?? t;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Ban size={16} className="text-destructive" /> Exclusões ({mes})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {exclusoes.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma exclusão para esta loja/mês.</p>}
          {exclusoes.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 rounded-md border border-border/50 px-3 py-2 text-sm">
              <span>
                <span className="font-medium">{rotulo(e.tipo)}</span>
                {e.vendedor_nome && <span className="text-muted-foreground"> · {e.vendedor_nome}</span>}
                {e.valor != null && <span className="text-muted-foreground"> · R$ {e.valor}</span>}
              </span>
              <Button variant="ghost" size="icon" onClick={() => remover.mutate(e.id)} aria-label="Remover exclusão">
                <Trash2 size={15} className="text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-2 border-t border-border/40 pt-3">
          <div className="min-w-[200px]">
            <Select value={tipo} onValueChange={(v) => setTipo(v as Exclusao['tipo'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {meta.precisaNome && (
            <Input className="w-40" placeholder="Vendedor" value={nome} onChange={(ev) => setNome(ev.target.value)} />
          )}
          {meta.precisaValor && (
            <Input className="w-32" type="number" placeholder="Valor (R$)" value={valor} onChange={(ev) => setValor(ev.target.value)} />
          )}
          <Button onClick={handleAdd} disabled={adicionar.isPending}><Plus size={15} /> Adicionar</Button>
        </div>
        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">
          Vale no próximo recálculo de comissões. Exclusões históricas (meses fechados) ficam fixas no sistema.
        </p>
      </CardContent>
    </Card>
  );
};
