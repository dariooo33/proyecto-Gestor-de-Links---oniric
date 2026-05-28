"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import styles from "./page.module.css";

interface Etiqueta {
  etiqueta_id: string;
  nombre: string;
  descripcion?: string;
  created_at: string;
  user_id: string;
  color?: string | null;
}

const COLORES_ETIQUETA = [
  { id: "green",  label: "Verde",    hex: "#4ecb8d", bg: "rgba(78,203,141,.15)",  border: "rgba(78,203,141,.4)"  },
  { id: "blue",   label: "Azul",     hex: "#60a5fa", bg: "rgba(96,165,250,.15)",  border: "rgba(96,165,250,.4)"  },
  { id: "purple", label: "Violeta",  hex: "#a78bfa", bg: "rgba(167,139,250,.15)", border: "rgba(167,139,250,.4)" },
  { id: "pink",   label: "Rosa",     hex: "#f472b6", bg: "rgba(244,114,182,.15)", border: "rgba(244,114,182,.4)" },
  { id: "orange", label: "Naranja",  hex: "#fb923c", bg: "rgba(251,146,60,.15)",  border: "rgba(251,146,60,.4)"  },
  { id: "yellow", label: "Amarillo", hex: "#fbbf24", bg: "rgba(251,191,36,.15)",  border: "rgba(251,191,36,.4)"  },
  { id: "red",    label: "Rojo",     hex: "#f87171", bg: "rgba(248,113,113,.15)", border: "rgba(248,113,113,.4)" },
  { id: "cyan",   label: "Cian",     hex: "#22d3ee", bg: "rgba(34,211,238,.15)",  border: "rgba(34,211,238,.4)"  },
  { id: "gray",   label: "Gris",     hex: "#94a3b8", bg: "rgba(148,163,184,.15)", border: "rgba(148,163,184,.4)" },
];

function getColorDef(colorId?: string | null) {
  return COLORES_ETIQUETA.find((c) => c.id === colorId) ?? COLORES_ETIQUETA[0];
}

