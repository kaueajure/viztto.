import { FaixaAtencao } from "./FaixaAtencao";
import { HeroJogador } from "./inicio/HeroJogador";
import { CardMeuClube } from "./inicio/CardMeuClube";
import { CardProximoJogo } from "./inicio/CardProximoJogo";
import { CardMiniCalendario } from "./inicio/CardMiniCalendario";
import { CardMensagens } from "./inicio/CardMensagens";
import { CardDesempenho } from "./inicio/CardDesempenho";
import { CardObjetivos } from "./inicio/CardObjetivos";
import { CardMercadoContrato } from "./inicio/CardMercadoContrato";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import { estaSemClube } from "@/simulacao/carreira/agente-livre";
import { categoriaPartidaDaSemana } from "@/simulacao/base/formacao";

/** Home: apenas rail opcional + grid de 3 níveis. Sem scroll em desktop. */
export function InicioCarreira({
  carreira: c,
  abrirResumo,
}: {
  carreira: EstadoCarreira;
  avancar?: () => void;
  ocupado?: boolean;
  abrirResumo: () => void;
}) {
  const livre = estaSemClube(c);
  const categoriaPartida = categoriaPartidaDaSemana(c);
  const jogaBaseNestaSemana = categoriaPartida === "base";
  const clube = livre
    ? undefined
    : c.clubes.find((cl) => cl.id === c.clubeAtualId);
  const partidas = jogaBaseNestaSemana
    ? c.temporada.partidasBase
    : c.temporada.partidas;
  const proximas =
    !livre && clube
      ? partidas.filter(
          (p) =>
            p.golsMandante === null &&
            [p.mandanteId, p.visitanteId].includes(clube.id),
        )
      : [];
  const proxima = proximas[0];
  const tabela = jogaBaseNestaSemana
    ? c.temporada.classificacaoBase
    : c.temporada.classificacao;
  const linha = clube ? tabela.find((l) => l.clubeId === clube.id) : undefined;

  return (
    <div className="vz-home">
      <FaixaAtencao carreira={c} />
      <div className="vz-home-grid">
        <HeroJogador carreira={c} />
        <CardMeuClube carreira={c} linha={linha} />
        <CardProximoJogo
          carreira={c}
          proxima={proxima}
          livre={livre}
          jogaBase={jogaBaseNestaSemana}
        />
        <CardMiniCalendario carreira={c} proximos={proximas} />
        <CardMensagens carreira={c} />
        <CardDesempenho carreira={c} abrirResumo={abrirResumo} />
        <CardObjetivos carreira={c} />
        <CardMercadoContrato carreira={c} />
      </div>
    </div>
  );
}
