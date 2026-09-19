import type { Clube, LinhaClassificacao } from "@/dominio/entidades/modelos";
import { Escudo } from "@/componentes/clube/Escudo";
import {
  classeZonaClassificacao,
  legendasZonaClassificacao,
  obterZonaClassificacao,
  type OpcoesZonaClassificacao,
} from "@/dominio/constantes/zonas-classificacao";

export function TabelaLiga({
  linhas,
  clubes,
  clubeAtualId,
  compacta = false,
  ligaId,
  temporadaEncerrada = false,
  ligasNoUniverso,
}: {
  linhas: LinhaClassificacao[];
  clubes: Clube[];
  clubeAtualId: string | null;
  compacta?: boolean;
  /** Quando omitido, a tabela não aplica zonas (histórico legado / compacta). */
  ligaId?: string;
  temporadaEncerrada?: boolean;
  ligasNoUniverso?: readonly string[];
}) {
  const opcoes: OpcoesZonaClassificacao | null =
    ligaId && ligasNoUniverso
      ? { temporadaEncerrada, ligasNoUniverso }
      : null;
  const legendas = opcoes
    ? legendasZonaClassificacao(ligaId!, opcoes)
    : [];

  return (
    <div className="tabela-classificacao-bloco">
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
              {opcoes && !compacta && <th scope="col">Zona</th>}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const c = clubes.find((c) => c.id === l.clubeId)!;
              const zona = opcoes
                ? obterZonaClassificacao(ligaId!, l.posicao, opcoes)
                : { tipo: "normal" as const, label: "" };
              const classeZona = classeZonaClassificacao(zona.tipo);
              const classes = [
                l.clubeId === clubeAtualId ? "meu-clube" : "",
                classeZona,
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <tr
                  key={l.clubeId}
                  className={classes}
                  aria-label={
                    zona.label
                      ? `${l.posicao}º ${c.nome}, ${zona.label}`
                      : undefined
                  }
                >
                  <td>
                    <span className="pos-marcador" aria-hidden="true" />
                    {String(l.posicao).padStart(2, "0")}
                  </td>
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
                  {opcoes && !compacta && (
                    <td className="zona-rotulo">
                      {zona.label || "—"}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {legendas.length > 0 && !compacta && (
        <ul className="legenda-zonas" aria-label="Legenda da classificação">
          {legendas.map((z) => (
            <li key={z.tipo} className={classeZonaClassificacao(z.tipo)}>
              <span className="legenda-ponto" aria-hidden="true" />
              {z.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
