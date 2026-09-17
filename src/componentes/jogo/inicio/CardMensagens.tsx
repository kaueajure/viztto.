import Link from "next/link";
import type { EstadoCarreira } from "@/dominio/entidades/modelos";
import { tempoRelativoNoticia } from "@/utilitarios/apresentacao-carreira";
import { Building2, Briefcase, ClipboardList, Newspaper } from "lucide-react";
import type { LucideIcon } from "lucide-react";

function iconeRemetente(remetente: string): LucideIcon {
  const r = remetente.toLowerCase();
  if (r.includes("diretor")) return Building2;
  if (r.includes("empres") || r.includes("agente")) return Briefcase;
  if (r.includes("comissão") || r.includes("treinador") || r.includes("técnic"))
    return ClipboardList;
  return Newspaper;
}

export function CardMensagens({ carreira: c }: { carreira: EstadoCarreira }) {
  const naoLidas = c.noticias.filter((n) => !n.lida).length;
  const itens = c.noticias.slice(0, 3);

  return (
    <section className="vz-card vz-mensagens">
      <header className="vz-card-head">
        <h3>
          MENSAGENS
          {naoLidas > 0 && (
            <span className="vz-badge" aria-label={`${naoLidas} não lidas`}>
              {naoLidas}
            </span>
          )}
        </h3>
      </header>
      {itens.length === 0 ? (
        <p className="vz-empty">Nenhuma mensagem no momento.</p>
      ) : (
        <ul className="vz-msg-lista">
          {itens.map((n) => {
            const Icone = iconeRemetente(n.remetente);
            return (
              <li key={n.id} className={n.lida ? "" : "nao-lida"}>
                <span className="vz-msg-icone" aria-hidden="true">
                  <Icone size={16} strokeWidth={1.8} />
                </span>
                <div>
                  <b>{n.remetente}</b>
                  <p>{n.titulo}</p>
                </div>
                <time>{tempoRelativoNoticia(n.data, c.dataAtual)}</time>
              </li>
            );
          })}
        </ul>
      )}
      <Link href="/carreira/noticias" className="vz-card-link">
        Ver todas as mensagens →
      </Link>
    </section>
  );
}
