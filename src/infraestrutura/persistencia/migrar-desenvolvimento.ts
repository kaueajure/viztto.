import { criarAcompanhamento, criarCentroTreinamento, criarCooldownsTreinador, criarPreparacao } from '@/dominio/desenvolvimento';
import type { CooldownsTreinador } from '@/dominio/desenvolvimento';

function normalizarAcompanhamento(valor: unknown): unknown {
  if (!valor || typeof valor !== 'object') return criarAcompanhamento();
  const a = { ...(valor as Record<string, unknown>) };

  const proxima = typeof a.proximaConversa === 'string' ? a.proximaConversa : null;
  delete a.proximaConversa;

  if (!a.cooldownsTreinador || typeof a.cooldownsTreinador !== 'object') {
    a.cooldownsTreinador = criarCooldownsTreinador(proxima);
  } else {
    const bruto = a.cooldownsTreinador as Record<string, unknown>;
    const normalizado = criarCooldownsTreinador(null);
    for (const chave of Object.keys(normalizado) as (keyof CooldownsTreinador)[]) {
      const v = bruto[chave];
      normalizado[chave] = typeof v === 'string' || v === null ? (v as string | null) : null;
    }
    // Se o save antigo só tinha proximaConversa global e o mapa veio vazio/parcial sem datas, herda o legado.
    if (proxima && Object.values(normalizado).every(v => v === null)) {
      a.cooldownsTreinador = criarCooldownsTreinador(proxima);
    } else {
      a.cooldownsTreinador = normalizado;
    }
  }

  if (a.papelAceito === undefined) a.papelAceito = null;

  if (!Array.isArray(a.historicoObjetivos)) a.historicoObjetivos = [];

  if (a.objetivoPessoal && typeof a.objetivoPessoal === 'object') {
    const o = { ...(a.objetivoPessoal as Record<string, unknown>) };
    if (typeof o.cicloId !== 'string' || !o.cicloId) {
      o.cicloId = `legado-${String(o.tipo ?? 'objetivo')}-${String(o.inicio ?? 's/d')}`;
    }
    a.objetivoPessoal = o;
  }

  if (a.resumoSemanal && typeof a.resumoSemanal === 'object') {
    const r = { ...(a.resumoSemanal as Record<string, unknown>) };
    if (r.mudancaElenco === undefined) r.mudancaElenco = null;
    a.resumoSemanal = r;
  }

  if (a.adaptacao && typeof a.adaptacao === 'object') {
    const ad = { ...(a.adaptacao as Record<string, unknown>) };
    if (ad.status === 'concluida') ad.status = 'secundaria';
    a.adaptacao = ad;
  }

  return a;
}

/** Defaults neutros e migração segura de campos do acompanhamento. Nunca recalcula atributos. */
export function migrarDesenvolvimento(valor: unknown, persistido = false): unknown {
  if (!valor || typeof valor !== 'object') return valor;
  const c = valor as Record<string, unknown>;

  let resultado: Record<string, unknown> = c;
  if ((persistido && c.versao === 3) || (!persistido && c.versao === 2)) {
    if (!c.jogador || typeof c.jogador !== 'object') return valor;
    const j = c.jogador as Record<string, unknown>;
    resultado = {
      ...c,
      ...(persistido ? { versao: 4 } : {}),
      acompanhamento: c.acompanhamento ?? criarAcompanhamento(),
      jogador: {
        ...j,
        perfilFormacao: j.perfilFormacao ?? { origem: 'legado' },
        preparacao: j.preparacao ?? criarPreparacao(),
      },
    };
  }

  if (resultado.acompanhamento !== undefined && resultado.acompanhamento !== null) {
    resultado = { ...resultado, acompanhamento: normalizarAcompanhamento(resultado.acompanhamento) };
  }

  // Fase 10: agente livre — saves antigos sem os campos recebem defaults.
  if (!Object.hasOwn(resultado, "agenteLivreDesde"))
    resultado = { ...resultado, agenteLivreDesde: null };
  if (!Object.hasOwn(resultado, "ultimoClubeId"))
    resultado = { ...resultado, ultimoClubeId: null };
  if (!Object.hasOwn(resultado, "historicoContratos"))
    resultado = { ...resultado, historicoContratos: [] };

  // Centro de treinamento: saves sem `centro` hidratam vazios.
  if (resultado.jogador && typeof resultado.jogador === "object") {
    const j = resultado.jogador as Record<string, unknown>;
    if (j.preparacao && typeof j.preparacao === "object") {
      const prep = { ...(j.preparacao as Record<string, unknown>) };
      if (!prep.centro || typeof prep.centro !== "object") {
        prep.centro = criarCentroTreinamento();
        resultado = { ...resultado, jogador: { ...j, preparacao: prep } };
      } else {
        const centro = { ...(prep.centro as Record<string, unknown>) };
        if (!centro.progressoAtributos || typeof centro.progressoAtributos !== "object")
          centro.progressoAtributos = {};
        if (!centro.melhoresExercicios || typeof centro.melhoresExercicios !== "object")
          centro.melhoresExercicios = {};
        if (!centro.semana || typeof centro.semana !== "object") {
          centro.semana = { chave: "", sessoes: [] };
        } else {
          const sem = { ...(centro.semana as Record<string, unknown>) };
          if (typeof sem.chave !== "string") sem.chave = "";
          if (!Array.isArray(sem.sessoes)) sem.sessoes = [];
          centro.semana = sem;
        }
        prep.centro = centro;
        resultado = { ...resultado, jogador: { ...j, preparacao: prep } };
      }
    }
  }

  return resultado;
}
