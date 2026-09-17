import { LIGAS_SUPORTADAS } from "@/dominio/constantes/ligas";
import { esquemaDadosLigaImportados } from "@/infraestrutura/transfermarkt/esquemas";

/** Valida bytes do índice Git, não arquivos locais que talvez não entrem no commit. */
export async function validarSnapshotsVersionados(
  ler: (caminho: string) => Promise<string | null>,
): Promise<{ layout: "legado" | "release"; ligas: number }> {
  const raiz = "src/dados/futebol";
  const texto = await ler(`${raiz}/active.json`);
  let origem = raiz;
  if (texto !== null) {
    const ativo = JSON.parse(texto);
    const esperadas = LIGAS_SUPORTADAS.map((l) => l.id);
    if (
      ativo.versao !== 1 ||
      typeof ativo.releaseId !== "string" ||
      !/^r-[a-zA-Z0-9._-]+$/.test(ativo.releaseId) ||
      !Array.isArray(ativo.ligas) ||
      ativo.ligas.length !== esperadas.length ||
      new Set(ativo.ligas).size !== esperadas.length ||
      ativo.ligas.some((id: string) => !esperadas.includes(id))
    )
      throw new Error("Manifesto versionado inválido ou incompleto");
    origem = `${raiz}/releases/${ativo.releaseId}`;
    for (const id of esperadas)
      if ((await ler(`${raiz}/${id}.json`)) !== null)
        throw new Error(
          "Remova os snapshots legados do índice após migrar para releases",
        );
  }
  let total = 0;
  for (const liga of LIGAS_SUPORTADAS) {
    const caminho = `${origem}/${liga.id}.json`;
    const bruto = await ler(caminho);
    // Antes da primeira release, o runtime já suporta ligas legadas indisponíveis.
    if (bruto === null && texto === null) continue;
    if (bruto === null) throw new Error(`Snapshot ausente no Git: ${caminho}`);
    total++;
    const dados = esquemaDadosLigaImportados.parse(JSON.parse(bruto));
    if (dados.ligaId !== liga.id) throw new Error(`Liga incorreta: ${caminho}`);
  }
  if (!total) throw new Error("Nenhum snapshot versionado");
  return { layout: texto === null ? "legado" : "release", ligas: total };
}
