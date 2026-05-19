import { useState, useEffect } from 'react';
import {
  useColaboradores,
  useCreateColaboradorComLojas,
  useUpdateColaboradorComLojas,
  useDeleteColaborador,
  useDividas,
  type VinculoLojaInput,
} from '@/hooks/useColaboradores';
import { DividasManager } from '@/components/colaboradores/DividasManager';
import { useUserManagement } from '@/hooks/useUserManagement';
import { supabase } from '@/integrations/supabase/client';
import { LOJAS, LOJAS_IDS, CARGOS } from '@/lib/constants';
import { formatCurrency } from '@/lib/formatters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Key, ChevronDown, ChevronRight, Shield, ShieldCheck, ShieldAlert, User, X } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { Colaborador, ColaboradorComDividas, CargoTipo } from '@/types/database';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

type Permissao = 'vendedor' | 'gerente' | 'supervisor' | 'administrador';

const PERMISSAO_LABELS: Record<Permissao, string> = {
  vendedor: 'Vendedor',
  gerente: 'Gerente',
  supervisor: 'Supervisor',
  administrador: 'Administrador',
};

const PERMISSAO_DESCRIPTIONS: Record<Permissao, string> = {
  vendedor: 'Dashboard + relatório individual (só os próprios dados)',
  gerente: 'Todos os dados da sua loja (metas, dashboard, relatórios)',
  supervisor: 'Dashboard, vendas, folha, supervisão e relatórios (todas as lojas)',
  administrador: 'Acesso total à plataforma',
};

const PERMISSAO_ICONS: Record<Permissao, React.ReactNode> = {
  vendedor: <User size={14} />,
  gerente: <Shield size={14} />,
  supervisor: <ShieldCheck size={14} />,
  administrador: <ShieldAlert size={14} />,
};

const PERMISSAO_COLORS: Record<Permissao, string> = {
  vendedor: 'bg-muted text-muted-foreground',
  gerente: 'bg-primary/10 text-primary',
  supervisor: 'bg-accent text-accent-foreground',
  administrador: 'bg-destructive/10 text-destructive',
};

// Maps permissao to role + acesso_gerente
const permissaoToRole = (permissao: Permissao): { role: 'admin' | 'colaborador' | 'supervisao'; acesso_gerente: boolean } => {
  switch (permissao) {
    case 'administrador': return { role: 'admin', acesso_gerente: false };
    case 'supervisor': return { role: 'supervisao', acesso_gerente: false };
    case 'gerente': return { role: 'colaborador', acesso_gerente: true };
    case 'vendedor': default: return { role: 'colaborador', acesso_gerente: false };
  }
};

// Derives permissao from role + acesso_gerente
const derivePermissao = (role: string, acesso_gerente: boolean): Permissao => {
  if (role === 'admin') return 'administrador';
  if (role === 'supervisao') return 'supervisor';
  if (role === 'colaborador' && acesso_gerente) return 'gerente';
  return 'vendedor';
};

// Wrapper para buscar dívidas do colaborador
const DividasManagerWrapper = ({ colaborador, selectedLoja }: { colaborador: Colaborador; selectedLoja: string }) => {
  const { data: dividas = [] } = useDividas(colaborador.id);
  return <DividasManager colaborador={colaborador} dividas={dividas} selectedLoja={selectedLoja} />;
};

interface LoginInfo {
  user_id: string;
  role: string;
}

