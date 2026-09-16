import Link from "next/link";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import { criarMercado } from "@/dominio/mercado";
import { obterSituacaoJanela } from "@/simulacao/transferencias/necessidade";
import { formatarData } from "@/utilitarios/formatacao";

export type AcaoAtencao = {
  id: string;
  prioridade: number;
  titulo: string;
  detalhe?: string;
  href?: string;
  cta?: string;
};

export function coletarAcoesAtencao(c: EstadoCarreira): AcaoAtencao[] {
  const m = c.mercado ?? criarMercado();
  const itens: AcaoAtencao[] = [];
  const nome = (id: string) =>
    c.clubes.find((cl) => cl.id === id)?.nome ?? "Clube";
  const janela = obterSituacaoJanela(c.dataAtual);

  for (const p of c.propostas.filter(
    (x) => x.status === "pendente" && x.validade >= c.dataAtual,
  )) {
    itens.push({
      id: `prop-${p.id}`,
      prioridade: 100,
      titulo: `Você tem uma proposta do ${nome(p.clubeId)}`,
      detalhe:
        p.tipo === "emprestimo"
          ? "Empréstimo aguardando resposta."
          : p.preContrato
            ? "Pré-contrato aguardando resposta."
            : "Oferta contratual aguardando sua decisão.",
      href: "/carreira/mercado",
      cta: "Ver proposta",
    });
  }

  for (const d of c.decisoes ?? []) {
    if (d.resolvida) continue;
    itens.push({
      id: `dec-${d.id}`,
      prioridade: 95,
      titulo: "Você tem uma decisão pendente",
      detalhe: d.titulo,
      href: "/carreira",
      cta: "Responder",
    });
  }

  const acordo = c.propostas.find(
    (p) =>
      p.status === "aceita" &&
      (p.etapa === "acordo" || p.etapa === "acordo_futuro") &&
      p.efetivarEm,
  );
  if (acordo) {
    itens.push({
      id: `acordo-${acordo.id}`,
      prioridade: 90,
      titulo: `Transferência para ${nome(acordo.clubeId)} acertada`,
      detalhe: `Apresentação: ${formatarData(acordo.efetivarEm!)}`,
      href: "/carreira/mercado",
    });
  }

  if (m.respostaDiretoriaSaida && m.statusPedidoSaida !== "nenhum") {
    itens.push({
      id: "dir-saida",
      prioridade: 80,
      titulo:
        m.statusPedidoSaida === "recusado"
          ? "Diretoria respondeu ao pedido de transferência"
          : "Pedido de transferência em andamento",
      detalhe: m.respostaDiretoriaSaida,
      href: "/carreira/mercado",
      cta: "Ver agente",
    });
  }

  if (m.respostaDiretoriaEmprestimo && m.pediuEmprestimo) {
    itens.push({
      id: "dir-emp",
      prioridade: 78,
      titulo: "Diretoria respondeu ao seu pedido de empréstimo",
      detalhe: m.respostaDiretoriaEmprestimo,
      href: "/carreira/mercado",
      cta: "Ver agente",
    });
  }

  const interesseNovo = m.interesses.find(
    (i) =>
      i.status !== "encerrado" &&
      i.origem === "agente" &&
      i.semanasObservando <= 1,
  );
  if (interesseNovo) {
    itens.push({
      id: `int-${interesseNovo.clubeId}`,
      prioridade: 70,
      titulo: `Seu agente recebeu interesse do ${nome(interesseNovo.clubeId)}`,
      detalhe: interesseNovo.resposta,
      href: "/carreira/mercado",
      cta: "Ver mercado",
    });
  }

  if (c.jogador.lesao && c.jogador.lesao.diasRecuperacao > 0) {
    itens.push({
      id: "lesao",
      prioridade: 65,
      titulo: `Você está lesionado por mais ${c.jogador.lesao.diasRecuperacao} dias`,
      detalhe: c.jogador.lesao.tipo,
    });
  }

  const diasContrato = Math.ceil(
    (Date.parse(c.jogador.contrato.dataTermino) - Date.parse(c.dataAtual)) /
      86400000,
  );
  if (diasContrato > 0 && diasContrato <= 365) {
    const meses = Math.ceil(diasContrato / 30);
    itens.push({
      id: "contrato",
      prioridade: diasContrato <= 90 ? 75 : diasContrato <= 180 ? 55 : 40,
      titulo:
        diasContrato <= 90
          ? `Contrato termina em cerca de ${meses} mês${meses > 1 ? "es" : ""}`
          : `Contrato termina em menos de ${meses <= 6 ? "6" : "12"} meses`,
      detalhe:
        diasContrato <= 180
          ? "Pré-contratos internacionais podem ser negociados perto do fim do vínculo."
          : `Término em ${formatarData(c.jogador.contrato.dataTermino)}.`,
      href: "/carreira/jogador",
      cta: "Ver contrato",
    });
  }

  if (!janela.aberta) {
    const dias = Math.ceil(
      (Date.parse(janela.proximaAbertura) - Date.parse(c.dataAtual)) / 86400000,
    );
    if (dias > 0 && dias <= 21) {
      itens.push({
        id: "janela",
        prioridade: 50,
        titulo: `Janela de transferências abre em ${dias} dia${dias > 1 ? "s" : ""}`,
        detalhe: `Próxima abertura: ${formatarData(janela.proximaAbertura)}`,
        href: "/carreira/mercado",
      });
    }
  }

  if (m.emprestimo) {
    itens.push({
      id: "emp-ativo",
      prioridade: 60,
      titulo: "Você está emprestado",
      detalhe: `Retorno previsto: ${formatarData(m.emprestimo.retornoEm)}`,
      href: "/carreira/mercado",
    });
  }

  if (!c.jogador.preparacao.planoId && !c.aposentado) itens.push({ id: "plano", prioridade: 60, titulo: "Defina seu plano de desenvolvimento", href: "/carreira/treinamento", cta: "Escolher plano" });
  for (const n of c.noticias.filter(n => !n.lida && ["treinador", "diretoria", "promessa", "hierarquia", "evolucao", "overall"].includes(n.tipo)).slice(0, 3))
    itens.push({ id: n.id, prioridade: n.tipo === "diretoria" || n.tipo === "promessa" ? 88 : 72, titulo: n.titulo, detalhe: n.texto, href: n.tipo === "evolucao" || n.tipo === "overall" ? "/carreira/noticias" : "/carreira/clube", cta: "Ver resposta" });
  return itens.sort((a, b) => b.prioridade - a.prioridade).slice(0, 4);
}

