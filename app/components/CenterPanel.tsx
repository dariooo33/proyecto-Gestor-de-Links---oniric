"use client";

import { useState, useEffect, useRef } from "react";
import { Carpeta, Recurso, NivelAcceso } from "../types";
import { fmtDate } from "../helpers";
import styles from "../page.module.css";

export function CenterPanel({
  carpeta, subCarpetas, recursos, loading, userId, nivelAcceso,
  onSelectCarpeta, onNewRecurso, onDeleteRecurso, onDeleteCarpeta, onOpenPermisos, onLeaveShared,
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
}) {
  const [selectedRecurso, setSelectedRecurso] = useState<Recurso | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSelectedRecurso(null); setMenuOpen(false); }, [carpeta?.carpeta_id]);

  // Cerrar menú al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const canEdit = nivelAcceso === "owner" || nivelAcceso === "edicion";
  const isOwner = nivelAcceso === "owner";

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

  return (
    <div>
      <div className={styles.folderHeader}>
        <div className={styles.folderHeaderIcon}>📂</div>
        <div className={styles.folderHeaderInfo}>
          <div className={styles.folderHeaderName}>
            {carpeta.nombre}
            {nivelAcceso === "lectura" && <span className={styles.nivelBadge} data-nivel="lectura">👁 Solo lectura</span>}
            {nivelAcceso === "edicion" && <span className={styles.nivelBadge} data-nivel="edicion">✏️ Edición</span>}
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
            <button
              className={styles.btnMenu}
              onClick={() => setMenuOpen((v) => !v)}
              title="Opciones"
            >⋯</button>
            {menuOpen && (
              <div className={styles.menuDropdown}>
                {isOwner && (
                  <>
                    <button className={styles.menuItem} onClick={() => { setMenuOpen(false); onOpenPermisos(); }}>
                      <span>🔐</span> Permisos
                    </button>
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

      {subCarpetas.length > 0 && (
        <>
          <div className={styles.sectionTitle}>Subcarpetas</div>
          <div className={styles.folderGrid}>
            {subCarpetas.map((sc) => (
              <div key={sc.carpeta_id} className={styles.folderCard} onClick={() => onSelectCarpeta(sc.carpeta_id)}>
                <div className={styles.folderCardIcon}>📁</div>
                <div className={styles.folderCardName}>{sc.nombre}</div>
                <div className={styles.folderCardMeta}>Creada {fmtDate(sc.created_at)}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {recursos.length > 0 && (
        <>
          <div className={styles.sectionTitle}>Recursos</div>
          <div className={styles.resourceList}>
            {recursos.map((r) => (
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

      {subCarpetas.length === 0 && recursos.length === 0 && (
        <div className={styles.emptyState} style={{ marginTop: 60 }}>
          <div className={styles.emptyIcon}>📭</div>
          <div className={styles.emptyText}>Esta carpeta está vacía</div>
        </div>
      )}
    </div>
  );
}