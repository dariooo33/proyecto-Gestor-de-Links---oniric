"use client";

import { useState } from "react";
import { TreeNode } from "../types";
import { flatFolders } from "../helpers";
import styles from "../page.module.css";

// ─── Modal Carpeta ─────────────────────────────────────────────────────────

export function ModalCarpeta({ tree, defaultParentId, onClose, onSave }: {
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
        <input autoFocus className={styles.modalInput} value={nombre}
          onChange={(e) => setNombre(e.target.value)} placeholder="Nombre de la carpeta…"
          onKeyDown={(e) => e.key === "Enter" && handleSave()} />
        <div className={styles.modalLabel}>Ubicación</div>
        <select className={styles.modalSelect} value={parentId ?? ""}
          onChange={(e) => setParentId(e.target.value || null)}>
          <option value="">/ Raíz</option>
          {allFolders.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
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