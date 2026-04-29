"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { TreeNode } from "../types";
import styles from "../page.module.css";

interface ContextMenuState {
  x: number;
  y: number;
  node: TreeNode;
}

// ── Menú contextual ────────────────────────────────────────────────────────
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

  const style: React.CSSProperties = {
    position: "fixed",
    top: menu.y,
    left: menu.x,
    zIndex: 1000,
  };

  return (
    <div ref={ref} className={styles.contextMenu} style={style}>
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

// ── Nodo individual del árbol ──────────────────────────────────────────────
function TreeNodeRow({
  node, depth, selectedId, expandedIds, draggingId, dragOverId,
  onSelect, onToggle, onDelete, onContextMenu, onRenameSubmit,
  renamingId, sharedIds, userId, onDragStart, onDragOver, onDrop, onDragEnd,
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
}) {
  const isExpanded = expandedIds.has(node.carpeta_id);
  const isSelected = selectedId === node.carpeta_id;
  const hasChildren = node.children.length > 0;
  const isOwner = node.user_id === userId;
  const isShared = sharedIds.has(node.carpeta_id);
  const isRenaming = renamingId === node.carpeta_id;
  const isDragging = draggingId === node.carpeta_id;
  const isDragOver = dragOverId === node.carpeta_id && draggingId !== node.carpeta_id;

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
        onDragStart={() => isOwner && onDragStart(node.carpeta_id)}
        onDragOver={(e) => { e.preventDefault(); onDragOver(e, node.carpeta_id); }}
        onDrop={(e) => { e.preventDefault(); onDrop(node.carpeta_id); }}
        onDragEnd={onDragEnd}
        onContextMenu={(e) => onContextMenu(e, node)}
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

      {isExpanded && node.children.length > 0 && (
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
}: {
  nodes: TreeNode[];
  depth: number;
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string, nombre: string) => void;
  onRename: (id: string, nuevoNombre: string) => Promise<void>;
  onMove: (draggedId: string, targetId: string) => Promise<void>;
  onNewFolder: (parentId: string | null) => void;
  onNewResource: (parentId: string) => void;
  onOpenPermisos: (node: TreeNode) => void;
  sharedIds: Set<string>;
  userId: string | null;
}) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  function handleContextMenu(e: React.MouseEvent, node: TreeNode) {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 200);
    const y = Math.min(e.clientY, window.innerHeight - 260);
    setContextMenu({ x, y, node });
  }

  function handleRenameSubmit(id: string, nuevoNombre: string) {
    if (nuevoNombre === "__EDIT__") { setRenamingId(id); return; }
    setRenamingId(null);
    const node = findNode(nodes, id);
    if (nuevoNombre.trim() && nuevoNombre.trim() !== node?.nombre) {
      onRename(id, nuevoNombre.trim());
    }
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    if (id !== draggingId) setDragOverId(id);
  }

  const handleDrop = useCallback(async (targetId: string) => {
    if (draggingId && draggingId !== targetId) {
      await onMove(draggingId, targetId);
    }
    setDraggingId(null);
    setDragOverId(null);
  }, [draggingId, onMove]);

  return (
    <>
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
        />
      ))}

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
    </>
  );
}

// ── Utilidad: buscar nodo por id ───────────────────────────────────────────
function findNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const n of nodes) {
    if (n.carpeta_id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}
