"use client";
import Link from "next/link";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import { NOMES_ATRIBUTOS } from "@/dominio/entidades/modelos";
import { OBJETIVOS_PESSOAIS, atributosTecnicaPosicao, objetivoBloqueadoPorCooldown } from "@/simulacao/carreira/acompanhamento";
import type { ObjetivoPessoalTipo } from "@/dominio/desenvolvimento";
import { categoriaPartidaDaSemana } from "@/simulacao/base/formacao";
import { estaSemClube } from "@/simulacao/carreira/agente-livre";
import { avaliarHierarquia } from "@/simulacao/elenco/hierarquia";
import { obterSituacaoJanela } from "@/simulacao/transferencias/necessidade";
import { useJogoStore } from "@/estado/jogo-store";
import { Escudo } from "@/componentes/clube/Escudo";
import { formatarData } from "@/utilitarios/formatacao";
import { criarMercado } from "@/dominio/mercado";

type Prioridade = "urgente" | "importante" | "informativo";

function cardsSemana(c: EstadoCarreira) {
  const m = c.mercado ?? criarMercado();
  const resumo = c.acompanhamento.resumoSemanal;
  const cards: {
    id: string;
    prioridade: Prioridade;
    titulo: string;
    texto: string;
    href?: string;
    cta?: string;
  }[] = [];

  if (c.propostas.some((p) => p.status === "pendente" && p.validade >= c.dataAtual))
    cards.push({
      id: "proposta",
      prioridade: "urgente",
      titulo: "PROPOSTA",
      texto: "Há oferta contratual aguardando sua decisão.",
      href: "/carreira/mercado",
      cta: "Ver",
    });
  if ((c.decisoes ?? []).some((d) => !d.resolvida))
    cards.push({
      id: "decisao",
      prioridade: "urgente",
      titulo: "DECISÃO",
      texto: "Uma decisão da carreira precisa da sua resposta.",
      href: "/carreira",
      cta: "Responder",
    });
  const pedido = c.acompanhamento.pedidosContrato.at(-1);
  if (pedido && pedido.data === (resumo?.data ?? c.dataAtual))
    cards.push({
      id: "contrato",
      prioridade: "urgente",
      titulo: "CONTRATO",
      texto: pedido.resposta,
      href: "/carreira/clube",
      cta: "Ver resposta",
    });
  if (c.acompanhamento.promessa?.status === "descumprida")
    cards.push({
      id: "promessa",
      prioridade: "urgente",
      titulo: "PROMESSA",
      texto: "O treinador não cumpriu o combinado. Você pode cobrá-lo.",
      href: "/carreira/clube",
      cta: "Conversar",
    });
  if (c.jogador.lesao)
    cards.push({
      id: "lesao",
      prioridade: "urgente",
      titulo: "LESÃO",
      texto: `${c.jogador.lesao.tipo} · ${c.jogador.lesao.diasRecuperacao} dias.`,
    });

  if (resumo?.evolucoes.length)
    cards.push({
      id: "evolucao",
      prioridade: "importante",
      titulo: "EVOLUÇÃO",
      texto: resumo.evolucoes
        .slice(0, 3)
        .map((e) => `${NOMES_ATRIBUTOS[e.atributo]} ${e.antes}→${e.depois}`)
        .join(" · "),
    });
  if (resumo?.mudancaElenco) {
    cards.push({
      id: "elenco",
      prioridade: "importante",
      titulo: "ELENCO",
      texto: resumo.mudancaElenco.texto,
      href: "/carreira/clube",
      cta: "Ver hierarquia",
    });
  }
  const conversa = c.acompanhamento.conversas.at(-1);
  if (conversa && conversa.data === (resumo?.data ?? c.dataAtual))
    cards.push({
      id: "tecnico",
      prioridade: "importante",
      titulo: "TÉCNICO",
      texto: conversa.resposta,
      href: "/carreira/clube",
      cta: "Continuar",
    });
  const interesse = m.interesses.find(
    (i) => i.status !== "encerrado" && i.ultimaAtualizacao === (resumo?.data ?? c.dataAtual),
  );
  if (interesse)
    cards.push({
      id: "mercado",
      prioridade: "importante",
      titulo: "MERCADO",
      texto: `${c.clubes.find((cl) => cl.id === interesse.clubeId)?.nome ?? "Um clube"} ${interesse.status === "observando" ? "começou a observar você" : `está em ${interesse.status}`}.`,
      href: "/carreira/mercado",
      cta: "Ver mercado",
    });

  if (resumo?.treino)
    cards.push({
      id: "treino",
      prioridade: "informativo",
      titulo: "TREINAMENTO",
      texto: resumo.treino,
      href: "/carreira/treinamento",
      cta: "Ajustar plano",
    });

  const ordem: Prioridade[] = ["urgente", "importante", "informativo"];
  return cards
    .sort((a, b) => ordem.indexOf(a.prioridade) - ordem.indexOf(b.prioridade))
    .slice(0, 6);
}

