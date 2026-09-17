import { CentralSemana } from "./CentralSemana";
import { PropostasInicio } from "./PropostasInicio";
import { DecisoesInicio } from "./DecisoesInicio";
import { AtencaoCarreira } from "./AtencaoCarreira";
import { PainelUltimaPartida } from "@/componentes/partida/PainelUltimaPartida";
import Link from "next/link";
import { formatarTemporada } from "@/dominio/constantes/temporadas-iniciais";
import { ArrowUpRight, MapPin, ArrowRight } from "lucide-react";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import { Escudo } from "@/componentes/clube/Escudo";
import { Barra, EstatisticasLinha } from "@/componentes/interface/Elementos";
import { TabelaLiga } from "@/componentes/partida/TabelaLiga";
import { somarEstatisticas } from "@/simulacao/temporada/estatisticas";
import {
  estaSemClube,
  semanasSemClube,
} from "@/simulacao/carreira/agente-livre";
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
    livre = estaSemClube(c),
    clube = livre
      ? undefined
      : c.clubes.find((cl) => cl.id === c.clubeAtualId);
  const ultimoClube = c.clubes.find((cl) => cl.id === c.ultimoClubeId);
  const partidas = base ? c.temporada.partidasBase : c.temporada.partidas,
    proxima =
      !livre && clube
        ? partidas.find(
            (p) =>
              p.golsMandante === null &&
              [p.mandanteId, p.visitanteId].includes(clube.id),
          )
        : undefined;
  const mandante = c.clubes.find((cl) => cl.id === proxima?.mandanteId),
    visitante = c.clubes.find((cl) => cl.id === proxima?.visitanteId);
  const tabela = base
      ? c.temporada.classificacaoBase
      : c.temporada.classificacao,
    indice = clube
      ? tabela.findIndex((l) => l.clubeId === clube.id)
      : 0,
    trecho = tabela.slice(
      Math.max(0, Math.min(indice - 2, tabela.length - 5)),
      Math.max(5, Math.min(indice + 3, tabela.length)),
    );
  const estatisticas = somarEstatisticas(
    c.registros
      .filter((r) => r.ano === c.temporada.ano)
      .map((r) => r.estatisticas),
  );
  const semanasLivre = semanasSemClube(c);
  return (
    <>
      <AtencaoCarreira carreira={c} />
      <PropostasInicio carreira={c} />
      <DecisoesInicio carreira={c} />
      <CentralSemana carreira={c} />
      {livre && (
        <section className="painel atencao-carreira" role="status">
          <p className="sobretitulo">SEM CLUBE / AGENTE LIVRE</p>
          <h2>VOCÊ ESTÁ NO MERCADO.</h2>
          <p>
            {ultimoClube
              ? `Seu contrato com o ${ultimoClube.nome} terminou.`
              : "Seu contrato terminou e você ficou sem clube."}
          </p>
          <p className="texto-suave">
            Seu agente está buscando uma nova equipe
            {semanasLivre > 0 ? ` · ${semanasLivre} semana(s) sem clube` : ""}.
          </p>
          <Link className="botao secundario" href="/carreira/mercado">
            Ir ao agente
          </Link>
        </section>
      )}
      <div className="linha-titulo titulo-pagina">
        <div>
          <p className="sobretitulo">
            {livre
              ? "AGENTE LIVRE"
              : base
                ? "DESENVOLVIMENTO / BASE"
                : "CENTRAL DA CARREIRA"}
          </p>
          <h1>{livre ? "SEM CLUBE." : "O JOGO CONTINUA."}</h1>
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
              {livre
                ? "SEM PARTIDA DE CLUBE"
                : c.temporada.encerrada
                  ? "TEMPORADA ENCERRADA"
                  : "PRÓXIMO COMPROMISSO"}
            </span>
            <span className="rotulo">
              {livre
                ? "AGENTE LIVRE"
                : c.temporada.encerrada
                  ? "FIM DE TEMPORADA"
                  : `RODADA ${proxima?.rodada ?? "—"}`}
            </span>
          </div>
          <div className="campo-miniatura" aria-hidden="true" />
          <p className="competicao-proxima">
            {c.liga.nome}
            {base ? " / Sub-20" : ""}
          </p>
          {livre ? (
            <div className="fim-temporada">
              <h2>
                SEM CLUBE.
                <br />
                MERCADO ABERTO.
              </h2>
              <p>
                Você não disputa partidas até assinar com um novo clube. Treine
                individualmente e peça ao agente para buscar oportunidades.
              </p>
            </div>
          ) : mandante && visitante ? (
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
                    : livre
                      ? "TREINO INDIVIDUAL"
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
              {livre
                ? "AGENTE LIVRE"
                : base
                  ? "PROMESSA DA BASE"
                  : "SEU JOGADOR"}
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
            {livre ? "sem clube" : j.status.replace("rotacao", "rotação")}
          </div>
          {!livre && <Barra nome="Confiança do treinador" valor={j.confianca} />}
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
            clubeAtualId={c.clubeAtualId}
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
            {livre
              ? "“Você está no mercado. Cada semana sem clube conta — mantenha o ritmo e pressione o agente.”"
              : base
                ? "“Busque regularidade. A comissão acompanha sua evolução antes de decidir pela promoção.”"
                : "“Seu lugar no time é conquistado a cada semana.”"}
          </p>
        </section>
      </div>
    </>
  );
}
