import type { Estatisticas } from "@/dominio/entidades/modelos";
export function Barra({ nome, valor }: { nome: string; valor: number }) {
  return (
    <div className="indicador">
      <div>
        <span>{nome}</span>
        <b>{Math.round(valor)}</b>
      </div>
      <div className="trilho">
        <span style={{ width: `${Math.min(100, Math.max(0, valor))}%` }} />
      </div>
    </div>
  );
}
export function EstatisticasLinha({
  estatisticas: e,
}: {
  estatisticas: Estatisticas;
}) {
  return (
    <div className="estatisticas-linha">
      {[
        [e.jogos, "Jogos"],
        [e.gols, "Gols"],
        [e.assistencias, "Assistências"],
        [e.jogos ? (e.somaNotas / e.jogos).toFixed(2) : "—", "Nota média"],
      ].map(([valor, rotulo]) => (
        <div key={rotulo}>
          <strong>{valor}</strong>
          <span>{rotulo}</span>
        </div>
      ))}
    </div>
  );
}
export function Vazio({ texto }: { texto: string }) {
  return <p className="estado-vazio">{texto}</p>;
}
