import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { KeyRound, Copy, UserPlus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { LOJAS } from '@/lib/constants';
import { toast } from 'sonner';

const ALFA = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const genSenha = () => Array.from({ length: 10 }, () => ALFA[Math.floor(Math.random() * ALFA.length)]).join('') + '@';
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '.');

interface Row { id: string; nome: string; cargo: string; user_id: string | null; }

interface Props { lojaId: string; }

export const GerenciarAcessosCard = ({ lojaId }: Props) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [credencial, setCredencial] = useState<{ nome: string; email?: string; senha: string } | null>(null);

  const { data: rows = [], refetch } = useQuery({
    queryKey: ['acessos-loja', lojaId],
    queryFn: async (): Promise<Row[]> => {
      const { data: colabs } = await supabase.from('colaboradores').select('id, nome, cargo').eq('loja_id', lojaId).order('nome');
      const { data: roles } = await supabase.from('user_roles').select('user_id, colaborador_id');
      const map = new Map((roles ?? []).filter((r) => r.colaborador_id).map((r) => [r.colaborador_id as string, r.user_id]));
      return (colabs ?? []).map((c) => ({ id: c.id, nome: c.nome, cargo: c.cargo, user_id: map.get(c.id) ?? null }));
    },
    enabled: !!lojaId,
  });

  const resetar = async (r: Row) => {
    if (!r.user_id) return;
    setBusy(r.id);
    const senha = genSenha();
    const { error } = await supabase.functions.invoke('manage-user', { body: { action: 'update-password', user_id: r.user_id, password: senha } });
    setBusy(null);
    if (error) { toast.error(`Falha ao resetar: ${error.message}`); return; }
    setCredencial({ nome: r.nome, senha });
    toast.success(`Senha de ${r.nome} redefinida`);
  };

  const criar = async (r: Row) => {
    setBusy(r.id);
    const email = `${slug(r.nome)}.${lojaId}@lidercelulares.local`;
    const senha = genSenha();
    const { data, error } = await supabase.functions.invoke('manage-user', { body: { action: 'create', email, password: senha } });
    if (error || !data?.user?.id) { setBusy(null); toast.error(`Falha ao criar: ${error?.message ?? 'sem id'}`); return; }
    const role = r.cargo === 'Supervisor' ? 'supervisao' : 'colaborador';
    await supabase.from('user_roles').insert({ user_id: data.user.id, role, colaborador_id: r.id });
    setBusy(null);
    setCredencial({ nome: r.nome, email, senha });
    toast.success(`Acesso criado para ${r.nome}`);
    refetch();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound size={16} className="text-primary" /> Acessos — {LOJAS[lojaId as keyof typeof LOJAS] ?? lojaId}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {credencial && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
            <p className="font-medium">{credencial.nome}</p>
            {credencial.email && <p className="text-xs text-muted-foreground">{credencial.email}</p>}
            <div className="flex items-center gap-2 mt-1">
              <code className="text-sm font-bold">{credencial.senha}</code>
              <Button variant="ghost" size="icon" onClick={() => { navigator.clipboard?.writeText(credencial.senha); toast.success('Senha copiada'); }} aria-label="Copiar senha">
                <Copy size={14} />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Anote e entregue por canal seguro — não fica visível depois.</p>
          </div>
        )}
        <div className="divide-y divide-border/40">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span><span className="font-medium">{r.nome}</span> <span className="text-muted-foreground text-xs">· {r.cargo}{!r.user_id && ' · sem acesso'}</span></span>
              {r.user_id ? (
                <Button variant="outline" size="sm" disabled={busy === r.id} onClick={() => resetar(r)}>
                  <KeyRound size={14} /> Resetar senha
                </Button>
              ) : (
                <Button variant="default" size="sm" disabled={busy === r.id} onClick={() => criar(r)}>
                  <UserPlus size={14} /> Criar acesso
                </Button>
              )}
            </div>
          ))}
          {rows.length === 0 && <p className="text-sm text-muted-foreground py-2">Nenhum colaborador nesta loja.</p>}
        </div>
      </CardContent>
    </Card>
  );
};
