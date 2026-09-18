"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import {
  criarMercado,
  PREFERENCIAS_CARREIRA,
  interesseComNovidadeNaoLida,
  type PreferenciasCarreira,
} from "@/dominio/mercado";
import { useJogoStore } from "@/estado/jogo-store";
import { Escudo } from "@/componentes/clube/Escudo";
import { PropostasInicio } from "./PropostasInicio";
import { dinheiro, formatarData } from "@/utilitarios/formatacao";
import { obterSituacaoJanela } from "@/simulacao/transferencias/necessidade";
import {
  estaSemClube,
  semanasSemClube,
} from "@/simulacao/carreira/agente-livre";

const SECOES = {
  geral: "VISÃO GERAL",
  propostas: "PROPOSTAS",
  agente: "MEU AGENTE",
  historico: "HISTÓRICO",
} as const;

const ROTULO_STATUS = {
  observando: "OBSERVANDO",
  interessado: "INTERESSE",
  sondagem: "SONDAGEM",
  negociando: "NEGOCIANDO",
  encerrado: "ENCERRADO",
} as const;

export function MercadoAgente({ carreira: c }: { carreira: EstadoCarreira }) {
  const [secao, setSecao] = useState<keyof typeof SECOES>("geral");
  const conversar = useJogoStore((s) => s.conversarAgente);
  const salvar = useJogoStore((s) => s.definirPreferencias);
  const marcarMercadoLido = useJogoStore((s) => s.marcarMercadoLido);
  const erro = useJogoStore((s) => s.erro);
  const m = c.mercado ?? criarMercado();
  useEffect(() => {
    const temNovidadeInteresse = m.interesses.some(interesseComNovidadeNaoLida);
    if (
      !m.respostaSaidaLida ||
      !m.respostaEmprestimoLida ||
      temNovidadeInteresse
    )
      marcarMercadoLido();
  }, [
    m.respostaSaidaLida,
    m.respostaEmprestimoLida,
    m.interesses,
    marcarMercadoLido,
  ]);
  const [aviso, setAviso] = useState("");
  const livre = estaSemClube(c);
  const clubeAtual = livre
    ? undefined
    : c.clubes.find((cl) => cl.id === c.clubeAtualId);
  const ultimoClube = c.clubes.find((cl) => cl.id === c.ultimoClubeId);
  const janela = obterSituacaoJanela(c.dataAtual);
  const acordoFuturo = c.propostas.find(
    (p) =>
      p.status === "aceita" &&
      (p.etapa === "acordo" || p.etapa === "acordo_futuro") &&
      p.efetivarEm,
  );
  const propostasPendentes = c.propostas.filter(
    (p) => p.status === "pendente" && p.validade >= c.dataAtual,
  );
  const interessesAtivos = m.interesses.filter((i) => i.status !== "encerrado");
  const observando = interessesAtivos.filter(
    (i) =>
      i.status === "observando" ||
      i.status === "interessado" ||
      i.status === "sondagem" ||
      i.status === "negociando",
  ).length;
  const nome = (id: string) =>
    c.clubes.find((cl) => cl.id === id)?.nome ?? "Clube";
  const notificar = (mensagem: string) =>
    setAviso(useJogoStore.getState().erro ? "" : mensagem);
  const textoPedidoSaida =
    m.statusPedidoSaida === "aceito"
      ? m.pedidoPublico
        ? "Aceito e público"
        : "Aceito (privado)"
      : m.statusPedidoSaida === "recusado"
        ? "Recusado pela diretoria"
        : "Nenhum";
  const textoEmprestimo = m.emprestimo
    ? `Ativo · retorno ${formatarData(m.emprestimo.retornoEm)}`
    : m.disponivelParaEmprestimo
      ? "Disponível para empréstimo"
      : m.pediuEmprestimo
        ? "Pedido recusado pela diretoria"
        : "Não solicitado";

  return (
    <>
      <p className="sobretitulo">TRANSFERÊNCIAS</p>
      <h1>Mercado</h1>
      <div className="mercado-vinculo">
        {clubeAtual ? (
          <Escudo clube={clubeAtual} tamanho={48} />
        ) : ultimoClube ? (
          <Escudo clube={ultimoClube} tamanho={48} />
        ) : null}
        <div>
          {livre ? (
            <>
              <strong>Sem contrato · Agente livre</strong>
              <p>
                Status: Sem contrato
                {ultimoClube ? ` · Último clube: ${ultimoClube.nome}` : ""}
                {semanasSemClube(c) > 0
                  ? ` · ${semanasSemClube(c)} semana(s) sem clube`
                  : ""}
              </p>
              <p className="texto-suave">
                Mercado: {observando} clube
                {observando === 1 ? "" : "s"} observando
              </p>
            </>
          ) : (
            <>
              <strong>{clubeAtual!.nome}</strong>
              <p>
                {dinheiro(c.jogador.contrato.salario)} / semana ·{" "}
                {c.jogador.contrato.papelEsperado.replace("rotacao", "rotação")} ·
                até {formatarData(c.jogador.contrato.dataTermino)}
              </p>
            </>
          )}
          {c.aposentado && (
            <p role="status">
              Carreira aposentada em {formatarData(c.dataAposentadoria!)}.
            </p>
          )}
          {m.emprestimo && (
            <p className="texto-suave">
              Empréstimo ativo · retorno em {formatarData(m.emprestimo.retornoEm)}
            </p>
          )}
        </div>
        <span className="rotulo">
          JANELA {janela.aberta ? "ABERTA" : "FECHADA"}
          {!janela.aberta
            ? ` · PRÓXIMA ${formatarData(janela.proximaAbertura)}`
            : ""}
        </span>
      </div>
      {!janela.aberta && propostasPendentes.length > 0 && (
        <p className="painel" role="status">
          Você pode negociar agora. A mudança só poderá acontecer em{" "}
          {formatarData(janela.proximaAbertura)}.
        </p>
      )}
      {acordoFuturo && (
        <p className="painel" role="status">
          Transferência acertada para {nome(acordoFuturo.clubeId)}.
          Apresentação prevista para {formatarData(acordoFuturo.efetivarEm!)}.
        </p>
      )}
      <div
        className="mercado-secoes"
        role="group"
        aria-label="Seções do mercado"
      >
        {Object.entries(SECOES).map(([id, label]) => (
          <button
            key={id}
            className="botao secundario"
            aria-pressed={secao === id}
            onClick={() => setSecao(id as keyof typeof SECOES)}
          >
            {label}
            {id === "propostas" && propostasPendentes.length > 0
              ? ` (${propostasPendentes.length})`
              : ""}
          </button>
        ))}
      </div>
      {erro && <p role="alert">{erro}</p>}
      {aviso && !erro && <p role="status">{aviso}</p>}
      {secao === "geral" && (
        <section className="painel espaco" aria-labelledby="geral-titulo">
          <h2 id="geral-titulo">SITUAÇÃO DO MERCADO</h2>
          <dl className="mercado-resumo">
            <div>
              <dt>Janela</dt>
              <dd>
                {janela.aberta
                  ? "Aberta"
                  : `Fechada · próxima ${formatarData(janela.proximaAbertura)}`}
              </dd>
            </div>
            <div>
              <dt>Pedido de saída</dt>
              <dd>{textoPedidoSaida}</dd>
            </div>
            <div>
              <dt>Empréstimo</dt>
              <dd>{textoEmprestimo}</dd>
            </div>
            <div>
              <dt>Propostas pendentes</dt>
              <dd>{propostasPendentes.length}</dd>
            </div>
            <div>
              <dt>Interesses ativos</dt>
              <dd>{interessesAtivos.length}</dd>
            </div>
            <div>
              <dt>Clubes contatados</dt>
              <dd>
                {m.interesses.filter((i) => i.origem === "agente").length}
              </dd>
            </div>
          </dl>
          {m.respostaDiretoriaSaida && (
            <p className="texto-suave">{m.respostaDiretoriaSaida}</p>
          )}
          {m.respostaDiretoriaEmprestimo && (
            <p className="texto-suave">{m.respostaDiretoriaEmprestimo}</p>
          )}
          <div className="acoes espaco">
            <button
              className="botao principal"
              onClick={() => setSecao("agente")}
            >
              Falar com o agente
            </button>
            {propostasPendentes.length > 0 && (
              <button
                className="botao secundario"
                onClick={() => setSecao("propostas")}
              >
                Ver propostas
              </button>
            )}
          </div>
          <h3>Interesses principais</h3>
          {!interessesAtivos.length && (
            <p>
              Nenhum clube no radar agora. Construa histórico em campo ou peça
              ao agente para buscar oportunidades.
            </p>
          )}
          {interessesAtivos.slice(0, 5).map((i) => (
            <article className="mercado-interesse" key={i.clubeId}>
              <div className="linha-titulo">
                <h3>{nome(i.clubeId)}</h3>
                <span className="rotulo">{ROTULO_STATUS[i.status]}</span>
              </div>
              <p>{i.resposta}</p>
              <p className="texto-suave">
                Observando há {i.semanasObservando} semana
                {i.semanasObservando === 1 ? "" : "s"} · Papel:{" "}
                {i.papel.replace("rotacao", "rotação")}
              </p>
            </article>
          ))}
        </section>
      )}
      {secao === "propostas" && (
        <div className="espaco">
          <PropostasInicio carreira={c} />
          {!propostasPendentes.length && (
            <p className="painel">
              Nenhuma oferta contratual aguardando resposta.
            </p>
          )}
          {c.propostas
            .filter(
              (p) =>
                p.status === "aceita" &&
                (p.etapa === "acordo" || p.etapa === "acordo_futuro"),
            )
            .map((p) => (
              <p className="painel" key={p.id}>
                {p.preContrato ? "Pré-contrato" : "Acordo"} com {nome(p.clubeId)}{" "}
                assinado. Chegada prevista: {formatarData(p.efetivarEm!)}.
              </p>
            ))}
        </div>
      )}
      {secao === "agente" && (
        <section className="painel espaco">
          <h2>SITUAÇÃO CONTRATUAL</h2>
          <dl className="ficha">
            <div>
              <dt>Status</dt>
              <dd>
                {livre
                  ? "Sem contrato · agente livre"
                  : `${c.jogador.contrato.tipo === "base" ? "Base" : "Profissional"} · ${c.jogador.status}`}
              </dd>
            </div>
            {!livre && (
              <>
                <div>
                  <dt>Salário semanal</dt>
                  <dd>{dinheiro(c.jogador.contrato.salario)}</dd>
                </div>
                <div>
                  <dt>Término</dt>
                  <dd>{formatarData(c.jogador.contrato.dataTermino)}</dd>
                </div>
              </>
            )}
          </dl>
          <Link className="botao secundario" href="/carreira/contrato">
            Ver contrato →
          </Link>
        </section>
      )}
      {secao === "agente" && (
        <section className="painel espaco" aria-labelledby="agente-titulo">
          <p className="sobretitulo">MEU AGENTE</p>
          <h2 id="agente-titulo">SITUAÇÃO ATUAL</h2>
          <dl className="mercado-resumo">
            <div>
              <dt>Seu agente</dt>
              <dd>
                {m.bloquearPropostas
                  ? "Filtrando propostas espontâneas"
                  : "Recebendo propostas"}
              </dd>
            </div>
            <div>
              <dt>Pedido de saída</dt>
              <dd>{textoPedidoSaida}</dd>
            </div>
            <div>
              <dt>Empréstimo</dt>
              <dd>{textoEmprestimo}</dd>
            </div>
            <div>
              <dt>Clubes contatados</dt>
              <dd>
                {m.interesses.filter((i) => i.origem === "agente").length}
              </dd>
            </div>
            <div>
              <dt>Próxima janela</dt>
              <dd>
                {janela.aberta
                  ? "Aberta agora"
                  : formatarData(janela.proximaAbertura)}
              </dd>
            </div>
          </dl>
          {m.respostaDiretoriaSaida && (
            <p className="texto-suave" role="status">
              {m.respostaDiretoriaSaida}
            </p>
          )}
          {m.respostaDiretoriaEmprestimo && (
            <p className="texto-suave" role="status">
              {m.respostaDiretoriaEmprestimo}
            </p>
          )}
          {!c.aposentado && (
            <>
              <h3>AÇÕES</h3>
              <form
                className="espaco"
                aria-label="Procurar clube específico"
                onSubmit={(e) => {
                  e.preventDefault();
                  const clubeId = String(
                    new FormData(e.currentTarget).get("clube"),
                  );
                  conversar("contatar", clubeId);
                  const falha = useJogoStore.getState().erro;
                  notificar(
                    falha
                      ? ""
                      : `Seu agente contatou ${nome(clubeId)}. Confira a resposta nos interesses.`,
                  );
                }}
              >
                <label>
                  Procurar um clube específico
                  <select name="clube" required defaultValue="">
                    <option value="" disabled>
                      Escolha o clube desejado
                    </option>
                    {c.clubes
                      .filter((cl) => cl.id !== c.clubeAtualId)
                      .map((cl) => (
                        <option key={cl.id} value={cl.id}>
                          {cl.nome} · {cl.pais}
                        </option>
                      ))}
                  </select>
                </label>
                <button className="botao principal espaco" type="submit">
                  Pedir contato ao agente
                </button>
              </form>
              <div className="acoes espaco">
                <button
                  className="botao secundario"
                  onClick={() => {
                    conversar("situacao");
                    const hist = useJogoStore.getState().carreira?.mercado
                      ?.historico.at(-1)?.texto;
                    notificar(hist ?? "Seu agente analisou a situação.");
                  }}
                >
                  Conversar sobre minha situação
                </button>
                <button
                  className="botao secundario"
                  onClick={() => {
                    conversar("buscar");
                    const hist = useJogoStore.getState().carreira?.mercado
                      ?.historico.at(-1)?.texto;
                    notificar(
                      hist ??
                        "Seu agente avaliou opções. Confira os contatos.",
                    );
                  }}
                >
                  Buscar oportunidades
                </button>
                <button
                  className="botao secundario"
                  onClick={() => {
                    const retirar =
                      m.statusPedidoSaida === "aceito" ||
                      m.statusPedidoSaida === "recusado";
                    conversar(retirar ? "permanecer" : "sair");
                    const hist = useJogoStore.getState().carreira?.mercado
                      ?.historico.at(-1)?.texto;
                    notificar(
                      hist ??
                        (retirar
                          ? "Pedido de saída retirado."
                          : "Seu agente levou o pedido privado à diretoria."),
                    );
                  }}
                >
                  {m.statusPedidoSaida === "aceito" ||
                  m.statusPedidoSaida === "recusado"
                    ? "Retirar pedido / permanecer"
                    : "Solicitar transferência"}
                </button>
                <button
                  className="botao secundario"
                  onClick={() => {
                    conversar(
                      m.pediuEmprestimo || m.disponivelParaEmprestimo
                        ? "cancelar-emprestimo"
                        : "emprestar",
                    );
                    const hist = useJogoStore.getState().carreira?.mercado
                      ?.historico.at(-1)?.texto;
                    notificar(
                      hist ??
                        (m.pediuEmprestimo || m.disponivelParaEmprestimo
                          ? "Pedido de empréstimo retirado."
                          : "Seu agente levou o pedido de empréstimo à diretoria."),
                    );
                  }}
                >
                  {m.pediuEmprestimo || m.disponivelParaEmprestimo
                    ? "Retirar pedido de empréstimo"
                    : "Solicitar empréstimo"}
                </button>
                <button
                  className="botao secundario"
                  onClick={() => {
                    conversar(
                      m.bloquearPropostas ? "desbloquear" : "bloquear",
                    );
                    notificar(
                      m.bloquearPropostas
                        ? "Voltando a receber propostas espontâneas."
                        : "Novas propostas espontâneas bloqueadas. Observação dos clubes continua.",
                    );
                  }}
                >
                  {m.bloquearPropostas
                    ? "Aceitar propostas espontâneas"
                    : "Bloquear novas propostas"}
                </button>
              </div>
              {m.statusPedidoSaida === "aceito" && !m.pedidoPublico && (
                <details className="espaco">
                  <summary>Tornar o pedido de saída público</summary>
                  <p>
                    Aumenta a visibilidade entre clubes compatíveis, mas
                    prejudica a relação com treinador e diretoria. Não garante
                    proposta.
                  </p>
                  <button
                    className="botao secundario"
                    onClick={() => {
                      conversar("publicar");
                      notificar("O pedido de saída foi tornado público.");
                    }}
                  >
                    Confirmar pedido público
                  </button>
                </details>
              )}
              <details className="espaco">
                <summary>
                  Definir preferências de carreira e clubes desejados
                </summary>
                <form
                  className="espaco"
                  aria-label="Preferências de carreira"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    const preferencias = Object.fromEntries(
                      Object.keys(PREFERENCIAS_CARREIRA).map((key) => [
                        key,
                        f.has(key),
                      ]),
                    ) as PreferenciasCarreira;
                    salvar(preferencias, f.getAll("desejados").map(String));
                    notificar(
                      "Preferências atualizadas. Elas guiam a busca do agente, não o interesse espontâneo dos clubes.",
                    );
                  }}
                >
                  <fieldset className="mercado-preferencias">
                    <legend>O que você busca?</legend>
                    {Object.entries(PREFERENCIAS_CARREIRA).map(([key, label]) => (
                      <label key={key}>
                        <input
                          type="checkbox"
                          name={key}
                          defaultChecked={
                            m.preferencias[key as keyof PreferenciasCarreira]
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </fieldset>
                  <fieldset className="mercado-preferencias mercado-clubes">
                    <legend>Clubes desejados</legend>
                    {c.clubes
                      .filter((cl) => cl.id !== c.clubeAtualId)
                      .map((cl) => (
                        <label key={cl.id}>
                          <input
                            type="checkbox"
                            name="desejados"
                            value={cl.id}
                            defaultChecked={m.clubesDesejados.includes(cl.id)}
                          />
                          {cl.nome}
                        </label>
                      ))}
                  </fieldset>
                  <button className="botao principal espaco" type="submit">
                    Salvar preferências
                  </button>
                </form>
              </details>
            </>
          )}
        </section>
      )}
      {secao === "historico" && (
        <section className="painel espaco" aria-labelledby="historico-mercado">
          <h2 id="historico-mercado">DIÁRIO DE NEGOCIAÇÕES</h2>
          {!m.historico.length && (
            <p>As conversas e ofertas da sua carreira aparecerão aqui.</p>
          )}
          <ol className="mercado-diario">
            {[...m.historico].reverse().map((h) => (
              <li key={h.id}>
                <time dateTime={h.data}>{formatarData(h.data)}</time>
                <h3>{nome(h.clubeId)}</h3>
                <p>{h.texto}</p>
                {h.termos && (
                  <p className="texto-suave">
                    {dinheiro(h.termos.salario)} / semana ·{" "}
                    {h.termos.duracaoAnos} anos ·{" "}
                    {h.termos.papelPrometido.replace("rotacao", "rotação")}
                    {h.termos.clausulaRescisao
                      ? ` · Cláusula: ${dinheiro(h.termos.clausulaRescisao)}`
                      : ""}
                  </p>
                )}
              </li>
            ))}
          </ol>
          <h3>TRANSFERÊNCIAS NO MUNDO</h3>
          {c.transferenciasRecentes.slice(0, 10).map((t, index) => (
            <p key={`${t.id}-${index}`}>
              {t.nomeJogador}: {nome(t.deClubeId)} → {nome(t.paraClubeId)}
            </p>
          ))}
        </section>
      )}
    </>
  );
}