export const ColaboradoresPage = () => {
  const { ask: askConfirm, confirmDialogProps } = useConfirmDialog();

  const [selectedLoja, setSelectedLoja] = useState<string>('');
  const [expandedLojas, setExpandedLojas] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingColaborador, setEditingColaborador] = useState<ColaboradorComDividas | null>(null);

  const { data: colaboradores = [], isLoading } = useColaboradores();

  const toggleLoja = (lojaId: string) => {
    setExpandedLojas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(lojaId)) {
        newSet.delete(lojaId);
        if (selectedLoja === lojaId) setSelectedLoja('');
      } else {
        newSet.add(lojaId);
        setSelectedLoja(lojaId);
      }
      return newSet;
    });
  };

  // Filtra por vínculos (colaborador_lojas), não pelo legado loja_id
  const colaboradoresPorLoja = (lojaId: string) =>
    colaboradores.filter(c => (c.lojas || []).some(v => v.loja_id === lojaId));

  // Retorna o vínculo do colaborador para uma loja específica (para exibir valores corretos)
  const getVinculo = (colaborador: ColaboradorComDividas, lojaId: string) =>
    (colaborador.lojas || []).find(v => v.loja_id === lojaId);

  const createColaborador = useCreateColaboradorComLojas();
  const updateColaborador = useUpdateColaboradorComLojas();
  const deleteColaborador = useDeleteColaborador();
  const { createUser, updatePassword, updateEmail, updateRole, deleteUser } = useUserManagement();
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [selectedColaboradorForLogin, setSelectedColaboradorForLogin] = useState<Colaborador | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '', permissao: 'vendedor' as Permissao });
  const [creatingLogin, setCreatingLogin] = useState(false);
  const [colaboradoresComLogin, setColaboradoresComLogin] = useState<Map<string, LoginInfo>>(new Map());
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  
  // Supervisor management (kept for backward compat with existing supervisor-only accounts)
  const [supervisores, setSupervisores] = useState<{ id: string; user_id: string; email: string }[]>([]);
  const [editSupervisorDialogOpen, setEditSupervisorDialogOpen] = useState(false);
  const [selectedSupervisor, setSelectedSupervisor] = useState<{ id: string; user_id: string; email: string } | null>(null);
  const [editSupervisorForm, setEditSupervisorForm] = useState({ username: '', password: '' });
  const [updatingSupervisor, setUpdatingSupervisor] = useState(false);

  // Fetch collaborators that already have logins (with role info)
  useEffect(() => {
    const fetchColaboradoresComLogin = async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('colaborador_id, user_id, role')
        .not('colaborador_id', 'is', null);
      
      if (data) {
        const loginMap = new Map<string, LoginInfo>();
        data.forEach(ur => {
          if (ur.colaborador_id) {
            loginMap.set(ur.colaborador_id as string, { 
              user_id: ur.user_id, 
              role: ur.role 
            });
          }
        });
        setColaboradoresComLogin(loginMap);
      }
    };
    fetchColaboradoresComLogin();
  }, [loginDialogOpen]);

  // Fetch supervisors list (supervisor-only accounts without colaborador)
  const fetchSupervisores = async () => {
    const { data } = await supabase
      .from('user_roles')
      .select('id, user_id, role, colaborador_id')
      .eq('role', 'supervisao')
      .is('colaborador_id', null);
    
    if (data && data.length > 0) {
      const supervisorList: { id: string; user_id: string; email: string }[] = [];
      for (const sup of data) {
        const { data: userData } = await supabase.functions.invoke('manage-user', {
          body: { action: 'get-user', user_id: sup.user_id }
        });
        if (userData?.email) {
          supervisorList.push({
            id: sup.id,
            user_id: sup.user_id,
            email: userData.email
          });
        }
      }
      setSupervisores(supervisorList);
    } else {
      setSupervisores([]);
    }
  };

  useEffect(() => {
    fetchSupervisores();
  }, [editSupervisorDialogOpen]);

  // Form data: nome + lista de vínculos por loja + dados de login (apenas no create)
  const emptyVinculo = (loja_id = ''): VinculoLojaInput => ({
    loja_id,
    cargo: 'Vendedor',
    salario: 0,
    ajuda_custo: 0,
    proporcional_meta: 100,
  });

  const [formData, setFormData] = useState({
    nome: '',
    isSupervisor: false,
    vinculos: [emptyVinculo()] as VinculoLojaInput[],
    criarLogin: false,
    username: '',
    password: '',
    permissao: 'vendedor' as Permissao,
  });

  const resetForm = () => {
    setFormData({
      nome: '',
      isSupervisor: false,
      vinculos: [emptyVinculo(selectedLoja || '')],
      criarLogin: false,
      username: '',
      password: '',
      permissao: 'vendedor',
    });
    setEditingColaborador(null);
  };

  // Helpers para manipular a lista de vínculos no form
  const addVinculo = () => {
    setFormData((prev) => ({ ...prev, vinculos: [...prev.vinculos, emptyVinculo()] }));
  };
  const removeVinculo = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      vinculos: prev.vinculos.filter((_, i) => i !== index),
    }));
  };
  const updateVinculo = (index: number, patch: Partial<VinculoLojaInput>) => {
    setFormData((prev) => ({
      ...prev,
      vinculos: prev.vinculos.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    }));
  };

  const normalizeForEmail = (text: string): string => {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '.')
      .replace(/[^a-z0-9.]/g, '');
  };

  const getColaboradorPermissao = (colaborador: Colaborador): Permissao | null => {
    const loginInfo = colaboradoresComLogin.get(colaborador.id);
    if (!loginInfo) return null;
    return derivePermissao(loginInfo.role, (colaborador as any).acesso_gerente || false);
  };

  const handleCreateLogin = async (colaborador: Colaborador) => {
    const hasExistingLogin = colaboradoresComLogin.has(colaborador.id);
    setIsUpdatingPassword(hasExistingLogin);
    setSelectedColaboradorForLogin(colaborador);
    
    const currentPermissao = getColaboradorPermissao(colaborador) || 'vendedor';
    
    let currentUsername = normalizeForEmail(colaborador.nome);
    
    // Fetch current email for existing logins
    if (hasExistingLogin) {
      const loginInfo = colaboradoresComLogin.get(colaborador.id);
      if (loginInfo) {
        try {
          const { data } = await supabase.functions.invoke('manage-user', {
            body: { action: 'get-user', user_id: loginInfo.user_id }
          });
          if (data?.email) {
            currentUsername = data.email.replace('@lidercelulares.com', '');
          }
        } catch (e) {
          console.error('Error fetching user email:', e);
        }
      }
    }
    
    setLoginForm({ 
      username: currentUsername,
      password: '',
      permissao: currentPermissao,
    });
    setLoginDialogOpen(true);
  };

  const handleSubmitLogin = async () => {
    if (!selectedColaboradorForLogin) return;

    if (!isUpdatingPassword && !loginForm.username) {
      toast.error('Preencha o usuário');
      return;
    }

    if (!isUpdatingPassword && !loginForm.password) {
      toast.error('Preencha a senha');
      return;
    }

    if (loginForm.password && loginForm.password.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres');
      return;
    }

    setCreatingLogin(true);
    try {
      const { role, acesso_gerente } = permissaoToRole(loginForm.permissao);

      if (isUpdatingPassword) {
        const loginInfo = colaboradoresComLogin.get(selectedColaboradorForLogin.id);
        if (!loginInfo) throw new Error('Usuário não encontrado');
        
        // Update password only if provided
        if (loginForm.password) {
          await updatePassword(loginInfo.user_id, loginForm.password);
        }

        // Update email/username if changed
        const newEmail = `${loginForm.username}@lidercelulares.com`;
        await updateEmail(loginInfo.user_id, newEmail);
        
        // Update role if changed
        const currentPermissao = getColaboradorPermissao(selectedColaboradorForLogin) || 'vendedor';
        if (loginForm.permissao !== currentPermissao) {
          await updateRole(loginInfo.user_id, role);
          await supabase
            .from('colaboradores')
            .update({ acesso_gerente })
            .eq('id', selectedColaboradorForLogin.id);
        }
        
        toast.success('Login atualizado com sucesso!');
      } else {
        // Create new login with selected permission
        await createUser({
          email: `${loginForm.username}@lidercelulares.com`,
          password: loginForm.password,
          role,
          colaborador_id: selectedColaboradorForLogin.id
        });
        
        // Set acesso_gerente on colaborador
        await supabase
          .from('colaboradores')
          .update({ acesso_gerente })
          .eq('id', selectedColaboradorForLogin.id);
        
        toast.success('Login criado com sucesso!');
      }
      setLoginDialogOpen(false);
      setSelectedColaboradorForLogin(null);
      setIsUpdatingPassword(false);
    } catch (error: any) {
      const errorMessage = error.message || 'Erro ao processar';
      if (errorMessage.includes('already been registered') || errorMessage.includes('email_exists')) {
        toast.error('Este usuário já existe no sistema');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setCreatingLogin(false);
    }
  };

  const handleEditSupervisor = (sup: { id: string; user_id: string; email: string }) => {
    setSelectedSupervisor(sup);
    const username = sup.email.replace('@lidercelulares.com', '');
    setEditSupervisorForm({ username, password: '' });
    setEditSupervisorDialogOpen(true);
  };

  const handleUpdateSupervisor = async () => {
    if (!selectedSupervisor) return;
    setUpdatingSupervisor(true);
    try {
      const newEmail = `${editSupervisorForm.username}@lidercelulares.com`;
      if (newEmail !== selectedSupervisor.email) {
        await updateEmail(selectedSupervisor.user_id, newEmail);
      }
      if (editSupervisorForm.password && editSupervisorForm.password.length >= 6) {
        await updatePassword(selectedSupervisor.user_id, editSupervisorForm.password);
      } else if (editSupervisorForm.password && editSupervisorForm.password.length < 6) {
        toast.error('A senha deve ter no mínimo 6 caracteres');
        setUpdatingSupervisor(false);
        return;
      }
      toast.success('Supervisão atualizada com sucesso!');
      setEditSupervisorDialogOpen(false);
      setSelectedSupervisor(null);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar');
    } finally {
      setUpdatingSupervisor(false);
    }
  };

  const handleDeleteSupervisor = (sup: { id: string; user_id: string; email: string }) => {
    askConfirm(
      `Deseja excluir o login de supervisão "${sup.email}"?`,
      async () => {
        try {
          await deleteUser(sup.user_id);
          toast.success('Supervisão excluída com sucesso!');
          fetchSupervisores();
        } catch (error: any) {
          toast.error(error.message || 'Erro ao excluir');
        }
      },
      { title: 'Excluir supervisão', confirmLabel: 'Excluir', destructive: true }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome.trim()) {
      toast.error('Informe o nome do colaborador');
      return;
    }

    // Supervisores não têm vínculos de loja (atuam em todas)
    if (formData.isSupervisor) {
      toast.error('Supervisores devem ser cadastrados pelo fluxo antigo (sem loja). Em breve.');
      return;
    }

    if (formData.vinculos.length === 0) {
      toast.error('Selecione ao menos uma loja');
      return;
    }

    // Valida cada vínculo
    const lojasUsadas = new Set<string>();
    for (const v of formData.vinculos) {
      if (!v.loja_id) {
        toast.error('Selecione a loja em todos os vínculos');
        return;
      }
      if (lojasUsadas.has(v.loja_id)) {
        toast.error(`A loja ${LOJAS[v.loja_id as keyof typeof LOJAS]} foi selecionada duas vezes`);
        return;
      }
      lojasUsadas.add(v.loja_id);
    }

    try {
      const { acesso_gerente } = permissaoToRole(formData.permissao);

      if (editingColaborador) {
        await updateColaborador.mutateAsync({
          id: editingColaborador.id,
          nome: formData.nome,
          vinculos: formData.vinculos,
        });
      } else {
        const result = await createColaborador.mutateAsync({
          nome: formData.nome,
          vinculos: formData.vinculos,
        });

        if (formData.criarLogin && formData.username && formData.password && result) {
          if (formData.password.length < 6) {
            toast.error('Colaborador criado, mas a senha deve ter no mínimo 6 caracteres para criar login');
          } else {
            try {
              const { role } = permissaoToRole(formData.permissao);
              await createUser({
                email: `${formData.username}@lidercelulares.com`,
                password: formData.password,
                role,
                colaborador_id: result.id,
              });
              await supabase
                .from('colaboradores')
                .update({ acesso_gerente })
                .eq('id', result.id);
              toast.success('Colaborador e login criados com sucesso!');
            } catch (loginError: any) {
              const errorMessage = loginError.message || '';
              if (errorMessage.includes('already been registered') || errorMessage.includes('email_exists')) {
                toast.error('Colaborador criado, mas este usuário já possui login cadastrado');
              } else {
                toast.error(`Colaborador criado, mas erro ao criar login: ${errorMessage}`);
              }
            }
          }
        }
      }
      setDialogOpen(false);
      resetForm();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message || 'Erro ao salvar colaborador');
    }
  };

  const handleEdit = (colaborador: ColaboradorComDividas) => {
    setEditingColaborador(colaborador);
    const vinculosExistentes = (colaborador.lojas || []).map((v) => ({
      loja_id: v.loja_id,
      cargo: v.cargo,
      salario: Number(v.salario) || 0,
      ajuda_custo: Number(v.ajuda_custo) || 0,
      proporcional_meta: v.proporcional_meta ?? 100,
    }));

    setFormData({
      nome: colaborador.nome,
      isSupervisor: colaborador.cargo === 'Supervisor',
      vinculos: vinculosExistentes.length > 0
        ? vinculosExistentes
        : [{
            loja_id: colaborador.loja_id || '',
            cargo: colaborador.cargo,
            salario: Number(colaborador.salario) || 0,
            ajuda_custo: Number(colaborador.ajuda_custo) || 0,
            proporcional_meta: colaborador.proporcional_meta ?? 100,
          }],
      criarLogin: false,
      username: '',
      password: '',
      permissao: getColaboradorPermissao(colaborador) || 'vendedor',
    });
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    askConfirm(
      'Tem certeza que deseja excluir este colaborador? Esta ação não pode ser desfeita.',
      async () => { await deleteColaborador.mutateAsync(id); },
      { title: 'Excluir colaborador', confirmLabel: 'Excluir', destructive: true }
    );
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-light">Gestão de Colaboradores</h1>
          <p className="text-muted-foreground">Cadastre e gerencie os colaboradores das lojas</p>
        </div>
        
        <div className="flex gap-3 flex-wrap">
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus size={18} className="mr-2" />Novo Colaborador</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingColaborador ? 'Editar' : 'Novo'} Colaborador</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Nome *</Label>
                  <Input
                    value={formData.nome}
                    onChange={e => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Nome do colaborador"
                  />
                </div>

                {/* Lista de vínculos: 1 bloco por loja */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">Lojas vinculadas *</Label>
                    <p className="text-xs text-muted-foreground">
                      Adicione mais de uma loja se o colaborador atua em várias unidades
                    </p>
                  </div>

                  {formData.vinculos.map((v, index) => {
                    // Lojas já escolhidas em outros vínculos (para evitar duplicar)
                    const lojasOcupadasEmOutros = new Set(
                      formData.vinculos
                        .filter((_, i) => i !== index)
                        .map((vv) => vv.loja_id)
                        .filter(Boolean)
                    );

                    return (
                      <div key={index} className="rounded-lg border bg-muted/30 p-3 space-y-3">
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <Label className="text-xs">Loja</Label>
                            <Select
                              value={v.loja_id}
                              onValueChange={(value) => updateVinculo(index, { loja_id: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a loja" />
                              </SelectTrigger>
                              <SelectContent>
                                {LOJAS_IDS.map((id) => (
                                  <SelectItem
                                    key={id}
                                    value={id}
                                    disabled={lojasOcupadasEmOutros.has(id)}
                                  >
                                    {LOJAS[id]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex-1">
                            <Label className="text-xs">Cargo</Label>
                            <Select
                              value={v.cargo}
                              onValueChange={(value) => updateVinculo(index, { cargo: value as CargoTipo })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CARGOS.filter((c) => c !== 'Supervisor').map((cargo) => (
                                  <SelectItem key={cargo} value={cargo}>{cargo}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {formData.vinculos.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeVinculo(index)}
                              title="Remover esta loja"
                            >
                              <X size={16} className="text-destructive" />
                            </Button>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs">Salário (R$)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={v.salario}
                              onChange={(e) => updateVinculo(index, { salario: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Ajuda de Custo (R$)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={v.ajuda_custo}
                              onChange={(e) => updateVinculo(index, { ajuda_custo: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Meta (%)</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={v.proporcional_meta}
                              onChange={(e) => updateVinculo(index, { proporcional_meta: parseInt(e.target.value) || 100 })}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addVinculo}
                    disabled={formData.vinculos.length >= LOJAS_IDS.length}
                  >
                    <Plus size={14} className="mr-2" />
                    Adicionar outra loja
                  </Button>
                </div>

                {!editingColaborador && (
                  <div className="space-y-3 border-t pt-4">
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="criarLogin"
                        checked={formData.criarLogin}
                        onCheckedChange={(checked) => setFormData({ ...formData, criarLogin: checked === true })}
                      />
                      <Label htmlFor="criarLogin" className="cursor-pointer">
                        Criar login para o colaborador
                      </Label>
                    </div>
                    
                    {formData.criarLogin && (
                      <div className="space-y-4 pl-6">
                        <div>
                          <Label>Permissão</Label>
                          <Select value={formData.permissao} onValueChange={v => setFormData({ ...formData, permissao: v as Permissao })}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(PERMISSAO_LABELS) as Permissao[]).map(p => (
                                <SelectItem key={p} value={p}>
                                  <div className="flex items-center gap-2">
                                    {PERMISSAO_ICONS[p]}
                                    <span>{PERMISSAO_LABELS[p]}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-1">
                            {PERMISSAO_DESCRIPTIONS[formData.permissao]}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Usuário</Label>
                            <Input 
                              value={formData.username}
                              onChange={e => setFormData({ ...formData, username: e.target.value })}
                              placeholder="usuario"
                            />
                            <p className="text-xs text-muted-foreground mt-1">@lidercelulares.com</p>
                          </div>
                          <div>
                            <Label>Senha</Label>
                            <Input 
                              type="password"
                              value={formData.password}
                              onChange={e => setFormData({ ...formData, password: e.target.value })}
                              placeholder="Senha"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createColaborador.isPending || updateColaborador.isPending}>
                    {editingColaborador ? 'Salvar' : 'Cadastrar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Store Buttons */}
      <div className="flex flex-wrap gap-3">
        {LOJAS_IDS.map(lojaId => (
          <Button
            key={lojaId}
            variant={expandedLojas.has(lojaId) ? 'default' : 'outline'}
            onClick={() => toggleLoja(lojaId)}
            className="min-w-[120px]"
          >
            {expandedLojas.has(lojaId) ? <ChevronDown size={16} className="mr-2" /> : <ChevronRight size={16} className="mr-2" />}
            {LOJAS[lojaId]} ({colaboradoresPorLoja(lojaId).length})
          </Button>
        ))}
      </div>

      {isLoading ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Carregando...</CardContent></Card>
      ) : (
        LOJAS_IDS.filter(lojaId => expandedLojas.has(lojaId)).map(lojaId => {
          const lojaColaboradores = colaboradoresPorLoja(lojaId);
          return (
            <Card key={lojaId}>
              <CardHeader className="py-3">
                <CardTitle className="text-lg">{LOJAS[lojaId]}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {lojaColaboradores.length === 0 ? (
                  <p className="text-muted-foreground text-sm p-4">Nenhum colaborador nesta loja.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead className="text-center">Permissão</TableHead>
                        <TableHead className="text-right">Salário</TableHead>
                        <TableHead className="text-right">Ajuda de Custo</TableHead>
                        <TableHead className="text-center">Meta %</TableHead>
                        <TableHead className="text-center">Login</TableHead>
                        <TableHead className="text-center">Dívidas</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lojaColaboradores.map(colaborador => {
                        const permissao = getColaboradorPermissao(colaborador);
                        const vinculo = getVinculo(colaborador, lojaId);
                        // Fallback: se ainda não houver vínculo (edge case), usa os campos legados
                        const cargoLoja = vinculo?.cargo ?? colaborador.cargo;
                        const salarioLoja = vinculo?.salario ?? colaborador.salario;
                        const ajudaLoja = vinculo?.ajuda_custo ?? colaborador.ajuda_custo;
                        const metaLoja = vinculo?.proporcional_meta ?? (colaborador.proporcional_meta ?? 100);
                        const outrasLojas = (colaborador.lojas || [])
                          .filter((l) => l.loja_id !== lojaId)
                          .map((l) => LOJAS[l.loja_id as keyof typeof LOJAS])
                          .filter(Boolean);

                        return (
                          <TableRow key={colaborador.id}>
                            <TableCell className="font-medium">
                              <div className="flex flex-col">
                                <span>{colaborador.nome}</span>
                                {outrasLojas.length > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    Também em: {outrasLojas.join(', ')}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{cargoLoja}</TableCell>
                            <TableCell className="text-center">
                              {permissao ? (
                                <Badge variant="outline" className={`${PERMISSAO_COLORS[permissao]} gap-1`}>
                                  {PERMISSAO_ICONS[permissao]}
                                  {PERMISSAO_LABELS[permissao]}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">Sem login</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(salarioLoja)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(ajudaLoja)}</TableCell>
                            <TableCell className="text-center">{metaLoja}%</TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCreateLogin(colaborador)}
                              >
                                <Key size={16} className="mr-1" />
                                {colaboradoresComLogin.has(colaborador.id) ? 'Editar' : 'Criar Login'}
                              </Button>
                            </TableCell>
                            <TableCell className="text-center">
                              <DividasManagerWrapper colaborador={colaborador} selectedLoja={lojaId} />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="sm" onClick={() => handleEdit(colaborador)}>
                                  <Pencil size={16} />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDelete(colaborador.id)}>
                                  <Trash2 size={16} className="text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Dialog para criar/atualizar login com permissão */}
      <Dialog open={loginDialogOpen} onOpenChange={(open) => {
        setLoginDialogOpen(open);
        if (!open) setIsUpdatingPassword(false);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isUpdatingPassword ? 'Editar Login' : 'Criar Login'} - {selectedColaboradorForLogin?.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Permission selection */}
            <div>
              <Label>Permissão de Acesso</Label>
              <Select value={loginForm.permissao} onValueChange={v => setLoginForm({ ...loginForm, permissao: v as Permissao })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PERMISSAO_LABELS) as Permissao[]).map(p => (
                    <SelectItem key={p} value={p}>
                      <div className="flex items-center gap-2">
                        {PERMISSAO_ICONS[p]}
                        <span>{PERMISSAO_LABELS[p]}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {PERMISSAO_DESCRIPTIONS[loginForm.permissao]}
              </p>
            </div>

            <div>
              <Label>Usuário</Label>
              <div className="flex items-center gap-2">
                <Input 
                  value={loginForm.username}
                  onChange={e => setLoginForm({ ...loginForm, username: e.target.value })}
                  placeholder="usuario"
                />
                <span className="text-muted-foreground text-sm whitespace-nowrap">@lidercelulares.com</span>
              </div>
            </div>
            <div>
              <Label>{isUpdatingPassword ? 'Nova Senha (deixe em branco para manter)' : 'Senha'}</Label>
              <Input 
                type="password"
                value={loginForm.password}
                onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                placeholder={isUpdatingPassword ? 'Nova senha (opcional)' : 'Digite a senha'}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setLoginDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSubmitLogin} disabled={creatingLogin}>
                {creatingLogin 
                  ? (isUpdatingPassword ? 'Salvando...' : 'Criando...') 
                  : (isUpdatingPassword ? 'Salvar' : 'Criar Login')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Supervisors Table (backward compat - supervisor-only accounts without colaborador) */}
      {supervisores.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield size={20} />
              Usuários de Supervisão (sem cadastro de colaborador)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supervisores.map(sup => (
                  <TableRow key={sup.id}>
                    <TableCell>{sup.email}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEditSupervisor(sup)} title="Editar">
                          <Pencil size={16} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteSupervisor(sup)} title="Excluir">
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Edit Supervisor Dialog */}
      <Dialog open={editSupervisorDialogOpen} onOpenChange={setEditSupervisorDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Supervisão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Usuário</Label>
              <Input 
                value={editSupervisorForm.username}
                onChange={e => setEditSupervisorForm({ ...editSupervisorForm, username: e.target.value })}
                placeholder="usuario"
              />
              <p className="text-xs text-muted-foreground mt-1">@lidercelulares.com</p>
            </div>
            <div>
              <Label>Nova Senha (deixe em branco para manter)</Label>
              <Input 
                type="password"
                value={editSupervisorForm.password}
                onChange={e => setEditSupervisorForm({ ...editSupervisorForm, password: e.target.value })}
                placeholder="Nova senha (opcional)"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditSupervisorDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleUpdateSupervisor} disabled={updatingSupervisor}>
                {updatingSupervisor ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <ConfirmDialog {...confirmDialogProps} />
    </div>
  );
};
