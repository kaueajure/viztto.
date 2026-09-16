"use client";
import { SuaHistoria } from "./SuaHistoria";
import { CAPITULOS, type EscolhasHistoria } from "@/dominio/desenvolvimento";
import { sortearHistoria } from "@/dominio/historia-formacao";
import { formatarTemporada } from "@/dominio/constantes/temporadas-iniciais";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, RefreshCw } from "lucide-react";
import type {
  Clube,
  IdentidadeJogador,
  Liga,
} from "@/dominio/entidades/modelos";
import { POSICOES, esquemaIdentidade } from "@/dominio/regras/jogador";
import {
  esquemaLigasDisponiveis,
  type LigaDisponivel,
} from "@/dominio/regras/liga";
import { esquemaImportacao } from "@/infraestrutura/transfermarkt/esquemas";
import { EstadoPersistencia } from "@/componentes/jogo/EstadoPersistencia";
import { useJogoStore } from "@/estado/jogo-store";
import { Escudo } from "@/componentes/clube/Escudo";
const ETAPAS = [
  "Identidade",
  "Jogador",
  "Sua História",
  "Liga",
  "Clube",
  "Confirmação",
];
export function CriacaoCarreira() {
  const roteador = useRouter(),
    iniciar = useJogoStore((s) => s.iniciar),
    existente = useJogoStore((s) => s.temSave),
    hidratado = useJogoStore((s) => s.hidratado),
    operando = useJogoStore((s) => s.operando);
  const [etapa, definirEtapa] = useState(0),
    [identidade, definirIdentidade] = useState<IdentidadeJogador>({
      nome: "",
      sobrenome: "",
      nacionalidade: "Brasil",
      idade: 15,
      posicao: "PD",
      posicaoSecundaria: "",
      peDominante: "direito",
      altura: 178,
      peso: 70,
      arquetipo: "equilibrado",
    });
  const [seed, definirSeed] = useState("");
  const [capitulo, definirCapitulo] = useState(0);
  const [escolhas, definirEscolhas] = useState<Partial<EscolhasHistoria>>({});
  const [ligas, definirLigas] = useState<LigaDisponivel[]>([]);
  const [ligaId, definirLiga] = useState(""),
    [clubes, definirClubes] = useState<Clube[]>([]),
    [clubeId, definirClube] = useState(""),
    [inicio, definirInicio] = useState(""),
    [aviso, definirAviso] = useState<string | null>(null),
    [erro, definirErro] = useState<string | null>(null),
    [carregando, definirCarregando] = useState(false),
    [carregandoLigas, definirCarregandoLigas] = useState(true),
    [confirmando, definirConfirmando] = useState(false),
    [tentativa, definirTentativa] = useState(0),
    [substituir, definirSubstituir] = useState(false);
  const liga = ligas.find((l) => l.id === ligaId),
    clube = clubes.find((c) => c.id === clubeId);
  const alterar = <Chave extends keyof IdentidadeJogador>(
    chave: Chave,
    valor: IdentidadeJogador[Chave],
  ) => definirIdentidade((atual) => ({ ...atual, [chave]: valor }));

  useEffect(() => {
    const controle = new AbortController();
    (async () => {
      try {
        const resposta = await fetch("/api/futebol/ligas", {
          signal: controle.signal,
        });
        if (!resposta.ok)
          throw new Error("Não foi possível carregar as ligas disponíveis.");
        const dados = esquemaLigasDisponiveis.parse(await resposta.json());
        if (!controle.signal.aborted) definirLigas(dados.ligas);
      } catch (falha) {
        if (!controle.signal.aborted)
          definirErro(
            falha instanceof Error
              ? falha.message
              : "Falha ao carregar as ligas.",
          );
      } finally {
        if (!controle.signal.aborted) definirCarregandoLigas(false);
      }
    })();
    return () => controle.abort();
  }, []);

  useEffect(() => {
    const controle = new AbortController();
    definirClube("");
    definirClubes([]);
    definirInicio("");
    definirAviso(null);
    if (!ligaId) {
      definirCarregando(false);
      return () => controle.abort();
    }
    definirCarregando(true);
    definirErro(null);
    (async () => {
      try {
        const resposta = await fetch(
          `/api/futebol?liga=${encodeURIComponent(ligaId)}`,
          { signal: controle.signal },
        );
        if (resposta.status === 404) {
          if (!controle.signal.aborted) {
            definirLigas((atuais) => atuais.filter((l) => l.id !== ligaId));
            definirLiga("");
            definirEtapa((atual) => (atual > 3 ? 3 : atual));
            definirAviso(
              "Esta liga não está mais disponível. Escolha outra opção.",
            );
          }
          return;
        }
        if (!resposta.ok)
          throw new Error("Não foi possível carregar os clubes desta liga.");
        const dados = esquemaImportacao.parse(await resposta.json());
        if (!controle.signal.aborted) {
          definirClubes(dados.clubes as Clube[]);
          definirInicio(dados.inicio);
          definirAviso(dados.aviso);
        }
      } catch (falha) {
        if (!controle.signal.aborted)
          definirErro(
            falha instanceof Error
              ? falha.message
              : "Falha ao carregar os clubes.",
          );
      } finally {
        if (!controle.signal.aborted) definirCarregando(false);
      }
    })();
    return () => controle.abort();
  }, [ligaId, tentativa]);
  function avancar() {
    definirErro(null);
    if (
      etapa === 0 &&
      (identidade.nome.trim().length < 2 ||
        identidade.sobrenome.trim().length < 2 ||
        identidade.nacionalidade.trim().length < 2)
    ) {
      definirErro(
        "Preencha nome, sobrenome e nacionalidade com pelo menos 2 caracteres.",
      );
      return;
    }
    if (etapa === 1 && !esquemaIdentidade.safeParse(identidade).success) {
      definirErro(
        "Confira idade (15–40), altura (150–215 cm) e peso (45–120 kg).",
      );
      return;
    }
    if (etapa === 3 && (!liga || carregando || clubes.length < 2)) return;
    if (etapa === 4 && !clube) {
      definirErro("Selecione seu clube inicial.");
      return;
    }
    if (etapa === 1) {
      if (!seed) definirSeed(crypto.randomUUID());
      if (seed) {
        const opcoes = sortearHistoria(seed, identidade.posicao);
        definirEscolhas(atuais => Object.fromEntries(CAPITULOS.filter(c => opcoes[c].some(o => o.id === atuais[c])).map(c => [c,atuais[c]])));
      }
      definirCapitulo(0);
    }
    if (etapa === 2 && capitulo < 4) {
      if (!escolhas[CAPITULOS[capitulo]]) { definirErro("Escolha um caminho para continuar."); return; }
      definirCapitulo(capitulo + 1);
      return;
    }
    definirEtapa(etapa + 1);
  }
  async function confirmar() {
    if (!liga || !clube || !inicio || confirmando || (existente && !substituir))
      return;
    definirConfirmando(true);
    definirErro(null);
    try {
      const ligasMundo: Liga[] = [];
      const clubesMundo: Clube[] = [];
      // Revalida a seleção antes de criar o mundo; consulta somente ligas do catálogo local.
      const resposta = await fetch(
        `/api/futebol?liga=${encodeURIComponent(liga.id)}`,
      );
      if (resposta.status === 404) {
        definirLigas((atuais) => atuais.filter((l) => l.id !== liga.id));
        definirLiga("");
        definirEtapa(3);
        return;
      }
      if (!resposta.ok)
        throw new Error("Não foi possível confirmar a liga selecionada.");
      const principal = esquemaImportacao.parse(await resposta.json());
      if (!principal.clubes.some((c) => c.id === clubeId)) {
        definirClubes(principal.clubes as Clube[]);
        definirClube("");
        definirEtapa(4);
        return;
      }
      for (const outra of ligas) {
        if (outra.id === liga.id) continue;
        const resposta = await fetch(
          `/api/futebol?liga=${encodeURIComponent(outra.id)}`,
        );
        if (resposta.status === 404) continue;
        if (!resposta.ok)
          throw new Error(
            `Não foi possível carregar ${outra.nome}. Tente novamente.`,
          );
        const dados = esquemaImportacao.parse(await resposta.json());
        ligasMundo.push(outra);
        clubesMundo.push(...(dados.clubes as Clube[]));
      }
      const criada = await iniciar(
        {
          identidade,
          liga,
          clubes: principal.clubes as Clube[],
          clubeId,
          origem: "api",
          seed,
          historia: escolhas as EscolhasHistoria,
          dataInicio: principal.inicio,
          ligasMundo,
          clubesMundo,
        },
        substituir,
      );
      const estado = useJogoStore.getState();
      if (criada) roteador.push("/carreira");
      else definirErro(estado.erro);
    } catch (falha) {
      definirErro(
        falha instanceof Error
          ? falha.message
          : "Não foi possível criar a carreira.",
      );
    } finally {
      definirConfirmando(false);
    }
  }
  return (
    <main className="criacao">
      <header className="cabecalho-inicial">
        <Link href="/" className="marca">
          viztto<span>.</span>
        </Link>
        <span className="rotulo">NOVA CARREIRA</span>
        <Link href="/" className="botao-texto">
          <ArrowLeft size={16} /> Voltar ao menu
        </Link>
      </header>
      <nav className="etapas" aria-label="Etapas da criação">
        {ETAPAS.map((nome, i) => (
          <div
            key={nome}
            className={i === etapa ? "atual" : i < etapa ? "concluida" : ""}
          >
            <span>
              {i < etapa ? <Check size={16} /> : String(i + 1).padStart(2, "0")}
            </span>
            {nome}
          </div>
        ))}
      </nav>
      <div className="criacao-corpo">
        <section className="formulario">
          <p className="sobretitulo">
            CAPÍTULO ZERO / {String(etapa + 1).padStart(2, "0")}
          </p>
          <h1>
            {
              [
                "QUEM É VOCÊ?",
                "DENTRO DE CAMPO.",
                "SUA HISTÓRIA.",
                "ESCOLHA SEU PALCO.",
                "SEU PRIMEIRO ESCUDO.",
                "COMEÇA A HISTÓRIA.",
              ][etapa]
            }
          </h1>
          <p className="texto-suave">
            {
              [
                "Todo jogador tem um começo. Este é o seu.",
                "Defina o perfil do atleta que vai entrar em campo.",
                "Construa o passado do atleta. Cada escolha traz qualidades e desafios.",
                `${ligas.length} ligas disponíveis. Diferentes caminhos para conquistar espaço.`,
                "Escolha onde você vai disputar sua primeira oportunidade.",
                "Confira os detalhes antes de entrar no vestiário.",
              ][etapa]
            }
          </p>
          {etapa === 0 && (
            <div className="campos">
              <label>
                Nome
                <input
                  autoFocus
                  value={identidade.nome}
                  maxLength={30}
                  onChange={(e) => alterar("nome", e.target.value)}
                  placeholder="Seu nome"
                />
              </label>
              <label>
                Sobrenome
                <input
                  value={identidade.sobrenome}
                  maxLength={40}
                  onChange={(e) => alterar("sobrenome", e.target.value)}
                  placeholder="Seu sobrenome"
                />
              </label>
              <label className="campo-inteiro">
                Nacionalidade
                <input
                  value={identidade.nacionalidade}
                  maxLength={40}
                  onChange={(e) => alterar("nacionalidade", e.target.value)}
                />
              </label>
            </div>
          )}
          {etapa === 1 && (
            <div className="campos">
              <label>
                Idade inicial
                <input
                  type="number"
                  min={15}
                  max={40}
                  value={identidade.idade}
                  onChange={(e) => alterar("idade", Number(e.target.value))}
                />
              </label>
              <label>
                Pé dominante
                <select
                  value={identidade.peDominante}
                  onChange={(e) =>
                    alterar(
                      "peDominante",
                      e.target.value as IdentidadeJogador["peDominante"],
                    )
                  }
                >
                  <option value="direito">Direito</option>
                  <option value="esquerdo">Esquerdo</option>
                  <option value="ambos">Ambos</option>
                </select>
              </label>
              <label>
                Posição principal
                <select
                  value={identidade.posicao}
                  onChange={(e) =>
                    alterar(
                      "posicao",
                      e.target.value as IdentidadeJogador["posicao"],
                    )
                  }
                >
                  {Object.entries(POSICOES).map(([codigo, nome]) => (
                    <option key={codigo} value={codigo}>
                      {codigo} — {nome}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Posição secundária
                <select
                  value={identidade.posicaoSecundaria}
                  onChange={(e) =>
                    alterar(
                      "posicaoSecundaria",
                      e.target.value as IdentidadeJogador["posicaoSecundaria"],
                    )
                  }
                >
                  <option value="">Nenhuma</option>
                  {Object.entries(POSICOES)
                    .filter(([codigo]) => codigo !== identidade.posicao)
                    .map(([codigo, nome]) => (
                      <option key={codigo} value={codigo}>
                        {codigo} — {nome}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Altura (cm)
                <input
                  type="number"
                  min={150}
                  max={215}
                  value={identidade.altura}
                  onChange={(e) => alterar("altura", Number(e.target.value))}
                />
              </label>
              <label>
                Peso (kg)
                <input
                  type="number"
                  min={45}
                  max={120}
                  value={identidade.peso}
                  onChange={(e) => alterar("peso", Number(e.target.value))}
                />
              </label>
              <p className="aviso campo-inteiro">
                {identidade.idade < 17
                  ? "Você começa na categoria de base. A promoção depende da avaliação da comissão técnica."
                  : "Você começa no elenco profissional, disputando espaço com os demais jogadores."}
              </p>
            </div>
          )}
          {etapa === 2 && seed && <SuaHistoria seed={seed} identidade={identidade} capitulo={capitulo} escolhas={escolhas} escolher={(c,id) => definirEscolhas(atuais => ({...atuais,[c]:id}))} />}
          {etapa === 3 && (
            <>
              <div className="opcoes grade-dupla">
                {ligas.map((l) => (
                  <button
                    aria-pressed={ligaId === l.id}
                    key={l.id}
                    className={`opcao opcao-liga ${ligaId === l.id ? "selecionada" : ""}`}
                    onClick={() => definirLiga(l.id)}
                  >
                    <span
                      className={`bandeira bandeira-${l.bandeira.toLowerCase()}`}
                    >
                      {l.bandeira}
                    </span>
                    <div>
                      <strong>{l.nome}</strong>
                      <span>
                        {l.pais} · {l.clubesDisponiveis} clubes
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              {carregandoLigas && (
                <p className="aviso" role="status">
                  Carregando ligas disponíveis…
                </p>
              )}
              {!carregandoLigas && !ligas.length && (
                <p className="estado-vazio" role="status">
                  Nenhuma liga disponível nesta edição. Você pode voltar mais
                  tarde.
                </p>
              )}
              {carregando && (
                <p className="aviso" role="status">
                  Carregando clubes…
                </p>
              )}
              {aviso && (
                <p className="aviso" role="status">
                  {aviso}
                </p>
              )}
            </>
          )}
          {etapa === 4 && (
            <>
              {aviso && (
                <p role="status" className="aviso">
                  {aviso}
                </p>
              )}
              <div className="linha-titulo">
                <span className="rotulo">{liga?.nome}</span>
                <button
                  className="botao-texto"
                  disabled={carregando}
                  onClick={() => definirTentativa((t) => t + 1)}
                >
                  <RefreshCw size={14} /> Recarregar
                </button>
              </div>
              {carregando ? (
                <p className="estado-vazio" role="status">
                  Carregando clubes…
                </p>
              ) : (
                <div className="selecao-clubes">
                  {clubes.map((c) => (
                    <button
                      key={c.id}
                      aria-pressed={clubeId === c.id}
                      className={`opcao opcao-clube ${clubeId === c.id ? "selecionada" : ""}`}
                      onClick={() => definirClube(c.id)}
                    >
                      <Escudo clube={c} tamanho={36} />
                      <div>
                        <strong>{c.nome}</strong>
                        <span>
                          {c.estadio}
                          {c.elenco.length > 0
                            ? ` · ${c.elenco.length} jogadores`
                            : ""}
                        </span>
                      </div>
                      <b className="forca-clube">{c.forcaGeral}</b>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          {etapa === 5 && (
            <div className="confirmacao">
              <dl>
                <div>
                  <dt>Nome</dt>
                  <dd>
                    {identidade.nome} {identidade.sobrenome}
                  </dd>
                </div>
                <div>
                  <dt>Perfil</dt>
                  <dd>
                    {identidade.idade} anos · {POSICOES[identidade.posicao]}
                  </dd>
                </div>
                <div>
                  <dt>Clube</dt>
                  <dd>{clube?.nome}</dd>
                </div>
                <div>
                  <dt>Competição</dt>
                  <dd>
                    {liga?.nome}
                    {identidade.idade < 17 ? " · Base" : ""}
                  </dd>
                </div>
                <div>
                  <dt>Temporada inicial</dt>
                  <dd>
                    {formatarTemporada(
                      liga?.id ?? "",
                      Number(inicio.slice(0, 4)),
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Mundo inicial</dt>
                  <dd>Clubes reais · Base local Transfermarkt</dd>
                </div>
              </dl>
              {existente && (
                <label className="aceite">
                  <input
                    type="checkbox"
                    checked={substituir}
                    onChange={(e) => definirSubstituir(e.target.checked)}
                  />{" "}
                  Substituir minha carreira salva por esta nova carreira.
                </label>
              )}
            </div>
          )}
          <EstadoPersistencia />
          {erro && (
            <p role="alert" className="aviso erro">
              {erro}
            </p>
          )}
          <footer className="navegacao-formulario">
            <button
              className="botao-texto"
              disabled={etapa === 0 || confirmando}
              onClick={() => {
                if (etapa === 2 && capitulo > 0) definirCapitulo(capitulo - 1);
                else definirEtapa(etapa - 1);
                definirErro(null);
              }}
            >
              <ArrowLeft size={17} /> Anterior
            </button>
            {etapa < 5 ? (
              <button
                className="botao principal"
                disabled={
                  (etapa === 3 && (!liga || carregando || clubes.length < 2)) ||
                  (etapa === 4 && (!clube || carregando))
                }
                onClick={avancar}
              >
                Continuar <ArrowRight size={18} />
              </button>
            ) : (
              <button
                className="botao principal"
                disabled={
                  !hidratado ||
                  operando ||
                  confirmando ||
                  !liga ||
                  !clube ||
                  (!!existente && !substituir)
                }
                onClick={confirmar}
              >
                {confirmando ? "Criando carreira…" : "Iniciar carreira"}{" "}
                <ArrowRight size={18} />
              </button>
            )}
          </footer>
        </section>
        <aside className="preview-jogador">
          <div className="camisa-abstrata" aria-hidden="true">
            <span>{identidade.posicao === "GOL" ? "1" : "10"}</span>
          </div>
          <div className="preview-dados">
            <span className="rotulo">
              {identidade.idade < 17
                ? "CATEGORIA DE BASE"
                : "ELENCO PROFISSIONAL"}
            </span>
            <h2>
              {identidade.nome || "SEU NOME"}
              <br />
              <span>{identidade.sobrenome || "SUA HISTÓRIA"}</span>
            </h2>
            <div className="perfil-resumo">
              <b>{identidade.posicao}</b>
              <span>{identidade.idade} anos</span>
              <span>{identidade.nacionalidade}</span>
            </div>
            {clube && (
              <div className="preview-clube">
                <Escudo clube={clube} tamanho={32} />
                <span>{clube.nome}</span>
              </div>
            )}
          </div>
          <p className="nota-preview">
            O talento abre a porta.
            <br />O que vem depois depende de você.
          </p>
        </aside>
      </div>
    </main>
  );
}
