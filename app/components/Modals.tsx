"use client";

import { useState, useEffect, useRef } from "react";
import { TreeNode, Categoria } from "../types";
import { flatFolders } from "../helpers";
import { supabase } from "@/lib/supabaseClient";
import styles from "../page.module.css";

interface Etiqueta { etiqueta_id: string; nombre: string; descripcion?: string; }

// ── Selector de etiquetas con búsqueda ────────────────────────────────────
function EtiquetasPicker({
  etiquetas,
  seleccionadas,
  onToggle,
  onCrear,
}: {
  etiquetas: Etiqueta[];
  seleccionadas: string[];
  onToggle: (id: string) => void;
  onCrear: (etiqueta: Etiqueta) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [creando, setCreando] = useState(false);
  const [nuevaDesc, setNuevaDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const texto = busqueda.trim().toLowerCase();
  const filtradas = texto
    ? etiquetas.filter((e) => e.nombre.toLowerCase().includes(texto))
    : etiquetas;

  const selSet = new Set(seleccionadas);
  const ordenadas = [
    ...filtradas.filter((e) => selSet.has(e.etiqueta_id)),
    ...filtradas.filter((e) => !selSet.has(e.etiqueta_id)),
  ];

  const noHayCoincidencias = texto.length > 0 && filtradas.length === 0;

  async function handleCrear() {
    const nombre = busqueda.trim();
    if (!nombre) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("Etiquetas")
      .insert({ nombre, descripcion: nuevaDesc.trim() })
      .select()
      .single();
    if (!error && data) {
      onCrear(data as Etiqueta);
      setBusqueda("");
      setNuevaDesc("");
      setCreando(false);
      inputRef.current?.focus();
    }
    setSaving(false);
  }

  return (
    <div>
      {seleccionadas.length > 0 && (
        <div className={styles.etiquetaSelectorWrap} style={{ marginBottom: 6 }}>
          {etiquetas
            .filter((e) => selSet.has(e.etiqueta_id))
            .map((e) => (
              <button
                key={e.etiqueta_id}
                type="button"
                className={`${styles.etiquetaChip} ${styles.etiquetaChipOn}`}
                onClick={() => onToggle(e.etiqueta_id)}
              >
                {e.nombre} <span style={{ opacity: 0.6, marginLeft: 2 }}>×</span>
              </button>
            ))}
        </div>
      )}

      <div className={styles.etiquetaSearchWrap}>
        <span className={styles.etiquetaSearchIcon}>🔍</span>
        <input
          ref={inputRef}
          className={styles.modalInput}
          style={{ paddingLeft: 28 }}
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setCreando(false); }}
          placeholder={etiquetas.length === 0 ? "Escribe para crear la primera etiqueta…" : "Buscar etiqueta…"}
          onKeyDown={(e) => {
            if (e.key === "Enter" && noHayCoincidencias) { e.preventDefault(); setCreando(true); }
          }}
        />
      </div>

      {!creando && (
        <div className={styles.etiquetaListBox}>
          {ordenadas.map((e) => {
            const activa = selSet.has(e.etiqueta_id);
            return (
              <button
                key={e.etiqueta_id}
                type="button"
                className={`${styles.etiquetaListItem} ${activa ? styles.etiquetaListItemOn : ""}`}
                onClick={() => onToggle(e.etiqueta_id)}
              >
                <span className={styles.etiquetaListCheck}>{activa ? "✓" : ""}</span>
                {e.nombre}
              </button>
            );
          })}

          {noHayCoincidencias && (
            <button
              type="button"
              className={`${styles.etiquetaListItem} ${styles.etiquetaListItemItalic}`}
              onClick={() => setCreando(true)}
            >
              <span className={styles.etiquetaListCheck}>+</span>
              Crear «{busqueda.trim()}»
            </button>
          )}

          {etiquetas.length === 0 && !texto && (
            <span className={styles.etiquetaEmpty} style={{ padding: "6px 10px", display: "block" }}>
              No hay etiquetas aún
            </span>
          )}
        </div>
      )}

      {!creando ? (
        !noHayCoincidencias && (
          <button
            type="button"
            className={styles.btnNuevaCategoria}
            style={{ marginTop: 6 }}
            onClick={() => setCreando(true)}
          >
            + Nueva etiqueta
          </button>
        )
      ) : (
        <div className={styles.nuevaCategoriaBox} style={{ marginTop: 6 }}>
          <input
            className={styles.modalInput}
            value={busqueda}
            autoFocus
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre de la etiqueta…"
          />
          <input
            className={styles.modalInput}
            value={nuevaDesc}
            onChange={(e) => setNuevaDesc(e.target.value)}
            placeholder="Descripción (opcional)…"
          />
          <div className={styles.nuevaCategoriaActions}>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => { setCreando(false); setNuevaDesc(""); }}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={styles.btnPrimary}
              disabled={!busqueda.trim() || saving}
              onClick={handleCrear}
            >
              {saving ? "Creando…" : "Crear etiqueta"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal Carpeta ─────────────────────────────────────────────────────────
export function ModalCarpeta({ tree, defaultParentId, userId, onClose, onSave }: {
  tree: TreeNode[];
  defaultParentId: string | null;
  userId: string;
  onClose: () => void;
  onSave: (nombre: string, parentId: string | null, categoriaId: string | null, etiquetaIds: string[]) => Promise<void>;
}) {
  const [nombre, setNombre] = useState("");
  const [parentId, setParentId] = useState<string | null>(defaultParentId);
  const [saving, setSaving] = useState(false);

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [creandoCategoria, setCreandoCategoria] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [nuevaDesc, setNuevaDesc] = useState("");

  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [etiquetasSeleccionadas, setEtiquetasSeleccionadas] = useState<string[]>([]);

  const allFolders = flatFolders(tree);

  useEffect(() => {
    Promise.all([
      supabase.from("Categorias").select("*").order("nombre"),
      supabase.from("Etiquetas").select("etiqueta_id, nombre, descripcion").order("nombre"),
    ]).then(([{ data: cats }, { data: etqs }]) => {
      setCategorias((cats as Categoria[]) ?? []);
      setEtiquetas((etqs as Etiqueta[]) ?? []);
    });
  }, []);

  async function handleCrearCategoria() {
    if (!nuevaCategoria.trim()) return;
    const { data, error } = await supabase
      .from("Categorias")
      .insert({ nombre: nuevaCategoria.trim(), descripcion: nuevaDesc.trim() })
      .select().single();
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
    await onSave(nombre.trim(), parentId, categoriaId, etiquetasSeleccionadas);
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
            <button type="button" className={styles.btnNuevaCategoria}
              onClick={() => setCreandoCategoria(true)}>+ Nueva</button>
          </div>
        ) : (
          <div className={styles.nuevaCategoriaBox}>
            <input className={styles.modalInput} value={nuevaCategoria} autoFocus
              onChange={(e) => setNuevaCategoria(e.target.value)}
              placeholder="Nombre de la categoría…" />
            <input className={styles.modalInput} value={nuevaDesc}
              onChange={(e) => setNuevaDesc(e.target.value)}
              placeholder="Descripción (opcional)…" />
            <div className={styles.nuevaCategoriaActions}>
              <button type="button" className={styles.btnSecondary}
                onClick={() => { setCreandoCategoria(false); setNuevaCategoria(""); setNuevaDesc(""); }}>
                Cancelar
              </button>
              <button type="button" className={styles.btnPrimary} disabled={!nuevaCategoria.trim()}
                onClick={handleCrearCategoria}>
                Crear categoría
              </button>
            </div>
          </div>
        )}

        <div className={styles.modalLabel}>
          Etiquetas <span className={styles.modalLabelOpt}>(opcional, múltiple)</span>
        </div>
        <EtiquetasPicker
          etiquetas={etiquetas}
          seleccionadas={etiquetasSeleccionadas}
          onToggle={(id) =>
            setEtiquetasSeleccionadas((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
            )
          }
          onCrear={(e) => {
            setEtiquetas((prev) => [...prev, e]);
            setEtiquetasSeleccionadas((prev) => [...prev, e.etiqueta_id]);
          }}
        />

        <div className={styles.modalActions}>
          <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
          <button type="button" className={styles.btnPrimary} disabled={!nombre.trim() || saving} onClick={handleSave}>
            {saving ? "Guardando…" : "Crear carpeta"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Recurso ─────────────────────────────────────────────────────────
export function ModalRecurso({ onClose, onSave }: {
  onClose: () => void;
  onSave: (nombre: string, contenido: string, etiquetaIds: string[]) => Promise<void>;
}) {
  const [nombre, setNombre] = useState("");
  const [contenido, setContenido] = useState("");
  const [saving, setSaving] = useState(false);

  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [etiquetasSeleccionadas, setEtiquetasSeleccionadas] = useState<string[]>([]);

  useEffect(() => {
    supabase.from("Etiquetas").select("etiqueta_id, nombre, descripcion").order("nombre")
      .then(({ data }) => setEtiquetas((data as Etiqueta[]) ?? []));
  }, []);

  async function handleSave() {
    if (!nombre.trim()) return;
    setSaving(true);
    await onSave(nombre.trim(), contenido, etiquetasSeleccionadas);
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

        <div className={styles.modalLabel}>
          Etiquetas <span className={styles.modalLabelOpt}>(opcional, múltiple)</span>
        </div>
        <EtiquetasPicker
          etiquetas={etiquetas}
          seleccionadas={etiquetasSeleccionadas}
          onToggle={(id) =>
            setEtiquetasSeleccionadas((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
            )
          }
          onCrear={(e) => {
            setEtiquetas((prev) => [...prev, e]);
            setEtiquetasSeleccionadas((prev) => [...prev, e.etiqueta_id]);
          }}
        />

        <div className={styles.modalActions}>
          <button type="button" className={styles.btnSecondary} onClick={onClose}>Cancelar</button>
          <button type="button" className={styles.btnPrimary} disabled={!nombre.trim() || saving} onClick={handleSave}>
            {saving ? "Guardando…" : "Crear recurso"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Confirmación (reemplaza confirm() nativo) ───────────────────────
export function ModalConfirm({ message, onConfirm, onCancel }: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <div className={styles.modalTitle}>⚠️ Confirmar</div>
        <p className={styles.permisosDesc}>{message}</p>
        <div className={styles.modalActions}>
          <button type="button" className={styles.btnSecondary} onClick={onCancel}>Cancelar</button>
          <button type="button" className={`${styles.btnPrimary} ${styles.btnDanger}`} onClick={onConfirm}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
