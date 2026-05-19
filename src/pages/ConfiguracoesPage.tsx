import React, { useCallback, useEffect, useMemo, useState, useContext } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/store/appStore';
import { useConfiguracao, useSaveConfiguracao } from '@/hooks/useConfiguracoes';
import { LOJAS } from '@/lib/constants';
import { isLojaNatalLike, isLojaSoledadeMonteiro, isLojaMonteiro } from '@/lib/lojaRules';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Settings, CalendarOff, RefreshCw, Database, Key, ShieldCheck, Copy } from 'lucide-react';
import { DiasFechamentoSelector } from '@/components/configuracoes/DiasFechamentoSelector';
import { VendedorBloqueiosManager } from '@/components/configuracoes/VendedorBloqueiosManager';
import { useStoreTenfrontConfig } from '@/hooks/useStoreTenfrontConfig';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type ConfigFormContextValue = {
  formConfig: Record<string, number>;
  onChange: (key: string, value: number) => void;
};

const ConfigFormContext = React.createContext<ConfigFormContextValue | null>(null);

const useConfigFormContext = () => {
  const ctx = useContext(ConfigFormContext);
  if (!ctx) throw new Error('ConfigFormContext não foi provido');
  return ctx;
};

const ConfigInput = React.memo(
  ({ id, label, step = '0.1' }: { id: string; label: string; step?: string }) => {
    const { formConfig, onChange } = useConfigFormContext();
    const externalValue = formConfig[id] ?? 0;

    const [localValue, setLocalValue] = useState<string>(String(externalValue));

    // Sincroniza apenas quando o valor externo muda (ex.: carregou do backend / mudou mês)
    useEffect(() => {
      setLocalValue(String(externalValue));
    }, [externalValue]);

    return (
      <div>
        <Label htmlFor={id}>{label}</Label>
        <Input
          id={id}
          type="number"
          step={step}
          value={localValue}
          onChange={(e) => {
            const next = e.target.value;
            setLocalValue(next);

            // Evita “quebrar” digitação de decimais (ex.: "1."), mas mantém o form atualizado para salvar.
            if (next === '') {
              onChange(id, 0);
              return;
            }
            if (next.endsWith('.')) return;

            const parsed = Number(next);
            if (Number.isFinite(parsed)) onChange(id, parsed);
          }}
        />
      </div>
    );
  }
);
ConfigInput.displayName = 'ConfigInput';