interface Carpeta {
  carpeta_id: string;
  nombre: string;
  id_padre: string | null;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

// ── Modal confirmación ────────────────────────────────────────────────────
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
function PanelCarpetas({ etiqueta, userId, onClose }: {
  etiqueta: Etiqueta; userId: string; onClose: () => void;
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
        supabase.from("Carpetas_Recrusos_Etiquetas")
          .select("carpeta_id")
          .eq("etiqueta_id", etiqueta.etiqueta_id)
          .not("carpeta_id", "is", null),
      ]);
      setTodasCarpetas(carpetas ?? []);
      setAsignadas(new Set((rel ?? []).map((r: any) => r.carpeta_id)));
      setLoading(false);
    }
    load();
  }, [etiqueta.etiqueta_id, userId]);

  async function toggle(carpetaId: string) {
    setSaving(carpetaId);
    if (asignadas.has(carpetaId)) {
      await supabase.from("Carpetas_Recrusos_Etiquetas")
        .delete()
        .eq("etiqueta_id", etiqueta.etiqueta_id)
        .eq("carpeta_id", carpetaId);
      setAsignadas((prev) => { const s = new Set(prev); s.delete(carpetaId); return s; });
    } else {
      await supabase.from("Carpetas_Recrusos_Etiquetas")
        .insert({ etiqueta_id: etiqueta.etiqueta_id, carpeta_id: carpetaId });
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
            <h2 className={styles.panelTitulo}>Carpetas — <span className={styles.accentText}>{etiqueta.nombre}</span></h2>
            <p className={styles.panelSub}>Activa o desactiva la etiqueta en cada carpeta</p>
          </div>
          <button className={styles.btnClose} onClick={onClose}>×</button>
        </div>

        <div className={styles.panelSearch}>
          <span className={styles.searchIconInner}>🔍</span>
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
  inicial?: Partial<Etiqueta>;
  onGuardar: (nombre: string, descripcion: string, color: string) => Promise<void>;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? "");
  const [color, setColor] = useState(inicial?.color ?? "green");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setSaving(true);
    await onGuardar(nombre.trim(), descripcion.trim(), color);
    setSaving(false);
  }

  const colorDef = getColorDef(color);

  return (
    <div className={styles.overlay} onClick={onCerrar}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitulo}>{inicial?.etiqueta_id ? "Editar etiqueta" : "Nueva etiqueta"}</h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.label}>Nombre</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{
              display: "inline-block", width: 18, height: 18, borderRadius: 5,
              background: colorDef.bg, border: `2px solid ${colorDef.hex}`, flexShrink: 0
            }} />
            <input
              ref={inputRef}
              className={styles.input}
              style={{ flex: 1, borderColor: colorDef.hex }}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: urgente, favorito, revisar…"
              maxLength={60}
            />
          </div>
          <label className={styles.label} style={{ marginTop: 14 }}>Color</label>
          <div className={styles.colorPicker}>
            {COLORES_ETIQUETA.map((c) => (
              <button
                key={c.id}
                type="button"
                className={styles.colorSwatch}
                style={{
                  background: c.bg,
                  border: `2px solid ${color === c.id ? c.hex : "transparent"}`,
                  boxShadow: color === c.id ? `0 0 0 2px ${c.hex}44` : "none",
                }}
                title={c.label}
                onClick={() => setColor(c.id)}
              >
                <span style={{
                  display: "block", width: 20, height: 20, borderRadius: "50%",
                  background: c.hex, opacity: 0.9
                }} />
              </button>
            ))}
          </div>
          <label className={styles.label} style={{ marginTop: 14 }}>Descripción <span className={styles.opcional}>(opcional)</span></label>
          <textarea
            className={styles.textarea}
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Breve descripción de la etiqueta…"
            rows={3}
            maxLength={300}
          />
          <div className={styles.modalActions}>
            <button type="button" className={styles.btnSecundario} onClick={onCerrar}>Cancelar</button>
            <button type="submit" className={styles.btnPrimario} disabled={!nombre.trim() || saving}
              style={{ background: colorDef.hex }}>
              {saving ? "Guardando…" : inicial?.etiqueta_id ? "Guardar cambios" : "Crear etiqueta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────
export default function EtiquetasPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  const [modalForm, setModalForm] = useState<{ abierto: boolean; editar?: Etiqueta }>({ abierto: false });
  const [confirmarEliminar, setConfirmarEliminar] = useState<Etiqueta | null>(null);
  const [panelCarpetas, setPanelCarpetas] = useState<Etiqueta | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login"); return; }
      const uid = session.user.id;
      setUserId(uid);
      supabase.from("Etiquetas")
        .select("*")
        .order("nombre")
        .then(({ data, error }) => {
          if (!error) setEtiquetas((data as Etiqueta[]) ?? []);
          setLoading(false);
        });
    });
  }, [router]);

  async function crearOEditar(nombre: string, descripcion: string, color: string) {
    if (modalForm.editar) {
      const { data } = await supabase.from("Etiquetas")
        .update({ nombre, descripcion, color })
        .eq("etiqueta_id", modalForm.editar.etiqueta_id)
        .select()
        .single();
      if (data) setEtiquetas((prev) => prev.map((e) => e.etiqueta_id === data.etiqueta_id ? data : e));
    } else {
      const { data } = await supabase.from("Etiquetas")
        .insert({ nombre, descripcion, color })
        .select()
        .single();
      if (data) setEtiquetas((prev) => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    }
    setModalForm({ abierto: false });
  }

  async function eliminar(e: Etiqueta) {
    await supabase.from("Etiquetas").delete().eq("etiqueta_id", e.etiqueta_id);
    setEtiquetas((prev) => prev.filter((x) => x.etiqueta_id !== e.etiqueta_id));
    setConfirmarEliminar(null);
  }

  const filtradas = busqueda.trim()
    ? etiquetas.filter((e) =>
        e.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()) ||
        e.descripcion?.toLowerCase().includes(busqueda.trim().toLowerCase())
      )
    : etiquetas;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <button className={styles.btnBack} onClick={() => router.back()}>← Volver</button>
          <div className={styles.headerIcon}>🔖</div>
          <div>
            <h1 className={styles.headerTitle}>Etiquetas</h1>
            <p className={styles.headerSub}>{etiquetas.length} etiqueta{etiquetas.length !== 1 ? "s" : ""} en total</p>
          </div>
        </div>
        <button className={styles.btnPrimario} onClick={() => setModalForm({ abierto: true })}>
          + Nueva etiqueta
        </button>
      </div>

      {/* Buscador */}
      <div className={styles.searchWrapper}>
        <span className={styles.searchIcon}>🔍</span>
        <input
          className={styles.searchInput}
          placeholder="Buscar etiquetas…"
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
          <div className={styles.emptyIcon}>{busqueda ? "🔍" : "🔖"}</div>
          <div>{busqueda ? `Sin resultados para "${busqueda}"` : "Aún no hay etiquetas. ¡Crea la primera!"}</div>
          {!busqueda && (
            <button className={styles.btnPrimario} onClick={() => setModalForm({ abierto: true })}>
              + Nueva etiqueta
            </button>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {filtradas.map((e) => (
            <div key={e.etiqueta_id} className={styles.card}
              style={{ borderColor: getColorDef(e.color).border }}>
              <div className={styles.cardTop}>
                <div className={styles.cardIconWrap}
                  style={{ background: getColorDef(e.color).bg, borderColor: getColorDef(e.color).border }}>
                  🔖
                </div>
                <div className={styles.cardInfo}>
                  <h3 className={styles.cardNombre}
                    style={{ color: getColorDef(e.color).hex }}>{e.nombre}</h3>
                  {e.descripcion && <p className={styles.cardDesc}>{e.descripcion}</p>}
                  <span className={styles.cardDate}>{fmtDate(e.created_at)}</span>
                </div>
              </div>
              <div className={styles.cardActions}>
                <button className={styles.btnAccion} onClick={() => setPanelCarpetas(e)} title="Asignar a carpetas">
                  📁 Carpetas
                </button>
                {e.user_id === userId && (
                  <>
                    <button className={styles.btnAccion} onClick={() => setModalForm({ abierto: true, editar: e })} title="Editar">
                      ✏️ Editar
                    </button>
                    <button className={`${styles.btnAccion} ${styles.btnAccionPeligro}`}
                      onClick={() => setConfirmarEliminar(e)} title="Eliminar">
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
          mensaje={`¿Eliminar la etiqueta "${confirmarEliminar.nombre}"? Se desvinculará de todas las carpetas y recursos.`}
          onConfirm={() => eliminar(confirmarEliminar)}
          onCancel={() => setConfirmarEliminar(null)}
        />
      )}
      {panelCarpetas && userId && (
        <PanelCarpetas
          etiqueta={panelCarpetas}
          userId={userId}
          onClose={() => setPanelCarpetas(null)}
        />
      )}
    </div>
  );
}