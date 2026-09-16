import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { gerarClubesDemonstracao } from "@/dados/demonstracao";
import {
  criarCarreira,
  type EntradaCarreira,
} from "@/aplicacao/casos-de-uso/criar-carreira";
export function exemploCarreira() {
  const ligas = [LIGAS_SUPORTADAS[0]!, LIGAS_SUPORTADAS[3]!];
  const clubes = ligas.flatMap((l) => gerarClubesDemonstracao(l).slice(0, 4));
  for (const c of clubes) {
    c.escudo = `https://imagens.test/${c.id}.png`;
    c.dadosBrutos = { catalogo: "não persistir" };
    c.elenco.forEach((j) => {
      j.foto = `https://imagens.test/${j.id}.png`;
    });
  }
  const entrada: EntradaCarreira = {
    identidade: {
      nome: "Ana",
      sobrenome: "Teste",
      nacionalidade: "Brasil",
      idade: 22,
      posicao: "PD",
      posicaoSecundaria: "",
      peDominante: "direito",
      altura: 170,
      peso: 62,
      arquetipo: "criador",
    },
    liga: ligas[0],
    clubes: clubes.filter((c) => c.ligaId === ligas[0].id),
    clubeId: clubes[0].id,
    seed: "persistencia-fase5",
    origem: "api",
    dataInicio: "2026-06-01",
    ligasMundo: [ligas[1]],
    clubesMundo: clubes.filter((c) => c.ligaId === ligas[1].id),
  };
  return {
    entrada,
    carreira: criarCarreira(entrada),
    catalogo: { ligas, clubes },
  };
}
