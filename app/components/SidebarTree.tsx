"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { TreeNode, Recurso } from "../types";
import { supabase } from "@/lib/supabaseClient";
import styles from "../page.module.css";

interface ContextMenuState {
  x: number;
  y: number;
  node: TreeNode;
}

interface RecursoContextMenuState {
  x: number;
  y: number;
  recurso: Recurso;
}

// ── Menú contextual carpetas ───────────────────────────────────────────────
function ContextMenu({
  menu, userId, onClose, onRename, onDelete, onNewFolder, onNewResource, onPermissions,
}: {
  menu: ContextMenuState;
  userId: string | null;
  onClose: () => void;
  onRename: (node: TreeNode) => void;
  onDelete: (id: string, nombre: string) => void;
  onNewFolder: (parentId: string) => void;
  onNewResource: (parentId: string) => void;
  onPermissions: (node: TreeNode) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isOwner = menu.node.user_id === userId;

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function keyHandler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [onClose]);

  return (
    <div ref={ref} className={styles.contextMenu} style={{ position: "fixed", top: menu.y, left: menu.x, zIndex: 1000 }}>
      <div className={styles.contextMenuHeader}>
        <span className={styles.contextMenuIcon}>📁</span>
        <span className={styles.contextMenuTitle}>{menu.node.nombre}</span>
      </div>
      <div className={styles.menuDivider} />
      <button className={styles.menuItem} onClick={() => { onNewFolder(menu.node.carpeta_id); onClose(); }}>
        <span>📁</span> Nueva subcarpeta
      </button>
      <button className={styles.menuItem} onClick={() => { onNewResource(menu.node.carpeta_id); onClose(); }}>
        <span>📄</span> Nuevo recurso
      </button>
      {isOwner && (
        <>
          <div className={styles.menuDivider} />
          <button className={styles.menuItem} onClick={() => { onRename(menu.node); onClose(); }}>
            <span>✏️</span> Renombrar
          </button>
          <button className={styles.menuItem} onClick={() => { onPermissions(menu.node); onClose(); }}>
            <span>🔐</span> Permisos
          </button>
          <div className={styles.menuDivider} />
          <button
            className={`${styles.menuItem} ${styles.menuItemDanger}`}
            onClick={() => { onDelete(menu.node.carpeta_id, menu.node.nombre); onClose(); }}
          >
            <span>🗑️</span> Eliminar
          </button>
        </>
      )}
    </div>
  );
}

// ── Menú contextual recursos ───────────────────────────────────────────────
function RecursoContextMenu({
  menu, onClose, onRename, onDelete, onEdit,
}: {
  menu: RecursoContextMenuState;
  onClose: () => void;
  onRename: (recurso: Recurso) => void;
  onDelete: (id: string, nombre: string) => void;
  onEdit: (recurso: Recurso) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function keyHandler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [onClose]);

  return (
    <div ref={ref} className={styles.contextMenu} style={{ position: "fixed", top: menu.y, left: menu.x, zIndex: 1000 }}>
      <div className={styles.contextMenuHeader}>
        <span className={styles.contextMenuIcon}>📄</span>
        <span className={styles.contextMenuTitle}>{menu.recurso.nombre}</span>
      </div>
      <div className={styles.menuDivider} />
      <button className={styles.menuItem} onClick={() => { onRename(menu.recurso); onClose(); }}>
        <span>✏️</span> Renombrar
      </button>
      <button className={styles.menuItem} onClick={() => { onEdit(menu.recurso); onClose(); }}>
        <span>📝</span> Editar
      </button>
      <div className={styles.menuDivider} />
      <button
        className={`${styles.menuItem} ${styles.menuItemDanger}`}
        onClick={() => { onDelete(menu.recurso.recurso_id, menu.recurso.nombre); onClose(); }}
      >
        <span>🗑️</span> Eliminar
      </button>
    </div>
  );
}

