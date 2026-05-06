import { Carpeta, TreeNode } from "./types";

export function buildTree(carpetas: Carpeta[]): TreeNode[] {
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

export function flatFolders(nodes: TreeNode[], depth = 0): { id: string; label: string }[] {
  const result: { id: string; label: string }[] = [];
  nodes.forEach((n) => {
    result.push({ id: n.carpeta_id, label: "\u3000".repeat(depth) + "📁 " + n.nombre });
    result.push(...flatFolders(n.children, depth + 1));
  });
  return result;
}

export function getAllDescendantIds(carpetaId: string, carpetas: Carpeta[]): string[] {
  const ids: string[] = [carpetaId];
  carpetas
    .filter((c) => c.id_padre === carpetaId)
    .forEach((c) => ids.push(...getAllDescendantIds(c.carpeta_id, carpetas)));
  return ids;
}

export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric", month: "short", year: "numeric",
  });
}
