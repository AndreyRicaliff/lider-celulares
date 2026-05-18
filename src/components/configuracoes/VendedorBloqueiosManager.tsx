import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldBan, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { LOJAS } from '@/lib/constants';

interface Bloqueio {
  id: string;
  vendedor_nome: string;
  loja_id_bloqueada: string;
  ativo: boolean;
  created_at: string;
}

export const VendedorBloqueiosManager = () => {
  const queryClient = useQueryClient();
  const [novoNome, setNovoNome] = useState('');
  const [novaLoja, setNovaLoja] = useState('');

  const { data: bloqueios = [], isLoading } = useQuery({
    queryKey: ['vendedor-bloqueios'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendedor_bloqueios')
        .select('*')
        .order('vendedor_nome');
      if (error) throw error;
      return data as Bloqueio[];
    },
  });

  const addBloqueio = useMutation({
    mutationFn: async ({ vendedor_nome, loja_id_bloqueada }: { vendedor_nome: string; loja_id_bloqueada: string }) => {
      const { error } = await supabase
        .from('vendedor_bloqueios')
        .insert({ vendedor_nome: vendedor_nome.trim().toUpperCase(), loja_id_bloqueada });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendedor-bloqueios'] });
      setNovoNome('');
      setNovaLoja('');
      toast.success('Bloqueio adicionado');
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const toggleBloqueio = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('vendedor_bloqueios')
        .update({ ativo })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendedor-bloqueios'] });
      toast.success('Bloqueio atualizado');
    },
  });

  const deleteBloqueio = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('vendedor_bloqueios')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendedor-bloqueios'] });
      toast.success('Bloqueio removido');
    },
  });

  const lojaOptions = Object.entries(LOJAS);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldBan size={20} />
          Bloqueio de Vendedores por Loja
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Bloqueie vendas de vendedores em lojas específicas. Útil quando um vendedor aparece em múltiplas lojas mas deve ter vendas registradas apenas em uma.
        </p>

        {/* Add new */}
        <div className="flex flex-col sm:flex-row gap-2 items-end">
          <div className="flex-1">
            <Label>Nome do Vendedor</Label>
            <Input
              placeholder="Ex: MAYKON"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-[200px]">
            <Label>Loja a Bloquear</Label>
            <Select value={novaLoja} onValueChange={setNovaLoja}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {lojaOptions.map(([id, nome]) => (
                  <SelectItem key={id} value={id}>{nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            onClick={() => addBloqueio.mutate({ vendedor_nome: novoNome, loja_id_bloqueada: novaLoja })}
            disabled={!novoNome.trim() || !novaLoja || addBloqueio.isPending}
          >
            <Plus size={16} className="mr-1" /> Adicionar
          </Button>
        </div>

        {/* List */}
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Carregando...</p>
        ) : bloqueios.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum bloqueio configurado.</p>
        ) : (
          <div className="space-y-2">
            {bloqueios.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
              >
                <div className="flex items-center gap-3">
                  <Switch
                    checked={b.ativo}
                    onCheckedChange={(checked) => toggleBloqueio.mutate({ id: b.id, ativo: checked })}
                  />
                  <div>
                    <p className="font-medium text-sm">{b.vendedor_nome}</p>
                    <p className="text-xs text-muted-foreground">
                      Bloqueado em: <span className="font-medium">{LOJAS[b.loja_id_bloqueada as keyof typeof LOJAS] || b.loja_id_bloqueada}</span>
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteBloqueio.mutate(b.id)}
                >
                  <Trash2 size={16} className="text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