// ── Modal edición recurso ──────────────────────────────────────────────────
function EditRecursoModal({
  recurso, onClose, onSave,
}: {
  recurso: Recurso;
  onClose: () => void;
  onSave: (id: string, nombre: string, contenido: string, url: string) => Promise<void>;
}) {
  const [nombre, setNombre] = useState(recurso.nombre);
  const [contenido, setContenido] = useState(recurso.contenido ?? "");
  const [url, setUrl] = useState(recurso.url ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!nombre.trim()) return;
    setSaving(true);
    await onSave(recurso.recurso_id, nombre.trim(), contenido, url.trim());
    setSaving(false);
    onClose();
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalTitle}>📝 Editar Recurso</div>

        <div className={styles.modalLabel}>Nombre</div>
        <input autoFocus className={styles.modalInput} value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="Nombre del recurso…" />

        <div className={styles.modalLabel}>Contenido</div>
        <textarea className={styles.modalTextarea} value={contenido}
          onChange={(e) => setContenido(e.target.value)}
          placeholder="Contenido del recurso (opcional)…" />

        <div className={styles.modalLabel}>URL <span className={styles.modalLabelOpt}>(opcional)</span></div>
        <input className={styles.modalInput} value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…" type="url" />

        <div className={styles.modalActions}>
          <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
          <button type="button" className={styles.btnPrimary} disabled={!nombre.trim() || saving} onClick={handleSave}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Fila de recurso en sidebar ─────────────────────────────────────────────
function RecursoRow({
  recurso, depth, draggingRecursoId, dragOverRecursoId,
  renamingRecursoId, onContextMenu, onRenameSubmit,
  onDragStart, onDragEnd,
}: {
  recurso: Recurso;
  depth: number;
  draggingRecursoId: string | null;
  dragOverRecursoId: string | null;
  renamingRecursoId: string | null;
  onContextMenu: (e: React.MouseEvent, recurso: Recurso) => void;
  onRenameSubmit: (id: string, nombre: string) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
}) {
  const isRenaming = renamingRecursoId === recurso.recurso_id;
  const isDragging = draggingRecursoId === recurso.recurso_id;
  const isDragOver = dragOverRecursoId === recurso.recurso_id && draggingRecursoId !== recurso.recurso_id;
  const [renameValue, setRenameValue] = useState(recurso.nombre);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) {
      setRenameValue(recurso.nombre);
      setTimeout(() => inputRef.current?.select(), 30);
    }
  }, [isRenaming, recurso.nombre]);

  return (
    <div
      className={[
        styles.sidebarRecursoRow,
        isDragging ? styles.treeNodeDragging : "",
        isDragOver ? styles.treeNodeDragOver : "",
      ].filter(Boolean).join(" ")}
      style={{ paddingLeft: `${10 + (depth + 1) * 14}px` }}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("tipo", "recurso"); onDragStart(recurso.recurso_id); }}
      onDragEnd={onDragEnd}
      onContextMenu={(e) => onContextMenu(e, recurso)}
      title={recurso.url ?? undefined}
    >
      <span className={styles.sidebarRecursoIcon}>{recurso.url ? "🔗" : "📄"}</span>
      {isRenaming ? (
        <input
          ref={inputRef}
          className={styles.nodeRenameInput}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onRenameSubmit(recurso.recurso_id, renameValue);
            if (e.key === "Escape") onRenameSubmit(recurso.recurso_id, recurso.nombre);
          }}
          onBlur={() => onRenameSubmit(recurso.recurso_id, renameValue)}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className={styles.sidebarRecursoLabel}
          onDoubleClick={() => onRenameSubmit(recurso.recurso_id, "__EDIT__")}
        >
          {recurso.nombre}
        </span>
      )}
    </div>
  );
}

