"use client";

import { useState, useEffect, useRef } from "react";
import { Carpeta, Recurso, NivelAcceso, Categoria } from "../types";
import { fmtDate } from "../helpers";
import { supabase } from "../../lib/supabaseClient";
import styles from "../page.module.css";

interface Etiqueta { etiqueta_id: string; nombre: string; descripcion?: string; }

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
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
          <input className={styles.menuCategoriaSelect} value={nuevoNombre} autoFocus
            onChange={(e) => setNuevoNombre(e.target.value)}
            placeholder="Nombre…" />
          <input className={styles.menuCategoriaSelect} value={nuevaDesc}
            onChange={(e) => setNuevaDesc(e.target.value)}
            placeholder="Descripción (opcional)…" />
          <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
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
}) {
  const [selectedRecurso, setSelectedRecurso] = useState<Recurso | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Filtros locales
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriasFiltro, setCategoriasFiltro] = useState<Set<string>>(new Set());
  const [busquedaLocal, setBusquedaLocal] = useState("");

  // Categoría actual
  const [todasCategorias, setTodasCategorias] = useState<Categoria[]>([]);
  const [categoriaActual, setCategoriaActual] = useState<string | null>(null);
  const [showCategoriaSelector, setShowCategoriaSelector] = useState(false);
  const [savingCategoria, setSavingCategoria] = useState(false);

  // Etiquetas — catálogo global compartido entre carpeta y recursos
  const [todasEtiquetas, setTodasEtiquetas] = useState<Etiqueta[]>([]);
  const [etiquetasCarpeta, setEtiquetasCarpeta] = useState<string[]>([]);
  const [showEtiquetaSelector, setShowEtiquetaSelector] = useState(false);
  const [savingEtiquetas, setSavingEtiquetas] = useState(false);
  const [etiquetasRecurso, setEtiquetasRecurso] = useState<Record<string, string[]>>({});
  const [recursoEtiquetaOpen, setRecursoEtiquetaOpen] = useState<string | null>(null);
  const [savingRecursoEtiqueta, setSavingRecursoEtiqueta] = useState(false);

  // Cargar catálogos globales una sola vez
  useEffect(() => {
    supabase.from("Etiquetas").select("etiqueta_id, nombre, descripcion").order("nombre")
      .then(({ data }) => setTodasEtiquetas((data as Etiqueta[]) ?? []));
    supabase.from("Categorias").select("categoria_id, nombre").order("nombre")
      .then(({ data }) => setTodasCategorias((data as Categoria[]) ?? []));
  }, []);

  // Recargar datos al cambiar de carpeta
  useEffect(() => {
    if (!carpeta) { setCategoriaActual(null); setEtiquetasCarpeta([]); return; }
    supabase.from("Carpetas_Recrusos_Categoria")
      .select("categoria_id").eq("carpeta_id", carpeta.carpeta_id).maybeSingle()
      .then(({ data }) => setCategoriaActual(data?.categoria_id ?? null));
    supabase.from("Carpetas_Recrusos_Etiquetas")
      .select("etiqueta_id").eq("carpeta_id", carpeta.carpeta_id)
      .then(({ data }) => setEtiquetasCarpeta((data ?? []).map((r: any) => r.etiqueta_id)));
  }, [carpeta?.carpeta_id]);

  // Etiquetas de los recursos visibles
  useEffect(() => {
    if (recursos.length === 0) { setEtiquetasRecurso({}); return; }
    const ids = recursos.map((r) => r.recurso_id);
    supabase.from("Carpetas_Recrusos_Etiquetas")
      .select("recurso_id, etiqueta_id").in("recurso_id", ids)
      .then(({ data }) => {
        const map: Record<string, string[]> = {};
        (data ?? []).forEach((r: any) => {
          if (!map[r.recurso_id]) map[r.recurso_id] = [];
          map[r.recurso_id].push(r.etiqueta_id);
        });
        setEtiquetasRecurso(map);
      });
  }, [recursos]);

  // Categorías de subcarpetas para chips de filtro
  useEffect(() => {
    if (!carpeta) return;
    const ids = subCarpetas.map((c) => c.carpeta_id);
    if (ids.length === 0) { setCategorias([]); return; }
    supabase.from("Carpetas_Recrusos_Categoria")
      .select("categoria_id, Categorias(categoria_id, nombre)").in("carpeta_id", ids)
      .then(({ data }) => {
        const seen = new Set<string>();
        const cats: Categoria[] = [];
        (data ?? []).forEach((r: any) => {
          const c = r.Categorias;
          if (c && !seen.has(c.categoria_id)) { seen.add(c.categoria_id); cats.push(c); }
        });
        setCategorias(cats);
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

  // Mapa carpeta → categorías para filtro local
  const [carpetaCategorias, setCarpetaCategorias] = useState<Record<string, string[]>>({});
  useEffect(() => {
    const ids = subCarpetas.map((c) => c.carpeta_id);
    if (ids.length === 0) { setCarpetaCategorias({}); return; }
    supabase.from("Carpetas_Recrusos_Categoria").select("carpeta_id, categoria_id").in("carpeta_id", ids)
      .then(({ data }) => {
        const map: Record<string, string[]> = {};
        (data ?? []).forEach((r: any) => {
          if (!map[r.carpeta_id]) map[r.carpeta_id] = [];
          map[r.carpeta_id].push(r.categoria_id);
        });
        setCarpetaCategorias(map);
      });
  }, [subCarpetas]);

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

  // Cuando se crea una etiqueta nueva desde cualquier picker, añadirla al catálogo global
  function handleNuevaEtiqueta(e: Etiqueta) {
    setTodasEtiquetas((prev) => [...prev, e].sort((a, b) => a.nombre.localeCompare(b.nombre)));
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
            {carpeta.nombre}
            {carpeta.publica && <span className={styles.publicaBadge}>🌐 Pública</span>}
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
              <div key={sc.carpeta_id} className={styles.folderCard} onClick={() => onSelectCarpeta(sc.carpeta_id)}>
                <div className={styles.folderCardIcon}>{sc.publica ? "🌐" : "📁"}</div>
                <div className={styles.folderCardName}>{sc.nombre}</div>
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
                    onClick={() => setSelectedRecurso(selectedRecurso?.recurso_id === r.recurso_id ? null : r)}>
                    <span className={styles.resourceIcon}>📄</span>
                    <span className={styles.resourceName}>{r.nombre}</span>
                    {etiObjs.map((e) => (
                      <span key={e.etiqueta_id} className={styles.etiquetaBadgeSmall}>{e.nombre}</span>
                    ))}
                    <span className={styles.resourceDate}>{fmtDate(r.created_at)}</span>
                    {canEdit && (
                      <span className={styles.resourceDelete} style={{ display: "flex", gap: 4 }}>
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
        <div style={{ marginTop: 20 }}>
          <div className={styles.resourceDetail}>
            <div className={styles.resourceDetailHeader}>
              <span style={{ fontSize: 22 }}>📄</span>
              <div>
                <div className={styles.resourceDetailName}>{selectedRecurso.nombre}</div>
                <div className={styles.resourceDetailMeta}>Creado {fmtDate(selectedRecurso.created_at)}</div>
              </div>
            </div>
            <div className={styles.resourceContent}>
              {selectedRecurso.contenido || <span style={{ opacity: .4 }}>Sin contenido</span>}
            </div>
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