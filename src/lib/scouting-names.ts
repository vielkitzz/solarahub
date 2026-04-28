// @/lib/scouting-names.ts
import { getCountryByName } from "./countries";

type NamePool = { first: string[]; last: string[] };

// Códigos suportados pela API RandomUser.me
const API_SUPPORTED_NATS = [
  "au",
  "br",
  "ca",
  "ch",
  "de",
  "dk",
  "es",
  "fi",
  "fr",
  "gb",
  "ie",
  "in",
  "ir",
  "mx",
  "nl",
  "no",
  "nz",
  "rs",
  "tr",
  "ua",
  "us",
];

const POOLS: Record<string, NamePool> = {
  // País Fictício
  Solara: {
    first: ["Aeron", "Kael", "Lyron", "Darius", "Zephyr", "Orion", "Theron", "Vael", "Caelum", "Nyx"],
    last: ["Vane", "Stark", "Dusk", "Sol", "Aethel", "Pyre", "Storm", "Vale", "Thorn", "Cross"],
  },
  // Países que você já tinha e que a API NÃO suporta bem (ou queremos manter fixos)
  Portugal: {
    first: ["Cristiano", "João", "Bruno", "Rúben", "Bernardo", "Diogo", "André", "Pedro", "Rafael", "Gonçalo"],
    last: ["Ronaldo", "Silva", "Fernandes", "Dias", "Neves", "Santos", "Costa", "Pereira", "Carvalho", "Almeida"],
  },
  Itália: {
    first: ["Gianluigi", "Leonardo", "Giorgio", "Nicolò", "Federico", "Lorenzo", "Marco", "Domenico", "Ciro", "Andrea"],
    last: [
      "Donnarumma",
      "Bonucci",
      "Chiellini",
      "Barella",
      "Chiesa",
      "Insigne",
      "Verratti",
      "Berardi",
      "Immobile",
      "Belotti",
    ],
  },
  Uruguai: {
    first: ["Luis", "Edinson", "Diego", "Federico", "Rodrigo", "Giorgian", "Nahitan", "Matías", "Lucas", "Sebastián"],
    last: [
      "Suárez",
      "Cavani",
      "Godín",
      "Valverde",
      "Bentancur",
      "De Arrascaeta",
      "Nández",
      "Vecino",
      "Torreira",
      "Coates",
    ],
  },
  Bélgica: {
    first: ["Kevin", "Eden", "Romelu", "Thibaut", "Yannick", "Jérémy", "Axel", "Toby", "Dries", "Thorgan"],
    last: [
      "De Bruyne",
      "Hazard",
      "Lukaku",
      "Courtois",
      "Carrasco",
      "Doku",
      "Witsel",
      "Alderweireld",
      "Mertens",
      "Tielemans",
    ],
  },
  // Você pode manter Brasil, Inglaterra, etc. aqui SE quiser forçar nomes de jogadores reais.
  // Caso contrário, pode apagá-los do POOLS e o script usará a API automaticamente!
};

const FALLBACK: NamePool = {
  first: ["Alex", "Sam", "Jordan", "Chris", "Daniel", "Kevin", "Marco", "Diego", "Lucas", "Pablo"],
  last: ["Anderson", "Bennett", "Carter", "Davies", "Edwards", "Foster", "Garcia", "Hughes", "Ivanov", "Johansson"],
};

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

export async function generateRandomName(nationality?: string | null): Promise<string> {
  // 1. Sem nacionalidade, cai no genérico
  if (!nationality) return `${pick(FALLBACK.first)} ${pick(FALLBACK.last)}`;

  // 2. Se a nacionalidade está nos nossos pools (Solara, Portugal, etc), usa o array local
  if (POOLS[nationality]) {
    return `${pick(POOLS[nationality].first)} ${pick(POOLS[nationality].last)}`;
  }

  // 3. Procura o código do país no arquivo countries.ts
  const country = getCountryByName(nationality);
  let code = country ? country.code.toLowerCase() : "";

  // Correção para Reino Unido (A API usa 'gb' para tudo, seu código é gb-eng, gb-wls, etc)
  if (code.startsWith("gb")) code = "gb";

  // 4. Se a API suportar o código, faz a requisição
  if (API_SUPPORTED_NATS.includes(code)) {
    try {
      const response = await fetch(`https://randomuser.me/api/?nat=${code}&inc=name&gender=male`);
      const data = await response.json();
      const user = data.results[0];
      return `${user.name.first} ${user.name.last}`;
    } catch (error) {
      console.error(`Erro ao buscar nome da API para ${code}:`, error);
      // Se a API cair ou der timeout, segue para o fallback abaixo
    }
  }

  // 5. Se não tiver na API nem no POOL, usa o Fallback global
  return `${pick(FALLBACK.first)} ${pick(FALLBACK.last)}`;
}
