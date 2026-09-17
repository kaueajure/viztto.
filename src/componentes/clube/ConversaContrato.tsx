"use client";
import Link from "next/link";
import { useState } from "react";
import type { EstadoCarreira, StatusElenco } from "@/dominio/entidades/modelos";
import type { TipoPedidoContrato } from "@/simulacao/transferencias/contratos";
import { useJogoStore } from "@/estado/jogo-store";
import {
  estaSemClube,
  semanasSemClube,
} from "@/simulacao/carreira/agente-livre";
import { formatarData } from "@/utilitarios/formatacao";
import { criarMercado } from "@/dominio/mercado";

const PAPEIS_BASE: StatusElenco[] = [
  "categoria de base",
  "promessa",
  "reserva",
  "rotacao",
  "titular",
  "jogador importante",
  "estrela do time",
];
const PAPEIS_PRO: StatusElenco[] = PAPEIS_BASE.filter(
  (p) => p !== "categoria de base",
);

export function ConversaContrato({ carreira: c }: { carreira: EstadoCarreira }) {
  const [tipo, setTipo] = useState<TipoPedidoContrato>("renovacao");
  const [salario, setSalario] = useState(
    Math.round(c.jogador.contrato.salario * 1.15),
  );
  const [anos, setAnos] = useState(3);
  const papeis =
    c.jogador.categoria === "profissional" ? PAPEIS_PRO : PAPEIS_BASE;
  const [papel, setPapel] = useState<StatusElenco>(
    c.jogador.status === "categoria de base" &&
      c.jogador.categoria === "profissional"
      ? "promessa"
      : c.jogador.status,
  );
  const [clausula, setClausula] = useState(
    c.jogador.contrato.clausulaRescisao ??
      Math.round(c.jogador.valorMercado * 2),
  );
  const solicitar = useJogoStore((s) => s.solicitarContrato);
  const a = c.acompanhamento;
  const ultima = a.pedidosContrato.at(-1);
  const bloqueado =
    !!a.proximoPedidoContrato && a.proximoPedidoContrato > c.dataAtual;
  const mostraSalario = tipo === "renovacao" || tipo === "aumento";
  const mostraDuracao = tipo === "renovacao" || tipo === "extensao";
  const mostraPapel = tipo === "renovacao" || tipo === "papel";

  if (estaSemClube(c)) {
    const ultimo = c.clubes.find((cl) => cl.id === c.ultimoClubeId);
    const observando = (c.mercado ?? criarMercado()).interesses.filter(
      (i) => i.status !== "encerrado",
    ).length;
    return (
      <section className="painel espaco">
        <h2>CONTRATO · STATUS</h2>
        <dl className="ficha">
          <div>
            <dt>Status</dt>
            <dd>Sem contrato</dd>
          </div>
          <div>
            <dt>Último clube</dt>
            <dd>{ultimo?.nome ?? "—"}</dd>
          </div>
          <div>
            <dt>Tempo sem clube</dt>
            <dd>
              {semanasSemClube(c) > 0
                ? `${semanasSemClube(c)} semana(s)`
                : "Recém-liberado"}
            </dd>
          </div>
          <div>
            <dt>Mercado</dt>
            <dd>
              {observando} clube{observando === 1 ? "" : "s"} observando
            </dd>
          </div>
        </dl>
        <p className="texto-suave">
          Sem vínculo ativo não há renovação com a diretoria. Negocie uma nova
          oferta pelo agente no mercado.
        </p>
        <Link className="botao principal" href="/carreira/mercado">
          Ir ao mercado
        </Link>
      </section>
    );
  }

  return (
    <section className="painel espaco">
      <h2>CONTRATO · CONVERSE COM SEU AGENTE</h2>
      <p className="texto-suave">
        Seu agente leva os termos à diretoria e apresenta a resposta aqui. A
        assinatura acontece nas propostas do mercado. Cada tipo de pedido altera
        apenas os termos relacionados.
      </p>
      <div className="campos">
        <label>
          Solicitação
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoPedidoContrato)}
          >
            <option value="renovacao">Renovação</option>
            <option value="aumento">Aumento salarial</option>
            <option value="extensao">Extensão do vínculo</option>
            <option value="papel">Revisão do papel</option>
            {c.jogador.contrato.clausulaRescisao && (
              <option value="clausula">Revisão de cláusula</option>
            )}
          </select>
        </label>
        {mostraSalario && (
          <label>
            Salário semanal (€)
            <input
              type="number"
              min="1"
              value={salario}
              onChange={(e) => setSalario(Number(e.target.value))}
            />
          </label>
        )}
        {mostraDuracao && (
          <label>
            Duração (anos a partir da assinatura)
            <input
              type="number"
              min="1"
              max="5"
              value={anos}
              onChange={(e) => setAnos(Number(e.target.value))}
            />
          </label>
        )}
        {mostraPapel && (
          <label>
            Papel solicitado
            <select
              value={papel}
              onChange={(e) => setPapel(e.target.value as StatusElenco)}
            >
              {papeis.map((p) => (
                <option key={p} value={p}>
                  {p.replace("rotacao", "rotação")}
                </option>
              ))}
            </select>
          </label>
        )}
        {tipo === "clausula" && (
          <label>
            Cláusula (€)
            <input
              type="number"
              min="1"
              value={clausula}
              onChange={(e) => setClausula(Number(e.target.value))}
            />
          </label>
        )}
      </div>
      <button
        className="botao principal espaco"
        disabled={bloqueado || !!c.aposentado}
        onClick={() =>
          solicitar({
            tipo,
            salario:
              tipo === "aumento" || tipo === "renovacao"
                ? salario
                : c.jogador.contrato.salario,
            duracaoAnos:
              tipo === "extensao" || tipo === "renovacao" ? anos : 1,
            papel:
              tipo === "papel" || tipo === "renovacao"
                ? papel
                : c.jogador.contrato.papelEsperado,
            ...(tipo === "clausula" ? { clausula } : {}),
          })
        }
      >
        Enviar pedido pelo agente
      </button>
      {bloqueado && (
        <p>Nova conversa em {formatarData(a.proximoPedidoContrato!)}.</p>
      )}
      {ultima && (
        <div role="status">
          <p className="citacao">{ultima.resposta}</p>
          {ultima.propostaId && (
            <Link className="botao secundario" href="/carreira/mercado">
              Ver proposta para assinatura
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
