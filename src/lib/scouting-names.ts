// Banco fixo de nomes/sobrenomes por nacionalidade.
// Quando a peneira do servidor retorna nomes genéricos ("Jogador XXXX"),
// substituímos por um nome compatível com a nacionalidade aqui no client.

type NamePool = { first: string[]; last: string[] };

const POOLS: Record<string, NamePool> = {
  Brasil: {
    first: ["João","Pedro","Lucas","Gabriel","Matheus","Rafael","Gustavo","Felipe","Bruno","Thiago","Diego","Caio","Vinícius","Leandro","Ronaldo","Eduardo","André","Fábio","Marcelo","Davi","Arthur","Enzo","Henrique","Renan","Ricardo"],
    last: ["Silva","Santos","Souza","Oliveira","Pereira","Costa","Almeida","Ferreira","Carvalho","Martins","Gomes","Lima","Araújo","Ribeiro","Rocha","Barbosa","Nascimento","Cardoso","Teixeira","Moreira"],
  },
  Argentina: {
    first: ["Lionel","Sergio","Ángel","Paulo","Juan","Diego","Martín","Nicolás","Lautaro","Gonzalo","Rodrigo","Facundo","Mateo","Emiliano","Cristian","Leandro","Ezequiel","Maximiliano","Hernán","Ignacio"],
    last: ["Messi","Agüero","Di María","Dybala","Martínez","Romero","López","Fernández","González","Rodríguez","Pérez","Sánchez","Gómez","Álvarez","Romero","Acuña","Paredes","Lo Celso","Otamendi","Tagliafico"],
  },
  Portugal: {
    first: ["Cristiano","João","Bruno","Rúben","Bernardo","Diogo","André","Pedro","Rafael","Gonçalo","Vitinha","Nuno","Tiago","Miguel","Francisco","Renato","Domingos","Ricardo","Joaquim","Luís"],
    last: ["Ronaldo","Silva","Fernandes","Dias","Neves","Santos","Costa","Pereira","Carvalho","Almeida","Ramos","Cancelo","Pepe","Félix","Leão","Mendes","Gonçalves","Oliveira","Sousa","Martins"],
  },
  Espanha: {
    first: ["Sergio","Pedri","Gavi","Marco","Álvaro","Ferran","Pablo","Rodri","Dani","Iker","David","Mikel","Unai","Nacho","Carlos","Ansu","Pau","Aymeric","Yeremy","Diego"],
    last: ["Ramos","Busquets","Asensio","Morata","Torres","Olmo","Sarabia","García","Carvajal","Hermoso","Casado","Llorente","Olabe","Gavi","Fati","Laporte","Torres","Mingueza","Pino","López"],
  },
  França: {
    first: ["Kylian","Antoine","Olivier","Karim","N'Golo","Paul","Hugo","Raphaël","Aurélien","Eduardo","Théo","Jules","Marcus","Christopher","Ousmane","Adrien","Wesley","Mike","Benjamin","William"],
    last: ["Mbappé","Griezmann","Giroud","Benzema","Kanté","Pogba","Lloris","Varane","Tchouaméni","Camavinga","Hernandez","Koundé","Thuram","Nkunku","Dembélé","Rabiot","Fofana","Maignan","Pavard","Saliba"],
  },
  Inglaterra: {
    first: ["Harry","Jack","Mason","Phil","Marcus","Bukayo","Jude","Declan","Reece","Jordan","Kyle","Trent","Eric","Ben","Conor","Aaron","Kalvin","James","Tammy","Raheem"],
    last: ["Kane","Grealish","Mount","Foden","Rashford","Saka","Bellingham","Rice","James","Henderson","Walker","Alexander-Arnold","Dier","Chilwell","Gallagher","Ramsdale","Phillips","Maddison","Abraham","Sterling"],
  },
  Alemanha: {
    first: ["Manuel","Joshua","Toni","Leon","Kai","Jamal","Serge","Niklas","Antonio","Florian","Timo","Marc-André","Thomas","Leroy","İlkay","Mats","Robin","Julian","Mario","Sven"],
    last: ["Neuer","Kimmich","Kroos","Goretzka","Havertz","Musiala","Gnabry","Süle","Rüdiger","Wirtz","Werner","ter Stegen","Müller","Sané","Gündoğan","Hummels","Gosens","Brandt","Götze","Bender"],
  },
  Itália: {
    first: ["Gianluigi","Leonardo","Giorgio","Nicolò","Federico","Lorenzo","Marco","Domenico","Ciro","Andrea","Manuel","Davide","Sandro","Bryan","Mattia","Alessandro","Stefano","Matteo","Vincenzo","Luca"],
    last: ["Donnarumma","Bonucci","Chiellini","Barella","Chiesa","Insigne","Verratti","Berardi","Immobile","Belotti","Locatelli","Calabria","Tonali","Cristante","Politano","Bastoni","Sensi","Pessina","Grifo","Pellegrini"],
  },
  Uruguai: {
    first: ["Luis","Edinson","Diego","Federico","Rodrigo","Giorgian","Nahitan","Matías","Lucas","Sebastián","José","Maximiliano","Fernando","Cristian","Ronald","Martín","Mauro","Agustín","Nicolás","Brian"],
    last: ["Suárez","Cavani","Godín","Valverde","Bentancur","De Arrascaeta","Nández","Vecino","Torreira","Coates","Giménez","Gómez","Muslera","Stuani","Araújo","Cáceres","Arambarri","Canobbio","Lodeiro","Rodríguez"],
  },
  Holanda: {
    first: ["Memphis","Frenkie","Matthijs","Virgil","Georginio","Donny","Cody","Steven","Denzel","Jurriën","Tijjani","Davy","Daley","Justin","Stefan","Wout","Quincy","Jasper","Owen","Teun"],
    last: ["Depay","de Jong","de Ligt","van Dijk","Wijnaldum","van de Beek","Gakpo","Bergwijn","Dumfries","Timber","Reijnders","Klaassen","Blind","Kluivert","de Vrij","Weghorst","Promes","Cillessen","Wijndal","Koopmeiners"],
  },
  Bélgica: {
    first: ["Kevin","Eden","Romelu","Thibaut","Yannick","Jérémy","Axel","Toby","Dries","Thorgan","Youri","Leandro","Hans","Timothy","Charles","Leander","Dodi","Alexis","Hugo","Jason"],
    last: ["De Bruyne","Hazard","Lukaku","Courtois","Carrasco","Doku","Witsel","Alderweireld","Mertens","Hazard","Tielemans","Trossard","Vanaken","Castagne","De Ketelaere","Dendoncker","Lukebakio","Saelemaekers","Vanaken","Denayer"],
  },
};

const FALLBACK: NamePool = {
  first: ["Alex","Sam","Jordan","Chris","Daniel","Kevin","Marco","Diego","Lucas","Pablo","Mario","Tony","Leo","Adam","Erik","Felix","Oscar","Hugo","Igor","Noah"],
  last: ["Anderson","Bennett","Carter","Davies","Edwards","Foster","Garcia","Hughes","Ivanov","Johansson","Kovač","Larsen","Müller","Novak","Owens","Pavlov","Quintero","Reyes","Stone","Torres"],
};

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

export function generateRandomName(nationality?: string | null): string {
  const pool = (nationality && POOLS[nationality]) || FALLBACK;
  return `${pick(pool.first)} ${pick(pool.last)}`;
}
