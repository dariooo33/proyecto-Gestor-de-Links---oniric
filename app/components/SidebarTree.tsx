"use client";

import { TreeNode } from "../types";
import styles from "../page.module.css";

export function SidebarTree({
  nodes, depth, selectedId, expandedIds, onSelect, onToggle, onDelete, sharedIds, userId,
}: {
  nodes: TreeNode[];
  depth: number;
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string, nombre: string) => void;
  sharedIds: Set<string>;
  userId: string | null;
}) {
  return (
    <>
      {nodes.map((node) => {
        const isExpanded = expandedIds.has(node.carpeta_id);
        const isSelected = selectedId === node.carpeta_id;
        const hasChildren = node.children.length > 0;
        const isOwner = node.user_id === userId;
        const isShared = sharedIds.has(node.carpeta_id);

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
                <SidebarTree
                  nodes={node.children} depth={depth + 1}
                  selectedId={selectedId} expandedIds={expandedIds}
                  onSelect={onSelect} onToggle={onToggle} onDelete={onDelete}
                  sharedIds={sharedIds} userId={userId}
                />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}