"use client";
import { formatarTemporada } from "@/dominio/constantes/temporadas-iniciais";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, RefreshCw } from "lucide-react";
import type { Clube, IdentidadeJogador } from "@/dominio/entidades/modelos";
import { POSICOES, esquemaIdentidade } from "@/dominio/regras/jogador";
import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { esquemaImportacao } from "@/infraestrutura/transfermarkt/esquemas";
import { useJogoStore } from "@/estado/jogo-store";
import { Escudo } from "@/componentes/clube/Escudo";
const ETAPAS = [
  "Identidade",
  "Jogador",
  "Estilo",
  "Liga",
  "Clube",
  "Confirmação",
];
const ESTILOS = {
  equilibrado: ["Completo", "Fundamentos distribuídos. Você define o caminho."],
  artilheiro: ["Artilheiro", "Instinto de gol, posicionamento e compostura."],
  criador: ["Maestro", "Enxerga espaços e dita o ritmo com o passe."],
  velocista: ["Velocista", "Aceleração, drible e profundidade."],
  marcador: ["Guardião", "Disputa, antecipação e presença defensiva."],
  paredao: ["Paredão", "Reflexos, defesas e segurança no gol."],
} as const;
export function CriacaoCarreira() {
  const roteador = useRouter(),
    iniciar = useJogoStore((s) => s.iniciar),
    existente = useJogoStore((s) => s.carreira);
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
  const [ligaId, definirLiga] = useState(LIGAS_SUPORTADAS[0].id),
    [clubes, definirClubes] = useState<Clube[]>([]),
    [clubeId, definirClube] = useState(""),
    [origem, definirOrigem] = useState<"api" | "demonstracao">("demonstracao"),
    [inicio, definirInicio] = useState(""),
    [aviso, definirAviso] = useState<string | null>(null),
    [errosImportacao, definirErrosImportacao] = useState<
      { clubeId: string; nome: string; motivo: string }[]
    >([]),
    [erro, definirErro] = useState<string | null>(null),
    [carregando, definirCarregando] = useState(false),
    [importando, definirImportando] = useState(false),
    [precisaImportar, definirPrecisaImportar] = useState(false),
    [progresso, definirProgresso] = useState<{
      total: number;
      importados: number;
      falhas: number;
      clubeAtual: string | null;
    } | null>(null),
    [tentativa, definirTentativa] = useState(0),
    [substituir, definirSubstituir] = useState(false);
  const liga = LIGAS_SUPORTADAS.find((l) => l.id === ligaId)!,
    clube = clubes.find((c) => c.id === clubeId);
  const alterar = <Chave extends keyof IdentidadeJogador>(
    chave: Chave,
    valor: IdentidadeJogador[Chave],
  ) => definirIdentidade((atual) => ({ ...atual, [chave]: valor }));
  async function carregarClubesLocais(
    controle: AbortController,
  ): Promise<"ok" | "precisa_importar"> {
    const resposta = await fetch(`/api/futebol?liga=${ligaId}`, {
      signal: controle.signal,
    });
    const bruto = await resposta.json();
    if (resposta.status === 404 && bruto.precisaImportar) {
      definirPrecisaImportar(true);
      definirProgresso(bruto.progresso ?? null);
      definirClubes([]);
      definirErro(null);
      return "precisa_importar";
    }
    if (!resposta.ok)
      throw new Error(
        typeof bruto.erro === "string"
          ? bruto.erro
          : "Não foi possível carregar esta liga.",
      );
    const dados = esquemaImportacao.parse(bruto);
    definirPrecisaImportar(false);
    definirClubes(dados.clubes);
    definirOrigem(dados.origem);
    definirInicio(dados.inicio);
    definirAviso(dados.aviso);
    definirErrosImportacao(dados.erros ?? []);
    definirProgresso(dados.progresso ?? null);
    return "ok";
  }

  async function aguardarImportacao(controle: AbortController) {
    while (!controle.signal.aborted) {
      const status = await fetch(`/api/futebol/importar?liga=${ligaId}`, {
        signal: controle.signal,
      });
      if (!status.ok) break;
      const dados = await status.json();
      if (dados.progresso) definirProgresso(dados.progresso);
      if (dados.status !== "em_andamento" && dados.status !== "nao_importada") {
        break;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  async function importarLigaSelecionada(
    forcar: boolean,
    controleExterno?: AbortController,
  ) {
    const controle = controleExterno ?? new AbortController();
    definirImportando(true);
    definirErro(null);
    const intervalo = setInterval(async () => {
      try {
        const status = await fetch(`/api/futebol/importar?liga=${ligaId}`, {
          signal: controle.signal,
        });
        if (status.ok) {
          const dados = await status.json();
          if (dados.progresso) definirProgresso(dados.progresso);
        }
      } catch {
        /* polling interrompido */
      }
    }, 2000);
    try {
      const resposta = await fetch(
        `/api/futebol/importar?liga=${ligaId}${forcar ? "&forcar=1" : ""}`,
        { method: "POST", signal: controle.signal },
      );
      const bruto = await resposta.json();
      if (resposta.status === 409) {
        if (bruto.progresso) definirProgresso(bruto.progresso);
        await aguardarImportacao(controle);
      } else if (!resposta.ok && resposta.status !== 502) {
        throw new Error(
          typeof bruto.erro === "string"
            ? bruto.erro
            : "Não foi possível importar esta liga.",
        );
      } else {
        if (bruto.progresso) definirProgresso(bruto.progresso);
        if (bruto.aviso) definirAviso(bruto.aviso);
        if (bruto.erros?.length) definirErrosImportacao(bruto.erros);
      }
      if (!controle.signal.aborted) {
        const estado = await carregarClubesLocais(controle);
        if (estado === "precisa_importar") {
          definirErro(
            "A importação não concluiu. Confira se a Transfermarkt API está no ar.",
          );
        }
      }
    } catch (falha) {
      if (controle.signal.aborted) return;
      definirErro(
        falha instanceof Error ? falha.message : "Falha ao importar os clubes.",
      );
    } finally {
      clearInterval(intervalo);
      if (!controle.signal.aborted) definirImportando(false);
    }
  }

  useEffect(() => {
    const controle = new AbortController();
    definirCarregando(true);
    definirImportando(false);
    definirClube("");
    definirClubes([]);
    definirErro(null);
    definirAviso(null);
    definirErrosImportacao([]);
    definirPrecisaImportar(false);
    definirProgresso(null);
    (async () => {
      try {
        const estado = await carregarClubesLocais(controle);
        if (controle.signal.aborted) return;
        if (estado === "precisa_importar") {
          definirCarregando(false);
          await importarLigaSelecionada(false, controle);
          return;
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
    if (etapa === 4 && !clube) {
      definirErro("Selecione seu clube inicial.");
      return;
    }
    definirEtapa(etapa + 1);
  }
  function confirmar() {
    if (!clube || !inicio) return;
    iniciar({
      identidade,
      liga,
      clubes,
      clubeId,
      origem,
      seed: crypto.randomUUID(),
      dataInicio: inicio,
    });
    if (useJogoStore.getState().carreira) roteador.push("/carreira");
    else definirErro(useJogoStore.getState().erro);
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
                "SEU JEITO DE JOGAR.",
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
                "Seu estilo orienta os atributos iniciais. A carreira faz o resto.",
                "Seis ligas. Diferentes caminhos para conquistar espaço.",
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
          {etapa === 2 && (
            <div className="opcoes grade-dupla">
              {Object.entries(ESTILOS).map(([id, [nome, descricao]]) => (
                <button
                  aria-pressed={identidade.arquetipo === id}
                  className={`opcao ${identidade.arquetipo === id ? "selecionada" : ""}`}
                  key={id}
                  onClick={() =>
                    alterar("arquetipo", id as IdentidadeJogador["arquetipo"])
                  }
                >
                  <strong>{nome}</strong>
                  <span>{descricao}</span>
                </button>
              ))}
            </div>
          )}
          {etapa === 3 && (
            <>
              <div className="opcoes grade-dupla">
                {LIGAS_SUPORTADAS.map((l) => (
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
                        {l.pais} · {l.quantidadeClubes} clubes
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              {(importando || carregando) && (
                <p className="aviso" role="status">
                  {importando
                    ? progresso
                      ? `Preparando ${liga.nome}: ${progresso.importados}/${progresso.total} clubes${progresso.clubeAtual ? ` · ${progresso.clubeAtual}` : ""}…`
                      : `Preparando ${liga.nome} (clubes e elencos)…`
                    : `Verificando dados de ${liga.nome}…`}
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
              {errosImportacao.length > 0 && (
                <details className="aviso">
                  <summary>
                    {errosImportacao.length} clube(s) sem elenco importado
                  </summary>
                  <ul>
                    {errosImportacao.map((item) => (
                      <li key={item.clubeId}>
                        <strong>{item.nome}:</strong> {item.motivo}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <div className="linha-titulo">
                <span className="rotulo">{liga.nome}</span>
                <button
                  className="botao-texto"
                  disabled={carregando || importando}
                  onClick={() => definirTentativa((t) => t + 1)}
                >
                  <RefreshCw size={14} /> Recarregar
                </button>
              </div>
              {progresso && (importando || progresso.importados < progresso.total) && (
                <p className="aviso" role="status">
                  {progresso.importados}/{progresso.total} clubes importados
                  {progresso.clubeAtual
                    ? ` · processando ${progresso.clubeAtual}`
                    : ""}
                  {progresso.falhas > 0 ? ` · ${progresso.falhas} falha(s)` : ""}
                </p>
              )}
              {!precisaImportar && clubes.length > 0 && (
                <button
                  className="botao-texto campo-inteiro"
                  disabled={importando || carregando}
                  onClick={() => void importarLigaSelecionada(true)}
                >
                  <RefreshCw size={14} /> Atualizar dados da liga
                </button>
              )}
              {carregando || importando ? (
                <p className="estado-vazio" role="status">
                  {importando
                    ? "Baixando clubes e elencos desta liga pela primeira vez… isso pode levar alguns minutos."
                    : "Carregando clubes…"}
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
                    {liga.nome}
                    {identidade.idade < 17 ? " · Base" : ""}
                  </dd>
                </div>
                <div>
                  <dt>Temporada inicial</dt>
                  <dd>
                    {formatarTemporada(liga.id, Number(inicio.slice(0, 4)))}
                  </dd>
                </div>
                <div>
                  <dt>Mundo inicial</dt>
                  <dd>
                    {origem === "api"
                      ? "Clubes reais · Transfermarkt API (importação local)"
                      : "Demonstração · clubes fictícios"}
                  </dd>
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
          {erro && (
            <p role="alert" className="aviso erro">
              {erro}
            </p>
          )}
          <footer className="navegacao-formulario">
            <button
              className="botao-texto"
              disabled={etapa === 0}
              onClick={() => {
                definirEtapa(etapa - 1);
                definirErro(null);
              }}
            >
              <ArrowLeft size={17} /> Anterior
            </button>
            {etapa < 5 ? (
              <button
                className="botao principal"
                disabled={etapa === 4 && (!clube || carregando)}
                onClick={avancar}
              >
                Continuar <ArrowRight size={18} />
              </button>
            ) : (
              <button
                className="botao principal"
                disabled={!!existente && !substituir}
                onClick={confirmar}
              >
                Iniciar carreira <ArrowRight size={18} />
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
