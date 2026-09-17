import { CentralSemana } from "./CentralSemana";
import { PropostasInicio } from "./PropostasInicio";
import { DecisoesInicio } from "./DecisoesInicio";
import { AtencaoCarreira } from "./AtencaoCarreira";
import { HeroJogador } from "./inicio/HeroJogador";
import { CardMeuClube } from "./inicio/CardMeuClube";
import { CardProximoJogo } from "./inicio/CardProximoJogo";
import { CardMiniCalendario } from "./inicio/CardMiniCalendario";
import { CardMensagens } from "./inicio/CardMensagens";
import { CardDesempenho } from "./inicio/CardDesempenho";
import { CardObjetivos } from "./inicio/CardObjetivos";
import { CardMercadoContrato } from "./inicio/CardMercadoContrato";
import { PainelUltimaPartida } from "@/componentes/partida/PainelUltimaPartida";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import {
  estaSemClube,
  semanasSemClube,
} from "@/simulacao/carreira/agente-livre";
import { categoriaPartidaDaSemana } from "@/simulacao/base/formacao";

export function InicioCarreira({
  carreira: c,
  avancar,
  ocupado,
  abrirResumo,
}: {
  carreira: EstadoCarreira;
  avancar: () => void;
  ocupado: boolean;
  abrirResumo: () => void;
}) {
  const j = c.jogador;
  const livre = estaSemClube(c);
  const ehDaBase = j.categoria === "base";
  const categoriaPartida = categoriaPartidaDaSemana(c);
  const jogaBaseNestaSemana = categoriaPartida === "base";
  const clube = livre
    ? undefined
    : c.clubes.find((cl) => cl.id === c.clubeAtualId);
  const ultimoClube = c.clubes.find((cl) => cl.id === c.ultimoClubeId);
  const partidas = jogaBaseNestaSemana
    ? c.temporada.partidasBase
    : c.temporada.partidas;
  const proximas = !livre && clube
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
  const linha = clube
    ? tabela.find((l) => l.clubeId === clube.id)
    : undefined;
  const semanasLivre = semanasSemClube(c);

  return (
    <>
      <AtencaoCarreira carreira={c} />
      <PropostasInicio carreira={c} />
      <DecisoesInicio carreira={c} />
      <CentralSemana carreira={c} />
      {livre && (
        <section className="vz-card vz-alerta-livre" role="status">
          <p className="vz-card-sub">SEM CLUBE / AGENTE LIVRE</p>
          <h2>Você está no mercado.</h2>
          <p>
            {ultimoClube
              ? `Seu contrato com o ${ultimoClube.nome} terminou.`
              : "Seu contrato terminou e você ficou sem clube."}
            {semanasLivre > 0 ? ` · ${semanasLivre} semana(s) sem clube` : ""}
          </p>
          <Link className="botao secundario" href="/carreira/mercado">
            Ir ao agente
          </Link>
        </section>
      )}

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
        <CardDesempenho carreira={c} />
        <CardObjetivos carreira={c} />
        <CardMercadoContrato carreira={c} />
      </div>

      <div className="espaco">
        <PainelUltimaPartida carreira={c} abrirDetalhes={abrirResumo} />
      </div>

      <div className="vz-avancar-semana">
        <div>
          <p className="vz-card-sub">
            {c.aposentado
              ? "CARREIRA ENCERRADA"
              : j.lesao
                ? "DEPARTAMENTO MÉDICO"
                : livre
                  ? "TREINO INDIVIDUAL"
                  : ehDaBase
                    ? "DESENVOLVIMENTO / BASE"
                    : "PREPARAÇÃO DA SEMANA"}
          </p>
          <p>
            {c.aposentado
              ? "Sua carreira foi encerrada."
              : j.lesao
                ? `${j.lesao.tipo} · ${j.lesao.diasRecuperacao} dias`
                : "Avance o tempo para simular a próxima semana."}
          </p>
        </div>
        <button
          className="botao principal"
          onClick={avancar}
          disabled={ocupado || !!c.aposentado}
        >
          {c.aposentado
            ? "Aposentado"
            : ocupado
              ? "Simulando…"
              : c.temporada.encerrada
                ? "Próxima temporada"
                : "Avançar semana"}
          <ArrowRight size={18} />
        </button>
      </div>
    </>
  );
}
