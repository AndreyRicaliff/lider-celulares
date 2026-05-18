import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRankingBotons } from '@/hooks/useBotons';
import { useLojas } from '@/hooks/useLojas';
import { Trophy, Crown, Shield, Medal, Award } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';

const MESES = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

export function RankingBotons() {
  const currentYear = new Date().getFullYear().toString();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedLoja, setSelectedLoja] = useState<string>('all');
  
  const { data: ranking, isLoading } = useRankingBotons(selectedYear);
  const { data: lojas } = useLojas();

  const years = Array.from({ length: 5 }, (_, i) => (parseInt(currentYear) - i).toString());

  const filteredRanking = ranking?.filter(r => 
    selectedLoja === 'all' || r.lojaId === selectedLoja
  );

  const getPositionStyle = (position: number) => {
    switch (position) {
      case 1:
        return 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/10 border-yellow-500/50';
      case 2:
        return 'bg-gradient-to-r from-gray-400/20 to-gray-500/10 border-gray-400/50';
      case 3:
        return 'bg-gradient-to-r from-amber-600/20 to-amber-700/10 border-amber-600/50';
      default:
        return 'bg-card border-border';
    }
  };

  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Trophy className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Award className="w-6 h-6 text-amber-600" />;
      default:
        return <span className="w-6 h-6 flex items-center justify-center text-muted-foreground font-bold">{position}º</span>;
    }
  };

  const getLojaName = (lojaId: string) => {
    return lojas?.find(l => l.id === lojaId)?.nome || lojaId;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            Ranking de Botons Premiados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            Ranking de Botons Premiados
          </CardTitle>
          <div className="flex gap-2">
            <Select value={selectedLoja} onValueChange={setSelectedLoja}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Loja" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Lojas</SelectItem>
                {lojas?.map(loja => (
                  <SelectItem key={loja.id} value={loja.id}>{loja.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={year}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Legend */}
        <div className="flex flex-wrap gap-4 p-3 bg-muted/50 rounded-lg text-sm">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-yellow-500" />
            <span>Tríplice Coroa = 10 pts</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-500" />
            <span>Proteção Líder = 5 pts</span>
          </div>
        </div>

        {/* Ranking List */}
        {!filteredRanking || filteredRanking.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum boton conquistado em {selectedYear}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRanking.map((item, index) => (
              <div
                key={item.colaboradorId}
                className={`p-4 rounded-lg border-2 transition-all hover:shadow-md ${getPositionStyle(index + 1)}`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    {getPositionIcon(index + 1)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{item.nome}</h3>
                      <Badge variant="outline" className="text-xs">
                        {getLojaName(item.lojaId)}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Crown className="w-3 h-3 text-yellow-500" />
                        {item.tripliceCoroa}x Tríplice
                      </span>
                      <span className="flex items-center gap-1">
                        <Shield className="w-3 h-3 text-blue-500" />
                        {item.protecaoLider}x Proteção
                      </span>
                    </div>
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <div className="text-2xl font-bold text-primary">
                      {item.pontosTotais}
                    </div>
                    <div className="text-xs text-muted-foreground">pontos</div>
                  </div>
                </div>

                {/* Monthly breakdown */}
                <div className="mt-3 flex gap-1 flex-wrap">
                  {MESES.map((mes, mesIndex) => {
                    const mesKey = `${selectedYear}-${String(mesIndex + 1).padStart(2, '0')}`;
                    const boton = item.botonsPorMes[mesKey];
                    
                    return (
                      <div
                        key={mesKey}
                        className={`w-8 h-8 rounded flex items-center justify-center text-xs font-medium transition-all ${
                          boton?.tipo === 'triplice_coroa'
                            ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50'
                            : boton?.tipo === 'protecao_lider'
                            ? 'bg-blue-500/20 text-blue-500 border border-blue-500/50'
                            : 'bg-muted/50 text-muted-foreground'
                        }`}
                        title={boton ? `${mes}: ${boton.tipo === 'triplice_coroa' ? 'Tríplice Coroa' : 'Proteção Líder'} (${boton.pontos}pts)` : mes}
                      >
                        {boton ? (
                          boton.tipo === 'triplice_coroa' ? (
                            <Crown className="w-4 h-4" />
                          ) : (
                            <Shield className="w-4 h-4" />
                          )
                        ) : (
                          mes.substring(0, 1)
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
