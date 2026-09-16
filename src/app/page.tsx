"use client";
import { formatarTemporada } from "@/dominio/constantes/temporadas-iniciais";
import { useFocoModal } from "@/componentes/interface/useFocoModal";
import Link from "next/link";
import { ArrowUpRight, Play, ArrowRight, Trash2 } from "lucide-react";
import { useJogoStore } from "@/estado/jogo-store";
import { useState } from "react";
export default function Inicio() {
  const { carreira, hidratado, excluir, erro } = useJogoStore();
  const [confirmar, definirConfirmar] = useState(false);
  useFocoModal(confirmar, () => definirConfirmar(false));
  return (
    <main className="tela-inicial">
      <header className="cabecalho-inicial">
        <span className="marca">
          viztto<span>.</span>
        </span>
        <span className="rotulo">FUTEBOL / MODO CARREIRA</span>
        <span className="edicao">EDIÇÃO 01</span>
      </header>
      <div className="campo-abertura" aria-hidden="true">
        <div className="linha-meio" />
        <div className="circulo-central" />
        <div className="area-gol" />
        <div className="area-pequena" />
        <span className="numero-camisa">10</span>
        <span className="legenda-campo">
          O PRÓXIMO CAPÍTULO
          <br />
          COMEÇA DENTRO DE CAMPO.
        </span>
      </div>
      <section className="abertura-conteudo">
        <p className="sobretitulo">
          <span className="ponto" /> SIMULADOR DE CARREIRA
        </p>
        <h1>
          SUA CARREIRA.
          <br />
          <span>SUA HISTÓRIA.</span>
        </h1>
        <p className="abertura-descricao">
          Da primeira oportunidade ao último apito.
          <br />O futebol acontece. Você constrói seu caminho.
        </p>
        <div className="acoes-iniciais">
          <Link className="botao principal" href="/nova-carreira">
            Nova carreira <ArrowUpRight size={22} />
          </Link>
          {hidratado && carreira ? (
            <Link className="botao secundario" href="/carreira">
              <Play size={17} /> Continuar carreira <ArrowRight size={20} />
            </Link>
          ) : (
            <button className="botao secundario" disabled>
              {hidratado ? "Continuar carreira" : "Carregando carreira…"}
            </button>
          )}
        </div>
        {carreira && (
          <p className="save-resumo">
            {carreira.jogador.nome} {carreira.jogador.sobrenome}{" "}
            <span> / </span>{" "}
            {formatarTemporada(carreira.liga.id, carreira.temporada.ano)}{" "}
            <span> / </span> Rodada {carreira.temporada.rodadaAtual}
          </p>
        )}
        {erro && (
          <p role="alert" className="aviso erro">
            {erro}
          </p>
        )}
        {hidratado && (carreira || erro) && (
          <button
            className="botao-texto excluir-inicio"
            onClick={() => definirConfirmar(true)}
          >
            <Trash2 size={14} /> Excluir carreira
          </button>
        )}
      </section>
      <footer className="rodape-inicial">
        <span>UM JOGADOR. UM MUNDO INTEIRO.</span>
        <span>SIMULAÇÃO • ESTRATÉGIA • FUTEBOL</span>
      </footer>
      {confirmar && (
        <div className="sobreposicao">
          <section
            className="dialogo"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="titulo-excluir"
          >
            <h2 id="titulo-excluir">Excluir carreira?</h2>
            <p>Todo o progresso salvo neste navegador será apagado.</p>
            <div className="acoes">
              <button
                className="botao secundario"
                onClick={() => definirConfirmar(false)}
              >
                Cancelar
              </button>
              <button
                className="botao perigo"
                onClick={() => {
                  excluir();
                  definirConfirmar(false);
                }}
              >
                Excluir carreira
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
