"use client";

import { useState, useEffect } from "react";
import { TreeNode, Categoria } from "../types";
import { flatFolders } from "../helpers";
import { supabase } from "../../lib/supabaseClient";
import styles from "../page.module.css";

// ─── Modal Carpeta ─────────────────────────────────────────────────────────

export function ModalCarpeta({ tree, defaultParentId, userId, onClose, onSave }: {
  tree: TreeNode[];
  defaultParentId: string | null;
  userId: string;
  onClose: () => void;
  onSave: (nombre: string, parentId: string | null, categoriaId: string | null) => Promise<void>;
}) {
  const [nombre, setNombre] = useState("");
  const [parentId, setParentId] = useState<string | null>(defaultParentId);
  const [saving, setSaving] = useState(false);

  // Categorías
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [creandoCategoria, setCreandoCategoria] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [nuevaDesc, setNuevaDesc] = useState("");

  const allFolders = flatFolders(tree);

  useEffect(() => {
    supabase.from("Categorias").select("*").order("nombre").then(({ data }) => {
      setCategorias((data as Categoria[]) ?? []);
    });
  }, []);

  async function handleCrearCategoria() {
    if (!nuevaCategoria.trim()) return;
    const { data, error } = await supabase
      .from("Categorias")
      .insert({ nombre: nuevaCategoria.trim(), descripcion: nuevaDesc.trim() })
      .select().single();
    console.log("crear categoria →", { data, error });
    if (error || !data) return;
    const cat = data as Categoria;
    setCategorias((prev) => [...prev, cat]);
    setCategoriaId(cat.categoria_id);
    setCreandoCategoria(false);
    setNuevaCategoria("");
    setNuevaDesc("");
  }

  async function handleSave() {
    if (!nombre.trim()) return;
    setSaving(true);
    await onSave(nombre.trim(), parentId, categoriaId);
    setSaving(false);
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalTitle}>📁 Nueva Carpeta</div>

        <div className={styles.modalLabel}>Nombre</div>
        <input autoFocus className={styles.modalInput} value={nombre}
          onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la carpeta…"
          onKeyDown={(e) => e.key === "Enter" && handleSave()} />

        <div className={styles.modalLabel}>Ubicación</div>
        <select className={styles.modalSelect} value={parentId ?? ""}
          onChange={(e) => setParentId(e.target.value || null)}>
          <option value="">/ Raíz</option>
          {allFolders.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>

        <div className={styles.modalLabel}>Categoría <span className={styles.modalLabelOpt}>(opcional)</span></div>
        {!creandoCategoria ? (
          <div className={styles.categoriaRow}>
            <select className={styles.modalSelect} value={categoriaId ?? ""}
              onChange={(e) => setCategoriaId(e.target.value || null)}>
              <option value="">Sin categoría</option>
              {categorias.map((c) => (
                <option key={c.categoria_id} value={c.categoria_id}>{c.nombre}</option>
              ))}
            </select>
            <button
              className={styles.btnNuevaCategoria}
              onClick={() => setCreandoCategoria(true)}
              title="Crear nueva categoría"
            >+ Nueva</button>
          </div>
        ) : (
          <div className={styles.nuevaCategoriaBox}>
            <input className={styles.modalInput} value={nuevaCategoria}
              onChange={(e) => setNuevaCategoria(e.target.value)}
              placeholder="Nombre de la categoría…" autoFocus />
            <input className={styles.modalInput} value={nuevaDesc}
              onChange={(e) => setNuevaDesc(e.target.value)}
              placeholder="Descripción (opcional)…" />
            <div className={styles.nuevaCategoriaActions}>
              <button className={styles.btnSecondary}
                onClick={() => { setCreandoCategoria(false); setNuevaCategoria(""); setNuevaDesc(""); }}>
                Cancelar
              </button>
              <button className={styles.btnPrimary} disabled={!nuevaCategoria.trim()}
                onClick={handleCrearCategoria}>
                Crear categoría
              </button>
            </div>
          </div>
        )}

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

export function ModalRecurso({ onClose, onSave }: {
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
        <input autoFocus className={styles.modalInput} value={nombre}
          onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del recurso…" />
        <div className={styles.modalLabel}>Contenido</div>
        <textarea className={styles.modalTextarea} value={contenido}
          onChange={(e) => setContenido(e.target.value)}
          placeholder="Contenido del recurso (opcional)…" />
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