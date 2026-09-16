import type {
  EstadoCarreira,
  EventoCarreira,
} from "@/dominio/entidades/modelos";

function idDisponivel(base: string, usados: Set<string>): string {
  let id = base;
  let sufixo = 1;
  while (usados.has(id)) id = `${base}-${sufixo++}`;
  return id;
}

/** Preserva as notícias de saves antigos, inclusive as que tinham IDs iguais. */
export function normalizarIdsEventos(eventos: EventoCarreira[]): void {
  const usados = new Set(eventos.map((evento) => evento.id));
  const vistos = new Set<string>();
  for (const evento of eventos) {
    if (vistos.has(evento.id)) {
      evento.id = idDisponivel(evento.id, usados);
      usados.add(evento.id);
    }
    vistos.add(evento.id);
  }
}

export function registrarEvento(
  carreira: EstadoCarreira,
  tipo: string,
  titulo: string,
  texto: string,
  remetente: EventoCarreira["remetente"] = "Imprensa",
  permanente = true,
): void {
  const evento: EventoCarreira = {
    id: idDisponivel(
      `${carreira.dataAtual}-${carreira.eventos.length}-${carreira.noticias.length}-${tipo}`,
      new Set([...carreira.eventos, ...carreira.noticias].map((e) => e.id)),
    ),
    data: carreira.dataAtual,
    tipo,
    titulo,
    texto,
    remetente,
    lida: false,
  };
  carreira.noticias.unshift(evento);
  carreira.noticias = carreira.noticias.slice(0, 100);
  if (permanente) carreira.eventos.push(evento);
}
export function atualizarObjetivos(carreira: EstadoCarreira): void {
  const totais = carreira.registros.reduce(
    (s, r) => ({
      jogos: s.jogos + r.estatisticas.jogos,
      gols: s.gols + r.estatisticas.gols,
      assistencias: s.assistencias + r.estatisticas.assistencias,
    }),
    { jogos: 0, gols: 0, assistencias: 0 },
  );
  for (const objetivo of carreira.objetivos) {
    objetivo.progresso = Math.min(
      objetivo.meta,
      objetivo.id === "jogos"
        ? totais.jogos
        : objetivo.id === "gol"
          ? totais.gols
          : objetivo.id === "assistencia"
            ? totais.assistencias
            : carreira.jogador.confianca,
    );
    if (!objetivo.concluido && objetivo.progresso >= objetivo.meta) {
      objetivo.concluido = true;
      carreira.jogador.reputacao = Math.min(
        100,
        carreira.jogador.reputacao + 1,
      );
      registrarEvento(
        carreira,
        "objetivo",
        `Objetivo cumprido: ${objetivo.titulo}`,
        "Seu trabalho começa a ser reconhecido. Reputação +1.",
        "Agente",
      );
    }
  }
}
