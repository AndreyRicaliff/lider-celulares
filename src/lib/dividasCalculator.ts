import { Divida } from "@/types/database";

export type DividaInfo = {
  id: string;
  descricao: string;
  valor: number;
  parcelaAtual: number;
  parcelasTotal: number;
};

// Usado para “recalculation safety”: se uma dívida já foi descontada e registrada
// no mês (ex.: dentro de comissoes.detalhes.dividasInfo), mantemos o desconto
// ao recalcular o mesmo mês mesmo que parcelas_pagas já tenha sido incrementado.
export type DividaAplicadaNoMes = {
  id: string;
  parcelaAtual: number;
};

const parseMes = (mesYYYYMM: string) => new Date(`${mesYYYYMM}-02T00:00:00`);

const diffMonths = (from: Date, to: Date) =>
  (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());

/**
 * Retorna a PRÓXIMA parcela pendente a ser descontada no mês informado.
 * Regra: desconta somente 1 parcela por mês e nunca “pula” parcelas.
 */
export function getParcelaParaDesconto(
  divida: Divida,
  mesParaCalcular: string
): { parcelaAtual: number; valorParcela: number } | null {
  if (!divida || !divida.mes_inicio) return null;
  if (!divida.parcelas_totais || divida.parcelas_totais <= 0) return null;

  const mesInicio = parseMes(divida.mes_inicio);
  const mesAtual = parseMes(mesParaCalcular);

  // Só aplicar se o mês atual for >= mês de início
  if (mesAtual < mesInicio) return null;

  // Parcela “do calendário” referente a este mês (1-indexed)
  const parcelaDoMes = diffMonths(mesInicio, mesAtual) + 1;

  // Próxima parcela pendente (1-indexed)
  const proximaParcela = (divida.parcelas_pagas || 0) + 1;

  // Se já quitou
  if (proximaParcela > divida.parcelas_totais) return null;

  // Se ainda não chegou a vez dessa parcela no calendário
  if (parcelaDoMes < proximaParcela) return null;

  const valorParcela = divida.valor_total / divida.parcelas_totais;
  return { parcelaAtual: proximaParcela, valorParcela };
}

export function calcularDescontosDividasNoMes(
  dividas: Divida[],
  mesParaCalcular: string,
  dividasAplicadasNoMes: DividaAplicadaNoMes[] = []
): { total: number; dividasInfo: DividaInfo[] } {
  let total = 0;
  const dividasInfo: DividaInfo[] = [];

  if (!dividas || dividas.length === 0) return { total, dividasInfo };

  dividas.forEach((divida) => {
    // Se já foi descontada neste mesmo mês (registrado em um cálculo anterior),
    // mantenha o desconto para evitar “sumir” ao recalcular.
    const aplicada = dividasAplicadasNoMes.find((d) => d.id === divida.id);
    if (aplicada) {
      const parcelaAtual = Math.max(
        1,
        Math.min(aplicada.parcelaAtual || 1, divida.parcelas_totais)
      );
      const valorParcela = divida.valor_total / divida.parcelas_totais;

      total += valorParcela;
      dividasInfo.push({
        id: divida.id,
        descricao: divida.descricao,
        valor: valorParcela,
        parcelaAtual,
        parcelasTotal: divida.parcelas_totais,
      });
      return;
    }

    const parcela = getParcelaParaDesconto(divida, mesParaCalcular);
    if (!parcela) {
      /**
       * Sync safety:
       * Se o banco já está com `parcelas_pagas` avançado (por ex. por um salvamento anterior)
       * mas o registro da comissão do mês não tem mais o `dividasInfo` (apagado/regravado),
       * a parcela do mês pode “sumir” no recálculo.
       *
       * Fallback: se a parcela correspondente ao mês já está marcada como paga (parcelas_pagas >= parcelaDoMes),
       * então consideramos que ela foi aplicada neste mês e mantemos a exibição/total.
       */
      try {
        if (!divida?.mes_inicio) return;
        const mesInicio = parseMes(divida.mes_inicio);
        const mesAtual = parseMes(mesParaCalcular);
        if (mesAtual < mesInicio) return;

        const parcelaDoMes = diffMonths(mesInicio, mesAtual) + 1;
        const pagas = divida.parcelas_pagas || 0;
        if (parcelaDoMes < 1) return;
        if (parcelaDoMes > divida.parcelas_totais) return;
        if (pagas < parcelaDoMes) return;

        const valorParcela = divida.valor_total / divida.parcelas_totais;
        total += valorParcela;
        dividasInfo.push({
          id: divida.id,
          descricao: divida.descricao,
          valor: valorParcela,
          parcelaAtual: parcelaDoMes,
          parcelasTotal: divida.parcelas_totais,
        });
      } catch {
        // Se algo inesperado ocorrer, não quebra o cálculo das comissões.
      }
      return;
    }

    total += parcela.valorParcela;
    dividasInfo.push({
      id: divida.id,
      descricao: divida.descricao,
      valor: parcela.valorParcela,
      parcelaAtual: parcela.parcelaAtual,
      parcelasTotal: divida.parcelas_totais,
    });
  });

  return { total, dividasInfo };
}