const TenfrontConfig = ({ lojaId }: { lojaId: string }) => {
  const { config, isLoading, saveConfig } = useStoreTenfrontConfig(lojaId);
  const [bearerToken, setBearerToken] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [isEditingKeys, setIsEditingKeys] = useState(false);

  useEffect(() => {
    if (config) {
      setBearerToken(config.tenfront_bearer_token || '');
      setConsumerKey(config.tenfront_consumer_key || '');
      setConsumerSecret(config.tenfront_consumer_secret || '');
    }
  }, [config]);

  const handleSave = () => {
    saveConfig.mutate({ bearerToken, consumerKey, consumerSecret }, {
      onSuccess: () => {
        setIsEditingKeys(false);
      }
    });
  };

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-primary">
          <ShieldCheck size={20} />
          Integração Tenfront (Estoque)
        </CardTitle>
        {!isEditingKeys && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsEditingKeys(true)}
            className="gap-2"
          >
            <Key size={14} />
            Editar Chaves
          </Button>
        )}
        {isEditingKeys && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              setIsEditingKeys(false);
              // Reset to original values
              if (config) {
                setBearerToken(config.tenfront_bearer_token || '');
                setConsumerKey(config.tenfront_consumer_key || '');
                setConsumerSecret(config.tenfront_consumer_secret || '');
              }
            }}
          >
            Cancelar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Configure as chaves da API Tenfront para esta loja para habilitar o estoque inteligente.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bearerToken">Bearer Token</Label>
            <div className="relative">
              <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="bearerToken"
                type={isEditingKeys ? "text" : "password"}
                disabled={!isEditingKeys}
                value={bearerToken}
                onChange={(e) => setBearerToken(e.target.value)}
                placeholder="Bearer bus|..."
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="consumerKey">Consumer Key</Label>
            <div className="relative">
              <Database className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="consumerKey"
                type={isEditingKeys ? "text" : "password"}
                disabled={!isEditingKeys}
                value={consumerKey}
                onChange={(e) => setConsumerKey(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="consumerSecret">Consumer Secret</Label>
            <div className="relative">
              <ShieldCheck className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="consumerSecret"
                type={isEditingKeys ? "text" : "password"}
                disabled={!isEditingKeys}
                value={consumerSecret}
                onChange={(e) => setConsumerSecret(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>
        {isEditingKeys && (
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saveConfig.isPending}>
              {saveConfig.isPending ? 'Salvando...' : 'Salvar Credenciais Tenfront'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};


export const ConfiguracoesPage = () => {
  const queryClient = useQueryClient();
  const { selectedLoja, selectedMes, setSelectedMes } = useAppStore();
  const lojaId = selectedLoja || 'soledade';
  const isSoledadeMonteiro = isLojaSoledadeMonteiro(lojaId);
  const isNatalLike = isLojaNatalLike(lojaId);
  const isMonteiro = isLojaMonteiro(lojaId);

  const { data: config, isLoading } = useConfiguracao(lojaId, selectedMes);
  const saveConfig = useSaveConfiguracao();
  const [isSyncingTenfront, setIsSyncingTenfront] = useState(false);

  const prevMes = useMemo(() => {
    const [year, month] = selectedMes.split('-').map(Number);
    const d = new Date(year, month - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, [selectedMes]);
  const { data: prevConfig } = useConfiguracao(lojaId, prevMes);

  const [formConfig, setFormConfig] = useState<Record<string, number>>({});
  const [diasFechamento, setDiasFechamento] = useState<string[]>([]);

  useEffect(() => {
    if (config) {
      setFormConfig(config.numericConfig);
      setDiasFechamento(config.diasFechamento);
    }
  }, [config]);

  const handleChange = useCallback((key: string, value: number) => {
    setFormConfig((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleCopyFromPrevMonth = () => {
    if (!prevConfig) {
      toast.error('Nenhuma configuração encontrada para o mês anterior');
      return;
    }
    setFormConfig(prevConfig.numericConfig);
    setDiasFechamento(prevConfig.diasFechamento);
    toast.success(`Configurações de ${prevMes} copiadas. Salve para confirmar.`);
  };

  const handleSave = async () => {
    await saveConfig.mutateAsync({
      lojaId,
      mes: selectedMes,
      config: { ...formConfig, dias_fechamento: diasFechamento },
    });
  };

  const syncTenfrontData = async () => {
    setIsSyncingTenfront(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-tenfront', {
        body: { mes: selectedMes, loja_id: lojaId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await queryClient.invalidateQueries({ queryKey: ['vendas', lojaId, selectedMes] });
      toast.success(`${data?.results?.[0]?.synced ?? 0} vendedores sincronizados da Tenfront.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao sincronizar vendas.';
      toast.error(message);
    } finally {
      setIsSyncingTenfront(false);
    }
  };

  const ctxValue = useMemo<ConfigFormContextValue>(
    () => ({ formConfig, onChange: handleChange }),
    [formConfig, handleChange]
  );

  if (isLoading) {
    return <Card><CardContent className="py-10 text-center text-muted-foreground">Carregando...</CardContent></Card>;
  }

  return (
    <ConfigFormContext.Provider value={ctxValue}>
      <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-light flex items-center gap-2">
            <Settings size={24} />
            Configurações - {LOJAS[lojaId as keyof typeof LOJAS]}
          </h1>
          <p className="text-muted-foreground">Configure metas e comissões para cada mês</p>
        </div>
        
        <div className="flex flex-wrap gap-3 items-end">
          {isMonteiro && (
            <Button 
              variant="outline" 
              onClick={syncTenfrontData} 
              disabled={isSyncingTenfront}
              className="gap-2"
            >
              <RefreshCw size={16} className={isSyncingTenfront ? "animate-spin" : ""} />
              Sincronizar Tenfront
            </Button>
          )}
          <div>
            <Label>Mês de Referência</Label>
            <Input 
              type="month" 
              value={selectedMes}
              onChange={e => setSelectedMes(e.target.value)}
              className="w-[180px]"
            />
          </div>
          <Button
            variant="outline"
            onClick={handleCopyFromPrevMonth}
            disabled={!prevConfig}
            title={`Copiar configurações de ${prevMes}`}
            className="gap-2"
          >
            <Copy size={16} />
            Copiar mês anterior
          </Button>
          <Button onClick={handleSave} disabled={saveConfig.isPending}>
            <Save size={16} className="mr-2" /> Salvar
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Tenfront API Config */}
        <TenfrontConfig lojaId={lojaId} />

        {/* Dias de Fechamento (Feriados Locais) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarOff size={20} />
              Dias de Fechamento (Feriados Locais)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Selecione os dias em que a loja ficará fechada além dos domingos e feriados nacionais. 
              Esses dias serão excluídos do cálculo da média diária projetada.
            </p>
            <DiasFechamentoSelector
              mes={selectedMes}
              diasFechamento={diasFechamento}
              onChange={setDiasFechamento}
            />
          </CardContent>
        </Card>
        {/* Bônus e Metas da Loja */}
        <Card>
          <CardHeader>
            <CardTitle>Bônus e Metas da Loja</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isSoledadeMonteiro ? (
              <>
                <ConfigInput id="loja_meta_prata" label="Meta Prata da Loja (R$)" step="1000" />
                <ConfigInput id="loja_bonus_meta_prata" label="Bônus Meta Prata (R$)" step="10" />
                <ConfigInput id="loja_meta_ouro" label="Meta Ouro da Loja (R$)" step="1000" />
                <ConfigInput id="loja_bonus_meta_ouro" label="Bônus Meta Ouro (R$)" step="10" />
              </>
            ) : (
              <>
                <ConfigInput id="loja_meta_ouro" label="Meta Ouro da Loja (R$)" step="1000" />
                <ConfigInput id="loja_bonus_meta_ouro" label="Bônus Meta Ouro (R$)" step="10" />
              </>
            )}
            <ConfigInput id="bonus_melhor_servico" label="Bônus Melhor Serviço (R$)" step="10" />
            <ConfigInput id="bonus_melhor_smartphone" label="Bônus Melhor Smartphone (R$)" step="10" />
          </CardContent>
        </Card>

        {/* Comissões Fixas */}
        <Card>
          <CardHeader>
            <CardTitle>Comissões Fixas</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ConfigInput id="geral_comissao" label="% Geral" />
            {isNatalLike && (
              <ConfigInput id="cases_comissao" label="% Cases" />
            )}
            {lojaId !== 'monteiro' && (
              <ConfigInput id="assistencia_tecnica_comissao" label="% Assistência Técnica" />
            )}
          </CardContent>
        </Card>

        {/* Cases Divisor - Soledade/Monteiro */}
        {isSoledadeMonteiro && (
          <Card>
            <CardHeader>
              <CardTitle>Comissão Cases (Vendedor)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ConfigInput id="cases_divisor" label="Divisor (R$)" step="1" />
              </div>
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-3">Faixas de Desbloqueio (adiciona ao multiplicador)</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <ConfigInput id="cases_faixa1" label="Faixa 1 - Acima de (R$)" step="1" />
                    <ConfigInput id="cases_bonus_faixa1" label="Bônus Faixa 1 (R$)" step="1" />
                  </div>
                  <div className="space-y-2">
                    <ConfigInput id="cases_faixa2" label="Faixa 2 - Acima de (R$)" step="1" />
                    <ConfigInput id="cases_bonus_faixa2" label="Bônus Faixa 2 (R$)" step="1" />
                  </div>
                  <div className="space-y-2">
                    <ConfigInput id="cases_faixa3" label="Faixa 3 - Acima de (R$)" step="1" />
                    <ConfigInput id="cases_bonus_faixa3" label="Bônus Faixa 3 (R$)" step="1" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Abaixo da Faixa 1 não ganha comissão de Cases</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Smartphones */}
        <Card>
          <CardHeader>
            <CardTitle>Smartphones</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ConfigInput id="smartphones_meta" label="Meta (R$)" step="100" />
            {isSoledadeMonteiro ? (
              <>
                <ConfigInput id="smartphones_comissao_meta_batida" label="% Se Bater Meta" />
                <ConfigInput id="smartphones_comissao_abaixo_meta" label="% Se Não Bater" />
                <ConfigInput id="smartphones_comissao_servico_fase2" label="% Bônus Serviço Fase 2" />
              </>
            ) : (
              <>
                <ConfigInput id="smartphones_comissao_blc_meta_batida" label="% BLC Meta Batida" />
                <ConfigInput id="smartphones_comissao_sb_meta_batida" label="% SB Meta Batida" />
                <ConfigInput id="smartphones_comissao_blc_abaixo_meta" label="% BLC Abaixo Meta" />
                <ConfigInput id="smartphones_comissao_sb_abaixo_meta" label="% SB Abaixo Meta" />
                {lojaId === 'campina-grande' && (
                  <>
                    <ConfigInput id="smartphones_comissao_blc_servico" label="% BLC Bônus Serviço" />
                    <ConfigInput id="smartphones_comissao_sb_servico" label="% SB Bônus Serviço" />
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Acessórios */}
        <Card>
          <CardHeader>
            <CardTitle>Acessórios</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {isSoledadeMonteiro ? (
              <>
                <ConfigInput id="acessorios_meta_estabelecida" label="Meta (R$)" step="100" />
                <ConfigInput id="acessorios_comissao_estabelecida" label="% Meta Batida" />
                <ConfigInput id="acessorios_comissao_abaixo_meta" label="% Abaixo Meta" />
              </>
            ) : (
              <>
                <ConfigInput id="acessorios_meta" label="Meta (R$)" step="100" />
                {lojaId === 'campina-grande' ? (
                  <>
                    <ConfigInput id="cg_acessorios_comissao_meta_batida" label="% Meta Batida" />
                    <ConfigInput id="cg_acessorios_comissao_abaixo_meta" label="% Abaixo Meta" />
                  </>
                ) : (
                  <>
                    <ConfigInput id="natal_acessorios_comissao_meta_batida" label="% Meta Batida" />
                    <ConfigInput id="natal_acessorios_comissao_abaixo_meta" label="% Abaixo Meta" />
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Película */}
        <Card>
          <CardHeader>
            <CardTitle>Película</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ConfigInput id="pelicula_meta" label="Meta (R$)" step="100" />
            {isSoledadeMonteiro ? (
              <>
                <ConfigInput id="pelicula_comissao_meta_batida" label="% Se Bater Meta" />
                <ConfigInput id="pelicula_comissao_abaixo_meta" label="% Se Não Bater" />
              </>
            ) : lojaId === 'campina-grande' ? (
              <>
                <ConfigInput id="cg_pelicula_meta_minima" label="Meta Mínima (R$)" step="100" />
                <ConfigInput id="cg_pelicula_comissao_meta_batida" label="% Meta Batida" />
                <ConfigInput id="cg_pelicula_comissao_abaixo_meta" label="% Abaixo Meta" />
              </>
            ) : (
              <>
                <ConfigInput id="natal_pelicula_meta_minima" label="Meta Mínima (R$)" step="100" />
                <ConfigInput id="natal_pelicula_comissao_meta_batida" label="% Meta Batida" />
                <ConfigInput id="natal_pelicula_comissao_meta_minima" label="% Meta Mínima" />
              </>
            )}
          </CardContent>
        </Card>


        {/* Serviços */}
        <Card>
          <CardHeader>
            <CardTitle>Serviços (Proteção Líder + Garantia Estendida)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <ConfigInput id="servicos_meta_fase1" label="Meta Fase 1 (R$)" step="100" />
            <ConfigInput id="servicos_comissao_fase1" label="% Fase 1" />
            <ConfigInput id="servicos_meta_fase2" label="Meta Fase 2 (R$)" step="100" />
            <ConfigInput id="servicos_comissao_fase2" label="% Fase 2" />
            <ConfigInput id="servicos_meta_fase3" label="Meta Fase 3 (R$)" step="100" />
            <ConfigInput id="servicos_comissao_fase3" label="% Fase 3" />
          </CardContent>
        </Card>

        {/* Configurações de Gerente (apenas CG/Natal) */}
        {!isSoledadeMonteiro && (
          <Card>
            <CardHeader>
              <CardTitle>Configurações do Gerente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ConfigInput id="gerente_geral_comissao" label="% Geral" />
                <ConfigInput id="gerente_cases_comissao" label="% Cases" />
                <ConfigInput id="gerente_pelicula_comissao" label="% Película" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ConfigInput id="gerente_acessorios_meta" label="Meta Acessórios (R$)" step="100" />
                {lojaId === 'campina-grande' ? (
                  <ConfigInput id="gerente_acessorios_comissao_cg" label="% Acessórios" />
                ) : (
                  <ConfigInput id="gerente_acessorios_comissao_natal" label="% Acessórios" />
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <ConfigInput id="gerente_servicos_destrave1_meta" label="Meta Destrave 1" step="100" />
                <ConfigInput id="gerente_servicos_destrave1_comissao" label="% Destrave 1" />
                <ConfigInput id="gerente_servicos_destrave2_meta" label="Meta Destrave 2" step="100" />
                <ConfigInput id="gerente_servicos_destrave2_comissao" label="% Destrave 2" />
                <ConfigInput id="gerente_servicos_destrave3_meta" label="Meta Destrave 3" step="100" />
                <ConfigInput id="gerente_servicos_destrave3_comissao" label="% Destrave 3" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <ConfigInput id="gerente_meta_bronze" label="Meta Bronze (R$)" step="1000" />
                <ConfigInput id="gerente_meta_prata" label="Meta Prata (R$)" step="1000" />
                <ConfigInput id="gerente_meta_ouro_acrescimo" label="% Acréscimo Ouro" />
                <ConfigInput id="gerente_comissao_prata" label="% Comissão Prata" />
                <ConfigInput id="gerente_comissao_ouro" label="% Comissão Ouro" />
              </div>
              <ConfigInput id="gerente_bonus_bronze" label="Bônus Bronze (R$)" step="10" />
              
            </CardContent>
          </Card>
        )}

        {/* Cases por volume removido para CG */}

        {/* Cases Divisor - Natal/CG (Vendedor) */}
        {!isSoledadeMonteiro && (
          <Card>
            <CardHeader>
              <CardTitle>Comissão Cases (Vendedor)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ConfigInput id="natal_cases_divisor" label="Divisor (R$)" step="1" />
              </div>
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-3">Faixas de Desbloqueio (adiciona ao multiplicador)</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <ConfigInput id="natal_cases_faixa1" label="Faixa 1 - Acima de (R$)" step="1" />
                    <ConfigInput id="natal_cases_bonus_faixa1" label="Bônus Faixa 1 (R$)" step="1" />
                  </div>
                  <div className="space-y-2">
                    <ConfigInput id="natal_cases_faixa2" label="Faixa 2 - Acima de (R$)" step="1" />
                    <ConfigInput id="natal_cases_bonus_faixa2" label="Bônus Faixa 2 (R$)" step="1" />
                  </div>
                  <div className="space-y-2">
                    <ConfigInput id="natal_cases_faixa3" label="Faixa 3 - Acima de (R$)" step="1" />
                    <ConfigInput id="natal_cases_bonus_faixa3" label="Bônus Faixa 3 (R$)" step="1" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Abaixo da Faixa 1 não ganha comissão de Cases</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cases removido para Soledade e Monteiro */}

        {/* Bloqueio de Vendedores */}
        <VendedorBloqueiosManager />
      </div>
    </div>
    </ConfigFormContext.Provider>
  );
};
