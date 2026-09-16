"use client";
import { formatarTemporada } from "@/dominio/constantes/temporadas-iniciais";
import { useFocoModal } from "@/componentes/interface/useFocoModal";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  House,
  UserRound,
  CalendarDays,
  Shield,
  Trophy,
  Dumbbell,
  ArrowLeftRight,
  Newspaper,
  History,
  Settings,
  Menu,
  X,
  LogOut,
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
import { Escudo } from "@/componentes/clube/Escudo";
import { formatarData } from "@/utilitarios/formatacao";
const NAVEGACAO = [
  ["", "Início", House],
  ["jogador", "Jogador", UserRound],
  ["calendario", "Calendário", CalendarDays],
  ["clube", "Clube", Shield],
  ["competicao", "Competição", Trophy],
  ["treinamento", "Treinamento", Dumbbell],
  ["mercado", "Mercado", ArrowLeftRight],
  ["noticias", "Notícias", Newspaper],
  ["historico", "Histórico", History],
] as const;
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
      avancar,
      proximaTemporada,
      reiniciar,
      excluir,
    } = useJogoStore(),
    roteador = useRouter();
  const [menu, definirMenu] = useState(false),
    [configuracoes, definirConfiguracoes] = useState(false),
    [confirmacao, definirConfirmacao] = useState<
      "excluir" | "reiniciar" | null
    >(null),
    [resumo, definirResumo] = useState(false),
    [ocupado, definirOcupado] = useState(false);
  useFocoModal(configuracoes, () => {
    definirConfiguracoes(false);
    definirConfirmacao(null);
  });
  if (!hidratado)
    return (
      <main className="carregamento">
        <span className="marca">viztto.</span>
        <p>Carregando sua carreira…</p>
      </main>
    );
  if (!c)
    return (
      <main className="carregamento">
        <span className="marca">viztto.</span>
        <h1>SEU CAMINHO COMEÇA AQUI.</h1>
        <p>{erro ?? "Nenhuma carreira encontrada."}</p>
        <EstadoPersistencia />
        <Link className="botao principal" href="/nova-carreira">
          Nova carreira
        </Link>
        <Link href="/">Voltar ao menu</Link>
      </main>
    );
  const clube = c.clubes.find((cl) => cl.id === c.clubeAtualId)!;
  const ultima = [...c.temporada.partidas, ...c.temporada.partidasBase].find(
    (p) => p.id === c.ultimaPartidaId,
  );
  async function avancarTempo() {
    if (ocupado) return;
    definirOcupado(true);
    await new Promise<void>((resolver) =>
      requestAnimationFrame(() => resolver()),
    );
    if (useJogoStore.getState().carreira?.temporada.encerrada)
      proximaTemporada();
    else {
      avancar();
      definirResumo(false);
    }
    definirOcupado(false);
  }
  return (
    <div className="estrutura-jogo">
      <aside className={`barra-lateral ${menu ? "aberta" : ""}`}>
        <div className="marca-lateral">
          <Link href="/" className="marca">
            viztto<span>.</span>
          </Link>
          <button
            className="botao-icone fechar-menu"
            aria-label="Fechar menu"
            onClick={() => definirMenu(false)}
          >
            <X />
          </button>
        </div>
        <span className="rotulo legenda-navegacao">MODO CARREIRA</span>
        <nav aria-label="Navegação da carreira">
          {NAVEGACAO.map(([rota, nome, Icone]) => (
            <Link
              key={rota}
              href={`/carreira${rota ? `/${rota}` : ""}`}
              className={secao === rota ? "ativo" : ""}
              onClick={() => definirMenu(false)}
              aria-current={secao === rota ? "page" : undefined}
            >
              <Icone size={18} strokeWidth={1.7} />
              {nome}
              {rota === "noticias" && c.noticias.some((n) => !n.lida) && (
                <span className="ponto" />
              )}
              {rota === "mercado" && badgeMercado(c) > 0 && (
                <span className="ponto" aria-label={`${badgeMercado(c)} pendências`} />
              )}
            </Link>
          ))}
        </nav>
        <div className="rodape-lateral">
          <Escudo clube={clube} tamanho={38} />
          <div>
            <b>{clube.codigo}</b>
            <span>
              {c.jogador.categoria === "base"
                ? "CATEGORIA DE BASE"
                : "PROFISSIONAL"}
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
          <div className="temporada-topo">
            <b>{formatarTemporada(c.liga.id, c.temporada.ano)}</b>
            <span>TEMPORADA</span>
          </div>
          <span className="data-topo">{formatarData(c.dataAtual)}</span>
          <div className="clube-topo">
            <Escudo clube={clube} tamanho={26} />
            <span>{clube.nome}</span>
          </div>
          <span className="jogador-topo">
            {c.jogador.nome} {c.jogador.sobrenome}
          </span>
          <button
            className="botao-icone"
            aria-label="Configurações da carreira"
            onClick={() => definirConfiguracoes(true)}
          >
            <Settings size={19} />
          </button>
        </header>
        {c.origem === "demonstracao" && (
          <div className="faixa-demonstracao">
            MODO DEMONSTRAÇÃO{" "}
            <span>
              Clubes fictícios · importe uma liga via Transfermarkt para iniciar
              com elencos reais.
            </span>
          </div>
        )}
        <EstadoPersistencia />
        {erro && (
          <p className="aviso erro" role="alert">
            {erro}
          </p>
        )}
        <main className="conteudo-jogo">
          {secao === "" && (
            <InicioCarreira
              carreira={c}
              avancar={avancarTempo}
              ocupado={ocupado}
              abrirResumo={() => definirResumo(true)}
            />
          )}{" "}
          {secao === "jogador" && <PainelJogador carreira={c} />}{" "}
          {(secao === "calendario" || secao === "competicao") && (
            <CalendarioCompeticao carreira={c} secao={secao} />
          )}{" "}
          {secao === "treinamento" && <Treinamento carreira={c} />}{" "}
          {(secao === "mercado" || secao === "clube") && (
            <MercadoClube carreira={c} secao={secao} />
          )}{" "}
          {(secao === "noticias" || secao === "historico") && (
            <NoticiasHistorico carreira={c} secao={secao} />
          )}
        </main>
        <footer className="rodape-jogo">
          <span>
            <span className="ponto" />{" "}
            {statusPersistencia === "conflito"
              ? "CONFLITO DE SAVE"
              : statusPersistencia === "salvando" || salvando
                ? "SALVANDO…"
                : statusPersistencia === "retentando"
                  ? "TENTANDO SALVAR NOVAMENTE…"
                  : statusPersistencia === "erro" || erroPersistencia
                    ? "ERRO AO SALVAR"
                    : alteracoesPendentes || statusPersistencia === "pendente"
                      ? "SALVAMENTO PENDENTE"
                      : "PROGRESSO SALVO"}
          </span>
          <span>VIZTTO / CARREIRA DE JOGADOR</span>
        </footer>
      </div>
      {resumo && ultima && (
        <ResumoPartida
          partida={ultima}
          carreira={c}
          fechar={() => definirResumo(false)}
        />
      )}{" "}
      {configuracoes && (
        <div className="sobreposicao">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="config-titulo"
            className="dialogo"
          >
            <div className="linha-titulo">
              <h2 id="config-titulo">CARREIRA SALVA</h2>
              <button
                autoFocus
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
                    : "Recomeçar esta carreira?"}
                </h3>
                <p>
                  O progresso atual será perdido.{" "}
                  {confirmacao === "reiniciar"
                    ? "Você voltará ao atleta e clube iniciais."
                    : "Você poderá criar um novo jogador."}
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
                      } else if (!(await reiniciar())) return;
                      definirConfiguracoes(false);
                      definirConfirmacao(null);
                    }}
                  >
                    Confirmar{" "}
                    {confirmacao === "excluir" ? "exclusão" : "reinício"}
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
