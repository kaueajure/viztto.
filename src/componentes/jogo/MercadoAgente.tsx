"use client";
import { useState } from "react";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import {
  criarMercado,
  PREFERENCIAS_CARREIRA,
  type PreferenciasCarreira,
} from "@/dominio/mercado";
import { useJogoStore } from "@/estado/jogo-store";
import { Escudo } from "@/componentes/clube/Escudo";
import { PropostasInicio } from "./PropostasInicio";
import { dinheiro, formatarData } from "@/utilitarios/formatacao";
import { obterSituacaoJanela } from "@/simulacao/transferencias/necessidade";
const SECOES = {
  interesses: "INTERESSES",
  propostas: "PROPOSTAS",
  agente: "MEU AGENTE",
  historico: "HISTÓRICO",
};
export function MercadoAgente({ carreira: c }: { carreira: EstadoCarreira }) {
  const [secao, setSecao] = useState<keyof typeof SECOES>("interesses");
  const conversar = useJogoStore((s) => s.conversarAgente);
  const aposentar = useJogoStore((s) => s.aposentar);
  const salvar = useJogoStore((s) => s.definirPreferencias);
  const erro = useJogoStore((s) => s.erro);
  const m = c.mercado ?? criarMercado();
  const [aviso, setAviso] = useState("");
  const [confirmarAposentadoria, setConfirmarAposentadoria] = useState(false);
  const clubeAtual = c.clubes.find((cl) => cl.id === c.clubeAtualId)!;
  const janela = obterSituacaoJanela(c.dataAtual);
  const acordoFuturo = c.propostas.find(
    (p) =>
      p.status === "aceita" &&
      (p.etapa === "acordo" || p.etapa === "acordo_futuro") &&
      p.efetivarEm,
  );
  const nome = (id: string) =>
    c.clubes.find((cl) => cl.id === id)?.nome ?? "Clube";
  const notificar = (mensagem: string) =>
    setAviso(useJogoStore.getState().erro ? "" : mensagem);
  return (
    <>
      <p className="sobretitulo">CARREIRA / MERCADO</p>
      <h1>SEU PRÓXIMO CAPÍTULO.</h1>
      <div className="mercado-vinculo">
        <Escudo clube={clubeAtual} tamanho={48} />
        <div>
          <strong>{clubeAtual.nome}</strong>
          <p>
            {dinheiro(c.jogador.contrato.salario)} / semana ·{" "}
            {c.jogador.contrato.papelEsperado.replace("rotacao", "rotação")} ·
            até {formatarData(c.jogador.contrato.dataTermino)}
          </p>
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
          </button>
        ))}
      </div>
      {erro && <p role="alert">{erro}</p>}
      {aviso && !erro && <p role="status">{aviso}</p>}
      {secao === "interesses" && (
        <section className="painel espaco" aria-labelledby="interesses-titulo">
          <h2 id="interesses-titulo">NO RADAR DOS CLUBES</h2>
          <p className="texto-suave">
            Observação → interesse → sondagem → negociação. Cada clube considera
            seu elenco e sua trajetória.
          </p>
          {!m.interesses.length && (
            <p>
              Nenhum clube iniciou observação. Construa seu histórico em campo
              ou converse com o agente.
            </p>
          )}
          {m.interesses.map((i) => (
            <article className="mercado-interesse" key={i.clubeId}>
              <div className="linha-titulo">
                <h3>{nome(i.clubeId)}</h3>
                <span className="rotulo">{i.status.toUpperCase()}</span>
              </div>
              <p>{i.resposta}</p>
              <p className="texto-suave">
                {i.semanasObservando} semanas de observação · Papel:{" "}
                {i.papel.replace("rotacao", "rotação")} · Motivo:{" "}
                {
                  {
                    reforco: "reforço",
                    promessa: "promessa",
                    sucessao: "sucessão",
                    lesao: "desfalque por lesão",
                    oportunidade: "situação contratual",
                  }[i.motivo]
                }
              </p>
              <label className="mercado-progresso">
                Interesse acumulado: {Math.round(i.nivelInteresse)} / 100{" "}
                <progress max={100} value={i.nivelInteresse} />
              </label>
            </article>
          ))}
        </section>
      )}
      {secao === "propostas" && (
        <div className="espaco">
          <PropostasInicio carreira={c} />
          {!c.propostas.some(
            (p) => p.status === "pendente" && p.validade >= c.dataAtual,
          ) && (
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
        <section className="painel espaco" aria-labelledby="agente-titulo">
          <p className="sobretitulo">MEU AGENTE</p>
          <h2 id="agente-titulo">CONVERSAR COM O SEU AGENTE</h2>
          <p>
            Situação: {m.pediuSaida ? "pedido de saída ativo" : "sem pedido de saída"}
            {" · "}
            {m.disponivelParaEmprestimo
              ? "disponível para empréstimo"
              : m.pediuEmprestimo
                ? "pedido de empréstimo em análise/recusado"
                : "sem pedido de empréstimo"}
            {" · "}
            {m.bloquearPropostas
              ? "propostas espontâneas bloqueadas"
              : "recebendo propostas"}
          </p>
          {m.respostaDiretoriaSaida && (
            <p className="texto-suave">{m.respostaDiretoriaSaida}</p>
          )}
          {m.respostaDiretoriaEmprestimo && (
            <p className="texto-suave">{m.respostaDiretoriaEmprestimo}</p>
          )}
          {!c.aposentado && (
            <>
              <form
                className="espaco"
                aria-label="Procurar clube específico"
                onSubmit={(e) => {
                  e.preventDefault();
                  conversar(
                    "contatar",
                    String(new FormData(e.currentTarget).get("clube")),
                  );
                  notificar(
                    "Contato registrado. Confira a resposta em Interesses.",
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
                    notificar("Seu agente recebeu as novas preferências.");
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
              <div className="acoes espaco">
                <button
                  className="botao secundario"
                  onClick={() => {
                    conversar("buscar");
                    notificar(
                      "Seu agente avaliou opções. Confira os contatos em Interesses.",
                    );
                  }}
                >
                  Buscar oportunidades
                </button>
                <button
                  className="botao secundario"
                  onClick={() => {
                    conversar(m.pediuSaida ? "permanecer" : "sair");
                    notificar(
                      m.pediuSaida
                        ? "Pedido de saída retirado."
                        : "Seu agente levou o pedido privado à diretoria.",
                    );
                  }}
                >
                  {m.pediuSaida
                    ? "Quero permanecer"
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
                    notificar(
                      m.pediuEmprestimo || m.disponivelParaEmprestimo
                        ? "Pedido de empréstimo retirado."
                        : "Seu agente levou o pedido de empréstimo à diretoria.",
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
                        : "Novas propostas espontâneas bloqueadas.",
                    );
                  }}
                >
                  {m.bloquearPropostas
                    ? "Aceitar propostas"
                    : "Bloquear novas propostas"}
                </button>
              </div>
              {m.pediuSaida && !m.pedidoPublico && (
                <details className="espaco">
                  <summary>Tornar o pedido de saída público</summary>
                  <p>
                    Isso pode prejudicar sua relação com o treinador e a
                    diretoria e aumentar a visibilidade no mercado.
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
                <summary>Solicitar aposentadoria</summary>
                {!confirmarAposentadoria ? (
                  <>
                    <p>
                      {c.jogador.idade < 30
                        ? "Você ainda tem muitos anos de carreira pela frente. Tem certeza?"
                        : "A aposentadoria encerra sua carreira profissional."}
                    </p>
                    <button
                      className="botao secundario"
                      onClick={() => setConfirmarAposentadoria(true)}
                    >
                      Quero me aposentar
                    </button>
                  </>
                ) : (
                  <>
                    <p role="alert">
                      TEM CERTEZA? A aposentadoria encerra sua carreira
                      profissional. Você poderá continuar vendo o histórico
                      desta carreira, mas não poderá voltar a jogar depois da
                      confirmação.
                    </p>
                    <div className="acoes">
                      <button
                        className="botao principal"
                        onClick={() => {
                          aposentar();
                          setConfirmarAposentadoria(false);
                          notificar("Carreira encerrada. O histórico foi preservado.");
                        }}
                      >
                        Confirmar aposentadoria
                      </button>
                      <button
                        className="botao secundario"
                        onClick={() => setConfirmarAposentadoria(false)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </>
                )}
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
