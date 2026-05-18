import { useMemo } from 'react';
import { useAppStore } from '@/store/appStore';
import { useVendas } from '@/hooks/useVendas';
import { useConfiguracao } from '@/hooks/useConfiguracoes';
import { useSupervisores, useAtualizarParcelasDividas } from '@/hooks/useColaboradores';
import { formatCurrency } from '@/lib/formatters';
import { calcularFolhaSupervisor, SUPERVISORES_CONFIG, SupervisorResult } from '@/lib/supervisorCalculator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Briefcase, DollarSign, Store, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export const SupervisaoFolhaPage = () => {
  const { selectedMes, setSelectedMes } = useAppStore();
  const atualizarParcelas = useAtualizarParcelasDividas();
  
  // Buscar vendas de todas as lojas
  const { data: vendasSoledade = [] } = useVendas('soledade', selectedMes);
  const { data: vendasMonteiro = [] } = useVendas('monteiro', selectedMes);
  const { data: vendasCampina = [] } = useVendas('campina-grande', selectedMes);
  const { data: vendasNatal = [] } = useVendas('natal', selectedMes);
  const { data: vendasCaruaru = [] } = useVendas('caruaru', selectedMes);
  
  // Buscar configurações de todas as lojas
  const { data: configSoledade } = useConfiguracao('soledade', selectedMes);
  const { data: configMonteiro } = useConfiguracao('monteiro', selectedMes);
  const { data: configCampina } = useConfiguracao('campina-grande', selectedMes);
  const { data: configNatal } = useConfiguracao('natal', selectedMes);
  const { data: configCaruaru } = useConfiguracao('caruaru', selectedMes);
  
  // Buscar supervisores com suas dívidas
  const { data: supervisores = [] } = useSupervisores();
  
  const vendasPorLoja = useMemo(() => ({
    'soledade': vendasSoledade,
    'monteiro': vendasMonteiro,
    'campina-grande': vendasCampina,
    'natal': vendasNatal,
    'caruaru': vendasCaruaru,
  }), [vendasSoledade, vendasMonteiro, vendasCampina, vendasNatal, vendasCaruaru]);
  
  const configsPorLoja = useMemo(() => ({
    'soledade': configSoledade?.numericConfig || {},
    'monteiro': configMonteiro?.numericConfig || {},
    'campina-grande': configCampina?.numericConfig || {},
    'natal': configNatal?.numericConfig || {},
    'caruaru': configCaruaru?.numericConfig || {},
  }), [configSoledade, configMonteiro, configCampina, configNatal, configCaruaru]);
  
  // Calcular folha de cada supervisor
  const supervisoresResultados = useMemo(() => {
    const resultados: SupervisorResult[] = [];
    
    Object.keys(SUPERVISORES_CONFIG).forEach(nome => {
      const supervisor = supervisores.find(s => s.nome.toLowerCase() === nome.toLowerCase());
      const dividas = supervisor?.dividas || [];
      
      // Usar loja_id diretamente das dívidas (já implementado no supervisorCalculator)
      const resultado = calcularFolhaSupervisor(nome, vendasPorLoja, configsPorLoja, dividas, selectedMes);
      if (resultado) {
        resultados.push(resultado);
      }
    });
    
    return resultados;
  }, [vendasPorLoja, configsPorLoja, supervisores, selectedMes]);
  
  const totalGeralSupervisores = supervisoresResultados.reduce((t, s) => t + s.totalGeral, 0);
  
  // Salvar parcelas de dívidas atualizadas
  const handleSalvarParcelas = async () => {
    const todasDividas: { id: string; parcelaAtual: number }[] = [];
    
    supervisoresResultados.forEach(sup => {
      sup.todasDividasInfo.forEach(d => {
        if (!todasDividas.find(td => td.id === d.id)) {
          todasDividas.push(d);
        }
      });
    });
    
    if (todasDividas.length === 0) {
      toast.info('Nenhuma dívida pendente para atualizar neste mês');
      return;
    }
    
    try {
      await atualizarParcelas.mutateAsync({ dividasParaAtualizar: todasDividas });
      toast.success(`${todasDividas.length} parcela(s) de dívidas atualizadas com sucesso!`);
    } catch (error) {
      toast.error('Erro ao atualizar parcelas de dívidas');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-light flex items-center gap-2">
            <Briefcase className="h-6 w-6" />
            Folha de Pagamento - Supervisão
          </h1>
          <p className="text-muted-foreground">Visualize os pagamentos dos supervisores por loja</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div>
            <Label>Mês de Referência</Label>
            <Input 
              type="month" 
              value={selectedMes}
              onChange={e => setSelectedMes(e.target.value)}
              className="w-full sm:w-[180px]"
            />
          </div>
          <Button 
            onClick={handleSalvarParcelas}
            disabled={atualizarParcelas.isPending}
            variant="default"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Confirmar Dívidas do Mês
          </Button>
        </div>
      </div>
      
      {/* Resumo Geral */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Supervisores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{supervisoresResultados.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Store className="h-4 w-4" />
              Lojas Supervisionadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Geral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{formatCurrency(totalGeralSupervisores)}</div>
          </CardContent>
        </Card>
      </div>
      
      {/* Abas por Supervisor */}
      <Tabs defaultValue={supervisoresResultados[0]?.nome || 'Luiz'}>
        <TabsList className="grid w-full grid-cols-2">
          {supervisoresResultados.map(sup => (
            <TabsTrigger key={sup.nome} value={sup.nome} className="flex items-center gap-2">
              {sup.nome}
              <Badge variant="secondary" className="ml-1">{formatCurrency(sup.totalGeral)}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>
        
        {supervisoresResultados.map(supervisor => (
          <TabsContent key={supervisor.nome} value={supervisor.nome}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{supervisor.nome}</span>
                  <Badge variant="default" className="text-lg px-4 py-1">
                    Total: {formatCurrency(supervisor.totalGeral)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Loja</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Salário</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Ajuda Custo</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Comissão Serviços (Loja)</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Comissão Vendas Próprias</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Bônus Meta</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Taxa Adm.</TableHead>
                      <TableHead className="text-right whitespace-nowrap text-destructive">Dívidas</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Complemento</TableHead>
                      <TableHead className="text-right whitespace-nowrap font-bold">Total Loja</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {supervisor.resultadosPorLoja.map(loja => (
                      <TableRow key={loja.lojaId}>
                        <TableCell className="font-medium">{loja.lojaNome}</TableCell>
                        <TableCell className="text-right">{formatCurrency(loja.salario)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(loja.ajudaCusto)}</TableCell>
                        <TableCell className="text-right text-primary">{formatCurrency(loja.comissaoServicoLoja)}</TableCell>
                        <TableCell className="text-right text-primary">{formatCurrency(loja.comissaoServicoVendaPropria)}</TableCell>
                        <TableCell className="text-right">
                          {loja.bonusMeta > 0 ? (
                            <Badge variant={loja.bonusMeta >= 700 ? 'default' : 'secondary'}>
                              {formatCurrency(loja.bonusMeta)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(loja.taxaAdministrativa)}</TableCell>
                        <TableCell className="text-right text-destructive">
                          {loja.descontoDividas > 0 ? formatCurrency(loja.descontoDividas) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {loja.complemento > 0 ? (
                            <span className="text-amber-500">{formatCurrency(loja.complemento)}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-bold text-green-500">
                          {formatCurrency(loja.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(supervisor.resultadosPorLoja.reduce((t, l) => t + l.salario, 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(supervisor.resultadosPorLoja.reduce((t, l) => t + l.ajudaCusto, 0))}
                      </TableCell>
                      <TableCell className="text-right text-primary">
                        {formatCurrency(supervisor.resultadosPorLoja.reduce((t, l) => t + l.comissaoServicoLoja, 0))}
                      </TableCell>
                      <TableCell className="text-right text-primary">
                        {formatCurrency(supervisor.resultadosPorLoja.reduce((t, l) => t + l.comissaoServicoVendaPropria, 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(supervisor.resultadosPorLoja.reduce((t, l) => t + l.bonusMeta, 0))}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(supervisor.resultadosPorLoja.reduce((t, l) => t + l.taxaAdministrativa, 0))}
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        {formatCurrency(supervisor.resultadosPorLoja.reduce((t, l) => t + l.descontoDividas, 0))}
                      </TableCell>
                      <TableCell className="text-right text-amber-500">
                        {formatCurrency(supervisor.resultadosPorLoja.reduce((t, l) => t + l.complemento, 0))}
                      </TableCell>
                      <TableCell className="text-right text-green-500">
                        {formatCurrency(supervisor.totalGeral)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};
