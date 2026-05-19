"use client";

import { useState, useEffect, useRef } from "react";
import { Carpeta, Recurso, NivelAcceso, Categoria } from "../types";
import { fmtDate } from "../helpers";
import { supabase } from "@/lib/supabaseClient";
import styles from "../page.module.css";

interface Etiqueta { etiqueta_id: string; nombre: string; descripcion?: string; }

// Tipos intermedios para resultados de join de Supabase
interface EtiquetaRelacion { etiqueta_id: string; }
interface CategoriaRelacion { carpeta_id: string; categoria_id: string; }
interface CategoriaJoin { Categorias: Categoria | Categoria[] | null; }

// ── Selector de etiquetas con creación inline ──────────────────────────────
function EtiquetasPicker({
  etiquetas,
  seleccionadas,
  saving,
  onToggle,
  onCrear,
}: {
  etiquetas: Etiqueta[];
  seleccionadas: string[];
  saving: boolean;
  onToggle: (id: string) => void;
  onCrear: (etiqueta: Etiqueta) => void;
}) {
  const [creando, setCreando] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevaDesc, setNuevaDesc] = useState("");
  const [savingNueva, setSavingNueva] = useState(false);

  async function handleCrear() {
    if (!nuevoNombre.trim()) return;
    setSavingNueva(true);
    const { data, error } = await supabase
      .from("Etiquetas")
      .insert({ nombre: nuevoNombre.trim(), descripcion: nuevaDesc.trim() })
      .select()
      .single();
    if (!error && data) {
      onCrear(data as Etiqueta);
      setNuevoNombre("");
      setNuevaDesc("");
      setCreando(false);
    }
    setSavingNueva(false);
  }

  return (
    <div>
      <div className={styles.etiquetaSelectorWrap}>
        {etiquetas.map((e) => (
          <button key={e.etiqueta_id} type="button"
            className={`${styles.etiquetaChip} ${seleccionadas.includes(e.etiqueta_id) ? styles.etiquetaChipOn : ""}`}
            disabled={saving}
            onClick={() => onToggle(e.etiqueta_id)}>
            {e.nombre}
          </button>
        ))}
        {etiquetas.length === 0 && !creando && (
          <span className={styles.etiquetaEmpty}>No hay etiquetas aún</span>
        )}
      </div>

      {!creando ? (
        <button type="button" className={styles.menuCategoriaQuitar}
          style={{ marginTop: 6, opacity: 1, color: "var(--accent)" }}
          onClick={() => setCreando(true)}>
          + Nueva etiqueta
        </button>
      ) : (
        <div className={styles.etiquetaCrearBox}>
          <input className={styles.menuCategoriaSelect} value={nuevoNombre} autoFocus
            onChange={(e) => setNuevoNombre(e.target.value)}
            placeholder="Nombre…" />
          <input className={styles.menuCategoriaSelect} value={nuevaDesc}
            onChange={(e) => setNuevaDesc(e.target.value)}
            placeholder="Descripción (opcional)…" />
          <div className={styles.etiquetaCrearActions}>
            <button type="button" className={styles.menuCategoriaQuitar}
              onClick={() => { setCreando(false); setNuevoNombre(""); setNuevaDesc(""); }}>
              Cancelar
            </button>
            <button type="button"
              className={styles.menuCategoriaQuitar}
              style={{ color: "var(--accent)", opacity: nuevoNombre.trim() ? 1 : 0.4 }}
              disabled={!nuevoNombre.trim() || savingNueva}
              onClick={handleCrear}>
              {savingNueva ? "Creando…" : "✓ Crear"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CenterPanel({
  carpeta, subCarpetas, recursos, loading, userId, nivelAcceso,
  onSelectCarpeta, onNewRecurso, onDeleteRecurso, onDeleteCarpeta,
  onOpenPermisos, onLeaveShared, onTogglePublica, onSetCategoria, onSetEtiquetas,
  onRenameRecurso, onRenameCarpeta,
}: {
  carpeta: Carpeta | null;
  subCarpetas: Carpeta[];
  recursos: Recurso[];
  loading: boolean;
  userId: string | null;
  nivelAcceso: NivelAcceso;
  onSelectCarpeta: (id: string) => void;
  onNewRecurso: () => void;
  onDeleteRecurso: (id: string) => void;
  onDeleteCarpeta: (id: string, nombre: string) => void;
  onOpenPermisos: () => void;
  onLeaveShared: (carpetaId: string) => void;
  onTogglePublica: (carpetaId: string, publica: boolean) => Promise<void>;
  onSetCategoria: (carpetaId: string, categoriaId: string | null) => Promise<void>;
  onSetEtiquetas: (carpetaId: string | null, recursoId: string | null, etiquetaIds: string[]) => Promise<void>;
  onRenameRecurso?: (recursoId: string, nuevoNombre: string) => void;
  onRenameCarpeta?: (carpetaId: string, nuevoNombre: string) => void;
}) {
  const [selectedRecurso, setSelectedRecurso] = useState<Recurso | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Edición inline de nombres
  const [editingRecursoId, setEditingRecursoId] = useState<string | null>(null);
  const [editingRecursoNombre, setEditingRecursoNombre] = useState("");
  const [editingCarpetaId, setEditingCarpetaId] = useState<string | null>(null);
  const [editingCarpetaNombre, setEditingCarpetaNombre] = useState("");
  const [editingRecursoFull, setEditingRecursoFull] = useState(false);
  const [editFullNombre, setEditFullNombre] = useState("");
  const [editFullUrl, setEditFullUrl] = useState("");
  const [editFullContenido, setEditFullContenido] = useState("");
  const [savingRecursoFull, setSavingRecursoFull] = useState(false);
  const [editingHeaderCarpeta, setEditingHeaderCarpeta] = useState(false);
  const [editHeaderNombre, setEditHeaderNombre] = useState("");

  const carpetaInputRef = useRef<HTMLInputElement>(null);

  // Filtros locales
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriasFiltro, setCategoriasFiltro] = useState<Set<string>>(new Set());
  const [busquedaLocal, setBusquedaLocal] = useState("");

  // Catálogos globales (cargados una sola vez)
  const [todasCategorias, setTodasCategorias] = useState<Categoria[]>([]);
  const [todasEtiquetas, setTodasEtiquetas] = useState<Etiqueta[]>([]);

  // Estado de la carpeta actual
  const [categoriaActual, setCategoriaActual] = useState<string | null>(null);
  const [showCategoriaSelector, setShowCategoriaSelector] = useState(false);
  const [savingCategoria, setSavingCategoria] = useState(false);
  const [etiquetasCarpeta, setEtiquetasCarpeta] = useState<string[]>([]);
  const [showEtiquetaSelector, setShowEtiquetaSelector] = useState(false);
  const [savingEtiquetas, setSavingEtiquetas] = useState(false);

  // Etiquetas de recursos
  const [etiquetasRecurso, setEtiquetasRecurso] = useState<Record<string, string[]>>({});
  const [recursoEtiquetaOpen, setRecursoEtiquetaOpen] = useState<string | null>(null);
  const [savingRecursoEtiqueta, setSavingRecursoEtiqueta] = useState(false);

  // Mapa carpeta → categorías para filtro
  const [carpetaCategorias, setCarpetaCategorias] = useState<Record<string, string[]>>({});

  // Cargar catálogos globales una sola vez
  useEffect(() => {
    Promise.all([
      supabase.from("Etiquetas").select("etiqueta_id, nombre, descripcion").order("nombre"),
      supabase.from("Categorias").select("categoria_id, nombre").order("nombre"),
    ]).then(([{ data: etqs }, { data: cats }]) => {
      setTodasEtiquetas((etqs as Etiqueta[]) ?? []);
      setTodasCategorias((cats as Categoria[]) ?? []);
    });
  }, []);

  // Recargar datos al cambiar de carpeta (agrupado en Promise.all)
  useEffect(() => {
    if (!carpeta) {
      setCategoriaActual(null);
      setEtiquetasCarpeta([]);
      return;
    }
    Promise.all([
      supabase.from("Carpetas_Recrusos_Categoria")
        .select("categoria_id").eq("carpeta_id", carpeta.carpeta_id).maybeSingle(),
      supabase.from("Carpetas_Recrusos_Etiquetas")
        .select("etiqueta_id").eq("carpeta_id", carpeta.carpeta_id),
    ]).then(([{ data: catData }, { data: etqData }]) => {
      setCategoriaActual(catData?.categoria_id ?? null);
      setEtiquetasCarpeta((etqData ?? []).map((r: EtiquetaRelacion) => r.etiqueta_id));
    });
  }, [carpeta?.carpeta_id]);

  // Etiquetas de los recursos visibles
  useEffect(() => {
    if (recursos.length === 0) { setEtiquetasRecurso({}); return; }
    const ids = recursos.map((r) => r.recurso_id);
    supabase.from("Carpetas_Recrusos_Etiquetas")
      .select("recurso_id, etiqueta_id").in("recurso_id", ids)
      .then(({ data }) => {
        const map: Record<string, string[]> = {};
        (data ?? []).forEach((r: { recurso_id: string; etiqueta_id: string }) => {
          if (!map[r.recurso_id]) map[r.recurso_id] = [];
          map[r.recurso_id].push(r.etiqueta_id);
        });
        setEtiquetasRecurso(map);
      });
  }, [recursos]);

  // Categorías de subcarpetas + mapa para filtro (agrupados en Promise.all)
  useEffect(() => {
    const ids = subCarpetas.map((c) => c.carpeta_id);
    if (ids.length === 0) {
      setCategorias([]);
      setCarpetaCategorias({});
      return;
    }
    Promise.all([
      supabase.from("Carpetas_Recrusos_Categoria")
        .select("categoria_id, Categorias(categoria_id, nombre, descripcion, created_at)").in("carpeta_id", ids),
      supabase.from("Carpetas_Recrusos_Categoria")
        .select("carpeta_id, categoria_id").in("carpeta_id", ids),
    ]).then(([{ data: joinData }, { data: mapData }]) => {
      // Chips de filtro únicos
      const seen = new Set<string>();
      const cats: Categoria[] = [];
      (joinData ?? []).forEach((r: CategoriaJoin) => {
        const raw = r.Categorias;
        const c = Array.isArray(raw) ? raw[0] : raw;
        if (c && !seen.has(c.categoria_id)) { seen.add(c.categoria_id); cats.push(c); }
      });
      setCategorias(cats);

      // Mapa carpeta → categorías
      const map: Record<string, string[]> = {};
      (mapData ?? []).forEach((r: CategoriaRelacion) => {
        if (!map[r.carpeta_id]) map[r.carpeta_id] = [];
        map[r.carpeta_id].push(r.categoria_id);
      });
      setCarpetaCategorias(map);
    });
  }, [carpeta?.carpeta_id, subCarpetas]);

  // Reset al cambiar de carpeta
  useEffect(() => {
    setSelectedRecurso(null);
    setMenuOpen(false);
    setShowCategoriaSelector(false);
    setShowEtiquetaSelector(false);
    setRecursoEtiquetaOpen(null);
    setCategoriasFiltro(new Set());
    setBusquedaLocal("");
  }, [carpeta?.carpeta_id]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setShowCategoriaSelector(false);
        setShowEtiquetaSelector(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const canEdit = nivelAcceso === "owner" || nivelAcceso === "edicion";
  const isOwner = nivelAcceso === "owner";

  const subCarpetasFiltradas = subCarpetas.filter((sc) => {
    const matchBusqueda = sc.nombre.toLowerCase().includes(busquedaLocal.toLowerCase());
    const matchCategoria = categoriasFiltro.size === 0 ||
      (carpetaCategorias[sc.carpeta_id] ?? []).some((cid) => categoriasFiltro.has(cid));
    return matchBusqueda && matchCategoria;
  });

  const recursosFiltrados = recursos.filter((r) =>
    r.nombre.toLowerCase().includes(busquedaLocal.toLowerCase())
  );

  function toggleCategoria(id: string) {
    setCategoriasFiltro((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleGuardarCategoria(nuevaCategoriaId: string | null) {
    if (!carpeta) return;
    setSavingCategoria(true);
    await onSetCategoria(carpeta.carpeta_id, nuevaCategoriaId);
    setCategoriaActual(nuevaCategoriaId);
    setSavingCategoria(false);
    setShowCategoriaSelector(false);
    setMenuOpen(false);
  }

  async function handleGuardarEtiquetasCarpeta(ids: string[]) {
    if (!carpeta) return;
    setSavingEtiquetas(true);
    await onSetEtiquetas(carpeta.carpeta_id, null, ids);
    setEtiquetasCarpeta(ids);
    setSavingEtiquetas(false);
  }

  async function handleGuardarEtiquetasRecurso(recursoId: string, ids: string[]) {
    setSavingRecursoEtiqueta(true);
    await onSetEtiquetas(null, recursoId, ids);
    setEtiquetasRecurso((prev) => ({ ...prev, [recursoId]: ids }));
    setSavingRecursoEtiqueta(false);
  }

  function handleNuevaEtiqueta(e: Etiqueta) {
    setTodasEtiquetas((prev) => [...prev, e].sort((a, b) => a.nombre.localeCompare(b.nombre)));
  }

  // ── Edición inline de recursos ────────────────────────────────────────────
  function startEditRecurso(r: Recurso) {
    if (!canEdit) return;
    setEditingRecursoId(r.recurso_id);
    setEditingRecursoNombre(r.nombre);
  }

  async function commitEditRecurso(recursoId: string, nombre: string, original: string) {
    setEditingRecursoId(null);
    const trimmed = nombre.trim();
    if (!trimmed || trimmed === original) return;
    await supabase.from("Recursos").update({ nombre: trimmed }).eq("recurso_id", recursoId);
    // Forzar refresco: actualizar el recurso seleccionado si coincide
    if (selectedRecurso?.recurso_id === recursoId) {
      setSelectedRecurso((prev) => prev ? { ...prev, nombre: trimmed } : prev);
    }
    // Notificar al padre para que recargue recursos
    onRenameRecurso?.(recursoId, trimmed);
  }

  // ── Edición completa del recurso (panel detalle) ──────────────────────────
  function startEditRecursoFull() {
    if (!selectedRecurso || !canEdit) return;
    setEditFullNombre(selectedRecurso.nombre);
    setEditFullUrl(selectedRecurso.url ?? "");
    setEditFullContenido(selectedRecurso.contenido ?? "");
    setEditingRecursoFull(true);
  }

  async function commitEditRecursoFull() {
    if (!selectedRecurso) return;
    setSavingRecursoFull(true);
    const trimmed = editFullNombre.trim();
    if (!trimmed) { setSavingRecursoFull(false); return; }
    const updates: Record<string, string> = {
      nombre: trimmed,
      contenido: editFullContenido,
    };
    if (editFullUrl.trim()) updates.url = editFullUrl.trim();
    else updates.url = "";
    await supabase.from("Recursos").update(updates).eq("recurso_id", selectedRecurso.recurso_id);
    const updated = { ...selectedRecurso, nombre: trimmed, contenido: editFullContenido, url: editFullUrl.trim() || null };
    setSelectedRecurso(updated);
    setEditingRecursoFull(false);
    setSavingRecursoFull(false);
    onRenameRecurso?.(selectedRecurso.recurso_id, trimmed);
  }

  // ── Edición del nombre de la carpeta actual (header) ──────────────────────
  function startEditHeaderCarpeta() {
    if (!carpeta || !canEdit) return;
    setEditHeaderNombre(carpeta.nombre);
    setEditingHeaderCarpeta(true);
  }

  async function commitEditHeaderCarpeta() {
    if (!carpeta) return;
    const trimmed = editHeaderNombre.trim();
    setEditingHeaderCarpeta(false);
    if (!trimmed || trimmed === carpeta.nombre) return;
    await supabase.from("Carpetas").update({ nombre: trimmed }).eq("carpeta_id", carpeta.carpeta_id);
    onRenameCarpeta?.(carpeta.carpeta_id, trimmed);
  }

  // ── Edición inline de subcarpetas ─────────────────────────────────────────
  function startEditCarpeta(c: Carpeta) {
    if (!canEdit) return;
    setEditingCarpetaId(c.carpeta_id);
    setEditingCarpetaNombre(c.nombre);
    setTimeout(() => carpetaInputRef.current?.select(), 30);
  }

  async function commitEditCarpeta(carpetaId: string, nombre: string, original: string) {
    setEditingCarpetaId(null);
    const trimmed = nombre.trim();
    if (!trimmed || trimmed === original) return;
    await supabase.from("Carpetas").update({ nombre: trimmed }).eq("carpeta_id", carpetaId);
    onRenameCarpeta?.(carpetaId, trimmed);
  }

  if (!carpeta) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>🗂️</div>
        <div className={styles.emptyText}>Selecciona una carpeta para ver su contenido</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.loadingDots}><span /><span /><span /></div>
      </div>
    );
  }

  const categoriaActualNombre = todasCategorias.find(c => c.categoria_id === categoriaActual)?.nombre;
  const etiquetasCarpetaObj = etiquetasCarpeta
    .map((id) => todasEtiquetas.find((e) => e.etiqueta_id === id))
    .filter(Boolean) as Etiqueta[];

  return (
    <div>
      {/* Header */}
      <div className={styles.folderHeader}>
        <div className={styles.folderHeaderIcon}>📂</div>
        <div className={styles.folderHeaderInfo}>
          <div className={styles.folderHeaderName}>
            {editingHeaderCarpeta ? (
              <input
                autoFocus
                className={styles.inlineEditInput}
                value={editHeaderNombre}
                style={{ fontSize: "inherit", fontWeight: "inherit", maxWidth: 300 }}
                onChange={(e) => setEditHeaderNombre(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEditHeaderCarpeta();
                  if (e.key === "Escape") setEditingHeaderCarpeta(false);
                }}
                onBlur={commitEditHeaderCarpeta}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                onDoubleClick={startEditHeaderCarpeta}
                title={canEdit ? "Doble clic para renombrar" : undefined}
                style={{ cursor: canEdit ? "text" : "default" }}
              >{carpeta.nombre}</span>
            )}
            {carpeta.publica && <span className={styles.publicaBadge}>🌐 Pública</span>}
            {!carpeta.publica && <span className={styles.privadaBadge}>🔒 Privada</span>}
            {nivelAcceso === "lectura" && <span className={styles.nivelBadge} data-nivel="lectura">👁 Solo lectura</span>}
            {nivelAcceso === "edicion" && <span className={styles.nivelBadge} data-nivel="edicion">✏️ Edición</span>}
            {categoriaActualNombre && (
              <span className={styles.categoriaBadge}>🏷️ {categoriaActualNombre}</span>
            )}
            {etiquetasCarpetaObj.map((e) => (
              <span key={e.etiqueta_id} className={styles.etiquetaBadge}>{e.nombre}</span>
            ))}
          </div>
          <div className={styles.folderHeaderMeta}>
            {subCarpetas.length} subcarpeta{subCarpetas.length !== 1 ? "s" : ""}
            {" · "}{recursos.length} recurso{recursos.length !== 1 ? "s" : ""}
            {" · "}Creada {fmtDate(carpeta.created_at)}
          </div>
        </div>

        <div className={styles.folderActions}>
          {canEdit && <button className={styles.btnPrimary} onClick={onNewRecurso}>+ Recurso</button>}
          <div className={styles.menuWrapper} ref={menuRef}>
            <button className={styles.btnMenu}
              onClick={() => { setMenuOpen((v) => !v); setShowCategoriaSelector(false); setShowEtiquetaSelector(false); }}
              title="Opciones">⋯</button>
            {menuOpen && (
              <div className={styles.menuDropdown}>
                {isOwner && (
                  <>
                    <button className={styles.menuItem} onClick={() => { setMenuOpen(false); onOpenPermisos(); }}>
                      <span>🔐</span> Permisos
                    </button>
                    <button className={styles.menuItem}
                      onClick={() => { setMenuOpen(false); onTogglePublica(carpeta.carpeta_id, !carpeta.publica); }}>
                      <span>{carpeta.publica ? "🔒" : "🌐"}</span>
                      {carpeta.publica ? "Hacer privada" : "Hacer pública"}
                    </button>

                    {/* Categoría */}
                    <button className={styles.menuItem}
                      onClick={() => { setShowEtiquetaSelector(false); setShowCategoriaSelector((v) => !v); }}>
                      <span>🏷️</span>{categoriaActual ? "Cambiar categoría" : "Asignar categoría"}
                    </button>
                    {showCategoriaSelector && (
                      <div className={styles.menuCategoriaSelector}>
                        <select className={styles.menuCategoriaSelect}
                          value={categoriaActual ?? ""}
                          onChange={(e) => handleGuardarCategoria(e.target.value || null)}
                          disabled={savingCategoria} autoFocus>
                          <option value="">Sin categoría</option>
                          {todasCategorias.map((c) => (
                            <option key={c.categoria_id} value={c.categoria_id}>{c.nombre}</option>
                          ))}
                        </select>
                        {categoriaActual && (
                          <button className={styles.menuCategoriaQuitar}
                            disabled={savingCategoria} onClick={() => handleGuardarCategoria(null)}>
                            × Quitar categoría
                          </button>
                        )}
                      </div>
                    )}

                    {/* Etiquetas carpeta */}
                    <button className={styles.menuItem}
                      onClick={() => { setShowCategoriaSelector(false); setShowEtiquetaSelector((v) => !v); }}>
                      <span>🔖</span> Etiquetas
                      {etiquetasCarpeta.length > 0 && (
                        <span className={styles.menuEtiquetaCount}>{etiquetasCarpeta.length}</span>
                      )}
                    </button>
                    {showEtiquetaSelector && (
                      <div className={styles.menuCategoriaSelector}>
                        <EtiquetasPicker
                          etiquetas={todasEtiquetas}
                          seleccionadas={etiquetasCarpeta}
                          saving={savingEtiquetas}
                          onToggle={(id) => {
                            const next = etiquetasCarpeta.includes(id)
                              ? etiquetasCarpeta.filter((x) => x !== id)
                              : [...etiquetasCarpeta, id];
                            handleGuardarEtiquetasCarpeta(next);
                          }}
                          onCrear={(e) => {
                            handleNuevaEtiqueta(e);
                            handleGuardarEtiquetasCarpeta([...etiquetasCarpeta, e.etiqueta_id]);
                          }}
                        />
                      </div>
                    )}

                    <div className={styles.menuDivider} />
                    <button className={`${styles.menuItem} ${styles.menuItemDanger}`}
                      onClick={() => { setMenuOpen(false); onDeleteCarpeta(carpeta.carpeta_id, carpeta.nombre); }}>
                      <span>🗑</span> Eliminar carpeta
                    </button>
                  </>
                )}
                {!isOwner && nivelAcceso !== null && (
                  <button className={`${styles.menuItem} ${styles.menuItemDanger}`}
                    onClick={() => { setMenuOpen(false); onLeaveShared(carpeta.carpeta_id); }}>
                    <span>🚪</span> Salir de carpeta
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Barra de filtros */}
      <div className={styles.filterBar}>
        <input className={styles.filterSearch} value={busquedaLocal}
          onChange={(e) => setBusquedaLocal(e.target.value)}
          placeholder="Buscar en esta carpeta…" />
        {categorias.length > 0 && (
          <div className={styles.filterCategorias}>
            {categorias.map((cat) => (
              <button key={cat.categoria_id}
                className={`${styles.filterChip} ${categoriasFiltro.has(cat.categoria_id) ? styles.filterChipActive : ""}`}
                onClick={() => toggleCategoria(cat.categoria_id)}>
                {cat.nombre}
              </button>
            ))}
            {categoriasFiltro.size > 0 && (
              <button className={styles.filterClear} onClick={() => setCategoriasFiltro(new Set())}>× Limpiar</button>
            )}
          </div>
        )}
      </div>

      {/* Subcarpetas */}
      {subCarpetasFiltradas.length > 0 && (
        <>
          <div className={styles.sectionTitle}>Subcarpetas</div>
          <div className={styles.folderGrid}>
            {subCarpetasFiltradas.map((sc) => (
              <div key={sc.carpeta_id} className={styles.folderCard} onClick={() => { if (editingCarpetaId !== sc.carpeta_id) onSelectCarpeta(sc.carpeta_id); }}>
                <div className={styles.folderCardIcon}>{sc.publica ? "🌐" : "📁"}</div>
                {editingCarpetaId === sc.carpeta_id ? (
                  <input
                    ref={carpetaInputRef}
                    className={styles.inlineEditInput}
                    value={editingCarpetaNombre}
                    onChange={(e) => setEditingCarpetaNombre(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEditCarpeta(sc.carpeta_id, editingCarpetaNombre, sc.nombre);
                      if (e.key === "Escape") setEditingCarpetaId(null);
                    }}
                    onBlur={() => commitEditCarpeta(sc.carpeta_id, editingCarpetaNombre, sc.nombre)}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div
                    className={styles.folderCardName}
                    onDoubleClick={(e) => { e.stopPropagation(); startEditCarpeta(sc); }}
                    title={canEdit ? "Doble clic para renombrar" : undefined}
                  >{sc.nombre}</div>
                )}
                <div className={styles.folderCardMeta}>Creada {fmtDate(sc.created_at)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Recursos */}
      {recursosFiltrados.length > 0 && (
        <>
          <div className={styles.sectionTitle}>Recursos</div>
          <div className={styles.resourceList}>
            {recursosFiltrados.map((r) => {
              const etiIds = etiquetasRecurso[r.recurso_id] ?? [];
              const etiObjs = etiIds.map((id) => todasEtiquetas.find((e) => e.etiqueta_id === id)).filter(Boolean) as Etiqueta[];
              const etiquetaOpen = recursoEtiquetaOpen === r.recurso_id;

              return (
                <div key={r.recurso_id}>
                  <div className={styles.resourceRow}
                    onClick={() => { if (editingRecursoId === r.recurso_id) return; setSelectedRecurso(selectedRecurso?.recurso_id === r.recurso_id ? null : r); }}>
                    <span className={styles.resourceIcon}>📄</span>
                    <span
                      className={styles.resourceName}
                      onDoubleClick={(e) => { e.stopPropagation(); startEditRecurso(r); }}
                      title={canEdit ? "Doble clic para renombrar" : undefined}
                    >
                      {editingRecursoId === r.recurso_id ? (
                        <input
                          autoFocus
                          className={styles.inlineEditInput}
                          value={editingRecursoNombre}
                          onChange={(e) => setEditingRecursoNombre(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitEditRecurso(r.recurso_id, editingRecursoNombre, r.nombre);
                            if (e.key === "Escape") setEditingRecursoId(null);
                          }}
                          onBlur={() => commitEditRecurso(r.recurso_id, editingRecursoNombre, r.nombre)}
                          onClick={(e) => e.stopPropagation()}
                          onDoubleClick={(e) => e.stopPropagation()}
                        />
                      ) : r.url ? (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.resourceLink}
                          onClick={(e) => e.stopPropagation()}
                          title={r.url}
                        >
                          {r.nombre}
                        </a>
                      ) : (
                        <span>{r.nombre}</span>
                      )}
                    </span>
                    {r.url && (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.resourceUrlChip}
                        onClick={(e) => e.stopPropagation()}
                        title={r.url}
                      >
                        🔗 URL
                      </a>
                    )}
                    {etiObjs.map((e) => (
                      <span key={e.etiqueta_id} className={styles.etiquetaBadgeSmall}>{e.nombre}</span>
                    ))}
                    <span className={styles.resourceDate}>{fmtDate(r.created_at)}</span>
                    {canEdit && (
                      <span className={styles.resourceDelete}>
                        <button className={styles.btnIcon} title="Etiquetas"
                          onClick={(e) => { e.stopPropagation(); setRecursoEtiquetaOpen(etiquetaOpen ? null : r.recurso_id); }}>
                          🔖
                        </button>
                        <button className={styles.btnIcon}
                          onClick={(e) => { e.stopPropagation(); onDeleteRecurso(r.recurso_id); }}>🗑</button>
                      </span>
                    )}
                  </div>

                  {/* Panel de etiquetas del recurso */}
                  {etiquetaOpen && (
                    <div className={styles.recursoEtiquetaPanel}>
                      <EtiquetasPicker
                        etiquetas={todasEtiquetas}
                        seleccionadas={etiIds}
                        saving={savingRecursoEtiqueta}
                        onToggle={(id) => {
                          const next = etiIds.includes(id)
                            ? etiIds.filter((x) => x !== id)
                            : [...etiIds, id];
                          handleGuardarEtiquetasRecurso(r.recurso_id, next);
                        }}
                        onCrear={(e) => {
                          handleNuevaEtiqueta(e);
                          handleGuardarEtiquetasRecurso(r.recurso_id, [...etiIds, e.etiqueta_id]);
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {selectedRecurso && (
        <div className={styles.resourceDetailWrap}>
          <div className={styles.resourceDetail}>
            <div className={styles.resourceDetailHeader}>
              <span className={styles.resourceDetailIcon}>📄</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingRecursoFull ? (
                  <input
                    autoFocus
                    className={styles.inlineEditInput}
                    value={editFullNombre}
                    style={{ fontSize: 15, fontWeight: 600, width: "100%" }}
                    onChange={(e) => setEditFullNombre(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Escape") setEditingRecursoFull(false); }}
                    placeholder="Nombre del recurso"
                  />
                ) : (
                  <div className={styles.resourceDetailName}>{selectedRecurso.nombre}</div>
                )}
                <div className={styles.resourceDetailMeta}>Creado {fmtDate(selectedRecurso.created_at)}</div>
              </div>
              {canEdit && !editingRecursoFull && (
                <button className={styles.btnIconSm} onClick={startEditRecursoFull} title="Editar recurso">✏️</button>
              )}
              {editingRecursoFull && (
                <div style={{ display: "flex", gap: 6 }}>
                  <button className={styles.btnPrimary} style={{ padding: "4px 12px", fontSize: 12 }} onClick={commitEditRecursoFull} disabled={savingRecursoFull}>
                    {savingRecursoFull ? "…" : "Guardar"}
                  </button>
                  <button className={styles.btnSecondary} style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setEditingRecursoFull(false)}>Cancelar</button>
                </div>
              )}
            </div>
            {editingRecursoFull ? (
              <>
                <div className={styles.resourceDetailEditField}>
                  <label className={styles.resourceDetailEditLabel}>URL</label>
                  <input
                    className={styles.inlineEditInput}
                    value={editFullUrl}
                    onChange={(e) => setEditFullUrl(e.target.value)}
                    placeholder="https://..."
                    style={{ width: "100%" }}
                  />
                </div>
                <div className={styles.resourceDetailEditField}>
                  <label className={styles.resourceDetailEditLabel}>Contenido</label>
                  <textarea
                    className={styles.resourceDetailEditTextarea}
                    value={editFullContenido}
                    onChange={(e) => setEditFullContenido(e.target.value)}
                    placeholder="Notas, descripción..."
                    rows={5}
                  />
                </div>
              </>
            ) : (
              <>
                <div className={styles.resourceContent}>
                  {selectedRecurso.contenido || <span className={styles.resourceContentEmpty}>Sin contenido</span>}
                </div>
                {selectedRecurso.url && (
                  <div className={styles.resourceDetailUrl}>
                    <a href={selectedRecurso.url} target="_blank" rel="noopener noreferrer" className={styles.resourceLink}>
                      🔗 {selectedRecurso.url}
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {subCarpetasFiltradas.length === 0 && recursosFiltrados.length === 0 && (
        <div className={styles.emptyState} style={{ marginTop: 60 }}>
          <div className={styles.emptyIcon}>📭</div>
          <div className={styles.emptyText}>
            {busquedaLocal || categoriasFiltro.size > 0 ? "Sin resultados para ese filtro" : "Esta carpeta está vacía"}
          </div>
        </div>
      )}
    </div>
  );
}