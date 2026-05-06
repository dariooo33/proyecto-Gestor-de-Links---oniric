"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Grupo, GrupoMiembro, UsuarioBusqueda } from "@/app/types";
import styles from "./page.module.css";
import adminStyles from "../page.module.css";

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function Avatar({ nombre, size = 32 }: { nombre: string; size?: number }) {
  return (
    <div className={adminStyles.avatar} style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {nombre.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── Modal Crear/Editar Grupo ───────────────────────────────────────────────

function ModalGrupo({
  grupo,
  onClose,
  onSave,
}: {
  grupo?: Grupo | null;
  onClose: () => void;
  onSave: (nombre: string, descripcion: string) => Promise<void>;
}) {
  const [nombre, setNombre] = useState(grupo?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(grupo?.descripcion ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!nombre.trim()) return;
    setSaving(true);
    await onSave(nombre.trim(), descripcion.trim());
    setSaving(false);
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalTitle}>
          {grupo ? "✏️ Editar grupo" : "➕ Nuevo grupo"}
        </div>

        <label className={styles.label}>Nombre del grupo *</label>
        <input
          className={styles.input}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: Equipo de diseño"
          autoFocus
        />

        <label className={styles.label}>Descripción (opcional)</label>
        <textarea
          className={styles.textarea}
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Para qué se usa este grupo…"
          rows={3}
        />

        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className={styles.btnPrimary} onClick={handleSubmit} disabled={saving || !nombre.trim()}>
            {saving ? "Guardando…" : grupo ? "Guardar cambios" : "Crear grupo"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Panel de detalle del grupo ─────────────────────────────────────────────

function DetalleGrupo({
  grupo,
  onClose,
  onUpdated,
}: {
  grupo: Grupo;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [miembros, setMiembros] = useState<GrupoMiembro[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<UsuarioBusqueda[]>([]);
  const [searching, setSearching] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const loadMiembros = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("GrupoMiembros")
      .select("*, Usuario!GrupoMiembros_user_id_fkey(nombre, email)")
      .eq("grupo_id", grupo.grupo_id)
      .order("added_at", { ascending: false });
    setMiembros((data as GrupoMiembro[]) ?? []);
    setLoading(false);
  }, [grupo.grupo_id]);

  useEffect(() => { loadMiembros(); }, [loadMiembros]);

  // Búsqueda de usuarios con debounce
  useEffect(() => {
    if (query.trim().length < 2) { setResultados([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      const miembroIds = miembros.map((m) => m.user_id);
      let q = supabase
        .from("Usuario")
        .select("user_id, nombre, email")
        .or(`nombre.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(6);
      // Excluir ya miembros
      if (miembroIds.length > 0) {
        q = q.not("user_id", "in", `(${miembroIds.join(",")})`);
      }
      const { data } = await q;
      setResultados((data as UsuarioBusqueda[]) ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, miembros]);

  async function handleAdd(usuario: UsuarioBusqueda) {
    setMsg(null);
    const { error } = await supabase.from("GrupoMiembros").insert({
      grupo_id: grupo.grupo_id,
      user_id: usuario.user_id,
    });
    if (error) {
      setMsg({ type: "err", text: error.message });
    } else {
      setMsg({ type: "ok", text: `${usuario.nombre} añadido al grupo` });
      setQuery("");
      setResultados([]);
      await loadMiembros();
    }
  }

  async function handleRemove(miembro: GrupoMiembro) {
    const { error } = await supabase
      .from("GrupoMiembros")
      .delete()
      .eq("grupo_id", grupo.grupo_id)
      .eq("user_id", miembro.user_id);
    if (error) setMsg({ type: "err", text: error.message });
    else await loadMiembros();
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.detailPanel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.detailHeader}>
          <div>
            <div className={styles.detailTitle}>👥 {grupo.nombre}</div>
            {grupo.descripcion && (
              <div className={styles.detailDesc}>{grupo.descripcion}</div>
            )}
            <div className={styles.detailMeta}>Creado {fmtDate(grupo.created_at)}</div>
          </div>
          <button className={styles.btnClose} onClick={onClose}>×</button>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Añadir usuario al grupo</div>
          <input
            className={styles.input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o correo…"
          />
          {searching && <div className={styles.hint}>Buscando…</div>}
          {resultados.length > 0 && (
            <div className={styles.searchResults}>
              {resultados.map((u) => (
                <div key={u.user_id} className={styles.searchResult}>
                  <Avatar nombre={u.nombre} size={28} />
                  <div className={styles.resultInfo}>
                    <span className={styles.resultName}>{u.nombre}</span>
                    <span className={styles.resultEmail}>{u.email}</span>
                  </div>
                  <button className={styles.btnPrimary} onClick={() => handleAdd(u)}>
                    Añadir
                  </button>
                </div>
              ))}
            </div>
          )}
          {query.length >= 2 && !searching && resultados.length === 0 && (
            <div className={styles.hint}>Sin resultados</div>
          )}
          {msg && (
            <div className={`${styles.msg} ${msg.type === "ok" ? styles.msgOk : styles.msgErr}`}>
              {msg.text}
            </div>
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            Miembros del grupo
            <span className={styles.badge}>{miembros.length}</span>
          </div>
          {loading ? (
            <div className={styles.hint}>Cargando…</div>
          ) : miembros.length === 0 ? (
            <div className={styles.hint}>El grupo no tiene miembros todavía.</div>
          ) : (
            <div className={styles.miembroList}>
              {miembros.map((m) => (
                <div key={m.user_id} className={styles.miembroRow}>
                  <Avatar nombre={m.Usuario?.nombre ?? "?"} size={30} />
                  <div className={styles.miembroInfo}>
                    <span className={styles.miembroNombre}>{m.Usuario?.nombre ?? "—"}</span>
                    <span className={styles.miembroEmail}>{m.Usuario?.email ?? ""}</span>
                  </div>
                  <span className={styles.miembroFecha}>{fmtDate(m.added_at)}</span>
                  <button
                    className={styles.btnRemove}
                    title="Quitar del grupo"
                    onClick={() => handleRemove(m)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function GruposPage() {
  const router = useRouter();
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editGrupo, setEditGrupo] = useState<Grupo | null>(null);
  const [selectedGrupo, setSelectedGrupo] = useState<Grupo | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const loadGrupos = useCallback(async () => {
    const { data } = await supabase
      .from("Grupos")
      .select("*")
      .order("created_at", { ascending: false });
    setGrupos((data as Grupo[]) ?? []);
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const { data: u } = await supabase
        .from("Usuario").select("rol").eq("user_id", session.user.id).single();
      if (!u || u.rol !== "admin") { router.push("/"); return; }

      setUserId(session.user.id);
      await loadGrupos();
      setLoading(false);
    }
    init();
  }, [router, loadGrupos]);

  async function handleCreate(nombre: string, descripcion: string) {
    if (!userId) return;
    const { error } = await supabase.from("Grupos").insert({
      nombre, descripcion: descripcion || null, created_by: userId,
    });
    if (!error) { await loadGrupos(); setShowModal(false); }
  }

  async function handleEdit(nombre: string, descripcion: string) {
    if (!editGrupo) return;
    const { error } = await supabase
      .from("Grupos")
      .update({ nombre, descripcion: descripcion || null })
      .eq("grupo_id", editGrupo.grupo_id);
    if (!error) { await loadGrupos(); setEditGrupo(null); }
  }

  async function handleDelete(grupo: Grupo) {
    if (!confirm(`¿Eliminar el grupo "${grupo.nombre}"? Se revocarán todos los permisos de carpeta asociados.`)) return;
    await supabase.from("Grupos").delete().eq("grupo_id", grupo.grupo_id);
    await loadGrupos();
    if (selectedGrupo?.grupo_id === grupo.grupo_id) setSelectedGrupo(null);
  }

  const filtered = grupos.filter((g) =>
    g.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (g.descripcion ?? "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className={adminStyles.loadingScreen}>
        <div className={adminStyles.loadingDots}><span /><span /><span /></div>
      </div>
    );
  }

  return (
    <div className={adminStyles.page}>
      {/* Header */}
      <div className={adminStyles.header}>
        <div className={adminStyles.headerLeft}>
          <div className={adminStyles.headerIcon}>👥</div>
          <div>
            <h1 className={adminStyles.headerTitle}>Grupos de Usuarios</h1>
            <p className={adminStyles.headerSub}>{grupos.length} grupos creados</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className={adminStyles.btnBack} onClick={() => router.push("/admin")}>
            ← Admin
          </button>
          <button
            className={styles.btnPrimary}
            onClick={() => setShowModal(true)}
          >
            + Nuevo grupo
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className={adminStyles.toolbar}>
        <input
          className={adminStyles.searchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar grupos…"
        />
        <span className={adminStyles.resultCount}>
          {filtered.length} grupo{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Grid de grupos */}
      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          {search
            ? `Sin resultados para "${search}"`
            : "Aún no hay grupos. Crea el primero con el botón de arriba."}
        </div>
      ) : (
        <div className={styles.gruposGrid}>
          {filtered.map((g) => (
            <div key={g.grupo_id} className={styles.grupoCard}>
              <div className={styles.grupoCardIcon}>👥</div>
              <div className={styles.grupoCardBody}>
                <div className={styles.grupoNombre}>{g.nombre}</div>
                {g.descripcion && (
                  <div className={styles.grupoDesc}>{g.descripcion}</div>
                )}
                <div className={styles.grupoMeta}>Creado {fmtDate(g.created_at)}</div>
              </div>
              <div className={styles.grupoCardActions}>
                <button
                  className={styles.btnAction}
                  title="Ver miembros"
                  onClick={() => setSelectedGrupo(g)}
                >
                  👤 Miembros
                </button>
                <button
                  className={styles.btnAction}
                  title="Editar"
                  onClick={() => setEditGrupo(g)}
                >
                  ✏️
                </button>
                <button
                  className={styles.btnActionDanger}
                  title="Eliminar"
                  onClick={() => handleDelete(g)}
                >
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <ModalGrupo
          onClose={() => setShowModal(false)}
          onSave={handleCreate}
        />
      )}
      {editGrupo && (
        <ModalGrupo
          grupo={editGrupo}
          onClose={() => setEditGrupo(null)}
          onSave={handleEdit}
        />
      )}
      {selectedGrupo && (
        <DetalleGrupo
          grupo={selectedGrupo}
          onClose={() => setSelectedGrupo(null)}
          onUpdated={loadGrupos}
        />
      )}
    </div>
  );
}
