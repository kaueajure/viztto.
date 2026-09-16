"use client";
import type { PropostaTransferencia } from "@/dominio/entidades/modelos";
import { PAPEIS_MERCADO, type TermosContrato } from "@/dominio/mercado";
import { useJogoStore } from "@/estado/jogo-store";
export function Contraproposta({
  proposta: p,
  clube,
}: {
  proposta: PropostaTransferencia;
  clube: string;
}) {
  const contrapropor = useJogoStore((s) => s.contrapropor);
  if (p.contrapropostaPendente)
    return (
      <p role="status">
        Contraproposta enviada. Avance uma semana para receber a resposta.
      </p>
    );
  if (!["proposta_jogador", "negociacao"].includes(p.etapa)) return null;
  if ((p.rodadasNegociacao ?? 0) >= 3)
    return <p>Oferta final: aceite ou rejeite os termos.</p>;
  return (
    <details className="negociar-oferta">
      <summary>
        Negociar com {clube} · {3 - (p.rodadasNegociacao ?? 0)} rodadas
        disponíveis
      </summary>
      <form
        className="espaco"
        aria-label={`Contraproposta para ${clube}`}
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          contrapropor(p.id, {
            salario: Number(f.get("salario")),
            duracaoAnos: Number(f.get("anos")),
            papelPrometido: f.get("papel") as TermosContrato["papelPrometido"],
            clausulaRescisao: f.get("clausula")
              ? Number(f.get("clausula"))
              : undefined,
          });
        }}
      >
        <fieldset className="campos mercado-campos">
          <legend>
            Sua contraproposta · preencha salário, duração e papel
          </legend>
          <label>
            Salário semanal (€)
            <input
              name="salario"
              type="number"
              min="1"
              step="1"
              required
              defaultValue={p.salario}
            />
          </label>
          <label>
            Duração (anos)
            <input
              name="anos"
              type="number"
              min="1"
              max="5"
              required
              defaultValue={p.duracaoAnos}
            />
          </label>
          <label>
            Papel esperado
            <select name="papel" defaultValue={p.papelPrometido}>
              {PAPEIS_MERCADO.map((papel) => (
                <option key={papel} value={papel}>
                  {papel.replace("rotacao", "rotação")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Cláusula de rescisão (€ · opcional)
            <input
              name="clausula"
              type="number"
              min="1"
              step="1"
              defaultValue={p.clausulaRescisao ?? ""}
            />
          </label>
        </fieldset>
        <button className="botao principal" type="submit">
          Enviar contraproposta
        </button>
      </form>
    </details>
  );
}
