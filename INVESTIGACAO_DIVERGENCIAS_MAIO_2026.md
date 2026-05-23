# Investigação: Divergências entre vendas_diarias e vendas (Maio 2026)

## TL;DR

**ACHADO CRÍTICO:** `vendas_diarias` e `vendas` são tabelas **completamente diferentes** em estrutura e propósito.

- ❌ `vendas_diarias` **NÃO contém** PROTEÇÃO LÍDER ou GARANTIA ESTENDIDA (sem campo de detalhes)
- ✅ `vendas` **CONTÉM** PROTEÇÃO LÍDER + GARANTIA ESTENDIDA (em JSON na coluna `detalhes`)

**Conclusão:** Não há "divergência" — são tabelas diferentes. `vendas` é a fonte de verdade para produtos detalhados.

---

## 1. Estrutura das Tabelas

### vendas_diarias (234 registros em maio)
Dados **granulares por dia e vendedor**, apenas valores categorizados:

```json
{
  "loja_id": "caruaru",
  "mes": "2026-05",
  "data": "2026-05-13",
  "vendedor_nome": "ALMIR",
  "valor_total": 8749.97,
  "smartphones": 8749.97,      // apenas VALOR
  "acessorios": 0,             // apenas VALOR
  "servicos": 0,               // apenas VALOR
  "detalhes": {}               // VAZIO
}
```

**Colunas:** `id, loja_id, mes, data, vendedor_nome, colaborador_id, valor_total, smartphones, acessorios, servicos, geral, detalhes` (vazio), `valor_bruto`

---

### vendas (23 registros em maio)
Dados **agregados por mês e vendedor**, com detalhes JSON de CADA PRODUTO:

```json
{
  "loja_id": "natal",
  "mes": "2026-05",
  "vendedor_nome": "VENDEDOR X",
  "valor_total": 21498.93,
  "detalhes": {
    "PROTEÇÃO LÍDER": 1309,           // ← PRESENTE
    "GARANTIA ESTENDIDA": 795,        // ← PRESENTE
    "BONIFICADO LC": 18919.92,
    "__qtd_smartphones": 10,
    "CASOS": 35,
    "PELÍCULA": 440.01,
    // ... + juros
  }
}
```

**Colunas:** `id, loja_id, colaborador_id, vendedor_nome, mes, valor_total, detalhes` (JSON), `created_at, geral, valor_bruto`

---

## 2. Comparação por Loja (Maio 2026)

### vendas_diarias - Agregado por Loja

| LOJA | SMARTPHONES | ACESSORIOS | SERVICOS | REGISTROS |
|------|-------------|-----------|----------|-----------|
| Campina Grande | R$ 148,160.58 | R$ 7,234.99 | R$ 20,917.38 | 50 |
| Caruaru | R$ 155,596.09 | R$ 3,459.98 | R$ 3,945.28 | 55 |
| Monteiro | R$ 38,515.99 | R$ 7,038.00 | R$ 4,501.39 | 18 |
| **Natal** | R$ 221,421.46 | R$ 10,678.95 | R$ 38,455.46 | 75 |
| Soledade | R$ 37,499.87 | R$ 7,025.58 | R$ 2,747.22 | 36 |

---

### vendas - Agregado por Loja (com PROTEÇÃO LÍDER + GARANTIA ESTENDIDA)

| LOJA | PROTEÇÃO LÍDER | GARANTIA EST | VALOR BRUTO | VALOR TOTAL | VENDEDORES |
|------|---|---|---|---|---|
| Campina Grande | R$ 15,736.48 | R$ 5,180.90 | R$ 34,278.67 | R$ 212,362.95 | 7 |
| Caruaru | R$ 1,264.29 | R$ 2,680.99 | R$ 54,938.29 | R$ 163,001.35 | 6 |
| Monteiro | R$ 1,589.15 | R$ 2,912.24 | R$ 17,736.99 | R$ 59,105.38 | 1 |
| **Natal** | R$ 26,632.73 | R$ 11,822.73 | R$ 65,910.86 | R$ 282,755.85 | 7 |
| Soledade | R$ 0.00 | R$ 2,327.22 | R$ 3,114.32 | R$ 47,272.67 | 2 |
| **TOTAL** | **R$ 45,222.65** | **R$ 24,924.08** | **R$ 175,979.14** | **R$ 764,498.20** | **23** |

