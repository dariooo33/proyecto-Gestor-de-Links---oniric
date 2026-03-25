"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { Carpeta, Recurso, NivelAcceso } from "./types";
import { buildTree } from "./helpers";
import { SidebarTree } from "./components/SidebarTree";
import { CenterPanel } from "./components/CenterPanel";
import { ModalCarpeta, ModalRecurso } from "./components/Modals";
import { ModalPermisos } from "./components/ModalPermisos";
import styles from "./page.module.css";

export default function Home() {
  const router = useRouter();
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

    const { data: propias } = await supabase
      .from("Carpetas").select("*").eq("user_id", userId).order("created_at");

    const { data: permisos } = await supabase
      .from("Permisos").select("carpeta_id, nivel").eq("user_id", userId);

    const permisosData = (permisos ?? []) as { carpeta_id: string; nivel: "lectura" | "edicion" }[];
    setPermisosRecibidos(permisosData);

    let compartidas: Carpeta[] = [];
    if (permisosData.length > 0) {
      const ids = permisosData.map((p) => p.carpeta_id);
      const { data } = await supabase.from("Carpetas").select("*").in("carpeta_id", ids).order("created_at");
      compartidas = (data ?? []) as Carpeta[];
    }

    const todas = [...(propias ?? []) as Carpeta[]];
    compartidas.forEach((c) => {
      if (!todas.find((t) => t.carpeta_id === c.carpeta_id)) todas.push(c);
    });

    setCarpetas(todas);
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
    if (selectedId) loadRecursos(selectedId);
    else setRecursos([]);
  }, [selectedId, loadRecursos]);

  // ── Nivel de acceso ──────────────────────────────────────────────────────
  const nivelAcceso: NivelAcceso = (() => {
    if (!selectedId || !userId) return null;
    const carpeta = carpetas.find((c) => c.carpeta_id === selectedId);
    if (!carpeta) return null;
    if (carpeta.user_id === userId) return "owner";
    return permisosRecibidos.find((p) => p.carpeta_id === selectedId)?.nivel ?? null;
  })();

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
  async function handleCreateCarpeta(nombre: string, parentId: string | null) {
    if (!userId) return;
    const duplicado = carpetas.some(
      (c) => c.nombre.toLowerCase() === nombre.toLowerCase() && c.id_padre === parentId
    );
    if (duplicado) { setError(`Ya existe una carpeta llamada "${nombre}" en esa ubicación`); return; }
    const { error } = await supabase.from("Carpetas").insert({ user_id: userId, id_padre: parentId, nombre });
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

  // ── CRUD Recursos ────────────────────────────────────────────────────────
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

  async function handleLeaveShared(carpetaId: string) {
    if (!userId) return;
    if (!confirm("¿Quieres eliminar tu acceso a esta carpeta compartida?")) return;
    const { error } = await supabase.from("Permisos")
      .delete()
      .eq("carpeta_id", carpetaId)
      .eq("user_id", userId);
    if (error) { setError(error.message); return; }
    setSelectedId(null);
    await loadCarpetas();
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
            <button className={styles.btnPrimary} onClick={() => setShowModalCarpeta(true)}>
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
              nodes={tree} depth={0}
              selectedId={selectedId} expandedIds={expandedIds}
              onSelect={setSelectedId} onToggle={toggleExpanded}
              onDelete={handleDeleteCarpeta}
              sharedIds={sharedIds} userId={userId}
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
          />
        </div>
      </main>

      {showModalCarpeta && (
        <ModalCarpeta tree={tree} defaultParentId={selectedId}
          onClose={() => setShowModalCarpeta(false)} onSave={handleCreateCarpeta} />
      )}
      {showModalRecurso && selectedId && (
        <ModalRecurso onClose={() => setShowModalRecurso(false)} onSave={handleCreateRecurso} />
      )}
      {showModalPermisos && selectedCarpeta && userId && (
        <ModalPermisos carpeta={selectedCarpeta} userId={userId}
          onClose={() => { setShowModalPermisos(false); loadCarpetas(); }} />
      )}

      {error && (
        <div className={styles.errorToast} onClick={() => setError(null)}>⚠ {error}</div>
      )}
    </>
  );
}