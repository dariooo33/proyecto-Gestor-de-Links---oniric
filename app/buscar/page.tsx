"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import styles from "./page.module.css";

interface Resultado {
  tipo: "carpeta" | "recurso" | "categoria" | "usuario";
  id: string;
  titulo: string;
  subtitulo?: string;
  extra?: string;
}

const ICONOS: Record<string, string> = {
  carpeta: "📁", recurso: "📄", categoria: "🏷️", usuario: "👤",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

export default function BuscarPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") ?? "";

  const [userId, setUserId] = useState<string | null>(null);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState<string>("todos");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login"); return; }
      setUserId(session.user.id);
    });
  }, [router]);

  const buscar = useCallback(async () => {
    if (!query.trim() || !userId) return;
    setLoading(true);
    const term = query.trim();
    const resultados: Resultado[] = [];

    const [carpetasRes, recursosRes, categoriasRes, usuariosRes] = await Promise.all([
      supabase.from("Carpetas").select("carpeta_id, nombre, user_id, publica, created_at")
        .ilike("nombre", `%${term}%`).or(`user_id.eq.${userId},publica.eq.true`).limit(20),
      supabase.from("Recursos").select("recurso_id, nombre, created_at")
        .eq("user_id", userId).ilike("nombre", `%${term}%`).limit(20),
      supabase.from("Categorias").select("categoria_id, nombre, descripcion").ilike("nombre", `%${term}%`).limit(10),
      supabase.from("Usuario").select("user_id, nombre, email, created_at")
        .neq("user_id", userId).or(`nombre.ilike.%${term}%,email.ilike.%${term}%`).limit(10),
    ]);

    (carpetasRes.data ?? []).forEach((c: any) => resultados.push({
      tipo: "carpeta", id: c.carpeta_id, titulo: c.nombre,
      subtitulo: c.user_id === userId ? "Tu carpeta" : "Carpeta pública",
      extra: fmtDate(c.created_at),
    }));
    (recursosRes.data ?? []).forEach((r: any) => resultados.push({
      tipo: "recurso", id: r.recurso_id, titulo: r.nombre,
      subtitulo: "Recurso", extra: fmtDate(r.created_at),
    }));
    (categoriasRes.data ?? []).forEach((c: any) => resultados.push({
      tipo: "categoria", id: c.categoria_id, titulo: c.nombre,
      subtitulo: c.descripcion || "Categoría",
    }));
    (usuariosRes.data ?? []).forEach((u: any) => resultados.push({
      tipo: "usuario", id: u.user_id, titulo: u.nombre,
      subtitulo: u.email, extra: `Miembro desde ${fmtDate(u.created_at)}`,
    }));

    setResultados(resultados);
    setLoading(false);
  }, [query, userId]);

  useEffect(() => { if (userId) buscar(); }, [userId, buscar]);

  function handleClick(r: Resultado) {
    if (r.tipo === "usuario") router.push(`/usuario/${r.id}`);
    else router.push(`/?highlight=${r.id}`);
  }

  const tipos = ["todos", "carpeta", "recurso", "categoria", "usuario"];
  const filtrados = filtro === "todos" ? resultados : resultados.filter((r) => r.tipo === filtro);
  const conteos: Record<string, number> = { todos: resultados.length };
  tipos.slice(1).forEach((t) => { conteos[t] = resultados.filter((r) => r.tipo === t).length; });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button className={styles.btnBack} onClick={() => router.back()}>← Volver</button>
        <div className={styles.headerInfo}>
          <h1 className={styles.title}>
            {loading ? "Buscando…" : `${resultados.length} resultado${resultados.length !== 1 ? "s" : ""} para`}
            {!loading && <span className={styles.query}> "{query}"</span>}
          </h1>
        </div>
      </div>

      {/* Filtros por tipo */}
      <div className={styles.filtros}>
        {tipos.map((t) => (
          <button
            key={t}
            className={`${styles.filtroBtn} ${filtro === t ? styles.filtroBtnActive : ""}`}
            onClick={() => setFiltro(t)}
          >
            {t === "todos" ? "Todos" : ICONOS[t] + " " + t.charAt(0).toUpperCase() + t.slice(1)}
            <span className={styles.filtroCount}>{conteos[t] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Resultados */}
      <div className={styles.resultados}>
        {loading ? (
          <div className={styles.loadingDots}><span /><span /><span /></div>
        ) : filtrados.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🔍</div>
            <div>Sin resultados{filtro !== "todos" ? ` en "${filtro}"` : ""}</div>
          </div>
        ) : (
          filtrados.map((r) => (
            <div key={`${r.tipo}-${r.id}`} className={styles.resultado} onClick={() => handleClick(r)}>
              <div className={styles.resultadoIcon}>{ICONOS[r.tipo]}</div>
              <div className={styles.resultadoInfo}>
                <div className={styles.resultadoTitulo}>{r.titulo}</div>
                {r.subtitulo && <div className={styles.resultadoSub}>{r.subtitulo}</div>}
                {r.extra && <div className={styles.resultadoExtra}>{r.extra}</div>}
              </div>
              <span className={styles.resultadoTipo}>{r.tipo}</span>
              <span className={styles.resultadoArrow}>→</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}