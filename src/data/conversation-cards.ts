export type ConversationCard = {
  id: string;
  topic: string;
  moods: string[];
  question: string;
  followUp: string;
  groupFollowUp: string;
};

const CARDS: ConversationCard[] = [
  {
    id: "espaco-01",
    topic: "Espaço",
    moods: ["Dar risada", "Viajar nas ideias"],
    question:
      "Tu virou representante da Terra. Quais três objetos levaria pra explicar a humanidade aos aliens?",
    followUp: "Qual desses objetos faria eles desistirem de visitar a gente?",
    groupFollowUp:
      "Cada pessoa escolhe um objeto. Depois vocês precisam defender esse kit como se fosse uma apresentação oficial.",
  },
  {
    id: "espaco-02",
    topic: "Espaço",
    moods: ["Papo profundo", "Me surpreender"],
    question:
      "Tu viajaria pra conhecer outro planeta se, na volta, tivessem passado 50 anos na Terra?",
    followUp: "O que precisaria existir nesse planeta pra viagem valer a pena?",
    groupFollowUp:
      "Quem iria e quem ficaria? Cada lado tem que explicar o que pesou mais na decisão.",
  },
  {
    id: "natureza-01",
    topic: "Natureza",
    moods: ["Relaxar", "Viajar nas ideias"],
    question:
      "Se pudesse passar uma tarde em qualquer paisagem, com conforto e segurança, qual escolheria?",
    followUp:
      "Imagina os sons, a temperatura e o que tu estaria vendo ao redor.",
    groupFollowUp:
      "Cada um descreve seu lugar sem falar o nome. O resto tenta imaginar onde é.",
  },
  {
    id: "musica-01",
    topic: "Música",
    moods: ["Relaxar", "Papo profundo"],
    question: "Qual música parece guardar uma versão antiga de ti?",
    followUp: "Que lugar ou momento aparece primeiro quando tu lembra dela?",
    groupFollowUp: "Cada pessoa conta a lembrança antes de revelar a música.",
  },
  {
    id: "musica-02",
    topic: "Música",
    moods: ["Dar risada", "Me surpreender"],
    question:
      "Se toda entrada tua num lugar tivesse uma música obrigatória, qual seria a pior escolha possível?",
    followUp: "E qual seria a música perfeita pra tua saída dramática?",
    groupFollowUp: "Escolham a música de entrada de cada pessoa da roda.",
  },
  {
    id: "games-01",
    topic: "Games",
    moods: ["Dar risada", "Viajar nas ideias"],
    question:
      "Se tua vida virasse um jogo, qual habilidade inútil tu já teria no nível máximo?",
    followUp: "Qual seria o nome da conquista desbloqueada?",
    groupFollowUp:
      "A galera inventa uma missão secundária pra cada pessoa completar na vida real, sem precisar fazer agora.",
  },
  {
    id: "nostalgia-01",
    topic: "Nostalgia",
    moods: ["Relaxar", "Papo profundo"],
    question:
      "Qual momento simples da infância tu gostaria de visitar por dez minutos?",
    followUp: "Tu voltaria pra participar ou só pra observar?",
    groupFollowUp:
      "Tem alguma lembrança parecida entre vocês, mesmo tendo crescido em lugares diferentes?",
  },
  {
    id: "misterios-01",
    topic: "Mistérios",
    moods: ["Viajar nas ideias", "Me surpreender"],
    question:
      "Uma porta aparece na tua casa e só abre uma vez. O que teria que estar escrito nela pra tu entrar?",
    followUp: "E qual frase faria tu nunca encostar na maçaneta?",
    groupFollowUp:
      "Cada pessoa inventa o destino da porta. Depois vocês escolhem em qual entrariam juntos.",
  },
  {
    id: "relacionamentos-01",
    topic: "Relacionamentos",
    moods: ["Papo profundo", "Relaxar"],
    question:
      "Qual gesto pequeno faz tu perceber que alguém presta atenção em ti?",
    followUp:
      "Tem algum gesto assim que tu gostaria de fazer mais pelas pessoas?",
    groupFollowUp:
      "Quem quiser pode contar uma situação em que um detalhe fez diferença.",
  },
  {
    id: "absurdos-01",
    topic: "Assuntos absurdos",
    moods: ["Dar risada", "Me surpreender"],
    question:
      "Tu recebeu dinheiro pra abrir uma loja que vende algo completamente inútil. O que vai vender?",
    followUp: "Inventa o nome da loja e uma propaganda exagerada.",
    groupFollowUp:
      "Uma pessoa inventa o produto e a próxima tenta vender pra roda.",
  },
  {
    id: "absurdos-02",
    topic: "Assuntos absurdos",
    moods: ["Dar risada", "Viajar nas ideias"],
    question:
      "Qual tarefa cotidiana ficaria mais engraçada se tivesse narrador esportivo?",
    followUp: "Como seria a narração do momento decisivo?",
    groupFollowUp:
      "Escolham uma tarefa e façam uma narração de dez segundos, se estiverem a fim.",
  },
];

export function buildConversationDeck(
  topics: string[],
  mood: string,
): ConversationCard[] {
  const matching = CARDS.filter(
    (card) => topics.length === 0 || topics.includes(card.topic),
  );

  const shuffled = [...matching];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = current;
  }

  const preferred = shuffled.filter((card) => card.moods.includes(mood));
  const remaining = shuffled.filter((card) => !card.moods.includes(mood));

  return [...preferred, ...remaining].slice(0, 5);
}