export function badgeMercado(c: EstadoCarreira): number {
  const m = c.mercado ?? criarMercado();
  let n = 0;
  n += c.propostas.filter(
    (p) => p.status === "pendente" && p.validade >= c.dataAtual,
  ).length;
  if (m.respostaDiretoriaSaida && m.statusPedidoSaida !== "nenhum") n += 1;
  if (m.respostaDiretoriaEmprestimo && m.pediuEmprestimo) n += 1;
  if (
    m.interesses.some(
      (i) =>
        i.status === "sondagem" ||
        i.status === "negociando" ||
        (i.status === "interessado" && i.semanasObservando <= 1),
    )
  )
    n += 1;
  return n;
}

export function AtencaoCarreira({ carreira: c }: { carreira: EstadoCarreira }) {
  const itens = coletarAcoesAtencao(c);
  if (!itens.length) return null;
  return (
    <section className="painel atencao-carreira" aria-labelledby="atencao-titulo">
      <p className="sobretitulo" id="atencao-titulo">
        ATENÇÃO / PRÓXIMAS AÇÕES
      </p>
      <ul className="lista-atencao">
        {itens.map((item) => (
          <li key={item.id}>
            <div>
              <strong>{item.titulo}</strong>
              {item.detalhe && <p className="texto-suave">{item.detalhe}</p>}
            </div>
            {item.href && item.cta && (
              <Link className="botao secundario" href={item.href}>
                {item.cta}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
