import type {
  DecisaoPendente,
  EstadoCarreira,
  Posicao,
} from "@/dominio/entidades/modelos";
import { GeradorAleatorio } from "@/utilitarios/aleatorio";
import { limitar } from "@/utilitarios/formatacao";
import { registrarEvento } from "../eventos/eventos";

function rotuloRelacao(valor: number): string {
  if (valor >= 85) return "Excelente";
  if (valor >= 70) return "Boa";
  if (valor >= 45) return "Neutra";
  if (valor >= 25) return "Ruim";
  return "Péssima";
}

export { rotuloRelacao };

export function gerarDecisoesSemana(
  carreira: EstadoCarreira,
  aleatorio: GeradorAleatorio,
): void {
  if (carreira.decisoes.some((d) => !d.resolvida)) return;
  const j = carreira.jogador;
  const clube = carreira.clubes.find((c) => c.id === carreira.clubeAtualId);
  if (!clube) return;

  if (
    carreira.relacionamentos.treinador > 80 &&
    j.idade <= 22 &&
    j.forma > 65 &&
    aleatorio.chance(0.18)
  ) {
    carreira.decisoes.push({
      id: `dec-papel-${carreira.dataAtual}`,
      data: carreira.dataAtual,
      tipo: "papel-elenco",
      remetente: "Treinador",
      titulo: "Maior responsabilidade no elenco",
      texto: `${clube.treinador.nome} quer ampliar seu papel nas próximas partidas.`,
      opcoes: [
        { id: "aceitar", rotulo: "Aceitar o desafio" },
        { id: "recusar", rotulo: "Manter ritmo atual" },
      ],
      resolvida: false,
    });
    return;
  }

  if (
    j.fadiga > 72 &&
    !j.lesao &&
    aleatorio.chance(0.22)
  ) {
    carreira.decisoes.push({
      id: `dec-medico-${carreira.dataAtual}`,
      data: carreira.dataAtual,
      tipo: "fadiga",
      remetente: "Departamento médico",
      titulo: "Fadiga elevada",
      texto: "O departamento médico alerta para risco de lesão no próximo clássico.",
      opcoes: [
        { id: "jogar", rotulo: "Quero jogar" },
        { id: "descansar", rotulo: "Pedir descanso" },
      ],
      resolvida: false,
    });
    return;
  }

  if (
    j.posicaoSecundaria === "" &&
    j.confianca > 55 &&
    aleatorio.chance(0.1)
  ) {
    const alternativas: Posicao[] =
      j.posicao === "PD"
        ? ["PE", "MEI"]
        : j.posicao === "PE"
          ? ["PD", "MEI"]
          : j.posicao === "CA"
            ? ["MEI", "PD"]
            : j.posicao === "MC"
              ? ["VOL", "MEI"]
              : ["MC"];
    const nova = aleatorio.escolher(alternativas);
    carreira.decisoes.push({
      id: `dec-pos-${carreira.dataAtual}`,
      data: carreira.dataAtual,
      tipo: "teste-posicao",
      remetente: "Treinador",
      titulo: `Teste como ${nova}`,
      texto: `${clube.treinador.nome}: quero testar você como ${nova} em algumas partidas.`,
      opcoes: [
        { id: `aceitar:${nova}`, rotulo: "Aceitar" },
        { id: "recusar", rotulo: "Recusar" },
      ],
      resolvida: false,
    });
    return;
  }

  if (
    carreira.propostas.some(
      (p) => p.status === "pendente" && p.tipo === "transferencia",
    ) &&
    aleatorio.chance(0.25)
  ) {
    const prop = carreira.propostas.find(
      (p) => p.status === "pendente" && p.tipo === "transferencia",
    )!;
    const nome =
      carreira.clubes.find((c) => c.id === prop.clubeId)?.nome ?? "um clube";
    carreira.decisoes.push({
      id: `dec-agente-${carreira.dataAtual}`,
      data: carreira.dataAtual,
      tipo: "conselho-agente",
      remetente: "Agente",
      titulo: `${nome} está de olho`,
      texto: "Seu agente quer saber como conduzir as conversas.",
      opcoes: [
        { id: "ouvir", rotulo: "Ouvir a proposta" },
        { id: "ficar", rotulo: "Quero ficar" },
        { id: "maiores", rotulo: "Só clubes maiores" },
      ],
      resolvida: false,
    });
  }
}

export function responderDecisao(
  estado: EstadoCarreira,
  id: string,
  opcaoId: string,
): EstadoCarreira {
  const carreira = structuredClone(estado);
  const decisao = carreira.decisoes.find((d) => d.id === id && !d.resolvida);
  if (!decisao) throw new Error("Decisão não disponível.");
  decisao.resolvida = true;
  decisao.opcaoEscolhida = opcaoId;
  const j = carreira.jogador;

  if (decisao.tipo === "papel-elenco") {
    if (opcaoId === "aceitar") {
      j.confianca = limitar(j.confianca + 6);
      carreira.relacionamentos.treinador = limitar(
        carreira.relacionamentos.treinador + 8,
      );
      j.moral = limitar(j.moral + 4);
      registrarEvento(
        carreira,
        "decisao",
        "Você topou mais minutos",
        "A comissão valorizou sua atitude.",
        "Treinador",
      );
    } else {
      carreira.relacionamentos.treinador = limitar(
        carreira.relacionamentos.treinador - 4,
      );
      j.confianca = limitar(j.confianca - 2);
    }
  } else if (decisao.tipo === "fadiga") {
    if (opcaoId === "descansar") {
      j.fadiga = limitar(j.fadiga - 25);
      j.condicionamento = limitar(j.condicionamento + 5);
      carreira.relacionamentos.treinador = limitar(
        carreira.relacionamentos.treinador - 1,
      );
      registrarEvento(
        carreira,
        "decisao",
        "Descanso autorizado",
        "O departamento médico aprova a escolha cautelosa.",
        "Departamento médico",
      );
    } else {
      j.fadiga = limitar(j.fadiga + 8);
      j.confianca = limitar(j.confianca + 3);
    }
  } else if (decisao.tipo === "teste-posicao") {
    if (opcaoId.startsWith("aceitar:")) {
      const pos = opcaoId.split(":")[1] as Posicao;
      j.posicaoSecundaria = pos;
      j.confianca = limitar(j.confianca + 4);
      carreira.relacionamentos.treinador = limitar(
        carreira.relacionamentos.treinador + 5,
      );
      registrarEvento(
        carreira,
        "decisao",
        `Versatilidade: ${pos}`,
        "Você aceitou o teste posicional.",
        "Treinador",
      );
    } else {
      carreira.relacionamentos.treinador = limitar(
        carreira.relacionamentos.treinador - 3,
      );
    }
  } else if (decisao.tipo === "conselho-agente") {
    if (opcaoId === "ficar") {
      carreira.relacionamentos.diretoria = limitar(
        carreira.relacionamentos.diretoria + 4,
      );
      carreira.relacionamentos.agente = limitar(
        carreira.relacionamentos.agente - 2,
      );
      j.moral = limitar(j.moral + 3);
    } else if (opcaoId === "maiores") {
      carreira.relacionamentos.agente = limitar(
        carreira.relacionamentos.agente + 3,
      );
      j.personalidade.ambicao = limitar(j.personalidade.ambicao + 2);
    } else {
      carreira.relacionamentos.agente = limitar(
        carreira.relacionamentos.agente + 4,
      );
    }
  }

  return carreira;
}

export function decisoesPendentes(
  carreira: EstadoCarreira,
): DecisaoPendente[] {
  return carreira.decisoes.filter((d) => !d.resolvida);
}
