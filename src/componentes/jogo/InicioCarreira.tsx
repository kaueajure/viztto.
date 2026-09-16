import { PropostasInicio } from "./PropostasInicio";
import { DecisoesInicio } from "./DecisoesInicio";
import { PainelUltimaPartida } from "@/componentes/partida/PainelUltimaPartida";
import Link from "next/link";
import { formatarTemporada } from "@/dominio/constantes/temporadas-iniciais";
import { ArrowUpRight, MapPin, ArrowRight } from "lucide-react";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import { Escudo } from "@/componentes/clube/Escudo";
import { Barra, EstatisticasLinha } from "@/componentes/interface/Elementos";
import { TabelaLiga } from "@/componentes/partida/TabelaLiga";
import { somarEstatisticas } from "@/simulacao/temporada/estatisticas";
import { formatarData } from "@/utilitarios/formatacao";
import { FOCOS_TREINO } from "@/simulacao/treinamento/treinamento";
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
  const j = c.jogador,
    base = j.categoria === "base",
    clube = c.clubes.find((cl) => cl.id === c.clubeAtualId)!;
  const partidas = base ? c.temporada.partidasBase : c.temporada.partidas,
    proxima = partidas.find(
      (p) =>
        p.golsMandante === null &&
        [p.mandanteId, p.visitanteId].includes(clube.id),
    );
  const mandante = c.clubes.find((cl) => cl.id === proxima?.mandanteId),
    visitante = c.clubes.find((cl) => cl.id === proxima?.visitanteId);
  const tabela = base
      ? c.temporada.classificacaoBase
      : c.temporada.classificacao,
    indice = tabela.findIndex((l) => l.clubeId === clube.id),
    trecho = tabela.slice(
      Math.max(0, Math.min(indice - 2, tabela.length - 5)),
      Math.max(5, Math.min(indice + 3, tabela.length)),
    );
  const estatisticas = somarEstatisticas(
    c.registros
      .filter((r) => r.ano === c.temporada.ano)
      .map((r) => r.estatisticas),
  );
  return (
    <>
      <PropostasInicio carreira={c} />
      <DecisoesInicio carreira={c} />
      <div className="linha-titulo titulo-pagina">
        <div>
          <p className="sobretitulo">
            {base ? "DESENVOLVIMENTO / BASE" : "CENTRAL DA CARREIRA"}
          </p>
          <h1>O JOGO CONTINUA.</h1>
        </div>
        <span className="data-edicao">
          {formatarTemporada(c.liga.id, c.temporada.ano)}
          <small>TEMPORADA</small>
        </span>
      </div>
      <div className="grade-central grade-central-com-resumo">
        <section className="painel-proxima">
          <div className="linha-titulo">
            <span className="sobretitulo">
              {c.temporada.encerrada
                ? "TEMPORADA ENCERRADA"
                : "PRÓXIMO COMPROMISSO"}
            </span>
            <span className="rotulo">
              {c.temporada.encerrada
                ? "FIM DE TEMPORADA"
                : `RODADA ${proxima?.rodada ?? "—"}`}
            </span>
          </div>
          <div className="campo-miniatura" aria-hidden="true" />
          <p className="competicao-proxima">
            {c.liga.nome}
            {base ? " / Sub-20" : ""}
          </p>
          {mandante && visitante ? (
            <>
              <div className="confronto">
                <div>
                  <Escudo clube={mandante} tamanho={76} />
                  <h2 title={mandante.nome}>{mandante.nome}</h2>
                  {base && <span>SUB-20</span>}
                </div>
                <b>VS</b>
                <div>
                  <Escudo clube={visitante} tamanho={76} />
                  <h2 title={visitante.nome}>{visitante.nome}</h2>
                  {base && <span>SUB-20</span>}
                </div>
              </div>
              <p className="local-partida">
                <MapPin size={14} />
                {mandante.estadio}
                <span>·</span>
                {formatarData(proxima!.data)}
              </p>
            </>
          ) : (
            <div className="fim-temporada">
              <h2>
                ÚLTIMO APITO.
                <br />
                HISTÓRIA REGISTRADA.
              </h2>
              <p>
                Campeão:{" "}
                {c.clubes.find((cl) => cl.id === tabela[0]?.clubeId)?.nome}
              </p>
            </div>
          )}
          <div className="rodape-proxima">
            <div>
              <span className="rotulo">
                {c.aposentado
                  ? "CARREIRA ENCERRADA"
                  : j.lesao
                    ? "DEPARTAMENTO MÉDICO"
                    : "PREPARAÇÃO DA SEMANA"}
              </span>
              <p>
                {c.aposentado
                  ? `Aposentado em ${formatarData(c.dataAposentadoria!)}`
                  : j.lesao
                    ? `${j.lesao.tipo} · ${j.lesao.diasRecuperacao} dias`
                    : FOCOS_TREINO[c.focoTreino].nome}
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
        </section>
        <PainelUltimaPartida carreira={c} abrirDetalhes={abrirResumo} />
        <section className="painel-temporada">
          <div className="linha-titulo">
            <span className="sobretitulo">SUA TEMPORADA</span>
            <Link href="/carreira/historico" className="botao-texto">
              Ver histórico <ArrowUpRight size={14} />
            </Link>
          </div>
          <EstatisticasLinha estatisticas={estatisticas} />
          {c.ultimaPartidaId && (
            <button className="botao-texto ultimo-jogo" onClick={abrirResumo}>
              Ver resumo do último jogo <ArrowRight size={15} />
            </button>
          )}
        </section>
        <section className="painel-atleta">
          <div className="linha-titulo">
            <span className="rotulo">
              {base ? "PROMESSA DA BASE" : "SEU JOGADOR"}
            </span>
            <Link href="/carreira/jogador" aria-label="Ver jogador">
              <ArrowUpRight size={19} />
            </Link>
          </div>
          <div className="identidade-atleta">
            <div>
              <span className="posicao-atleta">
                {j.posicao} <span>/ {j.idade} ANOS</span>
              </span>
              <h2>
                {j.nome}
                <br />
                {j.sobrenome}
              </h2>
            </div>
            <div className="overall">
              <strong>{j.overall}</strong>
              <span>GERAL</span>
            </div>
          </div>
          <div className="status-atleta">
            <span className="ponto" />
            {j.status.replace("rotacao", "rotação")}
          </div>
          <Barra nome="Confiança do treinador" valor={j.confianca} />
          <Barra nome="Condicionamento" valor={j.condicionamento} />
          <div className="forma-moral">
            <span>
              Forma <b>{Math.round(j.forma)}</b>
            </span>
            <span>
              Moral <b>{Math.round(j.moral)}</b>
            </span>
          </div>
        </section>
        <section className="painel-classificacao">
          <div className="linha-titulo">
            <span className="sobretitulo">NA COMPETIÇÃO</span>
            <Link href="/carreira/competicao" className="botao-texto">
              Tabela completa <ArrowUpRight size={14} />
            </Link>
          </div>
          <TabelaLiga
            linhas={trecho}
            clubes={c.clubes}
            clubeAtualId={clube.id}
            compacta
          />
        </section>
        <section className="painel-noticias">
          <div className="linha-titulo">
            <span className="sobretitulo">DO VESTIÁRIO À IMPRENSA</span>
            <Link href="/carreira/noticias">
              <ArrowUpRight size={17} />
            </Link>
          </div>
          {c.noticias.slice(0, 3).map((n) => (
            <Link
              href="/carreira/noticias"
              key={n.id}
              className="noticia-curta"
            >
              <span className="rotulo">
                {n.remetente} <span> / {formatarData(n.data)}</span>
              </span>
              <h3>{n.titulo}</h3>
            </Link>
          ))}
        </section>
        <section className="painel-objetivos">
          <span className="sobretitulo">PRÓXIMOS PASSOS</span>
          {c.objetivos.slice(0, 3).map((o) => (
            <div className="objetivo-curto" key={o.id}>
              <span>{o.titulo}</span>
              <b className={o.concluido ? "texto-verde" : ""}>
                {o.progresso}/{o.meta}
              </b>
            </div>
          ))}
          <p className="texto-suave avaliacao">
            {base
              ? "“Busque regularidade. A comissão acompanha sua evolução antes de decidir pela promoção.”"
              : "“Seu lugar no time é conquistado a cada semana.”"}
          </p>
        </section>
      </div>
    </>
  );
}
