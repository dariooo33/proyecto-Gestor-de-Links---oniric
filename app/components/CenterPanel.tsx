"use client";

import { useState, useEffect, useRef } from "react";
import { Carpeta, Recurso, NivelAcceso, Categoria } from "../types";
import { fmtDate } from "../helpers";
import { supabase } from "../../lib/supabaseClient";
import styles from "../page.module.css";

export function CenterPanel({
  carpeta, subCarpetas, recursos, loading, userId, nivelAcceso,
  onSelectCarpeta, onNewRecurso, onDeleteRecurso, onDeleteCarpeta,
  onOpenPermisos, onLeaveShared, onTogglePublica, onSetCategoria,
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
}) {
  const [selectedRecurso, setSelectedRecurso] = useState<Recurso | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Filtros
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriasFiltro, setCategoriasFiltro] = useState<Set<string>>(new Set());
  const [busquedaLocal, setBusquedaLocal] = useState("");

  // Categoría actual de la carpeta seleccionada y todas las categorías disponibles
  const [todasCategorias, setTodasCategorias] = useState<Categoria[]>([]);
  const [categoriaActual, setCategoriaActual] = useState<string | null>(null);
  const [showCategoriaSelector, setShowCategoriaSelector] = useState(false);
  const [savingCategoria, setSavingCategoria] = useState(false);

  // Cargar todas las categorías disponibles una sola vez
  useEffect(() => {
    supabase.from("Categorias").select("categoria_id, nombre").order("nombre")
      .then(({ data }) => setTodasCategorias((data as Categoria[]) ?? []));
  }, []);

  // Cargar categoría actual de la carpeta seleccionada
  useEffect(() => {
    if (!carpeta) { setCategoriaActual(null); return; }
    supabase
      .from("Carpetas_Recrusos_Cat")
      .select("categoria_id")
      .eq("carpeta_id", carpeta.carpeta_id)
      .not("categoria_id", "is", null)
      .maybeSingle()
      .then(({ data }) => {
        setCategoriaActual(data?.categoria_id ?? null);
      });
  }, [carpeta?.carpeta_id]);

  // Cargar categorías de las subcarpetas actuales (para filtros)
  useEffect(() => {
    if (!carpeta) return;
    const ids = subCarpetas.map((c) => c.carpeta_id);
    if (ids.length === 0) { setCategorias([]); return; }
    supabase
      .from("Carpetas_Recrusos_Cat")
      .select("categoria_id, Categorias(categoria_id, nombre)")
      .in("carpeta_id", ids)
      .then(({ data }) => {
        const seen = new Set<string>();
        const cats: Categoria[] = [];
        (data ?? []).forEach((r: any) => {
          const c = r.Categorias;
          if (c && !seen.has(c.categoria_id)) {
            seen.add(c.categoria_id);
            cats.push(c);
          }
        });
        setCategorias(cats);
      });
  }, [carpeta?.carpeta_id, subCarpetas]);

  useEffect(() => {
    setSelectedRecurso(null);
    setMenuOpen(false);
    setShowCategoriaSelector(false);
    setCategoriasFiltro(new Set());
    setBusquedaLocal("");
  }, [carpeta?.carpeta_id]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setShowCategoriaSelector(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const canEdit = nivelAcceso === "owner" || nivelAcceso === "edicion";
  const isOwner = nivelAcceso === "owner";

  // Mapa carpeta → categorías para el filtro
  const [carpetaCategorias, setCarpetaCategorias] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const ids = subCarpetas.map((c) => c.carpeta_id);
    if (ids.length === 0) { setCarpetaCategorias({}); return; }
    supabase
      .from("Carpetas_Recrusos_Cat")
      .select("carpeta_id, categoria_id")
      .in("carpeta_id", ids)
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
            <button className={styles.btnMenu} onClick={() => { setMenuOpen((v) => !v); setShowCategoriaSelector(false); }} title="Opciones">⋯</button>
            {menuOpen && (
              <div className={styles.menuDropdown}>
                {isOwner && (
                  <>
                    <button className={styles.menuItem} onClick={() => { setMenuOpen(false); onOpenPermisos(); }}>
                      <span>🔐</span> Permisos
                    </button>
                    <button className={styles.menuItem} onClick={() => { setMenuOpen(false); onTogglePublica(carpeta.carpeta_id, !carpeta.publica); }}>
                      <span>{carpeta.publica ? "🔒" : "🌐"}</span>
                      {carpeta.publica ? "Hacer privada" : "Hacer pública"}
                    </button>

                    {/* ── Categoría ── */}
                    <button
                      className={styles.menuItem}
                      onClick={() => setShowCategoriaSelector((v) => !v)}
                    >
                      <span>🏷️</span>
                      {categoriaActual ? "Cambiar categoría" : "Asignar categoría"}
                    </button>

                    {showCategoriaSelector && (
                      <div className={styles.menuCategoriaSelector}>
                        <select
                          className={styles.menuCategoriaSelect}
                          value={categoriaActual ?? ""}
                          onChange={(e) => handleGuardarCategoria(e.target.value || null)}
                          disabled={savingCategoria}
                          autoFocus
                        >
                          <option value="">Sin categoría</option>
                          {todasCategorias.map((c) => (
                            <option key={c.categoria_id} value={c.categoria_id}>{c.nombre}</option>
                          ))}
                        </select>
                        {categoriaActual && (
                          <button
                            className={styles.menuCategoriaQuitar}
                            disabled={savingCategoria}
                            onClick={() => handleGuardarCategoria(null)}
                          >
                            × Quitar categoría
                          </button>
                        )}
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
        <input
          className={styles.filterSearch}
          value={busquedaLocal}
          onChange={(e) => setBusquedaLocal(e.target.value)}
          placeholder="Buscar en esta carpeta…"
        />
        {categorias.length > 0 && (
          <div className={styles.filterCategorias}>
            {categorias.map((cat) => (
              <button
                key={cat.categoria_id}
                className={`${styles.filterChip} ${categoriasFiltro.has(cat.categoria_id) ? styles.filterChipActive : ""}`}
                onClick={() => toggleCategoria(cat.categoria_id)}
              >
                {cat.nombre}
              </button>
            ))}
            {categoriasFiltro.size > 0 && (
              <button className={styles.filterClear} onClick={() => setCategoriasFiltro(new Set())}>
                × Limpiar
              </button>
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
            {recursosFiltrados.map((r) => (
              <div key={r.recurso_id} className={styles.resourceRow}
                onClick={() => setSelectedRecurso(selectedRecurso?.recurso_id === r.recurso_id ? null : r)}>
                <span className={styles.resourceIcon}>📄</span>
                <span className={styles.resourceName}>{r.nombre}</span>
                <span className={styles.resourceDate}>{fmtDate(r.created_at)}</span>
                {canEdit && (
                  <span className={styles.resourceDelete}>
                    <button className={styles.btnIcon}
                      onClick={(e) => { e.stopPropagation(); onDeleteRecurso(r.recurso_id); }}>🗑</button>
                  </span>
                )}
              </div>
            ))}
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