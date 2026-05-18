// Feriados nacionais brasileiros (mês-dia)
const FERIADOS_NACIONAIS = [
  '01-01', // Ano Novo
  '04-21', // Tiradentes
  '05-01', // Dia do Trabalho
  '09-07', // Independência
  '10-12', // Nossa Senhora Aparecida
  '11-02', // Finados
  '11-15', // Proclamação da República
  '12-25', // Natal
];

// Calcula a páscoa usando o algoritmo de Computus
function calcularPascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

// Retorna feriados móveis para um ano (Carnaval e Sexta-feira Santa)
function getFeriadosMoveis(ano: number): string[] {
  const pascoa = calcularPascoa(ano);
  
  // Carnaval: 47 dias antes da Páscoa (terça-feira)
  const carnaval = new Date(pascoa);
  carnaval.setDate(carnaval.getDate() - 47);
  
  // Sexta-feira Santa: 2 dias antes da Páscoa
  const sextaSanta = new Date(pascoa);
  sextaSanta.setDate(sextaSanta.getDate() - 2);
  
  // Corpus Christi: 60 dias após a Páscoa
  const corpusChristi = new Date(pascoa);
  corpusChristi.setDate(corpusChristi.getDate() + 60);
  
  return [
    `${String(carnaval.getMonth() + 1).padStart(2, '0')}-${String(carnaval.getDate()).padStart(2, '0')}`,
    `${String(sextaSanta.getMonth() + 1).padStart(2, '0')}-${String(sextaSanta.getDate()).padStart(2, '0')}`,
    `${String(corpusChristi.getMonth() + 1).padStart(2, '0')}-${String(corpusChristi.getDate()).padStart(2, '0')}`,
  ];
}

function ehFeriado(data: Date, ano: number): boolean {
  const mesDia = `${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
  const feriadosMoveis = getFeriadosMoveis(ano);
  return FERIADOS_NACIONAIS.includes(mesDia) || feriadosMoveis.includes(mesDia);
}

function ehDomingo(data: Date): boolean {
  return data.getDay() === 0;
}

// Conta dias úteis (excluindo domingos e feriados) para Soledade/Monteiro
// diasFechamento: array de strings no formato 'YYYY-MM-DD' representando dias que a loja fechou (feriados locais, etc.)
export function getDiasUteisNoMes(mes: string, diasFechamento: string[] = []): number {
  const [ano, mesNum] = mes.split('-').map(Number);
  const ultimoDia = new Date(ano, mesNum, 0).getDate();
  let diasUteis = 0;
  
  const diasFechamentoSet = new Set(diasFechamento);
  
  for (let dia = 1; dia <= ultimoDia; dia++) {
    const data = new Date(ano, mesNum - 1, dia);
    const dataStr = `${ano}-${String(mesNum).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    
    // Verifica se é domingo, feriado nacional/móvel OU dia de fechamento configurado
    if (!ehDomingo(data) && !ehFeriado(data, ano) && !diasFechamentoSet.has(dataStr)) {
      diasUteis++;
    }
  }
  
  return diasUteis;
}

// Conta dias úteis decorridos até ontem no mês (não inclui o dia atual por padrão)
// diasFechamento: array de strings no formato 'YYYY-MM-DD' representando dias que a loja fechou
// incluirHoje: se true, conta incluindo o dia atual
// data: data de referência (opcional, padrão hoje)
export function getDiasUteisDecorridos(mes: string, diasFechamento: string[] = [], incluirHoje: boolean = false, data?: string): number {
  const [ano, mesNum] = mes.split('-').map(Number);
  const dataReferencia = data ? new Date(data + 'T12:00:00') : new Date();
  // Usar meio-dia para comparações consistentes
  const refDateMid = new Date(dataReferencia.getFullYear(), dataReferencia.getMonth(), dataReferencia.getDate(), 12, 0, 0);
  const mesReferenciaStr = `${refDateMid.getFullYear()}-${String(refDateMid.getMonth() + 1).padStart(2, '0')}`;
  
  if (mes !== mesReferenciaStr) {
    if (mes < mesReferenciaStr) return getDiasUteisNoMes(mes, diasFechamento);
    return 0;
  }
  
  const ateDia = incluirHoje ? refDateMid.getDate() : refDateMid.getDate() - 1;
  
  if (ateDia < 1) {
    return 0;
  }
  
  const diasFechamentoSet = new Set(diasFechamento);
  
  let diasUteis = 0;
  for (let dia = 1; dia <= ateDia; dia++) {
    const dataObj = new Date(ano, mesNum - 1, dia);
    const dataStr = `${ano}-${String(mesNum).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    
    if (!ehDomingo(dataObj) && !ehFeriado(dataObj, ano) && !diasFechamentoSet.has(dataStr)) {
      diasUteis++;
    }
  }
  
  return diasUteis;
}

// Conta dias corridos (excluindo apenas fechamentos)
export function getDiasDecorridosNoMes(mes: string, data?: string, diasFechamento: string[] = [], incluirHoje: boolean = false): number {
  const [ano, mesNum] = mes.split('-').map(Number);
  const dataReferencia = data ? new Date(data + 'T12:00:00') : new Date();
  const mesAlvo = `${dataReferencia.getFullYear()}-${String(dataReferencia.getMonth() + 1).padStart(2, '0')}`;
  
  if (mes !== mesAlvo) {
    if (mes < mesAlvo) {
      const ultimoDia = new Date(ano, mesNum, 0).getDate();
      return ultimoDia - diasFechamento.filter(d => d.startsWith(mes)).length;
    }
    return 0;
  }

  const ateDia = incluirHoje ? dataReferencia.getDate() : dataReferencia.getDate() - 1;
  if (ateDia < 1) return 0;

  let decorridos = 0;
  const diasFechamentoSet = new Set(diasFechamento);
  for (let dia = 1; dia <= ateDia; dia++) {
    const dataStr = `${ano}-${String(mesNum).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    if (!diasFechamentoSet.has(dataStr)) {
      decorridos++;
    }
  }
  return decorridos;
}
