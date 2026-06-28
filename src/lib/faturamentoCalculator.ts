// Faturamento "espelho Tenfront" — calibrado por loja, isolado da comissão.
// Os componentes vêm da tabela faturamento_loja (alimentada pelo sync).
// Calibração mora no configuracoes.config: bruto_inclui_juros (0/1) + faturamento_tenfront_ref.

export interface FaturamentoLoja {
  loja_id: string;
  mes: string;
  liquido: number;
  juros: number;
  faturamento_extra: number;
  total_bruto: number;
  custo: number;
  atendimentos: number;
}

export interface FaturamentoCalibracao {
  tenfrontRef?: number | null;
}

export interface FaturamentoEspelho {
  liquido: number;
  juros: number;
  extra: number;
  totalBruto: number;
  espelho: number;
  ajusteErp: number;
  divergencia: number | null;
}

const DRIFT_LIMITE = 0.02;

export function calcFaturamentoEspelho(
  f: FaturamentoLoja,
  cal: FaturamentoCalibracao,
): FaturamentoEspelho {
  // Faturamento = "Total faturado" do relatório Tenfront = Σ Total bruto (já inclui juros
  // de parcelamento e o seminovo negativo). Validado centavo-a-centavo em Campina/jun 2026.
  // NÃO somar juros aqui: o total_bruto já os contém — somar de novo era a causa do overshoot.
  const espelho = f.total_bruto;
  const ajusteErp = espelho - (f.liquido + f.juros + f.faturamento_extra);
  const divergencia = cal.tenfrontRef
    ? (espelho - cal.tenfrontRef) / cal.tenfrontRef
    : null;
  return {
    liquido: f.liquido,
    juros: f.juros,
    extra: f.faturamento_extra,
    totalBruto: f.total_bruto,
    espelho,
    ajusteErp,
    divergencia,
  };
}

export const calibracaoDesatualizada = (esp: FaturamentoEspelho): boolean =>
  esp.divergencia !== null && Math.abs(esp.divergencia) > DRIFT_LIMITE;

// Soma espelhos já calibrados por loja (cada loja aplica sua própria regra de juros).
// A divergência agregada não é significativa (ref é por loja) → null.
export const somarEspelhos = (itens: FaturamentoEspelho[]): FaturamentoEspelho =>
  itens.reduce<FaturamentoEspelho>(
    (a, it) => ({
      liquido: a.liquido + it.liquido,
      juros: a.juros + it.juros,
      extra: a.extra + it.extra,
      totalBruto: a.totalBruto + it.totalBruto,
      espelho: a.espelho + it.espelho,
      ajusteErp: a.ajusteErp + it.ajusteErp,
      divergencia: null,
    }),
    { liquido: 0, juros: 0, extra: 0, totalBruto: 0, espelho: 0, ajusteErp: 0, divergencia: null },
  );

export const lerCalibracao = (
  config: Record<string, number>,
): FaturamentoCalibracao => ({
  tenfrontRef: config.faturamento_tenfront_ref ?? null,
});
