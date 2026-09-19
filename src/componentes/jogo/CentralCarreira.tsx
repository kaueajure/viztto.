"use client";
import { useFocoModal } from "@/componentes/interface/useFocoModal";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  House,
  UserRound,
  CalendarDays,
  Dumbbell,
  ArrowLeftRight,
  Newspaper,
  Settings,
  Menu,
  X,
  LogOut,
  Bell,
  Target,
  FileText,
  Activity,
  ChartColumn,
  ArrowRight,
} from "lucide-react";
import { EstadoPersistencia } from "./EstadoPersistencia";
import { badgeMercado } from "./AtencaoCarreira";
import { useJogoStore } from "@/estado/jogo-store";
import { InicioCarreira } from "./InicioCarreira";
import { PainelJogador } from "@/componentes/jogador/PainelJogador";
import { CalendarioCompeticao } from "./CalendarioCompeticao";
import { Treinamento } from "./Treinamento";
import { MercadoClube } from "./MercadoClube";
import { NoticiasHistorico } from "./NoticiasHistorico";
import { ResumoPartida } from "@/componentes/partida/ResumoPartida";
import { MatchdayModal } from "@/componentes/partida/MatchdayModal";
import { Escudo } from "@/componentes/clube/Escudo";
import { ConversaContrato } from "@/componentes/clube/ConversaContrato";
import { PainelDesempenho } from "./PainelDesempenho";
import { PainelObjetivos } from "./PainelObjetivos";
import { dataCarreiraTopo } from "@/utilitarios/apresentacao-carreira";

const SIDEBAR = [
  ["", "Início", House],
  ["jogador", "Perfil", UserRound],
  ["desempenho", "Desempenho", Activity],
  ["calendario", "Calendário", CalendarDays],
  ["noticias", "Mensagens", Newspaper],
  ["mercado", "Transferências", ArrowLeftRight],
  ["contrato", "Contrato", FileText],
  ["objetivos", "Objetivos", Target],
  ["historico", "Estatísticas", ChartColumn],
  ["treinamento", "Treinamento", Dumbbell],
] as const;

const TOP_NAV = [
  ["", "Início"],
  ["jogador", "Minha Carreira"],
  ["clube", "Clube"],
  ["mercado", "Transferências"],
  ["competicao", "Mundo do Futebol"],
] as const;

function rotuloTemporada(
  c: NonNullable<ReturnType<typeof useJogoStore.getState>["carreira"]>,
  ocupado: boolean,
): string | null {
  if (c.aposentado) return "Aposentado";
  if (ocupado) return "Simulando…";
  if (c.temporada.encerrada) return "Próxima temporada";
  return null;
}

