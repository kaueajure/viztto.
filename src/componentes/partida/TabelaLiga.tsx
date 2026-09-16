import type { Clube, LinhaClassificacao } from "@/dominio/entidades/modelos";
import { Escudo } from "@/componentes/clube/Escudo";
export function TabelaLiga({
  linhas,
  clubes,
  clubeAtualId,
  compacta = false,
}: {
  linhas: LinhaClassificacao[];
  clubes: Clube[];
  clubeAtualId: string;
  compacta?: boolean;
}) {
  return (
    <div className="tabela-rolagem">
      <table className={`tabela-liga ${compacta ? "compacta" : ""}`}>
        <thead>
          <tr>
            <th scope="col">Pos</th>
            <th scope="col">Clube</th>
            <th scope="col">J</th>
            {!compacta && (
              <>
                <th scope="col">V</th>
                <th scope="col">E</th>
                <th scope="col">D</th>
                <th scope="col">GP</th>
                <th scope="col">GC</th>
              </>
            )}
            <th scope="col">SG</th>
            <th scope="col">PTS</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => {
            const c = clubes.find((c) => c.id === l.clubeId)!;
            return (
              <tr
                key={l.clubeId}
                className={l.clubeId === clubeAtualId ? "meu-clube" : ""}
              >
                <td>{String(l.posicao).padStart(2, "0")}</td>
                <td>
                  <div className="nome-clube">
                    <Escudo clube={c} tamanho={23} />
                    <span>{c.nome}</span>
                  </div>
                </td>
                <td>{l.jogos}</td>
                {!compacta && (
                  <>
                    <td>{l.vitorias}</td>
                    <td>{l.empates}</td>
                    <td>{l.derrotas}</td>
                    <td>{l.golsPro}</td>
                    <td>{l.golsContra}</td>
                  </>
                )}
                <td>
                  {l.saldo > 0 ? "+" : ""}
                  {l.saldo}
                </td>
                <td>
                  <b>{l.pontos}</b>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
