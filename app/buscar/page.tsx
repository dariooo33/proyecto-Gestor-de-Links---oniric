"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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

interface Categoria { categoria_id: string; nombre: string; }
interface Etiqueta { etiqueta_id: string; nombre: string; }

const ICONOS: Record<string, string> = {
  carpeta: "📁", recurso: "📄", categoria: "🏷️", usuario: "👤",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

// ── Dropdown de etiquetas con búsqueda ────────────────────────────────────
function EtiquetasDropdown({
  etiquetas,
  seleccionadas,
  onToggle,
  onLimpiar,
}: {
  etiquetas: Etiqueta[];
  seleccionadas: string[];
  onToggle: (id: string) => void;
  onLimpiar: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cerrar al hacer click fuera
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (abierto) setTimeout(() => inputRef.current?.focus(), 50);
    else setBusqueda("");
  }, [abierto]);

  const texto = busqueda.trim().toLowerCase();
  const filtradas = texto
    ? etiquetas.filter((e) => e.nombre.toLowerCase().includes(texto))
    : etiquetas;

  const selSet = new Set(seleccionadas);
  const ordenadas = [
    ...filtradas.filter((e) => selSet.has(e.etiqueta_id)),
    ...filtradas.filter((e) => !selSet.has(e.etiqueta_id)),
  ];

  const label = seleccionadas.length === 0
    ? "🔖 Etiquetas"
    : seleccionadas.length === 1
      ? `🔖 ${etiquetas.find((e) => e.etiqueta_id === seleccionadas[0])?.nombre ?? "1"}`
      : `🔖 ${seleccionadas.length} etiquetas`;

  const activo = seleccionadas.length > 0;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className={`${styles.filtroBtn} ${activo ? styles.filtroBtnActive : ""}`}
        onClick={() => setAbierto((v) => !v)}
      >
        {label}
        {activo && (
          <span
            style={{ marginLeft: 4, opacity: 0.6, fontSize: 11 }}
            onClick={(e) => { e.stopPropagation(); onLimpiar(); }}
            title="Quitar filtro de etiquetas"
          >×</span>
        )}
        <span style={{ marginLeft: 4, opacity: 0.4, fontSize: 10 }}>{abierto ? "▲" : "▼"}</span>
      </button>

      {abierto && (
        <div className={styles.etiquetasDropdownPanel}>
          {/* Buscador */}
          <div style={{ padding: "6px 8px 4px", borderBottom: "1px solid var(--border, #e5e7eb)" }}>
            <input
              ref={inputRef}
              className={styles.modalInput}
              style={{ margin: 0, fontSize: 13 }}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar etiqueta…"
            />
          </div>

          {/* Lista */}
          <div className={styles.etiquetasDropdownList}>
            {ordenadas.length === 0 && (
              <span style={{ padding: "8px 12px", display: "block", opacity: 0.5, fontSize: 13 }}>
                Sin resultados
              </span>
            )}
            {ordenadas.map((e) => {
              const activa = selSet.has(e.etiqueta_id);
              return (
                <button
                  key={e.etiqueta_id}
                  type="button"
                  className={`${styles.etiquetaListItem} ${activa ? styles.etiquetaListItemOn : ""}`}
                  onClick={() => onToggle(e.etiqueta_id)}
                >
                  <span className={styles.etiquetaListCheck}>{activa ? "✓" : ""}</span>
                  {e.nombre}
                </button>
              );
            })}
          </div>

          {/* Footer con chips seleccionadas */}
          {seleccionadas.length > 0 && (
            <div style={{
              padding: "6px 8px",
              borderTop: "1px solid var(--border, #e5e7eb)",
              display: "flex", flexWrap: "wrap", gap: 4,
            }}>
              {etiquetas.filter((e) => selSet.has(e.etiqueta_id)).map((e) => (
                <span
                  key={e.etiqueta_id}
                  className={`${styles.etiquetaChip} ${styles.etiquetaChipOn}`}
                  style={{ cursor: "pointer", fontSize: 12 }}
                  onClick={() => onToggle(e.etiqueta_id)}
                >
                  {e.nombre} ×
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BuscarPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get("q") ?? "";

  const [userId, setUserId] = useState<string | null>(null);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState<string>("todos");

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("");

  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [etiquetasFiltro, setEtiquetasFiltro] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login"); return; }
      setUserId(session.user.id);
    });
  }, [router]);

  useEffect(() => {
    supabase.from("Categorias").select("categoria_id, nombre").order("nombre")
      .then(({ data }) => setCategorias((data as Categoria[]) ?? []));
    supabase.from("Etiquetas").select("etiqueta_id, nombre").order("nombre")
      .then(({ data }) => setEtiquetas((data as Etiqueta[]) ?? []));
  }, []);

  const buscar = useCallback(async () => {
    if (!query.trim() || !userId) return;
    setLoading(true);
    const term = query.trim();
    const resultados: Resultado[] = [];

    const { data: permisosData } = await supabase
      .from("Permisos").select("carpeta_id").eq("user_id", userId);
    const sharedIds = (permisosData ?? []).map((p: any) => p.carpeta_id as string);

    let carpetasFilter = `user_id.eq.${userId},publica.eq.true`;
    if (sharedIds.length > 0) carpetasFilter += `,carpeta_id.in.(${sharedIds.join(",")})`;

    const hayFiltroCategoria = !!categoriaFiltro;
    const hayFiltroEtiqueta = etiquetasFiltro.length > 0;

    if (hayFiltroCategoria || hayFiltroEtiqueta) {
      let carpetaIdsValidas: string[] | null = null;
      let recursoIdsValidos: string[] | null = null;

      if (hayFiltroCategoria) {
        const { data } = await supabase.from("Carpetas_Recrusos_Categoria")
          .select("carpeta_id").eq("categoria_id", categoriaFiltro).not("carpeta_id", "is", null);
        carpetaIdsValidas = (data ?? []).map((r: any) => r.carpeta_id as string);

        const { data: dr } = await supabase.from("Carpetas_Recrusos_Categoria")
          .select("recurso_id").eq("categoria_id", categoriaFiltro).not("recurso_id", "is", null);
        recursoIdsValidos = (dr ?? []).map((r: any) => r.recurso_id as string);
      }

      if (hayFiltroEtiqueta) {
        for (const eid of etiquetasFiltro) {
          const { data: dc } = await supabase.from("Carpetas_Recrusos_Etiquetas")
            .select("carpeta_id").eq("etiqueta_id", eid).not("carpeta_id", "is", null);
          const ids = (dc ?? []).map((r: any) => r.carpeta_id as string);
          carpetaIdsValidas = carpetaIdsValidas === null ? ids : carpetaIdsValidas.filter((id) => ids.includes(id));

          const { data: dr } = await supabase.from("Carpetas_Recrusos_Etiquetas")
            .select("recurso_id").eq("etiqueta_id", eid).not("recurso_id", "is", null);
          const rids = (dr ?? []).map((r: any) => r.recurso_id as string);
          recursoIdsValidos = recursoIdsValidos === null ? rids : recursoIdsValidos.filter((id) => rids.includes(id));
        }
      }

      if (carpetaIdsValidas && carpetaIdsValidas.length > 0) {
        const { data: carpetas } = await supabase.from("Carpetas")
          .select("carpeta_id, nombre, user_id, publica, created_at")
          .ilike("nombre", `%${term}%`).or(carpetasFilter).in("carpeta_id", carpetaIdsValidas).limit(20);
        (carpetas ?? []).forEach((c: any) => resultados.push({
          tipo: "carpeta", id: c.carpeta_id, titulo: c.nombre,
          subtitulo: c.user_id === userId ? "Tu carpeta" : sharedIds.includes(c.carpeta_id) ? "Compartida contigo" : "Carpeta pública",
          extra: fmtDate(c.created_at),
        }));
      }

      if (recursoIdsValidos && recursoIdsValidos.length > 0) {
        const { data: recursos } = await supabase.from("Recursos")
          .select("recurso_id, nombre, created_at")
          .eq("user_id", userId).ilike("nombre", `%${term}%`).in("recurso_id", recursoIdsValidos).limit(20);
        (recursos ?? []).forEach((r: any) => resultados.push({
          tipo: "recurso", id: r.recurso_id, titulo: r.nombre,
          subtitulo: "Recurso", extra: fmtDate(r.created_at),
        }));
      }

    } else {
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
        subtitulo: c.user_id === userId ? "Tu carpeta" : sharedIds.includes(c.carpeta_id) ? "Compartida contigo" : "Carpeta pública",
        extra: fmtDate(c.created_at),
      }));
      (recursosRes.data ?? []).forEach((r: any) => resultados.push({
        tipo: "recurso", id: r.recurso_id, titulo: r.nombre, subtitulo: "Recurso", extra: fmtDate(r.created_at),
      }));
      (categoriasRes.data ?? []).forEach((c: any) => resultados.push({
        tipo: "categoria", id: c.categoria_id, titulo: c.nombre, subtitulo: c.descripcion || "Categoría",
      }));
      (usuariosRes.data ?? []).forEach((u: any) => resultados.push({
        tipo: "usuario", id: u.user_id, titulo: u.nombre, subtitulo: u.email, extra: `Miembro desde ${fmtDate(u.created_at)}`,
      }));
    }

    setResultados(resultados);
    setLoading(false);
  }, [query, userId, categoriaFiltro, etiquetasFiltro]);

  useEffect(() => { if (userId) buscar(); }, [userId, buscar]);

  useEffect(() => {
    if (categoriaFiltro || etiquetasFiltro.length > 0) setFiltro("todos");
  }, [categoriaFiltro, etiquetasFiltro]);

  function handleClick(r: Resultado) {
    if (r.tipo === "usuario") router.push(`/usuario/${r.id}`);
    else router.push(`/?highlight=${r.id}`);
  }

  function toggleEtiquetaFiltro(id: string) {
    setEtiquetasFiltro((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const hayFiltroAvanzado = !!categoriaFiltro || etiquetasFiltro.length > 0;
  const tiposDisponibles = hayFiltroAvanzado
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
        {/* Filtros de tipo */}
        {tiposDisponibles.map((t) => (
          <button key={t}
            className={`${styles.filtroBtn} ${filtro === t ? styles.filtroBtnActive : ""}`}
            onClick={() => setFiltro(t)}>
            {t === "todos" ? "Todos" : ICONOS[t] + " " + t.charAt(0).toUpperCase() + t.slice(1)}
            <span className={styles.filtroCount}>{conteos[t] ?? 0}</span>
          </button>
        ))}

        {/* Separador */}
        {(categorias.length > 0 || etiquetas.length > 0) && (
          <span style={{ width: 1, background: "var(--border)", alignSelf: "stretch", margin: "0 4px" }} />
        )}

        {/* Desplegable de categorías */}
        {categorias.length > 0 && (
          <select
            className={`${styles.filtroBtn} ${categoriaFiltro ? styles.filtroBtnActive : ""}`}
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}>
            <option value="">🏷️ Categoría</option>
            {categorias.map((c) => (
              <option key={c.categoria_id} value={c.categoria_id}>{c.nombre}</option>
            ))}
          </select>
        )}

        {/* Dropdown de etiquetas con búsqueda — reemplaza los chips individuales */}
        {etiquetas.length > 0 && (
          <EtiquetasDropdown
            etiquetas={etiquetas}
            seleccionadas={etiquetasFiltro}
            onToggle={toggleEtiquetaFiltro}
            onLimpiar={() => setEtiquetasFiltro([])}
          />
        )}

        {/* Limpiar todos los filtros avanzados */}
        {hayFiltroAvanzado && (
          <button className={styles.filtroBtn}
            onClick={() => { setCategoriaFiltro(""); setEtiquetasFiltro([]); }}
            style={{ opacity: 0.7 }}>
            × Limpiar filtros
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
            <div>Sin resultados{filtro !== "todos" ? ` en "${filtro}"` : ""}
              {hayFiltroAvanzado ? " con los filtros aplicados" : ""}
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