// ── Nodo individual del árbol ──────────────────────────────────────────────
function TreeNodeRow({
  node, depth, selectedId, expandedIds, draggingId, dragOverId,
  onSelect, onToggle, onDelete, onContextMenu, onRenameSubmit,
  renamingId, sharedIds, userId, onDragStart, onDragOver, onDrop, onDragEnd,
  showRecursos, recursos, draggingRecursoId, dragOverRecursoId, renamingRecursoId,
  onRecursoContextMenu, onRecursoRenameSubmit, onRecursoDragStart, onRecursoDragEnd,
  onRecursoDrop,
}: {
  node: TreeNode;
  depth: number;
  selectedId: string | null;
  expandedIds: Set<string>;
  draggingId: string | null;
  dragOverId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string, nombre: string) => void;
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
  onRenameSubmit: (id: string, nuevoNombre: string) => void;
  renamingId: string | null;
  sharedIds: Set<string>;
  userId: string | null;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (targetId: string) => void;
  onDragEnd: () => void;
  showRecursos: boolean;
  recursos: Record<string, Recurso[]>;
  draggingRecursoId: string | null;
  dragOverRecursoId: string | null;
  renamingRecursoId: string | null;
  onRecursoContextMenu: (e: React.MouseEvent, recurso: Recurso) => void;
  onRecursoRenameSubmit: (id: string, nombre: string) => void;
  onRecursoDragStart: (id: string) => void;
  onRecursoDragEnd: () => void;
  onRecursoDrop: (e: React.DragEvent, targetCarpetaId: string) => void;
}) {
  const isExpanded = expandedIds.has(node.carpeta_id);
  const isSelected = selectedId === node.carpeta_id;
  const hasChildren = node.children.length > 0;
  const isOwner = node.user_id === userId;
  const isShared = sharedIds.has(node.carpeta_id);
  const isRenaming = renamingId === node.carpeta_id;
  const isDragging = draggingId === node.carpeta_id;
  const isDragOver = dragOverId === node.carpeta_id && draggingId !== node.carpeta_id;

  const carpetaRecursos = recursos[node.carpeta_id] ?? [];
  const hasRecursos = showRecursos && isExpanded && carpetaRecursos.length > 0;
  const hasAnyChildren = hasChildren || hasRecursos;

  const [renameValue, setRenameValue] = useState(node.nombre);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) {
      setRenameValue(node.nombre);
      setTimeout(() => renameInputRef.current?.select(), 30);
    }
  }, [isRenaming, node.nombre]);

  function handleRenameKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") onRenameSubmit(node.carpeta_id, renameValue);
    if (e.key === "Escape") onRenameSubmit(node.carpeta_id, node.nombre);
  }

  return (
    <div key={node.carpeta_id}>
      <div
        className={[
          styles.treeNode,
          isSelected ? styles.selected : "",
          isDragging ? styles.treeNodeDragging : "",
          isDragOver ? styles.treeNodeDragOver : "",
        ].filter(Boolean).join(" ")}
        style={{ paddingLeft: `${10 + depth * 14}px` }}
        draggable={isOwner}
        onDragStart={() => { if (isOwner) { onDragStart(node.carpeta_id); } }}
        onDragOver={(e) => { e.preventDefault(); onDragOver(e, node.carpeta_id); }}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.getData("tipo") === "recurso") onRecursoDrop(e, node.carpeta_id);
          else onDrop(node.carpeta_id);
        }}
        onDragEnd={onDragEnd}
        onContextMenu={(e) => onContextMenu(e, node)}
      >
        <span
          className={`${styles.nodeArrow} ${isExpanded ? styles.open : ""}`}
          onClick={() => onToggle(node.carpeta_id)}
          style={{ visibility: hasChildren || (showRecursos && carpetaRecursos.length > 0) ? "visible" : "hidden" }}
        >▶</span>

        <span
          className={styles.nodeIcon}
          onClick={() => { onSelect(node.carpeta_id); onToggle(node.carpeta_id); }}
        >{isExpanded ? "📂" : "📁"}</span>

        {isRenaming ? (
          <input
            ref={renameInputRef}
            className={styles.nodeRenameInput}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={() => onRenameSubmit(node.carpeta_id, renameValue)}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className={styles.nodeLabel}
            onClick={() => { onSelect(node.carpeta_id); onToggle(node.carpeta_id); }}
            onDoubleClick={() => isOwner && onRenameSubmit(node.carpeta_id, "__EDIT__")}
          >{node.nombre}</span>
        )}

        {isShared && !isOwner && (
          <span className={styles.sharedBadge} title="Carpeta compartida contigo">↗</span>
        )}
        {isOwner && (
          <button
            className={styles.nodeDelete}
            title="Eliminar carpeta"
            onClick={(e) => { e.stopPropagation(); onDelete(node.carpeta_id, node.nombre); }}
          >×</button>
        )}
      </div>

      {isExpanded && (node.children.length > 0 || hasRecursos) && (
        <div className={styles.treeChildren}>
          {node.children.map((child) => (
            <TreeNodeRow
              key={child.carpeta_id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              draggingId={draggingId}
              dragOverId={dragOverId}
              onSelect={onSelect}
              onToggle={onToggle}
              onDelete={onDelete}
              onContextMenu={onContextMenu}
              onRenameSubmit={onRenameSubmit}
              renamingId={renamingId}
              sharedIds={sharedIds}
              userId={userId}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
              showRecursos={showRecursos}
              recursos={recursos}
              draggingRecursoId={draggingRecursoId}
              dragOverRecursoId={dragOverRecursoId}
              renamingRecursoId={renamingRecursoId}
              onRecursoContextMenu={onRecursoContextMenu}
              onRecursoRenameSubmit={onRecursoRenameSubmit}
              onRecursoDragStart={onRecursoDragStart}
              onRecursoDragEnd={onRecursoDragEnd}
              onRecursoDrop={onRecursoDrop}
            />
          ))}
          {hasRecursos && carpetaRecursos.map((r) => (
            <RecursoRow
              key={r.recurso_id}
              recurso={r}
              depth={depth + 1}
              draggingRecursoId={draggingRecursoId}
              dragOverRecursoId={dragOverRecursoId}
              renamingRecursoId={renamingRecursoId}
              onContextMenu={onRecursoContextMenu}
              onRenameSubmit={onRecursoRenameSubmit}
              onDragStart={onRecursoDragStart}
              onDragEnd={onRecursoDragEnd}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────
export function SidebarTree({
  nodes, depth, selectedId, expandedIds,
  onSelect, onToggle, onDelete, onRename, onMove,
  onNewFolder, onNewResource, onOpenPermisos, sharedIds, userId,
  onDeleteRecurso, onRefreshRecursos, refreshTrigger,
}: {
  nodes: TreeNode[];
  depth: number;
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string, nombre: string) => void;
  onRename: (id: string, nuevoNombre: string) => Promise<void>;
  onMove: (draggedId: string, targetId: string | null) => Promise<void>;
  onNewFolder: (parentId: string | null) => void;
  onNewResource: (parentId: string) => void;
  onOpenPermisos: (node: TreeNode) => void;
  sharedIds: Set<string>;
  userId: string | null;
  onDeleteRecurso: (id: string) => void;
  onRefreshRecursos: (carpetaId: string) => void;
  refreshTrigger?: number;
}) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [recursoContextMenu, setRecursoContextMenu] = useState<RecursoContextMenuState | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const [dragOverRoot, setDragOverRoot] = useState(false);
  const [showRecursos, setShowRecursos] = useState(false);
  const [recursos, setRecursos] = useState<Record<string, Recurso[]>>({});
  const [renamingRecursoId, setRenamingRecursoId] = useState<string | null>(null);
  const [draggingRecursoId, setDraggingRecursoId] = useState<string | null>(null);
  const draggingRecursoIdRef = useRef<string | null>(null);
  const [dragOverRecursoId, setDragOverRecursoId] = useState<string | null>(null);
  const [editingRecurso, setEditingRecurso] = useState<Recurso | null>(null);

  // Cargar recursos de las carpetas expandidas
  useEffect(() => {
    if (!showRecursos) return;
    const ids = Array.from(expandedIds);
    if (ids.length === 0) return;
    Promise.all(
      ids.map((id) =>
        supabase.from("Recursos").select("*").eq("carpeta_id", id).order("created_at")
          .then(({ data }) => ({ id, data: (data as Recurso[]) ?? [] }))
      )
    ).then((results) => {
      setRecursos((prev) => {
        const next = { ...prev };
        results.forEach(({ id, data }) => { next[id] = data; });
        return next;
      });
    });
  }, [showRecursos, expandedIds, refreshTrigger]);

  useEffect(() => {
    if (!showRecursos) setRecursos({});
  }, [showRecursos]);

  function handleContextMenu(e: React.MouseEvent, node: TreeNode) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: Math.min(e.clientX, window.innerWidth - 200), y: Math.min(e.clientY, window.innerHeight - 260), node });
  }

  function handleRecursoContextMenu(e: React.MouseEvent, recurso: Recurso) {
    e.preventDefault();
    e.stopPropagation();
    setRecursoContextMenu({ x: Math.min(e.clientX, window.innerWidth - 200), y: Math.min(e.clientY, window.innerHeight - 180), recurso });
  }

  function handleRenameSubmit(id: string, nuevoNombre: string) {
    if (nuevoNombre === "__EDIT__") { setRenamingId(id); return; }
    setRenamingId(null);
    const node = findNode(nodes, id);
    if (nuevoNombre.trim() && nuevoNombre.trim() !== node?.nombre) {
      onRename(id, nuevoNombre.trim());
    }
  }

  function handleRecursoRenameSubmit(id: string, nuevoNombre: string) {
    if (nuevoNombre === "__EDIT__") { setRenamingRecursoId(id); return; }
    setRenamingRecursoId(null);
    if (!nuevoNombre.trim()) return;
    let recursoActual: Recurso | null = null;
    for (const arr of Object.values(recursos)) {
      const found = arr.find((r) => r.recurso_id === id);
      if (found) { recursoActual = found; break; }
    }
    if (!recursoActual || nuevoNombre.trim() === recursoActual.nombre) return;
    const carpetaId = recursoActual.carpeta_id;
    supabase.from("Recursos").update({ nombre: nuevoNombre.trim() }).eq("recurso_id", id)
      .then(({ error }) => {
        if (!error) {
          setRecursos((prev) => {
            const next = { ...prev };
            for (const key of Object.keys(next)) {
              next[key] = next[key].map((r) => r.recurso_id === id ? { ...r, nombre: nuevoNombre.trim() } : r);
            }
            return next;
          });
          onRefreshRecursos(carpetaId);
        }
      });
  }

  async function handleRecursoEdit(id: string, nombre: string, contenido: string, url: string) {
    await supabase.from("Recursos").update({ nombre, contenido, url: url || null }).eq("recurso_id", id);
    let carpetaId = "";
    setRecursos((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (next[key].some((r) => r.recurso_id === id)) carpetaId = key;
        next[key] = next[key].map((r) => r.recurso_id === id ? { ...r, nombre, contenido, url: url || null } : r);
      }
      return next;
    });
    if (carpetaId) onRefreshRecursos(carpetaId);
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    if (id !== draggingId) setDragOverId(id);
  }

  const handleDrop = useCallback(async (targetId: string | null) => {
    if (draggingId && draggingId !== targetId) {
      await onMove(draggingId, targetId);
    }
    setDraggingId(null);
    setDragOverId(null);
  }, [draggingId, onMove]);

  async function handleRecursoDrop(e: React.DragEvent, targetCarpetaId: string) {
    const recursoId = draggingRecursoIdRef.current;
    if (!recursoId) return;
    let recursoActual: Recurso | null = null;
    for (const arr of Object.values(recursos)) {
      const found = arr.find((r) => r.recurso_id === recursoId);
      if (found) { recursoActual = found; break; }
    }
    if (!recursoActual || recursoActual.carpeta_id === targetCarpetaId) {
      setDraggingRecursoId(null); draggingRecursoIdRef.current = null; setDragOverRecursoId(null); return;
    }
    const origenId = recursoActual.carpeta_id;
    const { error } = await supabase.from("Recursos").update({ carpeta_id: targetCarpetaId }).eq("recurso_id", recursoId);
    if (error) { setDraggingRecursoId(null); draggingRecursoIdRef.current = null; setDragOverRecursoId(null); return; }
    setRecursos((prev) => {
      const next = { ...prev };
      if (next[origenId]) next[origenId] = next[origenId].filter((r) => r.recurso_id !== recursoId);
      if (next[targetCarpetaId]) next[targetCarpetaId] = [...next[targetCarpetaId], { ...recursoActual!, carpeta_id: targetCarpetaId }];
      return next;
    });
    onRefreshRecursos(origenId);
    onRefreshRecursos(targetCarpetaId);
    setDraggingRecursoId(null); draggingRecursoIdRef.current = null; setDragOverRecursoId(null);
  }

  return (
    <>
      <div className={styles.sidebarRecursosToggle}>
        <label className={styles.sidebarRecursosLabel}>
          <input
            type="checkbox"
            checked={showRecursos}
            onChange={(e) => setShowRecursos(e.target.checked)}
            className={styles.sidebarRecursosCheck}
          />
          Mostrar recursos
        </label>
      </div>

      {nodes.map((node) => (
        <TreeNodeRow
          key={node.carpeta_id}
          node={node}
          depth={depth}
          selectedId={selectedId}
          expandedIds={expandedIds}
          draggingId={draggingId}
          dragOverId={dragOverId}
          onSelect={onSelect}
          onToggle={onToggle}
          onDelete={onDelete}
          onContextMenu={handleContextMenu}
          onRenameSubmit={handleRenameSubmit}
          renamingId={renamingId}
          sharedIds={sharedIds}
          userId={userId}
          onDragStart={(id) => setDraggingId(id)}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
          showRecursos={showRecursos}
          recursos={recursos}
          draggingRecursoId={draggingRecursoId}
          dragOverRecursoId={dragOverRecursoId}
          renamingRecursoId={renamingRecursoId}
          onRecursoContextMenu={handleRecursoContextMenu}
          onRecursoRenameSubmit={handleRecursoRenameSubmit}
          onRecursoDragStart={(id) => { setDraggingRecursoId(id); draggingRecursoIdRef.current = id; }}
          onRecursoDragEnd={() => { setDraggingRecursoId(null); draggingRecursoIdRef.current = null; setDragOverRecursoId(null); }}
          onRecursoDrop={handleRecursoDrop}
        />
      ))}

      {/* ── Zona de soltar en raíz ──────────────────────────────────────── */}
      {(draggingId || draggingRecursoId) && (
        <div
          className={[
            styles.dropRootZone,
            dragOverRoot ? styles.dropRootZoneOver : "",
          ].filter(Boolean).join(" ")}
          onDragOver={(e) => { e.preventDefault(); setDragOverRoot(true); }}
          onDragLeave={() => setDragOverRoot(false)}
          onDrop={async (e) => {
            e.preventDefault();
            setDragOverRoot(false);
            const tipo = e.dataTransfer.getData("tipo");
            if (tipo === "recurso") {
              // Los recursos necesitan estar en una carpeta; no aplica mover a raíz
            } else {
              await handleDrop(null);
            }
          }}
        >
          <span className={styles.dropRootIcon}>📂</span>
          <span>Mover a raíz</span>
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          userId={userId}
          onClose={() => setContextMenu(null)}
          onRename={(node) => setRenamingId(node.carpeta_id)}
          onDelete={onDelete}
          onNewFolder={(parentId) => onNewFolder(parentId)}
          onNewResource={(parentId) => onNewResource(parentId)}
          onPermissions={(node) => onOpenPermisos(node)}
        />
      )}

      {recursoContextMenu && (
        <RecursoContextMenu
          menu={recursoContextMenu}
          onClose={() => setRecursoContextMenu(null)}
          onRename={(r) => setRenamingRecursoId(r.recurso_id)}
          onDelete={(id) => {
            setRecursoContextMenu(null);
            onDeleteRecurso(id);
            setRecursos((prev) => {
              const next = { ...prev };
              for (const key of Object.keys(next)) {
                next[key] = next[key].filter((r) => r.recurso_id !== id);
              }
              return next;
            });
          }}
          onEdit={(r) => setEditingRecurso(r)}
        />
      )}

      {editingRecurso && (
        <EditRecursoModal
          recurso={editingRecurso}
          onClose={() => setEditingRecurso(null)}
          onSave={handleRecursoEdit}
        />
      )}
    </>
  );
}

// ── Utilidad ───────────────────────────────────────────────────────────────
function findNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const n of nodes) {
    if (n.carpeta_id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}