export function CentralCarreira({ secao = "" }: { secao?: string }) {
  const {
      carreira: c,
      hidratado,
      salvando,
      alteracoesPendentes,
      erroPersistencia,
      statusPersistencia,
      operando,
      erro,
      saveIncompativel,
      matchday,
      simularSemana,
      acompanharSemana,
      matchdayComecar,
      matchdayAvancarAte,
      matchdayPularFim,
      matchdayDecidir,
      matchdayFechar,
      proximaTemporada,
      reiniciar,
      excluir,
      aposentar,
    } = useJogoStore(),
    roteador = useRouter();
  const [menu, definirMenu] = useState(false),
    [configuracoes, definirConfiguracoes] = useState(false),
    [confirmacao, definirConfirmacao] = useState<
      "excluir" | "reiniciar" | "aposentar" | null
    >(null),
    [resumo, definirResumo] = useState(false),
    [ocupado, definirOcupado] = useState(false);
  useFocoModal(
    configuracoes,
    () => {
      definirConfiguracoes(false);
      definirConfirmacao(null);
    },
    confirmacao ?? "configuracoes",
  );
  if (!hidratado)
    return (
      <main className="carregamento">
        <span className="marca">
          viztto<span>.</span>
        </span>
        <p>Carregando sua carreira…</p>
      </main>
    );
  if (!c)
    return (
      <main className="carregamento">
        <span className="marca">
          viztto<span>.</span>
        </span>
        <h1>SEU CAMINHO COMEÇA AQUI.</h1>
        <p>
          {saveIncompativel
            ? "Esta carreira não pode ser carregada nesta versão do jogo. O progresso no servidor foi preservado — crie uma nova carreira (substituindo) ou exclua a antiga no menu."
            : (erro ?? "Nenhuma carreira encontrada.")}
        </p>
        <EstadoPersistencia />
        <Link className="botao principal" href="/nova-carreira">
          Nova carreira
        </Link>
        <Link href="/">Voltar ao menu</Link>
      </main>
    );
  const clube =
    c.clubes.find((cl) => cl.id === c.clubeAtualId) ??
    c.clubes.find((cl) => cl.id === c.ultimoClubeId) ??
    c.clubes[0]!;
  const ultima = [...c.temporada.partidas, ...c.temporada.partidasBase].find(
    (p) => p.id === c.ultimaPartidaId,
  );
  const naoLidas = c.noticias.filter((n) => !n.lida).length;
  const topSecao =
    secao === "" || secao === "noticias"
      ? ""
      : secao === "jogador" ||
          secao === "desempenho" ||
          secao === "historico" ||
          secao === "treinamento" ||
          secao === "objetivos" ||
          secao === "contrato"
        ? "jogador"
        : secao === "clube"
          ? "clube"
          : secao === "mercado"
            ? "mercado"
            : secao === "competicao" || secao === "calendario"
              ? "competicao"
              : "";

  async function comTemporadaOu(acao: () => void) {
    if (ocupado) return;
    definirOcupado(true);
    await new Promise<void>((resolver) =>
      requestAnimationFrame(() => resolver()),
    );
    if (useJogoStore.getState().carreira?.temporada.encerrada)
      proximaTemporada();
    else {
      acao();
      definirResumo(false);
    }
    definirOcupado(false);
  }

  async function simularTempo() {
    await comTemporadaOu(() => simularSemana());
  }

  async function acompanharTempo() {
    await comTemporadaOu(() => acompanharSemana());
  }

  const rotuloUnico = rotuloTemporada(c, ocupado);
  const ctaDesabilitado = ocupado || !!c.aposentado;

  return (
    <div className={`estrutura-jogo vz-shell${secao === "" ? " vz-shell-home" : ""}`}>
      <aside className={`barra-lateral ${menu ? "aberta" : ""}`}>
        <div className="marca-lateral">
          <Link href="/carreira" className="marca vz-logo">
            VIZTTO <span>CARREIRA</span>
          </Link>
          <button
            className="botao-icone fechar-menu"
            aria-label="Fechar menu"
            onClick={() => definirMenu(false)}
          >
            <X />
          </button>
        </div>
        <nav aria-label="Navegação da carreira">
          {SIDEBAR.map(([rota, nome, Icone]) => {
            const ativo = secao === rota;
            const badge =
              rota === "noticias"
                ? naoLidas
                : rota === "mercado"
                  ? badgeMercado(c)
                  : 0;
            return (
              <Link
                key={rota}
                href={`/carreira${rota ? `/${rota}` : ""}`}
                className={ativo ? "ativo" : ""}
                onClick={() => definirMenu(false)}
                aria-current={ativo ? "page" : undefined}
              >
                <Icone size={18} strokeWidth={1.7} />
                <span>{nome}</span>
                {badge > 0 && (
                  <span
                    className="vz-nav-badge"
                    aria-label={`${badge} pendências`}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="rodape-lateral">
          <Escudo clube={clube} tamanho={28} />
          <div>
            <b>{clube.codigo}</b>
            <span>
              {c.jogador.categoria === "base"
                ? "CATEGORIA DE BASE"
                : "PROFISSIONAL"}
            </span>
            <span className="vz-save-status">
              {statusPersistencia === "conflito"
                ? "Conflito de save"
                : statusPersistencia === "salvando" || salvando
                  ? "Salvando…"
                  : statusPersistencia === "erro" || erroPersistencia
                    ? "Erro ao salvar"
                    : alteracoesPendentes || statusPersistencia === "pendente"
                      ? "Save pendente"
                      : "Progresso salvo"}
            </span>
          </div>
        </div>
        <Link href="/" className="sair-menu">
          <LogOut size={16} /> Menu principal
        </Link>
      </aside>
      {menu && (
        <button
          className="fundo-menu"
          aria-label="Fechar menu"
          onClick={() => definirMenu(false)}
        />
      )}
      <div className="area-jogo">
        <header className="barra-superior">
          <button
            className="botao-icone abrir-menu"
            aria-label="Abrir menu"
            onClick={() => definirMenu(true)}
          >
            <Menu />
          </button>
          <nav className="vz-top-nav" aria-label="Seções principais">
            {TOP_NAV.map(([rota, nome]) => (
              <Link
                key={rota + nome}
                href={`/carreira${rota ? `/${rota}` : ""}`}
                className={topSecao === rota ? "ativo" : ""}
                aria-current={topSecao === rota ? "page" : undefined}
              >
                {nome}
              </Link>
            ))}
          </nav>
          <div className="vz-topo-direita">
            <Link
              href="/carreira/noticias"
              className="botao-icone"
              aria-label={
                naoLidas > 0
                  ? `Notificações, ${naoLidas} não lidas`
                  : "Notificações"
              }
            >
              <Bell size={18} />
              {naoLidas > 0 && <span className="vz-dot" />}
            </Link>
            <button
              className="botao-icone"
              aria-label="Opções da carreira"
              onClick={() => definirConfiguracoes(true)}
            >
              <Settings size={18} />
            </button>
            <span className="vz-sep" aria-hidden="true" />
            <time className="data-topo" dateTime={c.dataAtual}>
              {dataCarreiraTopo(c.dataAtual)}
            </time>
            {c.origem === "demonstracao" && (
              <span className="vz-badge-demo" title="Clubes fictícios para exploração">
                Demo
              </span>
            )}
            {rotuloUnico ? (
              <button
                type="button"
                className="vz-cta-semana vz-cta-desktop"
                data-testid="advance-week"
                onClick={simularTempo}
                disabled={ctaDesabilitado}
              >
                {rotuloUnico}
                {!c.aposentado && <ArrowRight size={16} />}
              </button>
            ) : (
              <div className="vz-cta-semana-grupo vz-cta-desktop">
                <button
                  type="button"
                  className="vz-cta-semana secundario"
                  data-testid="simulate-week"
                  onClick={simularTempo}
                  disabled={ctaDesabilitado}
                >
                  Simular semana
                </button>
                <button
                  type="button"
                  className="vz-cta-semana"
                  data-testid="advance-week"
                  onClick={acompanharTempo}
                  disabled={ctaDesabilitado}
                >
                  Acompanhar
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        </header>
        <div className="vz-shell-floats" aria-live="polite">
          <EstadoPersistencia />
          {erro && (
            <p className="aviso erro vz-banner-float" role="alert">
              {erro}
            </p>
          )}
        </div>
        <main className={`conteudo-jogo${secao === "" ? " conteudo-home" : ""}`}>
          {secao === "" && (
            <InicioCarreira
              carreira={c}
              abrirResumo={() => definirResumo(true)}
            />
          )}
          {secao === "jogador" && <PainelJogador carreira={c} />}
          {secao === "desempenho" && <PainelDesempenho carreira={c} />}
          {(secao === "calendario" || secao === "competicao") && (
            <CalendarioCompeticao
              carreira={c}
              secao={secao as "calendario" | "competicao"}
            />
          )}
          {secao === "treinamento" && <Treinamento carreira={c} />}
          {(secao === "mercado" || secao === "clube") && (
            <MercadoClube carreira={c} secao={secao as "mercado" | "clube"} />
          )}
          {secao === "contrato" && (
            <div className="vz-pagina">
              <header className="vz-page-head">
                <p className="vz-card-sub">VÍNCULO</p>
                <h1>Contrato</h1>
              </header>
              <ConversaContrato carreira={c} />
            </div>
          )}
          {secao === "objetivos" && <PainelObjetivos carreira={c} />}
          {(secao === "noticias" || secao === "historico") && (
            <NoticiasHistorico
              carreira={c}
              secao={secao as "noticias" | "historico"}
            />
          )}
        </main>
        <div className="vz-cta-mobile-bar">
          <time dateTime={c.dataAtual}>{dataCarreiraTopo(c.dataAtual)}</time>
          {rotuloUnico ? (
            <button
              type="button"
              className="vz-cta-semana vz-cta-mobile"
              data-testid="advance-week-mobile"
              onClick={simularTempo}
              disabled={ctaDesabilitado}
            >
              {rotuloUnico}
              {!c.aposentado && <ArrowRight size={16} />}
            </button>
          ) : (
            <div className="vz-cta-semana-grupo">
              <button
                type="button"
                className="vz-cta-semana secundario vz-cta-mobile"
                data-testid="simulate-week-mobile"
                onClick={simularTempo}
                disabled={ctaDesabilitado}
              >
                Simular
              </button>
              <button
                type="button"
                className="vz-cta-semana vz-cta-mobile"
                data-testid="advance-week-mobile"
                onClick={acompanharTempo}
                disabled={ctaDesabilitado}
              >
                Acompanhar
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
      {resumo && ultima && (
        <ResumoPartida
          partida={ultima}
          carreira={c}
          fechar={() => definirResumo(false)}
        />
      )}
      {matchday && (
        <MatchdayModal
          carreira={c}
          sessao={matchday}
          onComecar={matchdayComecar}
          onAvancarAte={matchdayAvancarAte}
          onPularFim={matchdayPularFim}
          onDecidir={matchdayDecidir}
          onFechar={matchdayFechar}
        />
      )}
      {configuracoes && (
        <div className="sobreposicao">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="config-titulo"
            className="dialogo"
          >
            <div className="linha-titulo">
              <h2 id="config-titulo">OPÇÕES DA CARREIRA</h2>
              <button
                className="botao-icone"
                aria-label="Fechar configurações"
                onClick={() => {
                  definirConfiguracoes(false);
                  definirConfirmacao(null);
                }}
              >
                <X />
              </button>
            </div>
            {confirmacao ? (
              <>
                <EstadoPersistencia />
                <h3>
                  {confirmacao === "excluir"
                    ? "Excluir esta carreira?"
                    : confirmacao === "reiniciar"
                      ? "Recomeçar esta carreira?"
                      : "Encerrar a carreira profissional?"}
                </h3>
                <p>
                  {confirmacao === "aposentar"
                    ? "A aposentadoria é irreversível. Você poderá ver o histórico desta carreira, mas não voltará a jogar."
                    : confirmacao === "reiniciar"
                      ? "O progresso atual será perdido. Você voltará ao atleta e clube iniciais."
                      : "O progresso atual será perdido. Você poderá criar um novo jogador."}
                </p>
                <div className="acoes">
                  <button
                    className="botao secundario"
                    onClick={() => definirConfirmacao(null)}
                  >
                    Cancelar
                  </button>
                  <button
                    className="botao perigo"
                    disabled={operando}
                    onClick={async () => {
                      if (confirmacao === "excluir") {
                        if (!(await excluir())) return;
                        roteador.push("/");
                      } else if (confirmacao === "reiniciar") {
                        if (!(await reiniciar())) return;
                      } else {
                        aposentar();
                      }
                      definirConfiguracoes(false);
                      definirConfirmacao(null);
                    }}
                  >
                    Confirmar{" "}
                    {confirmacao === "excluir"
                      ? "exclusão"
                      : confirmacao === "reiniciar"
                        ? "reinício"
                        : "aposentadoria"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p>Seu progresso é salvo automaticamente no servidor.</p>
                <div className="config-acoes">
                  <Link className="botao secundario" href="/nova-carreira">
                    Nova carreira
                  </Link>
                  <button
                    className="botao secundario"
                    onClick={() => definirConfirmacao("reiniciar")}
                  >
                    Reiniciar carreira
                  </button>
                  {!c.aposentado && (
                    <button
                      className="botao secundario"
                      onClick={() => definirConfirmacao("aposentar")}
                    >
                      Solicitar aposentadoria
                    </button>
                  )}
                  <button
                    className="botao perigo"
                    onClick={() => definirConfirmacao("excluir")}
                  >
                    Excluir carreira
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
