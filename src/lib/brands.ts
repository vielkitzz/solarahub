// src/lib/brands.ts

export interface Brand {
  name: string;
  domain: string;
  setor: string;
  prestige?: number; // 0.6 (marca regional) → 2.0 (marca global top)
}

// 1. Fornecedoras de Material Esportivo
export const KIT_SUPPLIERS: Brand[] = [
  { name: "Adidas", domain: "adidaswrestling.com", setor: "Material Esportivo", prestige: 1.95 },
  { name: "Nike", domain: "nike.com", setor: "Material Esportivo", prestige: 2.0 },
  { name: "Puma", domain: "puma.com", setor: "Material Esportivo", prestige: 1.7 },
  { name: "New Balance", domain: "newbalance.com", setor: "Material Esportivo", prestige: 1.55 },
  { name: "Under Armour", domain: "underarmour.com", setor: "Material Esportivo", prestige: 1.5 },
  { name: "Umbro", domain: "umbro.com", setor: "Material Esportivo", prestige: 1.3 },
  { name: "Kappa", domain: "kappa.com", setor: "Material Esportivo", prestige: 1.25 },
  { name: "Reebok", domain: "reebok.com", setor: "Material Esportivo", prestige: 1.25 },
  { name: "Asics", domain: "asics.com", setor: "Material Esportivo", prestige: 1.2 },
  { name: "Mizuno", domain: "mizuno.com", setor: "Material Esportivo", prestige: 1.2 },
  { name: "Fila", domain: "fila.com", setor: "Material Esportivo", prestige: 1.15 },
  { name: "Champion", domain: "champion.com", setor: "Material Esportivo", prestige: 1.1 },
  { name: "Li-Ning", domain: "lining.com", setor: "Material Esportivo", prestige: 1.1 },
  { name: "Hummel", domain: "hummel.net", setor: "Material Esportivo", prestige: 1.05 },
  { name: "Castore", domain: "castore.com", setor: "Material Esportivo", prestige: 1.05 },
  { name: "Macron", domain: "macron.com", setor: "Material Esportivo", prestige: 1.0 },
  { name: "Joma", domain: "joma-sport.com", setor: "Material Esportivo", prestige: 1.0 },
  { name: "Lotto", domain: "lotto.it", setor: "Material Esportivo", prestige: 0.95 },
  { name: "Diadora", domain: "diadora.com", setor: "Material Esportivo", prestige: 0.95 },
  { name: "Le Coq Sportif", domain: "lecoqsportif.com.ar", setor: "Material Esportivo", prestige: 0.95 },
  { name: "Uhlsport", domain: "uhlsport.com", setor: "Material Esportivo", prestige: 0.9 },
  { name: "Errea", domain: "errea.com", setor: "Material Esportivo", prestige: 0.88 },
  { name: "Patrick", domain: "patrick.eu", setor: "Material Esportivo", prestige: 0.85 },
  { name: "Kelme", domain: "kelme.com", setor: "Material Esportivo", prestige: 0.85 },
  { name: "Wilson", domain: "wilson.com", setor: "Material Esportivo", prestige: 0.85 },
  { name: "Mitre", domain: "mitre.com", setor: "Material Esportivo", prestige: 0.82 },
  { name: "Anta", domain: "anta.com", setor: "Material Esportivo", prestige: 0.82 },
  { name: "Penalty", domain: "penalty.com.ar", setor: "Material Esportivo", prestige: 0.8 },
  { name: "Acerbis", domain: "acerbisusa.com", setor: "Material Esportivo", prestige: 0.8 },
  { name: "Givova", domain: "givova.it", setor: "Material Esportivo", prestige: 0.78 },
  { name: "Decathlon", domain: "decathlon.com", setor: "Varejista", prestige: 0.9 },
  { name: "Legea", domain: "legea.com", setor: "Material Esportivo", prestige: 0.75 },
  { name: "Topper", domain: "topper.com.br", setor: "Material Esportivo", prestige: 0.75 },
  { name: "Olympikus", domain: "olympikus.pe", setor: "Material Esportivo", prestige: 0.75 },
  { name: "Marathon", domain: "marathon.store", setor: "Material Esportivo", prestige: 0.72 },
  { name: "Xtep", domain: "xtep.id", setor: "Material Esportivo", prestige: 0.72 },
  { name: "Zeus", domain: "zeusport.it", setor: "Material Esportivo", prestige: 0.7 },
  { name: "Lupo", domain: "lupo.com.br", setor: "Material Esportivo", prestige: 0.7 },
  { name: "Volt", domain: "voltsport.com.br", setor: "Material Esportivo", prestige: 0.68 },
  { name: "Pirma", domain: "pirma.com.mx", setor: "Material Esportivo", prestige: 0.68 },
  { name: "Charly", domain: "charly.com", setor: "Material Esportivo", prestige: 0.68 },
  { name: "Walon", domain: "walon.com.pe", setor: "Material Esportivo", prestige: 0.65 },
  { name: "Atomik", domain: "atomik.com.ar", setor: "Material Esportivo", prestige: 0.65 },
  { name: "Jako", domain: "jako.com", setor: "Material Esportivo", prestige: 0.65 },
  { name: "Capelli Sport", domain: "capellisport.com", setor: "Material Esportivo", prestige: 0.62 },
  { name: "Merooj", domain: "merooj.ir", setor: "Material Esportivo", prestige: 0.6 },
];