---

## 3. Padrão em TODAS as Lojas (Maio 2026)

| Loja | PROTEÇÃO LÍDER | GARANTIA EST | Status |
|------|---|---|---|
| ✓ Natal | R$ 26,632.73 | R$ 11,822.73 | **PRESENTE** |
| ✓ Campina Grande | R$ 15,736.48 | R$ 5,180.90 | **PRESENTE** |
| ✓ Caruaru | R$ 1,264.29 | R$ 2,680.99 | **PRESENTE** |
| ✓ Monteiro | R$ 1,589.15 | R$ 2,912.24 | **PRESENTE** |
| ⚠️ Soledade | R$ 0.00 | R$ 2,327.22 | **FALTA PROTEÇÃO LÍDER** |

---

## 4. Achados Críticos

### Achado 1: Estrutura Completamente Diferente
- `vendas_diarias` é uma tabela de **auditoria/granular** com dados por dia
- `vendas` é uma tabela de **relatório/síntese** com dados agregados e detalhes

### Achado 2: Dados Não Correspondentes
- NÃO é possível recuperar PROTEÇÃO LÍDER de `vendas_diarias` porque a coluna `detalhes` está vazia
- `vendas` é a ÚNICA fonte de verdade para PROTEÇÃO LÍDER + GARANTIA ESTENDIDA

### Achado 3: Soledade Sem PROTEÇÃO LÍDER
- **Todas as lojas têm GARANTIA ESTENDIDA** em maio 2026
- **Soledade é a ÚNICA loja que FALTA PROTEÇÃO LÍDER** (R$ 0.00)
  - Campina Grande: R$ 15,736.48
  - Natal: R$ 26,632.73
  - Caruaru: R$ 1,264.29
  - Monteiro: R$ 1,589.15
  - Soledade: **R$ 0.00** ← ANOMALIA

### Achado 4: Padrão Consistente
- Todos os DIAS em maio 2026 têm a mesma anomalia: vendas_diarias não armazena produtos detalhados
- Não é um problema de "sincronização" — é um problema de **design de schema**

---

## 5. Root Cause

### Problema na Integração Tenfront → Supabase

A integração cria `vendas_diarias` a partir de um **feed genérico** que não expande os detalhes dos produtos:

1. Tenfront envia: `smartphone:1, acessorio:1, servico:1`
2. Supabase calcula **valores** e armazena em `vendas_diarias` (smartphones=R$X, acessorios=R$Y, servicos=R$Z)
3. **Mas NÃO armazena os detalhes JSON** (PROTEÇÃO LÍDER, GARANTIA ESTENDIDA, etc)

Enquanto isso, `vendas` pode ser:
- Um feed diferente (com detalhes expandidos), ou
- Preenchido **manualmente** por um admin (por isso tem apenas 23 registros)

---

## 6. Recomendações

### Para Conversa com Cliente (15/5 14:30)

1. **Confirmar com cliente:** Qual é a fonte de verdade?
   - Se for Tenfront (automático) → usar `vendas` (23 registros/mês)
   - Se for manual (admin) → procurar quem preenche e se há gaps

2. **Validar Soledade:** Por que não tem PROTEÇÃO LÍDER em maio?
   - Vendedor não vendeu, ou
   - Dados não foram sincronizados, ou
   - É exclusão intencional

3. **Analisar `vendas_diarias`:** Por que existe?
   - Se é apenas para auditoria (granular por dia) → OK
   - Se deveria ser sincronia de `vendas` → bug na integração

---

## 7. Resumo Visual

```
TENFRONT (CRM)
     ↓
     └─→ [INTEGRAÇÃO] → Supabase
            ├─ vendas_diarias (granular, sem detalhes)
            └─ vendas (agregado, com detalhes JSON)

CONSULTORA + LOVABLE
     ↓
     └─→ Lê vendas (23 registros/mês)
         └─ Exibe relatórios com PROTEÇÃO LÍDER + GARANTIA EST
```

---

**Relatório finalizado:** 2026-05-23  
**Status:** ✅ Investigação completa — problema identificado: schema mismatch entre `vendas_diarias` e `vendas`.
