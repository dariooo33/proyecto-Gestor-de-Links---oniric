"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { Carpeta, Recurso, NivelAcceso } from "./types";
import { buildTree, getAllDescendantIds } from "./helpers";
import { SidebarTree } from "./components/SidebarTree";
import { CenterPanel } from "./components/CenterPanel";
import { ModalCarpeta, ModalRecurso, ModalConfirm } from "./components/Modals";
import { ModalPermisos } from "./components/ModalPermisos";
import styles from "./page.module.css";

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");

  const [userId, setUserId] = useState<string | null>(null);
  const [carpetas, setCarpetas] = useState<Carpeta[]>([]);
  const [recursos, setRecursos] = useState<Recurso[]>([]);
  const [permisosRecibidos, setPermisosRecibidos] = useState<{ carpeta_id: string; nivel: "lectura" | "edicion" }[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loadingTree, setLoadingTree] = useState(true);
  const [loadingCenter, setLoadingCenter] = useState(false);
  const [showModalCarpeta, setShowModalCarpeta] = useState(false);
  const [showModalRecurso, setShowModalRecurso] = useState(false);
  const [showModalPermisos, setShowModalPermisos] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal de confirmación reutilizable
  const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // parentId preseleccionado al abrir modal desde el menú contextual
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null);

  // carpeta sobre la que se abre el modal de permisos
  const [carpetaPermisos, setCarpetaPermisos] = useState<Carpeta | null>(null);

  // ── Sesión ───────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login"); return; }
      setUserId(session.user.id);
    });
  }, [router]);

  // ── Cargar carpetas propias + compartidas ────────────────────────────────
  const loadCarpetas = useCallback(async () => {
    if (!userId) return;
    setLoadingTree(true);

    const [{ data: propias }, { data: permisos }] = await Promise.all([
      supabase.from("Carpetas").select("*").eq("user_id", userId).order("created_at"),
      supabase.from("Permisos").select("carpeta_id, nivel").eq("user_id", userId),
    ]);

    const permisosData = (permisos ?? []) as { carpeta_id: string; nivel: "lectura" | "edicion" }[];
    setPermisosRecibidos(permisosData);

    let compartidas: Carpeta[] = [];
    if (permisosData.length > 0) {
      const ids = permisosData.map((p) => p.carpeta_id);
      const { data } = await supabase.from("Carpetas").select("*").in("carpeta_id", ids).order("created_at");
      compartidas = (data ?? []) as Carpeta[];
    }

    const propiaIds = new Set((propias ?? []).map((c: Carpeta) => c.carpeta_id));
    const todas = [...(propias ?? []) as Carpeta[]];
    compartidas.forEach((c) => {
      if (!propiaIds.has(c.carpeta_id)) todas.push(c);
    });

    const unique = Array.from(new Map(todas.map((c) => [c.carpeta_id, c])).values());
    setCarpetas(unique);
    setLoadingTree(false);
  }, [userId]);

  // ── Cargar recursos ──────────────────────────────────────────────────────
  const loadRecursos = useCallback(async (carpetaId: string) => {
    setLoadingCenter(true);
    const { data, error } = await supabase
      .from("Recursos").select("*").eq("carpeta_id", carpetaId).order("created_at");
    if (error) { setError(error.message); setRecursos([]); }
    else setRecursos(data as Recurso[]);
    setLoadingCenter(false);
  }, []);

  useEffect(() => { if (userId) loadCarpetas(); }, [userId, loadCarpetas]);

  useEffect(() => {
    if (!highlightId || carpetas.length === 0) return;
    const carpeta = carpetas.find((c) => c.carpeta_id === highlightId);
    if (!carpeta) {
      supabase.from("Carpetas").select("carpeta_id, user_id").eq("carpeta_id", highlightId).single()
        .then(({ data }) => {
          if (data && data.user_id !== userId) router.replace(`/usuario/${data.user_id}`);
        });
      return;
    }
    setSelectedId(highlightId);
    const ancestros = new Set<string>();
    let current: Carpeta = carpeta;
    while (current.id_padre) {
      ancestros.add(current.id_padre);
      const padre = carpetas.find((c) => c.carpeta_id === current.id_padre);
      if (!padre) break;
      current = padre;
    }
    setExpandedIds((prev) => new Set([...prev, ...ancestros, highlightId]));
    router.replace("/", { scroll: false });
  }, [highlightId, carpetas, userId, router]);

  useEffect(() => {
    if (selectedId) loadRecursos(selectedId);
    else setRecursos([]);
  }, [selectedId, loadRecursos]);

  // ── Nivel de acceso (memoizado) ──────────────────────────────────────────
  const nivelAcceso: NivelAcceso = useMemo(() => {
    if (!selectedId || !userId) return null;
    const carpeta = carpetas.find((c) => c.carpeta_id === selectedId);
    if (!carpeta) return null;
    if (carpeta.user_id === userId) return "owner";
    return permisosRecibidos.find((p) => p.carpeta_id === selectedId)?.nivel ?? null;
  }, [selectedId, userId, carpetas, permisosRecibidos]);

  const tree = buildTree(carpetas);
  const sharedIds = new Set(permisosRecibidos.map((p) => p.carpeta_id));

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── CRUD Carpetas ────────────────────────────────────────────────────────
  async function handleCreateCarpeta(
    nombre: string,
    parentId: string | null,
    categoriaId: string | null,
    etiquetaIds: string[]
  ) {
    if (!userId) return;
    const duplicado = carpetas.some(
      (c) => c.nombre.toLowerCase() === nombre.toLowerCase() && c.id_padre === parentId
    );
    if (duplicado) { setError(`Ya existe una carpeta llamada "${nombre}" en esa ubicación`); return; }

    const { data: nueva, error } = await supabase
      .from("Carpetas")
      .insert({ user_id: userId, id_padre: parentId, nombre })
      .select("carpeta_id, user_id, nombre, id_padre, publica, created_at")
      .single();

    if (error || !nueva) { setError(error?.message ?? "Error al crear carpeta"); return; }

    const ops: Promise<unknown>[] = [];
if (parentId) {
  const padre = carpetas.find((c) => c.carpeta_id === parentId);
  if (padre && padre.user_id !== userId) {
    ops.push(Promise.resolve(supabase.from("Permisos").upsert({
      carpeta_id: nueva.carpeta_id,
      owner_id: userId,
      user_id: padre.user_id,
      nivel: "edicion",
    }, { onConflict: "carpeta_id,user_id" })).then(({ error: permError }) => {
      if (permError) setError(`Carpeta creada pero error al asignar permisos: ${permError.message}`);
    }));
  }
}

if (categoriaId) {
  ops.push(
    Promise.resolve(supabase.from("Carpetas_Recrusos_Categoria").insert({
      carpeta_id: nueva.carpeta_id,
      categoria_id: categoriaId,
    })).then(({ error: catError }) => {
      if (catError) setError(`Carpeta creada pero error al asignar categoría: ${catError.message}`);
    })
  );
}

if (etiquetaIds.length > 0) {
  const rows = etiquetaIds.map((eid) => ({ carpeta_id: nueva.carpeta_id, etiqueta_id: eid }));
  ops.push(
    Promise.resolve(supabase.from("Carpetas_Recrusos_Etiquetas").insert(rows)).then(({ error: etqError }) => {
      if (etqError) setError(`Carpeta creada pero error al asignar etiquetas: ${etqError.message}`);
    })
  );
}

    await Promise.all(ops);
    await loadCarpetas();
    setShowModalCarpeta(false);
    setDefaultParentId(null);
    if (parentId) setExpandedIds((prev) => new Set([...prev, parentId]));
  }

  async function handleDeleteCarpeta(carpetaId: string, nombre: string) {
    setConfirm({
      message: `¿Eliminar la carpeta "${nombre}" y todo su contenido?`,
      onConfirm: async () => {
        const { error } = await supabase.from("Carpetas").delete().eq("carpeta_id", carpetaId);
        if (error) { setError(error.message); return; }
        if (selectedId === carpetaId) setSelectedId(null);
        await loadCarpetas();
      },
    });
  }

  async function handleRenameCarpeta(carpetaId: string, nuevoNombre: string) {
    const { error } = await supabase
      .from("Carpetas")
      .update({ nombre: nuevoNombre })
      .eq("carpeta_id", carpetaId);
    if (error) { setError(error.message); return; }
    await loadCarpetas();
  }

  async function handleMoveCarpeta(draggedId: string, targetId: string) {
    if (draggedId === targetId) return;

    const esDescendiente = (posibleHijoId: string, raizId: string): boolean => {
      const hijos = carpetas.filter((c) => c.id_padre === raizId);
      return hijos.some(
        (h) => h.carpeta_id === posibleHijoId || esDescendiente(posibleHijoId, h.carpeta_id)
      );
    };

    if (esDescendiente(targetId, draggedId)) {
      setError("No puedes mover una carpeta dentro de una de sus subcarpetas.");
      return;
    }

    const { error } = await supabase
      .from("Carpetas")
      .update({ id_padre: targetId })
      .eq("carpeta_id", draggedId);
    if (error) { setError(error.message); return; }

    setExpandedIds((prev) => new Set([...prev, targetId]));
    await loadCarpetas();
  }

  async function handleTogglePublica(carpetaId: string, publica: boolean) {
    const { data: todasCarpetas } = await supabase.from("Carpetas").select("carpeta_id, id_padre");
    const ids = getAllDescendantIds(carpetaId, (todasCarpetas ?? []) as Carpeta[]);
    const { error } = await supabase.from("Carpetas").update({ publica }).in("carpeta_id", ids);
    if (error) { setError(error.message); return; }
    await loadCarpetas();
  }

  async function handleSetCategoria(carpetaId: string, categoriaId: string | null) {
    await supabase.from("Carpetas_Recrusos_Categoria").delete().eq("carpeta_id", carpetaId);
    if (categoriaId) {
      const { error } = await supabase.from("Carpetas_Recrusos_Categoria").insert({
        carpeta_id: carpetaId, categoria_id: categoriaId,
      });
      if (error) { setError(error.message); return; }
    }
    await loadCarpetas();
  }

  async function handleSetEtiquetas(
    carpetaId: string | null,
    recursoId: string | null,
    etiquetaIds: string[]
  ) {
    // Guard: se requiere al menos uno de los dos IDs para no borrar toda la tabla
    if (!carpetaId && !recursoId) return;

    const deleteQuery = supabase.from("Carpetas_Recrusos_Etiquetas").delete();
    if (carpetaId) await deleteQuery.eq("carpeta_id", carpetaId);
    else if (recursoId) await deleteQuery.eq("recurso_id", recursoId);

    if (etiquetaIds.length > 0) {
      const rows = etiquetaIds.map((eid) => ({
        ...(carpetaId ? { carpeta_id: carpetaId } : {}),
        ...(recursoId ? { recurso_id: recursoId } : {}),
        etiqueta_id: eid,
      }));
      const { error } = await supabase.from("Carpetas_Recrusos_Etiquetas").insert(rows);
      if (error) { setError(error.message); return; }
    }
  }

  async function handleCreateRecurso(nombre: string, contenido: string, etiquetaIds: string[]) {
    if (!selectedId || !userId) return;
    const { data: nuevo, error } = await supabase.from("Recursos")
      .insert({ user_id: userId, carpeta_id: selectedId, nombre, contenido })
      .select("recurso_id").single();
    if (error || !nuevo) { setError(error?.message ?? "Error al crear recurso"); return; }

    if (etiquetaIds.length > 0) {
      const rows = etiquetaIds.map((eid) => ({ recurso_id: nuevo.recurso_id, etiqueta_id: eid }));
      const { error: etqError } = await supabase.from("Carpetas_Recrusos_Etiquetas").insert(rows);
      if (etqError) setError(`Recurso creado pero error al asignar etiquetas: ${etqError.message}`);
    }

    await loadRecursos(selectedId);
    setShowModalRecurso(false);
  }

  async function handleDeleteRecurso(recursoId: string) {
    setConfirm({
      message: "¿Eliminar este recurso?",
      onConfirm: async () => {
        const { error } = await supabase.from("Recursos").delete().eq("recurso_id", recursoId);
        if (error) { setError(error.message); return; }
        if (selectedId) await loadRecursos(selectedId);
      },
    });
  }

  async function handleLeaveShared(carpetaId: string) {
    if (!userId) return;
    setConfirm({
      message: "¿Quieres eliminar tu acceso a esta carpeta compartida?",
      onConfirm: async () => {
        const { error } = await supabase.from("Permisos")
          .delete().eq("carpeta_id", carpetaId).eq("user_id", userId);
        if (error) { setError(error.message); return; }
        setSelectedId(null);
        await loadCarpetas();
      },
    });
  }

  const selectedCarpeta = carpetas.find((c) => c.carpeta_id === selectedId) ?? null;
  const subCarpetas = carpetas.filter((c) => c.id_padre === selectedId);

  return (
    <>
      <main className={styles.main}>
        <div className={styles.topBar}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>🗂</span>
            FileManager
          </div>
          <nav className={styles.topNav}>
            <button className={styles.btnPrimary} onClick={() => {
              setDefaultParentId(selectedId);
              setShowModalCarpeta(true);
            }}>
              + Nueva Carpeta
            </button>
          </nav>
        </div>

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
              nodes={tree}
              depth={0}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onSelect={setSelectedId}
              onToggle={toggleExpanded}
              onDelete={handleDeleteCarpeta}
              onRename={handleRenameCarpeta}
              onMove={handleMoveCarpeta}
              onNewFolder={(parentId) => {
                setDefaultParentId(parentId);
                setShowModalCarpeta(true);
              }}
              onNewResource={(parentId) => {
                setSelectedId(parentId);
                setShowModalRecurso(true);
              }}
              onOpenPermisos={(node) => {
                setCarpetaPermisos(carpetas.find((c) => c.carpeta_id === node.carpeta_id) ?? null);
                setShowModalPermisos(true);
              }}
              sharedIds={sharedIds}
              userId={userId}
            />
          )}
        </div>

        <div className={styles.center}>
          <CenterPanel
            carpeta={selectedCarpeta} subCarpetas={subCarpetas}
            recursos={recursos} loading={loadingCenter}
            userId={userId} nivelAcceso={nivelAcceso}
            onSelectCarpeta={(id) => { setSelectedId(id); setExpandedIds((prev) => new Set([...prev, id])); }}
            onNewRecurso={() => setShowModalRecurso(true)}
            onDeleteRecurso={handleDeleteRecurso}
            onDeleteCarpeta={handleDeleteCarpeta}
            onOpenPermisos={() => setShowModalPermisos(true)}
            onLeaveShared={handleLeaveShared}
            onTogglePublica={handleTogglePublica}
            onSetCategoria={handleSetCategoria}
            onSetEtiquetas={handleSetEtiquetas}
          />
        </div>
      </main>

      {showModalCarpeta && (
        <ModalCarpeta
          tree={tree}
          defaultParentId={defaultParentId}
          userId={userId ?? ""}
          onClose={() => { setShowModalCarpeta(false); setDefaultParentId(null); }}
          onSave={handleCreateCarpeta}
        />
      )}
      {showModalRecurso && selectedId && (
        <ModalRecurso onClose={() => setShowModalRecurso(false)} onSave={handleCreateRecurso} />
      )}
      {showModalPermisos && (carpetaPermisos ?? selectedCarpeta) && userId && (
        <ModalPermisos
          carpeta={(carpetaPermisos ?? selectedCarpeta)!}
          userId={userId}
          onClose={() => {
            setShowModalPermisos(false);
            setCarpetaPermisos(null);
            loadCarpetas();
          }}
        />
      )}

      {confirm && (
        <ModalConfirm
          message={confirm.message}
          onConfirm={() => { confirm.onConfirm(); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {error && (
        <div className={styles.errorToast} onClick={() => setError(null)}>⚠ {error}</div>
      )}
    </>
  );
}