// Mapeamento de bancos angolanos para os seus domínios oficiais.
// Os logótipos são obtidos diretamente dos sites oficiais via serviço de favicons de alta resolução.

const BANK_DOMAINS: Record<string, string> = {
  // Formato: chave normalizada => domínio oficial
  "bai": "bancobai.ao",
  "banco bai": "bancobai.ao",
  "banco angolano de investimentos": "bancobai.ao",
  "bfa": "bfa.ao",
  "banco de fomento angola": "bfa.ao",
  "bic": "bancobic.ao",
  "banco bic": "bancobic.ao",
  "bpc": "bpc.ao",
  "banco de poupanca e credito": "bpc.ao",
  "banco poupanca e credito": "bpc.ao",
  "atlantico": "atlantico.ao",
  "millennium atlantico": "atlantico.ao",
  "banco millennium atlantico": "atlantico.ao",
  "sol": "bancosol.ao",
  "banco sol": "bancosol.ao",
  "standard bank": "standardbank.co.ao",
  "standard": "standardbank.co.ao",
  "standard bank angola": "standardbank.co.ao",
  "bni": "bni.ao",
  "banco de negocios internacional": "bni.ao",
  "economico": "bancoeconomico.ao",
  "banco economico": "bancoeconomico.ao",
  "keve": "bancokeve.ao",
  "banco keve": "bancokeve.ao",
  "bci": "bci.ao",
  "banco de comercio e industria": "bci.ao",
  "access": "accessbank.ao",
  "access bank": "accessbank.ao",
  "access bank angola": "accessbank.ao",
  "yetu": "bancoyetu.co.ao",
  "banco yetu": "bancoyetu.co.ao",
  "caixa angola": "caixaangola.ao",
  "caixa geral angola": "caixaangola.ao",
  "vtb": "vtb.ao",
  "vtb africa": "vtb.ao",
  "banco vtb africa": "vtb.ao",
  "bcgtotta": "bcgtotta.ao",
  "banco caixa geral totta": "bcgtotta.ao",
  "credisul": "bancocredisul.ao",
  "banco credisul": "bancocredisul.ao",
  "bkl": "bkl.ao",
  "banco kwanza de investimento": "bkl.ao",
  "vale": "bancovale.ao",
  "banco valor": "bancovale.ao",
  "banco valor angola": "bancovale.ao",
  "prestigio": "bancoprestigio.ao",
  "banco prestigio": "bancoprestigio.ao",
  "commercial bank": "commercialbank.ao",
  "finibanco": "finibanco.ao",
  "banco pungo andongo": "bpa.ao",
  "bpa": "bpa.ao",
};

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getBankDomain(bankName: string | null | undefined): string | null {
  if (!bankName) return null;
  const key = normalize(bankName);
  if (BANK_DOMAINS[key]) return BANK_DOMAINS[key];
  // procura por chave que esteja contida no nome (ex.: "BFA - Corrente")
  for (const [k, domain] of Object.entries(BANK_DOMAINS)) {
    if (key.includes(k)) return domain;
  }
  return null;
}

/**
 * Devolve o URL do logótipo oficial do banco.
 * Usa o serviço de favicons do Google em alta resolução (128px), que busca o
 * ícone diretamente do site oficial do banco. Devolve null se não houver
 * domínio conhecido.
 */
export function getBankLogoUrl(bankName: string | null | undefined, size = 128): string | null {
  const domain = getBankDomain(bankName);
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
}

export const KNOWN_BANK_NAMES = Array.from(
  new Set(
    [
      "BAI",
      "BFA",
      "BIC",
      "BPC",
      "Millennium Atlântico",
      "Banco Sol",
      "Standard Bank Angola",
      "BNI",
      "Banco Económico",
      "Banco Keve",
      "BCI",
      "Access Bank Angola",
      "Banco Yetu",
      "Caixa Angola",
      "VTB Africa",
      "BCGTOTTA",
      "Banco Credisul",
      "Banco Valor",
      "Banco Prestígio",
    ],
  ),
);
