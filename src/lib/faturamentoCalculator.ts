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
  atendimentos: number;
}

export interface FaturamentoCalibracao {
  brutoIncluiJuros: boolean;
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

// Default por loja: o "Total bruto" do Tenfront já inclui juros?
// Calibrado empiricamente contra o dashboard (jun/2026). Overridável pelo banco
// (configuracoes.config.bruto_inclui_juros). Lojas sem evidência → false.
const BRUTO_INCLUI_JUROS_DEFAULT: Record<string, boolean> = {
  natal: true,
};

export function calcFaturamentoEspelho(
  f: FaturamentoLoja,
  cal: FaturamentoCalibracao,
): FaturamentoEspelho {
  const espelho = f.total_bruto + (cal.brutoIncluiJuros ? 0 : f.juros);
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

export const lerCalibracao = (
  config: Record<string, number>,
  lojaId: string,
): FaturamentoCalibracao => ({
  brutoIncluiJuros: config.bruto_inclui_juros !== undefined
    ? Boolean(config.bruto_inclui_juros)
    : (BRUTO_INCLUI_JUROS_DEFAULT[lojaId] ?? false),
  tenfrontRef: config.faturamento_tenfront_ref ?? null,
});
