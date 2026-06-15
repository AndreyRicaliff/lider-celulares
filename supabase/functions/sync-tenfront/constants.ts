export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

export const TENFRONT_API_URL = 'https://api.tenfront.com.br/v1/listar-atendimentos';
export const TENFRONT_SALDO_URL = 'https://api.tenfront.com.br/v1/saldo-token';
export const MIN_INTERVAL_MINUTES = 27; // Must be < cron interval (30 min) to avoid blocking every run
export const MIN_SALDO_THRESHOLD = 15;


// Mapeamento: nome da API → nome canônico no sistema (por loja se necessário)
export const VENDEDOR_NOME_OVERRIDES: Record<string, string> = {
  'lucas': 'LUCAS',
  'celio': 'CÉLIO',
  'igor': 'IGOR',
  'joao': 'JOÃO',
};

// Aliases para resolução de colaborador_id
export const NAME_ALIASES: Record<string, string> = {
  'lucas': 'lucas ferreira',
  'igor': 'eudivan',
};

export const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

// A API às vezes devolve JSON inválido com barra invertida solta em campos de texto
// (ex: Fornecedor "Moura \ cliente"), que o JSON.parse rejeita. Escapa só os
// backslashes que não iniciam um escape válido, preservando os demais.
export const VALID_JSON_ESCAPES = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);