export function CentralSemana({ carreira: c }: { carreira: EstadoCarreira }) {
  const resumo = c.acompanhamento.resumoSemanal;
  const h = avaliarHierarquia(c);
  const o = c.acompanhamento.objetivoPessoal;
  const escolher = useJogoStore((s) => s.escolherObjetivo);
  const livre = estaSemClube(c);
  const clube = livre
    ? undefined
    : c.clubes.find((cl) => cl.id === c.clubeAtualId);
  const partidas =
    categoriaPartidaDaSemana(c) === "base"
      ? c.temporada.partidasBase
      : c.temporada.partidas;
  const proxima =
    clube &&
    partidas.find(
      (p) =>
        p.golsMandante === null &&
        [p.mandanteId, p.visitanteId].includes(clube.id),
    );
  const mandante = c.clubes.find((cl) => cl.id === proxima?.mandanteId);
  const visitante = c.clubes.find((cl) => cl.id === proxima?.visitanteId);
  const janela = obterSituacaoJanela(c.dataAtual);
  const cards = cardsSemana(c);
  const semana = resumo
    ? Math.max(1, Math.round((Date.parse(resumo.data) - Date.parse(c.dataInicio)) / 604800000))
    : null;

  return (
    <section className="painel espaco central-semana" aria-labelledby="central-semana-titulo">
      <div className="linha-titulo">
        <div>
          <p className="sobretitulo">CENTRAL DA SEMANA</p>
          <h2 id="central-semana-titulo">
            {semana ? `SEMANA ${semana}` : "SEU PRÓXIMO PASSO"}
          </h2>
        </div>
        <span className="rotulo">
          {livre ? "SEM CLUBE" : `JANELA ${janela.aberta ? "ABERTA" : "FECHADA"}`}
        </span>
      </div>

      {livre && (
        <div className="mercado-vinculo">
          <div>
            <span className="rotulo">AGENTE LIVRE</span>
            <p>Sem partida de clube nesta semana.</p>
            <p className="texto-suave">{h.proximoPasso}</p>
          </div>
        </div>
      )}

      {!livre && proxima && mandante && visitante && (
        <div className="mercado-vinculo">
          <Escudo clube={mandante} tamanho={36} />
          <div>
            <span className="rotulo">PRÓXIMO JOGO</span>
            <p>
              {mandante.nome} × {visitante.nome}
              {proxima.data ? ` · ${formatarData(proxima.data)}` : ""}
            </p>
            <p className="texto-suave">
              CHANCE DE PARTICIPAÇÃO · {h.chance.toUpperCase()}. {h.proximoPasso}
            </p>
          </div>
          <Escudo clube={visitante} tamanho={36} />
        </div>
      )}

      {resumo && (
        <p className="citacao" role="status">
          {resumo.feedback}
        </p>
      )}
      {resumo && resumo.overallDepois > resumo.overallAntes && (
        <h3>
          SEU NÍVEL GERAL SUBIU · {resumo.overallAntes} → {resumo.overallDepois}
        </h3>
      )}

      <div className="grade-dupla cards-semana">
        {cards.map((card) => (
          <article key={card.id} className={`card-semana ${card.prioridade}`}>
            <span className="rotulo">{card.prioridade.toUpperCase()} · {card.titulo}</span>
            <p>{card.texto}</p>
            {card.href && card.cta && (
              <Link className="botao-texto" href={card.href}>
                {card.cta} →
              </Link>
            )}
          </article>
        ))}
      </div>

      <div className="espaco">
        <label>
          OBJETIVO PESSOAL
          <select
            value={o && !o.concluido ? o.tipo : ""}
            onChange={(e) => {
              if (e.target.value)
                escolher(e.target.value as ObjetivoPessoalTipo);
            }}
          >
            <option value="">Escolha seu foco</option>
            {Object.entries(OBJETIVOS_PESSOAIS).map(([id, nome]) => {
              const tipo = id as ObjetivoPessoalTipo;
              const bloqueado = objetivoBloqueadoPorCooldown(c, tipo).bloqueado;
              return (
                <option key={id} value={id} disabled={bloqueado}>
                  {nome}{bloqueado ? " (já alcançado)" : ""}
                </option>
              );
            })}
          </select>
        </label>
        {o && (
          <p role="status">
            {OBJETIVOS_PESSOAIS[o.tipo]} ·{" "}
            {o.concluido
              ? "Alcançado"
              : `${Math.round(o.progresso)}% do caminho`}
            .{" "}
            {o.tipo === "minutos"
              ? "Meta: conquistar mais 270 minutos."
              : o.tipo === "tecnica"
                ? `Meta: somar três pontos em ${atributosTecnicaPosicao(c.jogador.posicao).map((a) => NOMES_ATRIBUTOS[a].toLowerCase()).join(", ")}.`
                : "Acompanhe as decisões e oportunidades da carreira."}
          </p>
        )}
        {c.objetivos.length > 0 && (
          <div className="espaco">
            <span className="rotulo">OBJETIVOS DA COMISSÃO</span>
            <ul className="lista-atencao">
              {c.objetivos.slice(0, 3).map((obj) => (
                <li key={obj.id}>
                  <div>
                    <strong>{obj.titulo}</strong>
                    <p className="texto-suave">
                      {obj.concluido
                        ? "Cumprido"
                        : `${Math.min(obj.progresso, obj.meta)} / ${obj.meta}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
