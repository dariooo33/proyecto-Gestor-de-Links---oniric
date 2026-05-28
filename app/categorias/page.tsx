"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import styles from "./page.module.css";

interface Categoria {
  categoria_id: string;
  nombre: string;
  descripcion: string;
  created_at: string;
  user_id: string;
}

interface Carpeta {
  carpeta_id: string;
  nombre: string;
  id_padre: string | null;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

// ── Modal genérico de confirmación ───────────────────────────────────────
function ModalConfirm({ mensaje, onConfirm, onCancel }: {
  mensaje: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <p className={styles.modalMsg}>{mensaje}</p>
        <div className={styles.modalActions}>
          <button className={styles.btnSecundario} onClick={onCancel}>Cancelar</button>
          <button className={styles.btnPeligro} onClick={onConfirm}>Eliminar</button>
        </div>
      </div>
    </div>
  );
}

// ── Panel de asignación de carpetas ──────────────────────────────────────
function PanelCarpetas({ categoria, userId, onClose }: {
  categoria: Categoria; userId: string; onClose: () => void;
}) {
  const [todasCarpetas, setTodasCarpetas] = useState<Carpeta[]>([]);
  const [asignadas, setAsignadas] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [{ data: carpetas }, { data: rel }] = await Promise.all([
        supabase.from("Carpetas")
          .select("carpeta_id, nombre, id_padre")
          .eq("user_id", userId)
          .order("nombre"),
        supabase.from("Carpetas_Recrusos_Categoria")
          .select("carpeta_id")
          .eq("categoria_id", categoria.categoria_id)
          .not("carpeta_id", "is", null),
      ]);
      setTodasCarpetas(carpetas ?? []);
      setAsignadas(new Set((rel ?? []).map((r: any) => r.carpeta_id)));
      setLoading(false);
    }
    load();
  }, [categoria.categoria_id, userId]);

  async function toggle(carpetaId: string) {
    setSaving(carpetaId);
    if (asignadas.has(carpetaId)) {
      await supabase.from("Carpetas_Recrusos_Categoria")
        .delete()
        .eq("categoria_id", categoria.categoria_id)
        .eq("carpeta_id", carpetaId);
      setAsignadas((prev) => { const s = new Set(prev); s.delete(carpetaId); return s; });
    } else {
      await supabase.from("Carpetas_Recrusos_Categoria")
        .insert({ categoria_id: categoria.categoria_id, carpeta_id: carpetaId });
      setAsignadas((prev) => new Set([...prev, carpetaId]));
    }
    setSaving(null);
  }

  const filtradas = busqueda.trim()
    ? todasCarpetas.filter((c) => c.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()))
    : todasCarpetas;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panelCarpetas} onClick={(e) => e.stopPropagation()}>
        <div className={styles.panelHeader}>
          <div>
            <h2 className={styles.panelTitulo}>Carpetas — <span className={styles.accentText}>{categoria.nombre}</span></h2>
            <p className={styles.panelSub}>Activa o desactiva la categoría en cada carpeta</p>
          </div>
          <button className={styles.btnClose} onClick={onClose}>×</button>
        </div>

        <div className={styles.panelSearch}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            className={styles.panelSearchInput}
            placeholder="Buscar carpeta…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        <div className={styles.panelLista}>
          {loading ? (
            <div className={styles.loadingDots}><span /><span /><span /></div>
          ) : filtradas.length === 0 ? (
            <div className={styles.empty}><span>📂</span> No hay carpetas</div>
          ) : (
            filtradas.map((c) => {
              const activa = asignadas.has(c.carpeta_id);
              return (
                <div key={c.carpeta_id} className={`${styles.carpetaRow} ${activa ? styles.carpetaRowOn : ""}`}
                  onClick={() => toggle(c.carpeta_id)}>
                  <span className={styles.carpetaRowIcon}>📁</span>
                  <span className={styles.carpetaRowNombre}>{c.nombre}</span>
                  <span className={`${styles.carpetaToggle} ${activa ? styles.carpetaToggleOn : ""}`}>
                    {saving === c.carpeta_id ? "…" : activa ? "✓" : ""}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div className={styles.panelFooter}>
          <span className={styles.panelCount}>{asignadas.size} carpeta{asignadas.size !== 1 ? "s" : ""} asignada{asignadas.size !== 1 ? "s" : ""}</span>
          <button className={styles.btnPrimario} onClick={onClose}>Listo</button>
        </div>
      </div>
    </div>
  );
}

// ── Modal crear / editar ──────────────────────────────────────────────────
function ModalForm({ inicial, onGuardar, onCerrar }: {
  inicial?: Partial<Categoria>;
  onGuardar: (nombre: string, descripcion: string) => Promise<void>;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setSaving(true);
    await onGuardar(nombre.trim(), descripcion.trim());
    setSaving(false);
  }

  return (
    <div className={styles.overlay} onClick={onCerrar}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitulo}>{inicial?.categoria_id ? "Editar categoría" : "Nueva categoría"}</h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>Nombre</label>
          <input
            ref={inputRef}
            className={styles.input}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Frontend, Diseño, Recursos…"
            maxLength={80}
          />
          <label className={styles.label}>Descripción <span className={styles.opcional}>(opcional)</span></label>
          <textarea
            className={styles.textarea}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Breve descripción de la categoría…"
            rows={3}
            maxLength={300}
          />
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecundario} onClick={onCerrar}>Cancelar</button>
            <button type="submit" className={styles.btnPrimario} disabled={!nombre.trim() || saving}>
              {saving ? "Guardando…" : inicial?.categoria_id ? "Guardar cambios" : "Crear categoría"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────
export default function CategoriasPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  const [modalForm, setModalForm] = useState<{ abierto: boolean; editar?: Categoria }>({ abierto: false });
  const [confirmarEliminar, setConfirmarEliminar] = useState<Categoria | null>(null);
  const [panelCarpetas, setPanelCarpetas] = useState<Categoria | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login"); return; }
      const uid = session.user.id;
      setUserId(uid);
      supabase.from("Categorias")
        .select("*")
        .order("nombre")
        .then(({ data, error }) => {
          if (!error) setCategorias((data as Categoria[]) ?? []);
          setLoading(false);
        });
    });
  }, [router]);

  async function crearOEditar(nombre: string, descripcion: string) {
    if (modalForm.editar) {
      const { data } = await supabase.from("Categorias")
        .update({ nombre, descripcion })
        .eq("categoria_id", modalForm.editar.categoria_id)
        .select()
        .single();
      if (data) setCategorias((prev) => prev.map((c) => c.categoria_id === data.categoria_id ? data : c));
    } else {
      const { data } = await supabase.from("Categorias")
        .insert({ nombre, descripcion })
        .select()
        .single();
      if (data) setCategorias((prev) => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    }
    setModalForm({ abierto: false });
  }

  async function eliminar(c: Categoria) {
    await supabase.from("Categorias").delete().eq("categoria_id", c.categoria_id);
    setCategorias((prev) => prev.filter((x) => x.categoria_id !== c.categoria_id));
    setConfirmarEliminar(null);
  }

  const filtradas = busqueda.trim()
    ? categorias.filter((c) =>
        c.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()) ||
        c.descripcion?.toLowerCase().includes(busqueda.trim().toLowerCase())
      )
    : categorias;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.btnBack} onClick={() => router.back()}>← Volver</button>
          <div className={styles.headerIcon}>🏷️</div>
          <div>
            <h1 className={styles.headerTitle}>Categorías</h1>
            <p className={styles.headerSub}>{categorias.length} categoría{categorias.length !== 1 ? "s" : ""} en total</p>
          </div>
        </div>
        <button className={styles.btnPrimario} onClick={() => setModalForm({ abierto: true })}>
          + Nueva categoría
        </button>
      </div>

      {/* Buscador */}
      <div className={styles.searchWrapper}>
        <span className={styles.searchIcon}>🔍</span>
        <input
          className={styles.searchInput}
          placeholder="Buscar categorías…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        {busqueda && <button className={styles.searchClear} onClick={() => setBusqueda("")}>×</button>}
      </div>

      {/* Lista */}
      {loading ? (
        <div className={styles.loadingDots}><span /><span /><span /></div>
      ) : filtradas.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>{busqueda ? "🔍" : "🏷️"}</div>
          <div>{busqueda ? `Sin resultados para "${busqueda}"` : "Aún no hay categorías. ¡Crea la primera!"}</div>
          {!busqueda && (
            <button className={styles.btnPrimario} onClick={() => setModalForm({ abierto: true })}>
              + Nueva categoría
            </button>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {filtradas.map((c) => (
            <div key={c.categoria_id} className={styles.card}>
              <div className={styles.cardTop}>
                <div className={styles.cardIconWrap}>🏷️</div>
                <div className={styles.cardInfo}>
                  <h3 className={styles.cardNombre}>{c.nombre}</h3>
                  {c.descripcion && <p className={styles.cardDesc}>{c.descripcion}</p>}
                  <span className={styles.cardDate}>{fmtDate(c.created_at)}</span>
                </div>
              </div>
              <div className={styles.cardActions}>
                <button className={styles.btnAccion} onClick={() => setPanelCarpetas(c)} title="Asignar a carpetas">
                  📁 Carpetas
                </button>
                {(c.user_id === userId)&& (
                  <>
                    <button className={styles.btnAccion} onClick={() => setModalForm({ abierto: true, editar: c })} title="Editar">
                      ✏️ Editar
                    </button>
                    <button className={`${styles.btnAccion} ${styles.btnAccionPeligro}`}
                      onClick={() => setConfirmarEliminar(c)} title="Eliminar">
                      🗑️
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modales */}
      {modalForm.abierto && (
        <ModalForm
          inicial={modalForm.editar}
          onGuardar={crearOEditar}
          onCerrar={() => setModalForm({ abierto: false })}
        />
      )}
      {confirmarEliminar && (
        <ModalConfirm
          mensaje={`¿Eliminar la categoría "${confirmarEliminar.nombre}"? Se desvinculará de todas las carpetas y recursos.`}
          onConfirm={() => eliminar(confirmarEliminar)}
          onCancel={() => setConfirmarEliminar(null)}
        />
      )}
      {panelCarpetas && userId && (
        <PanelCarpetas
          categoria={panelCarpetas}
          userId={userId}
          onClose={() => setPanelCarpetas(null)}
        />
      )}
    </div>
  );
}