// 2. Patrocinadores Padrão
export const SPONSORS: Brand[] = [
  // --- Globais Top ---
  { name: "Apple", domain: "apple.com", setor: "Tecnologia", prestige: 2.0 },
  { name: "Samsung", domain: "samsung.com", setor: "Tecnologia", prestige: 1.95 },
  { name: "Sony", domain: "sony.com", setor: "Tecnologia", prestige: 1.85 },
  { name: "Visa", domain: "visa.com", setor: "Finanças", prestige: 1.9 },
  { name: "Mastercard", domain: "mastercardservices.com", setor: "Finanças", prestige: 1.85 },
  { name: "Coca-Cola", domain: "coca-cola.com", setor: "Alimentação", prestige: 1.9 },
  { name: "Toyota", domain: "toyota.com", setor: "Automóveis", prestige: 1.85 },
  { name: "Volkswagen", domain: "volkswagen.de", setor: "Automóveis", prestige: 1.75 },
  { name: "Emirates", domain: "emirates.com", setor: "Companhias Aéreas", prestige: 1.85 },
  { name: "Hyundai", domain: "hyundaiusa.com", setor: "Automóveis", prestige: 1.7 },
  { name: "Intel", domain: "intel.com", setor: "Tecnologia", prestige: 1.75 },
  { name: "Philips", domain: "philips.com", setor: "Tecnologia", prestige: 1.65 },

  // --- Grandes Internacionais ---
  { name: "Spotify", domain: "spotify.com", setor: "Tecnologia", prestige: 1.75 },
  { name: "Santander", domain: "santander.com.br", setor: "Banco", prestige: 1.7 },
  { name: "BBVA", domain: "bbva.com", setor: "Banco", prestige: 1.65 },
  { name: "Standard Chartered", domain: "sc.com", setor: "Banco", prestige: 1.6 },
  { name: "Mercado Libre", domain: "mercadolibre.com.ar", setor: "Tecnologia", prestige: 1.55 },
  { name: "Mercado Pago", domain: "mercadopago.com.ar", setor: "Finanças", prestige: 1.5 },
  { name: "Turkish Airlines", domain: "turkishairlines.com", setor: "Companhias Aéreas", prestige: 1.6 },
  { name: "Etihad Airways", domain: "etihad.com", setor: "Companhias Aéreas", prestige: 1.6 },
  { name: "LATAM Airlines", domain: "latamairlines.com", setor: "Companhias Aéreas", prestige: 1.45 },
  { name: "Pirelli", domain: "pirelli.ch", setor: "Automóveis", prestige: 1.55 },
  { name: "Bridgestone", domain: "bridgestone.co.in", setor: "Automóveis", prestige: 1.45 },
  { name: "Kia", domain: "kia.com", setor: "Automóveis", prestige: 1.45 },
  { name: "Peugeot", domain: "peugeot.fr", setor: "Automóveis", prestige: 1.4 },
  { name: "Opel", domain: "opel.com", setor: "Automóveis", prestige: 1.25 },
  { name: "Jeep", domain: "jeep.com", setor: "Automóveis", prestige: 1.35 },
  { name: "Continental", domain: "continental.com", setor: "Automóveis", prestige: 1.35 },
  { name: "BYD", domain: "byd.com", setor: "Automóveis", prestige: 1.3 },
  { name: "Yamaha", domain: "yamaha-motor.eu", setor: "Automóveis", prestige: 1.3 },
  { name: "Vodafone", domain: "vodafone-us.com", setor: "Telecomunicações", prestige: 1.55 },
  { name: "Deutsche Telekom", domain: "telekom.de", setor: "Telecomunicações", prestige: 1.5 },
  { name: "Claro", domain: "claro.com.br", setor: "Telecomunicações", prestige: 1.3 },
  { name: "Movistar", domain: "movistar.com.ar", setor: "Telecomunicações", prestige: 1.25 },
  { name: "Estrella Galicia", domain: "estrellagalicia00.es", setor: "Alimentação", prestige: 1.25 },
  { name: "DirecTV", domain: "directv.com", setor: "Telecomunicações", prestige: 1.2 },
  { name: "TeamViewer", domain: "teamviewer.com", setor: "Tecnologia", prestige: 1.3 },
  { name: "AMD", domain: "amd.com", setor: "Tecnologia", prestige: 1.35 },
  { name: "Globant", domain: "globant.com", setor: "Tecnologia", prestige: 1.1 },
  { name: "Socios.com", domain: "socios.com", setor: "Tecnologia", prestige: 1.05 },
  { name: "Chiliz", domain: "chiliz.com", setor: "Tecnologia", prestige: 1.0 },
  { name: "Konami", domain: "konamigaming.com", setor: "Tecnologia", prestige: 1.2 },
  { name: "Sanyo", domain: "sanyotv.com", setor: "Tecnologia", prestige: 0.9 },
  { name: "Radio Corporation of America", domain: "rca.com", setor: "Tecnologia", prestige: 0.85 },
  { name: "Accor", domain: "accor.com", setor: "Serviços", prestige: 1.3 },
  { name: "Kayak", domain: "kayak.com", setor: "Serviços", prestige: 1.1 },
  { name: "UNICEF", domain: "unicef.org", setor: "Multinacional", prestige: 1.8 },

  // --- Casas de Apostas ---
  { name: "Betano", domain: "betano.com", setor: "Casa de Apostas", prestige: 1.45 },
  { name: "Stake", domain: "stake.com", setor: "Casa de Apostas", prestige: 1.4 },
  { name: "Superbet", domain: "superbet.com", setor: "Casa de Apostas", prestige: 1.3 },
  { name: "Betsson", domain: "betsson.co", setor: "Casa de Apostas", prestige: 1.25 },
  { name: "EstrelaBet", domain: "estrelabetcasinos.com", setor: "Casa de Apostas", prestige: 1.15 },
  { name: "Esportes da Sorte", domain: "esportesdasorte.com", setor: "Casa de Apostas", prestige: 1.1 },
  { name: "H2bet", domain: "h2.bet.br", setor: "Casa de Apostas", prestige: 1.05 },
  { name: "KTO", domain: "kto.bet.br", setor: "Casa de Apostas", prestige: 1.0 },
  { name: "Codere", domain: "codere.bet.ar", setor: "Casa de Apostas", prestige: 1.0 },
  { name: "Fatal Model", domain: "fatalmodelgroup.com", setor: "Serviços", prestige: 0.8 },

  // --- Solara: Bancos e Financeiras ---
  { name: "Banco Nación", domain: "bna.com.ar", setor: "Banco", prestige: 1.2 },
  { name: "Banco Macro", domain: "macro.com.ar", setor: "Banco", prestige: 1.1 },
  { name: "Banco Ciudad", domain: "bancociudad.com.ar", setor: "Banco", prestige: 1.05 },
  { name: "Credicoop", domain: "bancocredicoop.coop", setor: "Banco", prestige: 0.95 },
  { name: "Brubank", domain: "brubank.com", setor: "Banco", prestige: 0.9 },
  { name: "Banco Patagonia", domain: "bancopatagonia.com.ar", setor: "Banco", prestige: 0.85 },
  { name: "Banco Entre Rios", domain: "bancoentrerios.com.ar", setor: "Banco", prestige: 0.75 },
  { name: "Naranja X", domain: "naranjax.com", setor: "Finanças", prestige: 0.9 },
  { name: "Assist Card", domain: "assistcard.com", setor: "Seguros", prestige: 0.85 },
  { name: "La Nueva Seguros", domain: "lanuevaseguros.com.ar", setor: "Seguros", prestige: 0.7 },
  { name: "Rapipago", domain: "rapipago.com.ar", setor: "Finanças", prestige: 0.68 },
  { name: "Pago Fácil", domain: "pagofacil.com.ar", setor: "Finanças", prestige: 0.68 },

  // --- Solara: Energia ---
  { name: "YPF", domain: "ypf.com", setor: "Energia", prestige: 1.25 },
  { name: "Axion Energy", domain: "axionenergy.com", setor: "Energia", prestige: 1.05 },
  { name: "Pampa Energía", domain: "pampaenergia.com", setor: "Energia", prestige: 0.95 },

  // --- Solara: Alimentos, Bebidas e Varejo ---
  { name: "Quilmes", domain: "quilmes.com.ar", setor: "Alimentação", prestige: 1.15 },
  { name: "Arcor", domain: "arcor.com", setor: "Alimentação", prestige: 1.1 },
  { name: "Guaraná Antarctica", domain: "guaranaantarctica.com.br", setor: "Alimentação", prestige: 1.05 },
  { name: "Parmalat", domain: "parmalat.com.br", setor: "Alimentação", prestige: 1.0 },
  { name: "SanCor", domain: "sancor.com", setor: "Alimentação", prestige: 0.9 },
  { name: "Mostaza", domain: "mostazaweb.com.ar", setor: "Alimentação", prestige: 0.82 },
  { name: "Bodega Norton", domain: "norton.com.ar", setor: "Alimentação", prestige: 0.8 },
  { name: "Zuccardi", domain: "zuccardiwines.com", setor: "Alimentação", prestige: 0.78 },
  { name: "La Virginia", domain: "lavirginia.com.ar", setor: "Alimentação", prestige: 0.75 },
  { name: "Ledesma", domain: "ledesma.com.ar", setor: "Alimentação", prestige: 0.75 },
  { name: "Netshoes", domain: "netshoes.com.br", setor: "Varejista", prestige: 0.95 },
  { name: "Havan", domain: "havan.com.br", setor: "Varejista", prestige: 0.8 },
  { name: "Coto", domain: "coto.com.ar", setor: "Varejista", prestige: 0.75 },
  { name: "Garbarino", domain: "garbarino.com", setor: "Varejista", prestige: 0.75 },
  { name: "Bimbo", domain: "grupobimbo.com", setor: "Alimentação", prestige: 0.75 },

  // --- Solara: Serviços e Outros ---
  { name: "Aerolíneas Solaras", domain: "aerolineas.com.ar", setor: "Companhias Aéreas", prestige: 1.1 },
  { name: "Flybondi", domain: "flybondi.com", setor: "Companhias Aéreas", prestige: 0.8 },
  { name: "Fate", domain: "fate.com.ar", setor: "Automóveis", prestige: 0.78 },
  { name: "CATA Internacional", domain: "catainternacional.com", setor: "Automóveis", prestige: 0.7 },
  { name: "Motomel", domain: "motomel.com.ar", setor: "Automóveis", prestige: 0.7 },
  { name: "Universidad Católica de Santa Fe", domain: "ucsf.edu.ar", setor: "Serviços", prestige: 0.62 },
];

export function getBrandLogoUrl(domain: string, apiKey?: string): string {
  if (apiKey) {
    return `https://img.logo.dev/${domain}?token=${apiKey}`;
  }
  const LOGO_DEV_KEY = "pk_OuJ9QjT9SqS6Au08Xadf7A";
  return `https://img.logo.dev/${domain}?token=${LOGO_DEV_KEY}`;
}
