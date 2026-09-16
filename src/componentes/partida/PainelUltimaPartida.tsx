import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import { Escudo } from "@/componentes/clube/Escudo";
export function PainelUltimaPartida({
  carreira,
  abrirDetalhes,
}: {
  carreira: EstadoCarreira;
  abrirDetalhes: () => void;
}) {
  const partida = [
    ...carreira.temporada.partidas,
    ...carreira.temporada.partidasBase,
  ].find((p) => p.id === carreira.ultimaPartidaId);
  const mandante = carreira.clubes.find((c) => c.id === partida?.mandanteId),
    visitante = carreira.clubes.find((c) => c.id === partida?.visitanteId),
    p = partida?.participacao;
  const variacao = (valor: number) => `${valor > 0 ? "+" : ""}${valor}`;
  return (
    <section
      className="painel-ultimo-jogo"
      aria-label="Resumo da última partida"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="linha-titulo">
        <span className="sobretitulo">ÚLTIMA PARTIDA</span>
        <span className="rotulo">
          {partida ? `RODADA ${partida.rodada}` : "AGUARDANDO ESTREIA"}
        </span>
      </div>
      {partida && mandante && visitante ? (
        <>
          <p className="competicao-resumo">
            {carreira.liga.nome} ·{" "}
            {partida.categoria === "base" ? "Base" : "Profissional"}
          </p>
          <div className="placar-painel">
            <div>
              <Escudo clube={mandante} tamanho={32} />
              <span>{mandante.nome}</span>
            </div>
            <strong>
              {partida.golsMandante}
              <span> : </span>
              {partida.golsVisitante}
            </strong>
            <div>
              <Escudo clube={visitante} tamanho={32} />
              <span>{visitante.nome}</span>
            </div>
          </div>
          {p && (
            <>
              <div className="participacao-painel">
                <div>
                  <b>
                    {p.minutos
                      ? `${p.minutos} minutos em campo`
                      : p.escalacao === "banco"
                        ? "Não saiu do banco"
                        : p.escalacao === "nao relacionado"
                          ? "Não relacionado"
                          : p.escalacao === "lesionado"
                            ? "Lesionado"
                            : "Suspenso"}
                  </b>
                  <span>
                    {p.minutos
                      ? p.escalacao === "titular"
                        ? "Começou como titular"
                        : "Entrou durante o jogo"
                      : "Sem participação nesta rodada"}
                  </span>
                </div>
                <div className="nota-painel">
                  <small>NOTA</small>
                  <strong>{p.nota?.toFixed(1) ?? "—"}</strong>
                </div>
              </div>
              <dl className="numeros-pos-jogo">
                {[
                  [p.gols, "Gols"],
                  [p.assistencias, "Assistências"],
                  [p.chutes, "Chutes"],
                  [p.passes, "Passes"],
                  [p.passesChave, "Passes-chave"],
                  [p.desarmes, "Desarmes"],
                  [p.defesas, "Defesas"],
                  [p.faltas, "Faltas"],
                  [p.amarelos, "Amarelos"],
                  [p.vermelhos, "Vermelhos"],
                ].map(([valor, nome]) => (
                  <div key={nome}>
                    <dt>{nome}</dt>
                    <dd>{valor}</dd>
                  </div>
                ))}
              </dl>
              <div className="impactos-painel">
                <span>
                  Confiança <b>{variacao(p.confianca)}</b>
                </span>
                <span>
                  Moral <b>{variacao(p.moral)}</b>
                </span>
                <span>
                  Desenv. <b>+{p.desenvolvimento}</b>
                </span>
              </div>
            </>
          )}
          <button
            className="botao-texto detalhes-pos-jogo"
            onClick={abrirDetalhes}
          >
            Ver cronologia e detalhes
          </button>
        </>
      ) : (
        <div className="resumo-sem-partida">
          <h2>
            A SEMANA TERMINA.
            <br />O RESULTADO FICA AQUI.
          </h2>
          <p>
            Avance a semana para acompanhar o placar, sua atuação e o impacto no
            jogador, direto neste painel.
          </p>
        </div>
      )}
    </section>
  );
}
