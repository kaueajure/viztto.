"use client";
import { SuaHistoria } from "./SuaHistoria";
import { CAPITULOS, type EscolhasHistoria } from "@/dominio/desenvolvimento";
import { resumirHistoria, sortearHistoria } from "@/dominio/historia-formacao";
import { formatarTemporada } from "@/dominio/constantes/temporadas-iniciais";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, RefreshCw } from "lucide-react";
import type {
  Clube,
  IdentidadeJogador,
  Liga,
  Posicao,
} from "@/dominio/entidades/modelos";
import { POSICOES, POSICOES_ALTERNATIVAS, esquemaIdentidade } from "@/dominio/regras/jogador";
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
    saveIncompativel = useJogoStore((s) => s.saveIncompativel),
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
    [tentativaLigas, definirTentativaLigas] = useState(0),
    [substituir, definirSubstituir] = useState(false),
    [buscaClube, definirBuscaClube] = useState(""),
    [errosCampo, definirErrosCampo] = useState<Partial<Record<string, string>>>({}),
    [tocados, definirTocados] = useState<Partial<Record<string, boolean>>>({}),
    [erroLigas, definirErroLigas] = useState<string | null>(null),
    [erroClubes, definirErroClubes] = useState<string | null>(null);
  const liga = ligas.find((l) => l.id === ligaId),
    clube = clubes.find((c) => c.id === clubeId);
  const clubesFiltrados = (() => {
    const q = buscaClube.trim().toLowerCase();
    if (!q) return clubes;
    return clubes.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        c.codigo.toLowerCase().includes(q),
    );
  })();
  const alterar = <Chave extends keyof IdentidadeJogador>(
    chave: Chave,
    valor: IdentidadeJogador[Chave],
  ) => {
    definirIdentidade((atual) => {
      const proximo = { ...atual, [chave]: valor };
      if (chave === "posicao") {
        const secundarias = POSICOES_ALTERNATIVAS[valor as Posicao];
        if (
          proximo.posicaoSecundaria &&
          !secundarias.includes(proximo.posicaoSecundaria as Posicao)
        ) {
          proximo.posicaoSecundaria = "";
        }
      }
      return proximo;
    });
    definirErrosCampo((e) => {
      if (!e[chave]) return e;
      const n = { ...e };
      delete n[chave];
      return n;
    });
  };
  const tocar = (campo: string) =>
    definirTocados((t) => ({ ...t, [campo]: true }));

  function validarIdentidadeCampos(): boolean {
    const e: Partial<Record<string, string>> = {};
    if (identidade.nome.trim().length < 2)
      e.nome = "Nome precisa ter pelo menos 2 caracteres.";
    if (identidade.sobrenome.trim().length < 2)
      e.sobrenome = "Informe seu sobrenome.";
    if (identidade.nacionalidade.trim().length < 2)
      e.nacionalidade = "Informe a nacionalidade.";
    definirErrosCampo(e);
    definirTocados({ nome: true, sobrenome: true, nacionalidade: true });
    return Object.keys(e).length === 0;
  }

  function validarPerfilCampos(): boolean {
    const e: Partial<Record<string, string>> = {};
    const parsed = esquemaIdentidade.safeParse(identidade);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = String(issue.path[0] ?? "idade");
        if (!e[path]) e[path] = issue.message;
      }
      if (!e.idade && (identidade.idade < 15 || identidade.idade > 40))
        e.idade = "Idade entre 15 e 40 anos.";
      if (!e.altura && (identidade.altura < 150 || identidade.altura > 215))
        e.altura = "Altura entre 150 e 215 cm.";
      if (!e.peso && (identidade.peso < 45 || identidade.peso > 120))
        e.peso = "Peso entre 45 e 120 kg.";
      if (!e.posicao) e.posicao = "Selecione uma posição.";
    }
    definirErrosCampo(e);
    definirTocados({
      idade: true,
      altura: true,
      peso: true,
      posicao: true,
    });
    return Object.keys(e).length === 0;
  }

  useEffect(() => {
    const controle = new AbortController();
    definirCarregandoLigas(true);
    definirErroLigas(null);
    (async () => {
      try {
        const resposta = await fetch("/api/futebol/ligas", {
          signal: controle.signal,
        });
        if (!resposta.ok)
          throw new Error("Não foi possível carregar as ligas disponíveis.");
        const dados = esquemaLigasDisponiveis.parse(await resposta.json());
        if (!controle.signal.aborted) {
          definirLigas(dados.ligas);
          definirErroLigas(null);
        }
      } catch (falha) {
        if (!controle.signal.aborted)
          definirErroLigas(
            falha instanceof Error
              ? falha.message
              : "Falha ao carregar as ligas.",
          );
      } finally {
        if (!controle.signal.aborted) definirCarregandoLigas(false);
      }
    })();
    return () => controle.abort();
  }, [tentativaLigas]);

  useEffect(() => {
    definirClube("");
    definirBuscaClube("");
  }, [ligaId]);

  useEffect(() => {
    const controle = new AbortController();
    definirClubes([]);
    definirInicio("");
    definirAviso(null);
    if (!ligaId) {
      definirCarregando(false);
      return () => controle.abort();
    }
    definirCarregando(true);
    definirErroClubes(null);
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
          definirErroClubes(null);
        }
      } catch (falha) {
        if (!controle.signal.aborted)
          definirErroClubes(
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
    if (etapa === 0) {
      if (!validarIdentidadeCampos()) return;
    }
    if (etapa === 1) {
      if (!validarPerfilCampos()) return;
      const seedAtual = seed || crypto.randomUUID();
      if (!seed) definirSeed(seedAtual);
      const opcoes = sortearHistoria(seedAtual, identidade.posicao);
      definirEscolhas((atuais) =>
        Object.fromEntries(
          CAPITULOS.filter((c) =>
            opcoes[c].some((o) => o.id === atuais[c]),
          ).map((c) => [c, atuais[c]]),
        ),
      );
      definirCapitulo(0);
    }
    if (etapa === 3 && (!liga || carregando || clubes.length < 2)) {
      if (!liga) definirErrosCampo({ liga: "Selecione uma liga." });
      return;
    }
    if (etapa === 4 && !clube) {
      definirErrosCampo({ clube: "Selecione seu clube inicial." });
      return;
    }
    if (etapa === 2 && capitulo < 4) {
      if (!escolhas[CAPITULOS[capitulo]]) {
        definirErro("Escolha um caminho para continuar.");
        return;
      }
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
      // Carrega ligas do mundo em paralelo com concorrência limitada (evita dezenas de requests).
      const CONCORRENCIA = 4;
      const outras = ligas.filter((l) => l.id !== liga.id);
      for (let i = 0; i < outras.length; i += CONCORRENCIA) {
        const lote = outras.slice(i, i + CONCORRENCIA);
        const resultados = await Promise.all(
          lote.map(async (outra) => {
            const resposta = await fetch(
              `/api/futebol?liga=${encodeURIComponent(outra.id)}`,
            );
            if (resposta.status === 404) return null;
            if (!resposta.ok)
              throw new Error(
                `Não foi possível carregar ${outra.nome}. Tente novamente.`,
              );
            const dados = esquemaImportacao.parse(await resposta.json());
            return { liga: outra, clubes: dados.clubes as Clube[] };
          }),
        );
        for (const r of resultados) {
          if (!r) continue;
          ligasMundo.push(r.liga);
          clubesMundo.push(...r.clubes);
        }
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
      else
        definirErro(
          estado.erro ??
            "Não foi possível criar a carreira. Tente novamente.",
        );
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
  const ligasPorPais = ligas.reduce<Record<string, typeof ligas>>((acc, l) => {
    (acc[l.pais] ??= []).push(l);
    return acc;
  }, {});

  const tituloEtapa = [
    "Quem é você?",
    "Perfil em campo",
    capitulo >= 4 ? "História concluída" : "Sua história",
    "Escolha a liga",
    "Escolha o clube",
    "Confirmar carreira",
  ][etapa]!;

  const ctaContinuar =
    etapa === 2 && capitulo >= 4
      ? "Continuar para a liga"
      : etapa === 2 && capitulo < 3
        ? "Próximo capítulo"
        : etapa === 2
          ? "Concluir história"
          : "Continuar";

  return (
    <main className="vz-wizard">
      <header className="vz-wizard-head">
        <Link href="/" className="marca">
          viztto<span>.</span>
        </Link>
        <span className="rotulo">Nova carreira</span>
        <Link href="/" className="botao-texto">
          <ArrowLeft size={16} /> Voltar
        </Link>
      </header>

      <nav className="vz-wizard-steps" aria-label="Etapas da criação">
        {ETAPAS.map((nome, i) => (
          <div
            key={nome}
            className={i === etapa ? "atual" : i < etapa ? "concluida" : ""}
          >
            <span>
              {i < etapa ? <Check size={14} /> : String(i + 1).padStart(2, "0")}
            </span>
            {nome}
          </div>
        ))}
      </nav>

      <div className="vz-wizard-body">
        <section className="vz-wizard-main">
          <p className="vz-card-sub">
            Etapa {String(etapa + 1).padStart(2, "0")}
          </p>
          <h1>{tituloEtapa}</h1>

          {etapa === 0 && (
            <div className="vz-wizard-campos">
              <label>
                Nome
                <input
                  autoFocus
                  value={identidade.nome}
                  maxLength={30}
                  onChange={(e) => alterar("nome", e.target.value)}
                  onBlur={() => tocar("nome")}
                  placeholder="Seu nome"
                  aria-invalid={!!(tocados.nome && errosCampo.nome)}
                />
                {errosCampo.nome && (
                  <span className="vz-campo-erro">{errosCampo.nome}</span>
                )}
              </label>
              <label>
                Sobrenome
                <input
                  value={identidade.sobrenome}
                  maxLength={40}
                  onChange={(e) => alterar("sobrenome", e.target.value)}
                  onBlur={() => tocar("sobrenome")}
                  placeholder="Seu sobrenome"
                  aria-invalid={!!errosCampo.sobrenome}
                />
                {errosCampo.sobrenome && (
                  <span className="vz-campo-erro">{errosCampo.sobrenome}</span>
                )}
              </label>
              <label className="campo-inteiro">
                Nacionalidade
                <input
                  value={identidade.nacionalidade}
                  maxLength={40}
                  onChange={(e) => alterar("nacionalidade", e.target.value)}
                  onBlur={() => tocar("nacionalidade")}
                  aria-invalid={!!errosCampo.nacionalidade}
                />
                {errosCampo.nacionalidade && (
                  <span className="vz-campo-erro">
                    {errosCampo.nacionalidade}
                  </span>
                )}
              </label>
            </div>
          )}

          {etapa === 1 && (
            <div className="vz-wizard-perfil">
              <label>
                Idade
                <input
                  type="number"
                  min={15}
                  max={40}
                  value={identidade.idade}
                  onChange={(e) => alterar("idade", Number(e.target.value))}
                  onBlur={() => tocar("idade")}
                  aria-invalid={!!(tocados.idade && errosCampo.idade)}
                />
                {tocados.idade && errosCampo.idade && (
                  <span className="vz-campo-erro">{errosCampo.idade}</span>
                )}
              </label>
              <div className="vz-segmented" role="group" aria-label="Pé dominante">
                {(
                  [
                    ["direito", "Direito"],
                    ["esquerdo", "Esquerdo"],
                    ["ambos", "Ambos"],
                  ] as const
                ).map(([v, rotulo]) => (
                  <button
                    key={v}
                    type="button"
                    className={identidade.peDominante === v ? "ativo" : ""}
                    aria-pressed={identidade.peDominante === v}
                    onClick={() => alterar("peDominante", v)}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>

              <div className="vz-pos-grupos">
                {(
                  [
                    ["Goleiro", ["GOL"]],
                    ["Defesa", ["LD", "ZAG", "LE"]],
                    ["Meio", ["VOL", "MC", "MEI"]],
                    ["Ataque", ["PD", "PE", "CA"]],
                  ] as const
                ).map(([grupo, codigos]) => (
                  <div key={grupo}>
                    <span className="vz-card-sub">{grupo}</span>
                    <div className="vz-pos-grid">
                      {codigos.map((codigo) => (
                        <button
                          key={codigo}
                          type="button"
                          className={
                            identidade.posicao === codigo ? "ativo" : ""
                          }
                          aria-pressed={identidade.posicao === codigo}
                          onClick={() =>
                            alterar(
                              "posicao",
                              codigo as IdentidadeJogador["posicao"],
                            )
                          }
                        >
                          <b>{codigo}</b>
                          <span>{POSICOES[codigo]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {errosCampo.posicao && (
                  <span className="vz-campo-erro" role="alert">
                    {errosCampo.posicao}
                  </span>
                )}
              </div>

              <label className="vz-campo-select">
                Posição secundária
                <select
                  className="vz-select-compacto"
                  value={identidade.posicaoSecundaria}
                  onChange={(e) =>
                    alterar(
                      "posicaoSecundaria",
                      e.target.value as IdentidadeJogador["posicaoSecundaria"],
                    )
                  }
                  onBlur={() => tocar("posicaoSecundaria")}
                  aria-invalid={!!errosCampo.posicaoSecundaria}
                  disabled={POSICOES_ALTERNATIVAS[identidade.posicao].length === 0}
                >
                  <option value="">Nenhuma</option>
                  {POSICOES_ALTERNATIVAS[identidade.posicao].map((codigo) => (
                    <option key={codigo} value={codigo}>
                      {codigo} — {POSICOES[codigo]}
                    </option>
                  ))}
                </select>
                {POSICOES_ALTERNATIVAS[identidade.posicao].length === 0 && (
                  <span className="texto-suave">Goleiros não usam posição secundária.</span>
                )}
                {errosCampo.posicaoSecundaria && (
                  <span className="vz-campo-erro">
                    {errosCampo.posicaoSecundaria}
                  </span>
                )}
              </label>

              <div className="vz-wizard-fisico">
                <label>
                  Altura (cm)
                  <input
                    type="number"
                    min={150}
                    max={215}
                    value={identidade.altura}
                    onChange={(e) => alterar("altura", Number(e.target.value))}
                    onBlur={() => tocar("altura")}
                    aria-invalid={!!(tocados.altura && errosCampo.altura)}
                  />
                  {tocados.altura && errosCampo.altura && (
                    <span className="vz-campo-erro">{errosCampo.altura}</span>
                  )}
                </label>
                <label>
                  Peso (kg)
                  <input
                    type="number"
                    min={45}
                    max={120}
                    value={identidade.peso}
                    onChange={(e) => alterar("peso", Number(e.target.value))}
                    onBlur={() => tocar("peso")}
                    aria-invalid={!!(tocados.peso && errosCampo.peso)}
                  />
                  {tocados.peso && errosCampo.peso && (
                    <span className="vz-campo-erro">{errosCampo.peso}</span>
                  )}
                </label>
              </div>
            </div>
          )}

          {etapa === 2 && seed && (
            <SuaHistoria
              seed={seed}
              identidade={identidade}
              capitulo={capitulo}
              escolhas={escolhas}
              escolher={(c, id) =>
                definirEscolhas((atuais) => ({ ...atuais, [c]: id }))
              }
            />
          )}

          {etapa === 3 && (
            <div className="vz-ligas">
              {carregandoLigas && (
                <div className="vz-skel-grid" aria-busy="true">
                  {Array.from({ length: 6 }, (_, i) => (
                    <div key={i} className="vz-skel" />
                  ))}
                </div>
              )}
              {!carregandoLigas &&
                Object.entries(ligasPorPais).map(([pais, lista]) => (
                  <div key={pais} className="vz-liga-pais">
                    <h3>{pais}</h3>
                    <div className="vz-liga-row">
                      {lista.map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          aria-pressed={ligaId === l.id}
                          className={`vz-liga-card${ligaId === l.id ? " selecionada" : ""}`}
                          onClick={() => definirLiga(l.id)}
                        >
                          <span className={`bandeira bandeira-${l.bandeira.toLowerCase()}`}>
                            {l.bandeira}
                          </span>
                          <strong>{l.nome}</strong>
                          <span>
                            {l.clubesDisponiveis} clubes
                            {l.divisao ? ` · Div. ${l.divisao}` : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              {!carregandoLigas && !ligas.length && (
                <p className="estado-vazio">Nenhuma liga disponível.</p>
              )}
              {erroLigas && (
                <p className="aviso erro" role="alert">
                  {erroLigas}{" "}
                  <button
                    type="button"
                    className="botao-texto"
                    onClick={() => definirTentativaLigas((t) => t + 1)}
                  >
                    Tentar novamente
                  </button>
                </p>
              )}
              {errosCampo.liga && (
                <p className="vz-campo-erro" role="alert">
                  {errosCampo.liga}
                </p>
              )}
              {aviso && (
                <p className="aviso" role="status">
                  {aviso}
                </p>
              )}
            </div>
          )}

          {etapa === 4 && (
            <div className="vz-clube-sel">
              <div className="vz-clube-lista">
                <div className="linha-titulo">
                  <span className="rotulo">{liga?.nome}</span>
                  <button
                    type="button"
                    className="botao-texto"
                    disabled={carregando}
                    onClick={() => definirTentativa((t) => t + 1)}
                  >
                    <RefreshCw size={14} /> Recarregar
                  </button>
                </div>
                <label className="vz-busca-clube">
                  <span className="sr-only">Buscar clube</span>
                  <input
                    type="search"
                    placeholder="Buscar clube…"
                    value={buscaClube}
                    onChange={(e) => definirBuscaClube(e.target.value)}
                    disabled={carregando}
                  />
                </label>
                {erroClubes && (
                  <p className="aviso erro" role="alert">
                    {erroClubes}{" "}
                    <button
                      type="button"
                      className="botao-texto"
                      onClick={() => definirTentativa((t) => t + 1)}
                    >
                      Tentar novamente
                    </button>
                  </p>
                )}
                {errosCampo.clube && (
                  <p className="vz-campo-erro" role="alert">
                    {errosCampo.clube}
                  </p>
                )}
                {carregando ? (
                  <div className="vz-skel-lista" aria-busy="true">
                    {Array.from({ length: 8 }, (_, i) => (
                      <div key={i} className="vz-skel" />
                    ))}
                  </div>
                ) : (
                  <div className="vz-clube-scroll">
                    {clubesFiltrados.length === 0 ? (
                      <p className="vz-empty">Nenhum clube com esse filtro.</p>
                    ) : (
                      clubesFiltrados.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          aria-pressed={clubeId === c.id}
                          className={`vz-clube-item${clubeId === c.id ? " selecionada" : ""}`}
                          onClick={() => {
                            definirClube(c.id);
                            definirErrosCampo((e) => {
                              const n = { ...e };
                              delete n.clube;
                              return n;
                            });
                          }}
                        >
                          <Escudo clube={c} tamanho={32} />
                          <span>
                            {c.nome}
                            <small>{c.codigo}</small>
                          </span>
                          <b>{c.forcaGeral}</b>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <aside className="vz-clube-detalhe">
                {clube ? (
                  <>
                    <Escudo clube={clube} tamanho={64} />
                    <h2>{clube.nome}</h2>
                    <p>{liga?.nome}</p>
                    <dl className="ficha">
                      <div>
                        <dt>Força</dt>
                        <dd>{clube.forcaGeral}</dd>
                      </div>
                      <div>
                        <dt>Estádio</dt>
                        <dd>{clube.estadio}</dd>
                      </div>
                      <div>
                        <dt>Elenco</dt>
                        <dd>{clube.elenco.length} jogadores</dd>
                      </div>
                      <div>
                        <dt>Início</dt>
                        <dd>
                          {identidade.idade < 17
                            ? "Categoria de base"
                            : "Elenco profissional"}
                        </dd>
                      </div>
                    </dl>
                  </>
                ) : (
                  <p className="vz-empty">Selecione um clube na lista.</p>
                )}
              </aside>
            </div>
          )}

          {etapa === 5 && (
            <div className="vz-confirm">
              <div className="vz-confirm-card">
                <p className="vz-card-sub">Jogador</p>
                <h2>
                  {identidade.nome} {identidade.sobrenome}
                </h2>
                <p>
                  {identidade.idade} anos · {POSICOES[identidade.posicao]} · Pé{" "}
                  {identidade.peDominante} · {identidade.altura} cm
                </p>
              </div>
              <div className="vz-confirm-card">
                <p className="vz-card-sub">Clube</p>
                {clube && (
                  <div className="vz-confirm-clube">
                    <Escudo clube={clube} tamanho={40} />
                    <div>
                      <h3>{clube.nome}</h3>
                      <p>
                        {liga?.nome}
                        {identidade.idade < 17 ? " · Base" : ""}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              {CAPITULOS.every((c) => escolhas[c]) && (
                <div className="vz-confirm-card">
                  <p className="vz-card-sub">Sua história</p>
                  <dl className="vz-confirm-hist">
                    {(["Origem", "Destaque", "Dificuldade", "Chegada"] as const).map(
                      (rotulo, i) => {
                        const chave = CAPITULOS[i]!;
                        const resumo = resumirHistoria(
                          escolhas as EscolhasHistoria,
                        );
                        return (
                          <div key={chave}>
                            <dt>{rotulo}</dt>
                            <dd>{resumo.opcoes[i]?.titulo}</dd>
                          </div>
                        );
                      },
                    )}
                  </dl>
                </div>
              )}
              <div className="vz-confirm-card">
                <p className="vz-card-sub">Temporada</p>
                <p>
                  {formatarTemporada(
                    liga?.id ?? "",
                    Number(inicio.slice(0, 4)),
                  )}
                </p>
              </div>
              {existente && (
                <label className="vz-confirm-check">
                  <input
                    type="checkbox"
                    checked={substituir}
                    onChange={(e) => definirSubstituir(e.target.checked)}
                  />
                  {saveIncompativel
                    ? "Substituir a carreira antiga do servidor"
                    : "Substituir a carreira atual"}
                </label>
              )}
              {existente && saveIncompativel && !substituir && (
                <p className="aviso" role="status">
                  Existe uma carreira antiga no servidor que não abre nesta
                  versão. Marque a opção acima para criar uma nova no lugar.
                </p>
              )}
            </div>
          )}

          <EstadoPersistencia />
          {erro && (
            <p role="alert" className="aviso erro">
              {erro}
            </p>
          )}
        </section>

        <aside className="vz-wizard-preview">
          <div className="vz-preview-camisa" aria-hidden>
            <span>{identidade.posicao === "GOL" ? "1" : "10"}</span>
          </div>
          <p className="vz-card-sub">
            {identidade.idade < 17
              ? "Início de carreira · Base"
              : "Elenco profissional"}
          </p>
          <h2>
            {(identidade.nome || "Seu nome").trim()}
            <br />
            <span>{(identidade.sobrenome || "Sobrenome").trim()}</span>
          </h2>
          <div className="perfil-resumo">
            <b>{identidade.posicao}</b>
            <span>{identidade.idade} anos</span>
            <span>{identidade.nacionalidade}</span>
          </div>
          {identidade.idade < 17 ? (
            <p className="vz-preview-nota">
              Você começa na categoria de base. A promoção depende da comissão
              técnica.
            </p>
          ) : (
            <p className="vz-preview-nota">
              Você disputa espaço no elenco profissional desde o início.
            </p>
          )}
          {clube && (
            <div className="preview-clube">
              <Escudo clube={clube} tamanho={28} />
              <span>{clube.nome}</span>
            </div>
          )}
        </aside>
      </div>

      <footer className="vz-wizard-foot">
        <button
          type="button"
          className="botao-texto"
          disabled={etapa === 0 || confirmando}
          onClick={() => {
            if (etapa === 2 && capitulo > 0) definirCapitulo(capitulo - 1);
            else definirEtapa(etapa - 1);
            definirErro(null);
          }}
        >
          <ArrowLeft size={17} /> Voltar
        </button>
        {etapa < 5 ? (
          <button
            type="button"
            className="botao principal"
            disabled={
              (etapa === 3 && (!liga || carregando || clubes.length < 2)) ||
              (etapa === 4 && (!clube || carregando))
            }
            onClick={avancar}
          >
            {ctaContinuar} <ArrowRight size={18} />
          </button>
        ) : (
          <button
            type="button"
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
            {confirmando ? "Criando seu mundo…" : "Iniciar carreira"}{" "}
            <ArrowRight size={18} />
          </button>
        )}
      </footer>

      {confirmando && (
        <div className="vz-wizard-overlay" role="status" aria-live="polite">
          <p className="vz-card-sub">Preparando</p>
          <h2>Criando seu mundo…</h2>
          <ul>
            <li>Carregando clubes</li>
            <li>Preparando competições</li>
            <li>Montando calendário</li>
          </ul>
        </div>
      )}
    </main>
  );
}

