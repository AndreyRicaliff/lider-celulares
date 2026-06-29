import { useEffect, useState } from 'react';
import { Briefcase } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { SUPERVISORES_CONFIG, type SupervisorConfig } from '@/lib/supervisorCalculator';
import { useSupervisorConfigs, useSaveSupervisorConfig, type SupervisorOverride } from '@/hooks/useSupervisorConfig';

const CAMPOS: { key: keyof SupervisorConfig; label: string }[] = [
  { key: 'salarioBase', label: 'Salário base (R$)' },
  { key: 'ajudaCusto', label: 'Ajuda de custo (R$)' },
  { key: 'salarioMinimo', label: 'Salário mínimo (R$)' },
  { key: 'comissaoServicoLoja', label: '% Serviço (loja)' },
  { key: 'comissaoServicoVendaPropria', label: '% Serviço (venda própria)' },
  { key: 'bonusMetaBatida', label: 'Bônus meta (R$)' },
  { key: 'bonusSuperMeta', label: 'Bônus super meta (R$)' },
  { key: 'taxaAdministrativa', label: 'Taxa administrativa (R$)' },
];

const SupervisorRow = ({ nome }: { nome: string }) => {
  const { data: overrides = {} } = useSupervisorConfigs();
  const save = useSaveSupervisorConfig();
  const base = SUPERVISORES_CONFIG[nome];
  const [form, setForm] = useState<Record<string, number>>({});

  useEffect(() => {
    const merged = { ...base, ...(overrides[nome] ?? {}) } as Record<string, number>;
    setForm(Object.fromEntries(CAMPOS.map((c) => [c.key, Number(merged[c.key] ?? 0)])));
  }, [overrides, nome, base]);

  const salvar = () => {
    const config = CAMPOS.reduce((acc, c) => ({ ...acc, [c.key]: Number(form[c.key]) || 0 }), {} as SupervisorOverride);
    save.mutate({ nome, config }, {
      onSuccess: () => toast.success(`Config de ${nome} salva (vale no próximo recálculo)`),
      onError: (e) => toast.error((e as Error).message),
    });
  };

  return (
    <div className="rounded-md border border-border/50 p-3 space-y-3">
      <p className="font-medium text-sm">{nome}</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {CAMPOS.map((c) => (
          <div key={c.key} className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">{c.label}</Label>
            <Input type="number" value={form[c.key] ?? 0} onChange={(e) => setForm((f) => ({ ...f, [c.key]: Number(e.target.value) }))} />
          </div>
        ))}
      </div>
      <Button size="sm" onClick={salvar} disabled={save.isPending}>Salvar {nome}</Button>
    </div>
  );
};

export const SupervisorConfigCard = () => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><Briefcase size={16} className="text-primary" /> Config dos Supervisores</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      {Object.keys(SUPERVISORES_CONFIG).map((nome) => <SupervisorRow key={nome} nome={nome} />)}
      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">
        Salário, comissões e bônus por supervisor. Vale no próximo recálculo da Folha de Supervisão. Lojas de rateio/ajuda de custo seguem o padrão do sistema.
      </p>
    </CardContent>
  </Card>
);
