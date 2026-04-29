"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Carpeta, Recurso } from "../../types";
import { fmtDate } from "../../helpers";
import styles from "./page.module.css";

interface UsuarioPerfil {
  user_id: string;
  nombre: string;
  email: string;
  rol: string;
  created_at: string;
}

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

// ─── Sidebar tree (solo carpetas públicas) ─────────────────────────────────

function SidebarTree({
  nodes, depth, selectedId, expandedIds, onSelect, onToggle,
}: {
  nodes: TreeNode[];
  depth: number;
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
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
              onClick={() => { onSelect(node.carpeta_id); if (hasChildren) onToggle(node.carpeta_id); }}
            >
              <span className={`${styles.nodeArrow} ${isExpanded ? styles.open : ""}`}
                style={{ visibility: hasChildren ? "visible" : "hidden" }}>▶</span>
              <span className={styles.nodeIcon}>{isExpanded ? "📂" : "📁"}</span>
              <span className={styles.nodeLabel}>{node.nombre}</span>
            </div>
            {isExpanded && node.children.length > 0 && (
              <div className={styles.treeChildren}>
                <SidebarTree nodes={node.children} depth={depth + 1}
                  selectedId={selectedId} expandedIds={expandedIds}
                  onSelect={onSelect} onToggle={onToggle} />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function UsuarioPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [perfil, setPerfil] = useState<UsuarioPerfil | null>(null);
  const [carpetas, setCarpetas] = useState<Carpeta[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [recursos, setRecursos] = useState<Recurso[]>([]);
  const [loadingRecursos, setLoadingRecursos] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Verificar sesión
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      // Cargar perfil
      const { data: u } = await supabase
        .from("Usuario").select("*").eq("user_id", id).single();
      if (!u) { router.push("/"); return; }
      setPerfil(u as UsuarioPerfil);

      // Cargar carpetas públicas del usuario
      const { data: c } = await supabase
        .from("Carpetas").select("*")
        .eq("user_id", id)
        .eq("publica", true)
        .order("created_at");
      setCarpetas((c ?? []) as Carpeta[]);
      setLoading(false);
    }
    load();
  }, [id, router]);

  useEffect(() => {
    if (!selectedId) { setRecursos([]); return; }
    setLoadingRecursos(true);
    supabase.from("Recursos").select("*").eq("carpeta_id", selectedId).order("created_at")
      .then(({ data }) => {
        setRecursos((data ?? []) as Recurso[]);
        setLoadingRecursos(false);
      });
  }, [selectedId]);

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const tree = buildTree(carpetas);
  const selectedCarpeta = carpetas.find((c) => c.carpeta_id === selectedId) ?? null;
  const subCarpetas = carpetas.filter((c) => c.id_padre === selectedId);

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingDots}><span /><span /><span /></div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Perfil header */}
      <div className={styles.perfilHeader}>
        <button className={styles.btnBack} onClick={() => router.back()}>← Volver</button>
        <div className={styles.perfilInfo}>
          <div className={styles.avatar}>{perfil!.nombre.charAt(0).toUpperCase()}</div>
          <div>
            <div className={styles.perfilNombre}>{perfil!.nombre}</div>
            <div className={styles.perfilMeta}>
              {carpetas.length} carpeta{carpetas.length !== 1 ? "s" : ""} públicas
              {" · "}Miembro desde {fmtDate(perfil!.created_at)}
            </div>
          </div>
        </div>
        {/* Espacio para añadir más info del perfil en el futuro */}
      </div>

      {/* Layout con sidebar + centro */}
      <div className={styles.layout}>
        {/* Sidebar */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarTitle}>Carpetas públicas</div>
          {tree.length === 0 ? (
            <div className={styles.sidebarEmpty}>Este usuario no tiene carpetas públicas.</div>
          ) : (
            <SidebarTree
              nodes={tree} depth={0}
              selectedId={selectedId} expandedIds={expandedIds}
              onSelect={setSelectedId} onToggle={toggleExpanded}
            />
          )}
        </div>

        {/* Centro */}
        <div className={styles.center}>
          {!selectedCarpeta ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>📂</div>
              <div className={styles.emptyText}>Selecciona una carpeta para ver su contenido</div>
            </div>
          ) : (
            <div>
              <div className={styles.folderHeader}>
                <div className={styles.folderHeaderIcon}>📂</div>
                <div>
                  <div className={styles.folderName}>{selectedCarpeta.nombre}</div>
                  <div className={styles.folderMeta}>
                    {subCarpetas.length} subcarpeta{subCarpetas.length !== 1 ? "s" : ""}
                    {" · "}{recursos.length} recurso{recursos.length !== 1 ? "s" : ""}
                    {" · "}Creada {fmtDate(selectedCarpeta.created_at)}
                  </div>
                </div>
              </div>

              {subCarpetas.length > 0 && (
                <>
                  <div className={styles.sectionTitle}>Subcarpetas</div>
                  <div className={styles.folderGrid}>
                    {subCarpetas.map((sc) => (
                      <div key={sc.carpeta_id} className={styles.folderCard}
                        onClick={() => { setSelectedId(sc.carpeta_id); setExpandedIds((p) => new Set([...p, sc.carpeta_id])); }}>
                        <div className={styles.folderCardIcon}>📁</div>
                        <div className={styles.folderCardName}>{sc.nombre}</div>
                        <div className={styles.folderCardMeta}>{fmtDate(sc.created_at)}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {loadingRecursos ? (
                <div className={styles.loadingDots} style={{ margin: "30px auto", width: "fit-content" }}>
                  <span /><span /><span />
                </div>
              ) : recursos.length > 0 && (
                <>
                  <div className={styles.sectionTitle}>Recursos</div>
                  <div className={styles.resourceList}>
                    {recursos.map((r) => (
                      <div key={r.recurso_id} className={styles.resourceRow}>
                        <span className={styles.resourceIcon}>📄</span>
                        <span className={styles.resourceName}>{r.nombre}</span>
                        <span className={styles.resourceDate}>{fmtDate(r.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {subCarpetas.length === 0 && recursos.length === 0 && !loadingRecursos && (
                <div className={styles.emptyState} style={{ marginTop: 60 }}>
                  <div className={styles.emptyIcon}>📭</div>
                  <div className={styles.emptyText}>Esta carpeta está vacía</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}