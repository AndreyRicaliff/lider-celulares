import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { LOJAS, LOJAS_IDS } from '@/lib/constants';
import { CATEGORIAS } from './categorias';
import type { CategoriaId } from './types';

interface Props {
  selectedLoja: string | null;
  setSelectedLoja: (v: string | null) => void;
  selectedMes: string;
  setSelectedMes: (v: string) => void;
  vendedorFiltro: string;
  setVendedorFiltro: (v: string) => void;
  vendedores: string[];
  categoriaFiltro: CategoriaId;
  setCategoriaFiltro: (v: CategoriaId) => void;
  apenasConcluidas: boolean;
  setApenasConcluidas: (v: boolean) => void;
}

const labelCls = 'text-xs font-medium text-muted-foreground uppercase';

export const AuditoriaFiltros = (props: Props) => (
  <Card className="glass-card">
    <CardContent className="p-4 flex flex-wrap gap-4 items-end">
      <div className="space-y-2">
        <label className={labelCls}>Loja</label>
        <Select value={props.selectedLoja || 'todas'} onValueChange={(v) => props.setSelectedLoja(v === 'todas' ? null : v)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as Lojas</SelectItem>
            {LOJAS_IDS.map((id) => <SelectItem key={id} value={id}>{LOJAS[id]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className={labelCls}>Mês</label>
        <input
          type="month"
          value={props.selectedMes}
          onChange={(e) => props.setSelectedMes(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div className="space-y-2">
        <label className={labelCls}>Vendedor</label>
        <Select value={props.vendedorFiltro} onValueChange={props.setVendedorFiltro}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {props.vendedores.map((v) => (
              <SelectItem key={v} value={v}>{v === 'todos' ? 'Todos os Vendedores' : v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className={labelCls}>Categoria</label>
        <Select value={props.categoriaFiltro} onValueChange={(v) => props.setCategoriaFiltro(v as CategoriaId)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CATEGORIAS.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2 pb-2">
        <Checkbox id="concluidas" checked={props.apenasConcluidas} onCheckedChange={(c) => props.setApenasConcluidas(!!c)} />
        <Label htmlFor="concluidas" className="text-xs font-medium cursor-pointer">Apenas concluídas</Label>
      </div>
    </CardContent>
  </Card>
);
