"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase, type Carpeta, type Recurso } from "../lib/supabaseClient";
import styles from "./page.module.css";

// ─── Helpers ──────────────────────────────────────────────────────────────

type TreeNode = Carpeta & { children: TreeNode[] };

function buildTree(carpetas: Carpeta[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  carpetas.forEach((c) => map.set(c.carpeta_id, { ...c, children: [] }));
  const roots: TreeNode[] = [];
  map.forEach((node) => {
    if (node.id_padre && map.has(node.id_padre)) {
      map.get(node.id_padre)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function flatFolders(
  nodes: TreeNode[],
  depth = 0
): { id: string; label: string }[] {
  const result: { id: string; label: string }[] = [];
  nodes.forEach((n) => {
    result.push({ id: n.carpeta_id, label: "\u3000".repeat(depth) + "📁 " + n.nombre });
    result.push(...flatFolders(n.children, depth + 1));
  });
  return result;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric", month: "short", year: "numeric",
  });
}

// ─── Sidebar Tree ──────────────────────────────────────────────────────────

function SidebarTree({
  nodes, depth, selectedId, expandedIds, onSelect, onToggle, onDelete,
}: {
  nodes: TreeNode[];
  depth: number;
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string, nombre: string) => void;
}) {
  return (
    <>
      {nodes.map((node) => {
        const isExpanded = expandedIds.has(node.carpeta_id);
        const isSelected = selectedId === node.carpeta_id;
        const hasChildren = node.children.length > 0;

        return (
          <div key={node.carpeta_id}>
            <div
              className={`${styles.treeNode} ${isSelected ? styles.selected : ""}`}
              style={{ paddingLeft: `${10 + depth * 14}px` }}
            >
              <span
                className={`${styles.nodeArrow} ${isExpanded ? styles.open : ""}`}
                onClick={() => hasChildren && onToggle(node.carpeta_id)}
                style={{ visibility: hasChildren ? "visible" : "hidden" }}
              >▶</span>
              <span
                className={styles.nodeIcon}
                onClick={() => { onSelect(node.carpeta_id); onToggle(node.carpeta_id); }}
              >{isExpanded ? "📂" : "📁"}</span>
              <span
                className={styles.nodeLabel}
                onClick={() => { onSelect(node.carpeta_id); onToggle(node.carpeta_id); }}
              >{node.nombre}</span>
              <button
                className={styles.nodeDelete}
                title="Eliminar carpeta"
                onClick={(e) => { e.stopPropagation(); onDelete(node.carpeta_id, node.nombre); }}
              >×</button>
            </div>
            {isExpanded && node.children.length > 0 && (
              <div className={styles.treeChildren}>
                <SidebarTree
                  nodes={node.children} depth={depth + 1}
                  selectedId={selectedId} expandedIds={expandedIds}
                  onSelect={onSelect} onToggle={onToggle} onDelete={onDelete}
                />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

// ─── Modal Carpeta ─────────────────────────────────────────────────────────

function ModalCarpeta({ tree, defaultParentId, onClose, onSave }: {
  tree: TreeNode[];
  defaultParentId: string | null;
  onClose: () => void;
  onSave: (nombre: string, parentId: string | null) => Promise<void>;
}) {
  const [nombre, setNombre] = useState("");
  const [parentId, setParentId] = useState<string | null>(defaultParentId);
  const [saving, setSaving] = useState(false);
  const allFolders = flatFolders(tree);

  async function handleSave() {
    if (!nombre.trim()) return;
    setSaving(true);
    await onSave(nombre.trim(), parentId);
    setSaving(false);
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalTitle}>📁 Nueva Carpeta</div>
        <div className={styles.modalLabel}>Nombre</div>
        <input
          autoFocus className={styles.modalInput} value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nombre de la carpeta…"
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
        />
        <div className={styles.modalLabel}>Ubicación</div>
        <select
          className={styles.modalSelect}
          value={parentId ?? ""}
          onChange={(e) => setParentId(e.target.value || null)}
        >
          <option value="">/ Raíz</option>
          {allFolders.map((f) => (
            <option key={f.id} value={f.id}>{f.label}</option>
          ))}
        </select>
        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
          <button className={styles.btnPrimary} disabled={!nombre.trim() || saving} onClick={handleSave}>
            {saving ? "Guardando…" : "Crear carpeta"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Recurso ─────────────────────────────────────────────────────────

function ModalRecurso({ onClose, onSave }: {
  onClose: () => void;
  onSave: (nombre: string, contenido: string) => Promise<void>;
}) {
  const [nombre, setNombre] = useState("");
  const [contenido, setContenido] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!nombre.trim()) return;
    setSaving(true);
    await onSave(nombre.trim(), contenido);
    setSaving(false);
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalTitle}>📄 Nuevo Recurso</div>
        <div className={styles.modalLabel}>Nombre</div>
        <input
          autoFocus className={styles.modalInput} value={nombre}
          onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del recurso…"
        />
        <div className={styles.modalLabel}>Contenido</div>
        <textarea
          className={styles.modalTextarea} value={contenido}
          onChange={(e) => setContenido(e.target.value)}
          placeholder="Contenido del recurso (opcional)…"
        />
        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
          <button className={styles.btnPrimary} disabled={!nombre.trim() || saving} onClick={handleSave}>
            {saving ? "Guardando…" : "Crear recurso"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Center Panel ──────────────────────────────────────────────────────────

function CenterPanel({
  carpeta, subCarpetas, recursos, loading,
  onSelectCarpeta, onNewRecurso, onDeleteRecurso, onDeleteCarpeta,
}: {
  carpeta: Carpeta | null;
  subCarpetas: Carpeta[];
  recursos: Recurso[];
  loading: boolean;
  onSelectCarpeta: (id: string) => void;
  onNewRecurso: () => void;
  onDeleteRecurso: (id: string) => void;
  onDeleteCarpeta: (id: string, nombre: string) => void;
}) {
  const [selectedRecurso, setSelectedRecurso] = useState<Recurso | null>(null);
  useEffect(() => { setSelectedRecurso(null); }, [carpeta?.carpeta_id]);

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
      {/* Header */}
      <div className={styles.folderHeader}>
        <div className={styles.folderHeaderIcon}>📂</div>
        <div className={styles.folderHeaderInfo}>
          <div className={styles.folderHeaderName}>{carpeta.nombre}</div>
          <div className={styles.folderHeaderMeta}>
            {subCarpetas.length} subcarpeta{subCarpetas.length !== 1 ? "s" : ""}
            {" · "}
            {recursos.length} recurso{recursos.length !== 1 ? "s" : ""}
            {" · "}
            Creada {fmtDate(carpeta.created_at)}
          </div>
        </div>
        <div className={styles.folderActions}>
          <button className={styles.btnPrimary} onClick={onNewRecurso}>+ Recurso</button>
          <button
            className={styles.btnSecondary}
            onClick={() => onDeleteCarpeta(carpeta.carpeta_id, carpeta.nombre)}
          >🗑 Eliminar</button>
        </div>
      </div>

      {/* Sub-carpetas */}
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

      {/* Recursos */}
      {recursos.length > 0 && (
        <>
          <div className={styles.sectionTitle}>Recursos</div>
          <div className={styles.resourceList}>
            {recursos.map((r) => (
              <div
                key={r.recurso_id}
                className={styles.resourceRow}
                onClick={() => setSelectedRecurso(selectedRecurso?.recurso_id === r.recurso_id ? null : r)}
              >
                <span className={styles.resourceIcon}>📄</span>
                <span className={styles.resourceName}>{r.nombre}</span>
                <span className={styles.resourceDate}>{fmtDate(r.created_at)}</span>
                <span className={styles.resourceDelete}>
                  <button
                    className={styles.btnIcon}
                    onClick={(e) => { e.stopPropagation(); onDeleteRecurso(r.recurso_id); }}
                  >🗑</button>
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Recurso detail */}
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

      {/* Empty */}
      {subCarpetas.length === 0 && recursos.length === 0 && (
        <div className={styles.emptyState} style={{ marginTop: 60 }}>
          <div className={styles.emptyIcon}>📭</div>
          <div className={styles.emptyText}>Esta carpeta está vacía</div>
        </div>
      )}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [carpetas, setCarpetas] = useState<Carpeta[]>([]);
  const [recursos, setRecursos] = useState<Recurso[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loadingTree, setLoadingTree] = useState(true);
  const [loadingCenter, setLoadingCenter] = useState(false);
  const [showModalCarpeta, setShowModalCarpeta] = useState(false);
  const [showModalRecurso, setShowModalRecurso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Obtener sesión activa ────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login"); return; }
      setUserId(session.user.id);
    });
  }, [router]);

  const loadCarpetas = useCallback(async () => {
    if (!userId) return;
    setLoadingTree(true);
    const { data, error } = await supabase
      .from("Carpetas").select("*")
      .eq("user_id", userId).order("created_at");
    if (error) setError(error.message);
    else setCarpetas(data as Carpeta[]);
    setLoadingTree(false);
  }, [userId]);

  const loadRecursos = useCallback(async (carpetaId: string) => {
    setLoadingCenter(true);
    const { data, error } = await supabase
      .from("Recursos").select("*")
      .eq("carpeta_id", carpetaId).order("created_at");
    if (error) { setError(error.message); setRecursos([]); }
    else setRecursos(data as Recurso[]);
    setLoadingCenter(false);
  }, []);

  useEffect(() => { if (userId) loadCarpetas(); }, [userId, loadCarpetas]);
  useEffect(() => {
    if (selectedId) loadRecursos(selectedId);
    else setRecursos([]);
  }, [selectedId, loadRecursos]);

  const tree = buildTree(carpetas);

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleCreateCarpeta(nombre: string, parentId: string | null) {
    if (!userId) return;
    // Comprobar nombre duplicado en la misma ubicación
    const duplicado = carpetas.some(
      (c) => c.nombre.toLowerCase() === nombre.toLowerCase() && c.id_padre === parentId
    );
    if (duplicado) {
      setError(`Ya existe una carpeta llamada "${nombre}" en esa ubicación`);
      return;
    }
    const { error } = await supabase.from("Carpetas").insert({
      user_id: userId, id_padre: parentId, nombre,
    });
    if (error) { setError(error.message); return; }
    await loadCarpetas();
    setShowModalCarpeta(false);
    if (parentId) setExpandedIds((prev) => new Set([...prev, parentId]));
  }

  async function handleDeleteCarpeta(carpetaId: string, nombre: string) {
    if (!confirm(`¿Eliminar la carpeta "${nombre}" y todo su contenido?`)) return;
    const { error } = await supabase.from("Carpetas").delete().eq("carpeta_id", carpetaId);
    if (error) { setError(error.message); return; }
    if (selectedId === carpetaId) setSelectedId(null);
    await loadCarpetas();
  }

  async function handleCreateRecurso(nombre: string, contenido: string) {
    if (!selectedId || !userId) return;
    const { error } = await supabase.from("Recursos").insert({
      user_id: userId, carpeta_id: selectedId, nombre, contenido,
    });
    if (error) { setError(error.message); return; }
    await loadRecursos(selectedId);
    setShowModalRecurso(false);
  }

  async function handleDeleteRecurso(recursoId: string) {
    if (!confirm("¿Eliminar este recurso?")) return;
    const { error } = await supabase.from("Recursos").delete().eq("recurso_id", recursoId);
    if (error) { setError(error.message); return; }
    if (selectedId) await loadRecursos(selectedId);
  }

  const selectedCarpeta = carpetas.find((c) => c.carpeta_id === selectedId) ?? null;
  const subCarpetas = carpetas.filter((c) => c.id_padre === selectedId);

  return (
    <>
      <main className={styles.main}>
        {/* Top bar */}
        <div className={styles.topBar}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>X</span>
            Gestor De Archivos
          </div>
          <nav className={styles.topNav}>
            <button className={styles.btnPrimary} onClick={() => setShowModalCarpeta(true)}>
              + Nueva Carpeta
            </button>
          </nav>
        </div>

        {/* Sidebar */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <span className={styles.sidebarTitle}>Carpetas</span>
          </div>
          {loadingTree ? (
            <div className={styles.sidebarEmpty}>Cargando…</div>
          ) : tree.length === 0 ? (
            <div className={styles.sidebarEmpty}>
              Aún no tienes carpetas.<br />Crea una con el botón de arriba.
            </div>
          ) : (
            <SidebarTree
              nodes={tree} depth={0}
              selectedId={selectedId} expandedIds={expandedIds}
              onSelect={setSelectedId} onToggle={toggleExpanded}
              onDelete={handleDeleteCarpeta}
            />
          )}
        </div>

        {/* Center */}
        <div className={styles.center}>
          <CenterPanel
            carpeta={selectedCarpeta}
            subCarpetas={subCarpetas}
            recursos={recursos}
            loading={loadingCenter}
            onSelectCarpeta={(id) => {
              setSelectedId(id);
              setExpandedIds((prev) => new Set([...prev, id]));
            }}
            onNewRecurso={() => setShowModalRecurso(true)}
            onDeleteRecurso={handleDeleteRecurso}
            onDeleteCarpeta={handleDeleteCarpeta}
          />
        </div>
      </main>

      {showModalCarpeta && (
        <ModalCarpeta
          tree={tree}
          defaultParentId={selectedId}
          onClose={() => setShowModalCarpeta(false)}
          onSave={handleCreateCarpeta}
        />
      )}

      {showModalRecurso && selectedId && (
        <ModalRecurso
          onClose={() => setShowModalRecurso(false)}
          onSave={handleCreateRecurso}
        />
      )}

      {error && (
        <div className={styles.errorToast} onClick={() => setError(null)}>
          ⚠ {error}
        </div>
      )}
    </>
  );
}