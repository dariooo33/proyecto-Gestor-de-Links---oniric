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

interface Categoria {
  categoria_id: string;
  nombre: string;
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

  // Categorías
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login"); return; }
      setUserId(session.user.id);
    });
  }, [router]);

  // Cargar todas las categorías una sola vez
  useEffect(() => {
    supabase.from("Categorias").select("categoria_id, nombre").order("nombre")
      .then(({ data }) => setCategorias((data as Categoria[]) ?? []));
  }, []);

  const buscar = useCallback(async () => {
    if (!query.trim() || !userId) return;
    setLoading(true);
    const term = query.trim();
    const resultados: Resultado[] = [];

    // IDs de carpetas compartidas con el usuario
    const { data: permisosData } = await supabase
      .from("Permisos")
      .select("carpeta_id")
      .eq("user_id", userId);
    const sharedIds = (permisosData ?? []).map((p: any) => p.carpeta_id as string);

    // Filtro de carpetas: propias + públicas + compartidas
    let carpetasFilter = `user_id.eq.${userId},publica.eq.true`;
    if (sharedIds.length > 0) carpetasFilter += `,carpeta_id.in.(${sharedIds.join(",")})`;

    if (categoriaFiltro) {
      // ── Con filtro de categoría ──────────────────────────────────────────

      // Carpetas que tienen esa categoría asignada
      const { data: catCarpetas } = await supabase
        .from("Carpetas_Recrusos_Cat")
        .select("carpeta_id")
        .eq("categoria_id", categoriaFiltro)
        .not("carpeta_id", "is", null);

      const carpetaIdsConCat = (catCarpetas ?? []).map((r: any) => r.carpeta_id as string);

      // Recursos que tienen esa categoría asignada
      const { data: catRecursos } = await supabase
        .from("Carpetas_Recrusos_Cat")
        .select("recurso_id")
        .eq("categoria_id", categoriaFiltro)
        .not("recurso_id", "is", null);

      const recursoIdsConCat = (catRecursos ?? []).map((r: any) => r.recurso_id as string);

      // Carpetas accesibles que además tienen esa categoría
      if (carpetaIdsConCat.length > 0) {
        const { data: carpetas } = await supabase
          .from("Carpetas")
          .select("carpeta_id, nombre, user_id, publica, created_at")
          .ilike("nombre", `%${term}%`)
          .or(carpetasFilter)
          .in("carpeta_id", carpetaIdsConCat)
          .limit(20);

        (carpetas ?? []).forEach((c: any) => resultados.push({
          tipo: "carpeta", id: c.carpeta_id, titulo: c.nombre,
          subtitulo: c.user_id === userId
            ? "Tu carpeta"
            : sharedIds.includes(c.carpeta_id)
              ? "Compartida contigo"
              : "Carpeta pública",
          extra: fmtDate(c.created_at),
        }));
      }

      // Recursos propios que además tienen esa categoría
      if (recursoIdsConCat.length > 0) {
        const { data: recursos } = await supabase
          .from("Recursos")
          .select("recurso_id, nombre, created_at")
          .eq("user_id", userId)
          .ilike("nombre", `%${term}%`)
          .in("recurso_id", recursoIdsConCat)
          .limit(20);

        (recursos ?? []).forEach((r: any) => resultados.push({
          tipo: "recurso", id: r.recurso_id, titulo: r.nombre,
          subtitulo: "Recurso", extra: fmtDate(r.created_at),
        }));
      }

    } else {
      // ── Sin filtro de categoría (comportamiento original) ────────────────

      const [carpetasRes, recursosRes, categoriasRes, usuariosRes] = await Promise.all([
        supabase.from("Carpetas").select("carpeta_id, nombre, user_id, publica, created_at")
          .ilike("nombre", `%${term}%`).or(carpetasFilter).limit(20),
        supabase.from("Recursos").select("recurso_id, nombre, created_at")
          .eq("user_id", userId).ilike("nombre", `%${term}%`).limit(20),
        supabase.from("Categorias").select("categoria_id, nombre, descripcion").ilike("nombre", `%${term}%`).limit(10),
        supabase.from("Usuario").select("user_id, nombre, email, created_at")
          .neq("user_id", userId).or(`nombre.ilike.%${term}%,email.ilike.%${term}%`).limit(10),
      ]);

      (carpetasRes.data ?? []).forEach((c: any) => resultados.push({
        tipo: "carpeta", id: c.carpeta_id, titulo: c.nombre,
        subtitulo: c.user_id === userId
          ? "Tu carpeta"
          : sharedIds.includes(c.carpeta_id)
            ? "Compartida contigo"
            : "Carpeta pública",
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
    }

    setResultados(resultados);
    setLoading(false);
  }, [query, userId, categoriaFiltro]);

  useEffect(() => { if (userId) buscar(); }, [userId, buscar]);

  // Al activar filtro de categoría, volver a "todos" por si el tipo activo ya no existe
  useEffect(() => {
    if (categoriaFiltro) setFiltro("todos");
  }, [categoriaFiltro]);

  function handleClick(r: Resultado) {
    if (r.tipo === "usuario") router.push(`/usuario/${r.id}`);
    else router.push(`/?highlight=${r.id}`);
  }

  // Con categoría activa solo tiene sentido mostrar carpetas y recursos
  const tiposDisponibles = categoriaFiltro
    ? ["todos", "carpeta", "recurso"]
    : ["todos", "carpeta", "recurso", "categoria", "usuario"];

  const filtrados = filtro === "todos" ? resultados : resultados.filter((r) => r.tipo === filtro);
  const conteos: Record<string, number> = { todos: resultados.length };
  tiposDisponibles.slice(1).forEach((t) => { conteos[t] = resultados.filter((r) => r.tipo === t).length; });

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

      {/* Barra de filtros */}
      <div className={styles.filtros}>

        {/* Filtros por tipo */}
        {tiposDisponibles.map((t) => (
          <button
            key={t}
            className={`${styles.filtroBtn} ${filtro === t ? styles.filtroBtnActive : ""}`}
            onClick={() => setFiltro(t)}
          >
            {t === "todos" ? "Todos" : ICONOS[t] + " " + t.charAt(0).toUpperCase() + t.slice(1)}
            <span className={styles.filtroCount}>{conteos[t] ?? 0}</span>
          </button>
        ))}

        {/* Separador visual */}
        {categorias.length > 0 && (
          <span style={{ width: 1, background: "var(--border)", alignSelf: "stretch", margin: "0 4px" }} />
        )}

        {/* Desplegable de categorías */}
        {categorias.length > 0 && (
          <select
            className={`${styles.filtroBtn} ${categoriaFiltro ? styles.filtroBtnActive : ""}`}
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
          >
            <option value="">🏷️ Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c.categoria_id} value={c.categoria_id}>{c.nombre}</option>
            ))}
          </select>
        )}

        {/* Botón limpiar categoría */}
        {categoriaFiltro && (
          <button
            className={styles.filtroBtn}
            onClick={() => setCategoriaFiltro("")}
          >
            × Limpiar
          </button>
        )}
      </div>

      {/* Resultados */}
      <div className={styles.resultados}>
        {loading ? (
          <div className={styles.loadingDots}><span /><span /><span /></div>
        ) : filtrados.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🔍</div>
            <div>
              Sin resultados{filtro !== "todos" ? ` en "${filtro}"` : ""}
              {categoriaFiltro
                ? ` con la categoría "${categorias.find(c => c.categoria_id === categoriaFiltro)?.nombre}"`
                : ""}
            </div>
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