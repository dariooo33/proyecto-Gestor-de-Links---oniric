"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Grupo, GrupoMiembro, UsuarioBusqueda, PermisoGrupo } from "@/app/types";
import { getAllDescendantIds } from "@/app/helpers";
import { Carpeta } from "@/app/types";
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

async function getDescendantIds(rootId: string): Promise<string[]> {
  const { data } = await supabase.from("Carpetas").select("carpeta_id, id_padre, user_id");
  return getAllDescendantIds(rootId, (data ?? []) as Carpeta[]);
}

// ─── Tipo auxiliar para carpetas con propietario ────────────────────────────

interface CarpetaConOwner {
  carpeta_id: string;
  nombre: string;
  id_padre: string | null;
  user_id: string;
  ownerNombre: string;
}

// ─── Modal Crear/Editar Grupo ───────────────────────────────────────────────

function ModalGrupo({
  grupo, onClose, onSave,
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
        <div className={styles.modalTitle}>{grupo ? "✏️ Editar grupo" : "➕ Nuevo grupo"}</div>
        <label className={styles.label}>Nombre del grupo *</label>
        <input className={styles.input} value={nombre} onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: Equipo de diseño" autoFocus />
        <label className={styles.label}>Descripción (opcional)</label>
        <textarea className={styles.textarea} value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Para qué se usa este grupo…" rows={3} />
        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onClose} disabled={saving}>Cancelar</button>
          <button className={styles.btnPrimary} onClick={handleSubmit} disabled={saving || !nombre.trim()}>
            {saving ? "Guardando…" : grupo ? "Guardar cambios" : "Crear grupo"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Panel de detalle del grupo ─────────────────────────────────────────────

type DetalleTab = "miembros" | "carpetas";

function DetalleGrupo({
  grupo, onClose, onUpdated,
}: {
  grupo: Grupo;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [tab, setTab] = useState<DetalleTab>("miembros");

  // ── Estado miembros ──────────────────────────────────────────────────────
  const [miembros, setMiembros] = useState<GrupoMiembro[]>([]);
  const [loadingMiembros, setLoadingMiembros] = useState(true);
  const [queryUsuario, setQueryUsuario] = useState("");
  const [resultadosUsuario, setResultadosUsuario] = useState<UsuarioBusqueda[]>([]);
  const [searchingUsuario, setSearchingUsuario] = useState(false);
  const [msgMiembro, setMsgMiembro] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // ── Estado carpetas ──────────────────────────────────────────────────────
  const [carpetasCompartidas, setCarpetasCompartidas] = useState<(PermisoGrupo & { carpetaNombre: string; ownerNombre: string })[]>([]);
  const [loadingCarpetas, setLoadingCarpetas] = useState(true);
  const [queryCarpeta, setQueryCarpeta] = useState("");
  const [resultadosCarpeta, setResultadosCarpeta] = useState<CarpetaConOwner[]>([]);
  const [searchingCarpeta, setSearchingCarpeta] = useState(false);
  const [nivelCarpeta, setNivelCarpeta] = useState<"lectura" | "edicion">("lectura");
  const [msgCarpeta, setMsgCarpeta] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [savingCarpeta, setSavingCarpeta] = useState(false);

  // ── Cargar miembros ──────────────────────────────────────────────────────
  const loadMiembros = useCallback(async () => {
    setLoadingMiembros(true);
    const { data } = await supabase
      .from("GrupoMiembros")
      .select("*, Usuario!GrupoMiembros_user_id_fkey(nombre, email)")
      .eq("grupo_id", grupo.grupo_id)
      .order("added_at", { ascending: false });
    setMiembros((data as GrupoMiembro[]) ?? []);
    setLoadingMiembros(false);
  }, [grupo.grupo_id]);

  // ── Cargar carpetas compartidas con el grupo ─────────────────────────────
  const loadCarpetasCompartidas = useCallback(async () => {
    setLoadingCarpetas(true);
    const { data: pgData } = await supabase
      .from("PermisosGrupo")
      .select("*")
      .eq("grupo_id", grupo.grupo_id);

    const pg = (pgData ?? []) as PermisoGrupo[];

    // Solo raíces (carpetas que no tienen padre dentro del mismo conjunto de permisos)
    // Para simplicidad, mostramos todas las que tienen owner_id = la carpeta raíz compartida
    // Filtramos para mostrar solo las carpetas raíz del permiso (sin duplicar subcarpetas)
    const carpetaIds = [...new Set(pg.map((p) => p.carpeta_id))];
    if (carpetaIds.length === 0) { setCarpetasCompartidas([]); setLoadingCarpetas(false); return; }

    const { data: carpetasData } = await supabase
      .from("Carpetas")
      .select("carpeta_id, nombre, id_padre, user_id")
      .in("carpeta_id", carpetaIds);

    const carpetas = (carpetasData ?? []) as Carpeta[];
    const carpetaSet = new Set(carpetaIds);

    // Solo mostrar carpetas raíz del permiso (cuyo padre no está también en el conjunto)
    const raices = carpetas.filter((c) => !c.id_padre || !carpetaSet.has(c.id_padre));

    // Obtener nombres de owners
    const ownerIds = [...new Set(raices.map((c) => c.user_id))];
    const ownerMap: Record<string, string> = {};
    if (ownerIds.length > 0) {
      const { data: owners } = await supabase
        .from("Usuario").select("user_id, nombre").in("user_id", ownerIds);
      (owners ?? []).forEach((o: { user_id: string; nombre: string }) => { ownerMap[o.user_id] = o.nombre; });
    }

    // Unir con nivel del permiso
    const result = raices.map((c) => {
      const permiso = pg.find((p) => p.carpeta_id === c.carpeta_id);
      return {
        ...(permiso ?? { permiso_grupo_id: "", carpeta_id: c.carpeta_id, grupo_id: grupo.grupo_id, owner_id: c.user_id, nivel: "lectura" as const, created_at: "" }),
        carpetaNombre: c.nombre,
        ownerNombre: ownerMap[c.user_id] ?? "—",
      };
    });

    setCarpetasCompartidas(result);
    setLoadingCarpetas(false);
  }, [grupo.grupo_id]);

  useEffect(() => { loadMiembros(); }, [loadMiembros]);
  useEffect(() => { loadCarpetasCompartidas(); }, [loadCarpetasCompartidas]);

  // ── Búsqueda de usuarios ─────────────────────────────────────────────────
  useEffect(() => {
    if (queryUsuario.trim().length < 2) { setResultadosUsuario([]); return; }
    const timer = setTimeout(async () => {
      setSearchingUsuario(true);
      const miembroIds = miembros.map((m) => m.user_id);
      let q = supabase.from("Usuario").select("user_id, nombre, email")
        .or(`nombre.ilike.%${queryUsuario}%,email.ilike.%${queryUsuario}%`).limit(6);
      if (miembroIds.length > 0) q = q.not("user_id", "in", `(${miembroIds.join(",")})`);
      const { data } = await q;
      setResultadosUsuario((data as UsuarioBusqueda[]) ?? []);
      setSearchingUsuario(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [queryUsuario, miembros]);

  // ── Búsqueda de carpetas ─────────────────────────────────────────────────
  useEffect(() => {
    if (queryCarpeta.trim().length < 2) { setResultadosCarpeta([]); return; }
    const timer = setTimeout(async () => {
      setSearchingCarpeta(true);
      const yaIds = carpetasCompartidas.map((c) => c.carpeta_id);

      let q = supabase
        .from("Carpetas")
        .select("carpeta_id, nombre, id_padre, user_id")
        .ilike("nombre", `%${queryCarpeta}%`)
        .limit(8);
      if (yaIds.length > 0) q = q.not("carpeta_id", "in", `(${yaIds.join(",")})`);
      const { data: carpetasRaw } = await q;
      const carpetas = (carpetasRaw ?? []) as Carpeta[];

      // Obtener nombres de owners
      const ownerIds = [...new Set(carpetas.map((c) => c.user_id))];
      const ownerMap: Record<string, string> = {};
      if (ownerIds.length > 0) {
        const { data: owners } = await supabase
          .from("Usuario").select("user_id, nombre").in("user_id", ownerIds);
        (owners ?? []).forEach((o: { user_id: string; nombre: string }) => { ownerMap[o.user_id] = o.nombre; });
      }

      setResultadosCarpeta(carpetas.map((c) => ({
        carpeta_id: c.carpeta_id,
        nombre: c.nombre,
        id_padre: c.id_padre,
        user_id: c.user_id,
        ownerNombre: ownerMap[c.user_id] ?? "—",
      })));
      setSearchingCarpeta(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [queryCarpeta, carpetasCompartidas]);

  // ── Acciones miembros ────────────────────────────────────────────────────
  async function handleAddMiembro(usuario: UsuarioBusqueda) {
    setMsgMiembro(null);
    const { error } = await supabase.from("GrupoMiembros").insert({ grupo_id: grupo.grupo_id, user_id: usuario.user_id });
    if (error) { setMsgMiembro({ type: "err", text: error.message }); return; }
    setMsgMiembro({ type: "ok", text: `${usuario.nombre} añadido al grupo` });
    setQueryUsuario(""); setResultadosUsuario([]);
    await loadMiembros();
  }

  async function handleRemoveMiembro(miembro: GrupoMiembro) {
    const { error } = await supabase.from("GrupoMiembros").delete()
      .eq("grupo_id", grupo.grupo_id).eq("user_id", miembro.user_id);
    if (error) setMsgMiembro({ type: "err", text: error.message });
    else await loadMiembros();
  }

  // ── Acciones carpetas ────────────────────────────────────────────────────
  async function handleAddCarpeta(carpeta: CarpetaConOwner) {
    setSavingCarpeta(true); setMsgCarpeta(null);
    const ids = await getDescendantIds(carpeta.carpeta_id);
    const rows = ids.map((cid) => ({
      carpeta_id: cid,
      grupo_id: grupo.grupo_id,
      owner_id: carpeta.user_id,
      nivel: nivelCarpeta,
    }));
    const { error } = await supabase.from("PermisosGrupo").upsert(rows, { onConflict: "carpeta_id,grupo_id" });
    if (error) { setMsgCarpeta({ type: "err", text: error.message }); setSavingCarpeta(false); return; }

    // Propagar permisos individuales a cada miembro del grupo
    if (miembros.length > 0) {
      const permisoRows = ids.flatMap((cid) =>
        miembros.map((m) => ({ carpeta_id: cid, owner_id: carpeta.user_id, user_id: m.user_id, nivel: nivelCarpeta }))
      );
      await supabase.from("Permisos").upsert(permisoRows, { onConflict: "carpeta_id,user_id" });
    }

    setMsgCarpeta({ type: "ok", text: `"${carpeta.nombre}" compartida con el grupo` });
    setQueryCarpeta(""); setResultadosCarpeta([]);
    await loadCarpetasCompartidas();
    setSavingCarpeta(false);
  }

  async function handleChangeNivelCarpeta(item: typeof carpetasCompartidas[0], nivel: "lectura" | "edicion") {
    const ids = await getDescendantIds(item.carpeta_id);
    await supabase.from("PermisosGrupo").update({ nivel }).eq("grupo_id", grupo.grupo_id).in("carpeta_id", ids);
    if (miembros.length > 0) {
      const userIds = miembros.map((m) => m.user_id);
      await supabase.from("Permisos").update({ nivel }).in("user_id", userIds).in("carpeta_id", ids);
    }
    await loadCarpetasCompartidas();
  }

  async function handleRemoveCarpeta(item: typeof carpetasCompartidas[0]) {
    const ids = await getDescendantIds(item.carpeta_id);
    await supabase.from("PermisosGrupo").delete().eq("grupo_id", grupo.grupo_id).in("carpeta_id", ids);
    if (miembros.length > 0) {
      const userIds = miembros.map((m) => m.user_id);
      await supabase.from("Permisos").delete().in("user_id", userIds).in("carpeta_id", ids);
    }
    await loadCarpetasCompartidas();
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.detailPanel} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.detailHeader}>
          <div>
            <div className={styles.detailTitle}>👥 {grupo.nombre}</div>
            {grupo.descripcion && <div className={styles.detailDesc}>{grupo.descripcion}</div>}
            <div className={styles.detailMeta}>Creado {fmtDate(grupo.created_at)}</div>
          </div>
          <button className={styles.btnClose} onClick={onClose}>×</button>
        </div>

        {/* Tabs */}
        <div className={styles.tabBar}>
          {(["miembros", "carpetas"] as DetalleTab[]).map((t) => (
            <button key={t} className={`${styles.tabBtn} ${tab === t ? styles.tabBtnActive : ""}`}
              onClick={() => setTab(t)}>
              {t === "miembros" ? `👤 Miembros (${miembros.length})` : `📁 Carpetas (${carpetasCompartidas.length})`}
            </button>
          ))}
        </div>

        {/* ── Tab Miembros ─────────────────────────────────────────────── */}
        {tab === "miembros" && (
          <>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Añadir usuario al grupo</div>
              <input className={styles.input} value={queryUsuario}
                onChange={(e) => setQueryUsuario(e.target.value)} placeholder="Buscar por nombre o correo…" />
              {searchingUsuario && <div className={styles.hint}>Buscando…</div>}
              {resultadosUsuario.length > 0 && (
                <div className={styles.searchResults}>
                  {resultadosUsuario.map((u) => (
                    <div key={u.user_id} className={styles.searchResult}>
                      <Avatar nombre={u.nombre} size={28} />
                      <div className={styles.resultInfo}>
                        <span className={styles.resultName}>{u.nombre}</span>
                        <span className={styles.resultEmail}>{u.email}</span>
                      </div>
                      <button className={styles.btnPrimary} onClick={() => handleAddMiembro(u)}>Añadir</button>
                    </div>
                  ))}
                </div>
              )}
              {queryUsuario.length >= 2 && !searchingUsuario && resultadosUsuario.length === 0 && (
                <div className={styles.hint}>Sin resultados</div>
              )}
              {msgMiembro && (
                <div className={`${styles.msg} ${msgMiembro.type === "ok" ? styles.msgOk : styles.msgErr}`}>
                  {msgMiembro.text}
                </div>
              )}
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                Miembros <span className={styles.badge}>{miembros.length}</span>
              </div>
              {loadingMiembros ? <div className={styles.hint}>Cargando…</div>
                : miembros.length === 0 ? <div className={styles.hint}>El grupo no tiene miembros todavía.</div>
                : (
                  <div className={styles.miembroList}>
                    {miembros.map((m) => (
                      <div key={m.user_id} className={styles.miembroRow}>
                        <Avatar nombre={m.Usuario?.nombre ?? "?"} size={30} />
                        <div className={styles.miembroInfo}>
                          <span className={styles.miembroNombre}>{m.Usuario?.nombre ?? "—"}</span>
                          <span className={styles.miembroEmail}>{m.Usuario?.email ?? ""}</span>
                        </div>
                        <span className={styles.miembroFecha}>{fmtDate(m.added_at)}</span>
                        <button className={styles.btnRemove} title="Quitar del grupo" onClick={() => handleRemoveMiembro(m)}>×</button>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </>
        )}

        {/* ── Tab Carpetas ─────────────────────────────────────────────── */}
        {tab === "carpetas" && (
          <>
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Compartir carpeta con el grupo</div>
              <div className={styles.searchRow}>
                <input className={styles.input} value={queryCarpeta}
                  onChange={(e) => setQueryCarpeta(e.target.value)}
                  placeholder="Buscar carpeta por nombre…"
                  style={{ flex: 1 }} />
                <select className={styles.nivelSelect} value={nivelCarpeta}
                  onChange={(e) => setNivelCarpeta(e.target.value as "lectura" | "edicion")}>
                  <option value="lectura">👁 Lectura</option>
                  <option value="edicion">✏️ Edición</option>
                </select>
              </div>
              {searchingCarpeta && <div className={styles.hint}>Buscando…</div>}
              {resultadosCarpeta.length > 0 && (
                <div className={styles.searchResults}>
                  {resultadosCarpeta.map((c) => (
                    <div key={c.carpeta_id} className={styles.searchResult}>
                      <span style={{ fontSize: 18 }}>{c.id_padre ? "📂" : "📁"}</span>
                      <div className={styles.resultInfo}>
                        <span className={styles.resultName}>{c.nombre}</span>
                        <span className={styles.resultEmail}>de {c.ownerNombre}</span>
                      </div>
                      <button className={styles.btnPrimary} disabled={savingCarpeta}
                        onClick={() => handleAddCarpeta(c)}>
                        Compartir
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {queryCarpeta.length >= 2 && !searchingCarpeta && resultadosCarpeta.length === 0 && (
                <div className={styles.hint}>Sin carpetas encontradas</div>
              )}
              {msgCarpeta && (
                <div className={`${styles.msg} ${msgCarpeta.type === "ok" ? styles.msgOk : styles.msgErr}`}>
                  {msgCarpeta.text}
                </div>
              )}
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                Carpetas compartidas <span className={styles.badge}>{carpetasCompartidas.length}</span>
              </div>
              {loadingCarpetas ? <div className={styles.hint}>Cargando…</div>
                : carpetasCompartidas.length === 0
                  ? <div className={styles.hint}>Este grupo no tiene acceso a ninguna carpeta todavía.</div>
                  : (
                    <div className={styles.miembroList}>
                      {carpetasCompartidas.map((item) => (
                        <div key={item.carpeta_id} className={styles.miembroRow}>
                          <span style={{ fontSize: 18 }}>📁</span>
                          <div className={styles.miembroInfo}>
                            <span className={styles.miembroNombre}>{item.carpetaNombre}</span>
                            <span className={styles.miembroEmail}>de {item.ownerNombre}</span>
                          </div>
                          <select className={styles.nivelSelect} value={item.nivel}
                            onChange={(e) => handleChangeNivelCarpeta(item, e.target.value as "lectura" | "edicion")}>
                            <option value="lectura">👁 Lectura</option>
                            <option value="edicion">✏️ Edición</option>
                          </select>
                          <button className={styles.btnRemove} title="Descompartir" onClick={() => handleRemoveCarpeta(item)}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
            </div>
          </>
        )}

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
    const { data } = await supabase.from("Grupos").select("*").order("created_at", { ascending: false });
    setGrupos((data as Grupo[]) ?? []);
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      const { data: u } = await supabase.from("Usuario").select("rol").eq("user_id", session.user.id).single();
      if (!u || u.rol !== "admin") { router.push("/"); return; }
      setUserId(session.user.id);
      await loadGrupos();
      setLoading(false);
    }
    init();
  }, [router, loadGrupos]);

  async function handleCreate(nombre: string, descripcion: string) {
    if (!userId) return;
    const { error } = await supabase.from("Grupos").insert({ nombre, descripcion: descripcion || null, created_by: userId });
    if (!error) { await loadGrupos(); setShowModal(false); }
  }

  async function handleEdit(nombre: string, descripcion: string) {
    if (!editGrupo) return;
    const { error } = await supabase.from("Grupos").update({ nombre, descripcion: descripcion || null }).eq("grupo_id", editGrupo.grupo_id);
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
      <div className={adminStyles.header}>
        <div className={adminStyles.headerLeft}>
          <div className={adminStyles.headerIcon}>👥</div>
          <div>
            <h1 className={adminStyles.headerTitle}>Grupos de Usuarios</h1>
            <p className={adminStyles.headerSub}>{grupos.length} grupos creados</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className={adminStyles.btnBack} onClick={() => router.push("/admin")}>← Admin</button>
          <button className={styles.btnPrimary} onClick={() => setShowModal(true)}>+ Nuevo grupo</button>
        </div>
      </div>

      <div className={adminStyles.toolbar}>
        <input className={adminStyles.searchInput} value={search}
          onChange={(e) => setSearch(e.target.value)} placeholder="Buscar grupos…" />
        <span className={adminStyles.resultCount}>{filtered.length} grupo{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          {search ? `Sin resultados para "${search}"` : "Aún no hay grupos. Crea el primero con el botón de arriba."}
        </div>
      ) : (
        <div className={styles.gruposGrid}>
          {filtered.map((g) => (
            <div key={g.grupo_id} className={styles.grupoCard}>
              <div className={styles.grupoCardIcon}>👥</div>
              <div className={styles.grupoCardBody}>
                <div className={styles.grupoNombre}>{g.nombre}</div>
                {g.descripcion && <div className={styles.grupoDesc}>{g.descripcion}</div>}
                <div className={styles.grupoMeta}>Creado {fmtDate(g.created_at)}</div>
              </div>
              <div className={styles.grupoCardActions}>
                <button className={styles.btnAction} onClick={() => setSelectedGrupo(g)}>👤 Gestionar</button>
                <button className={styles.btnAction} onClick={() => setEditGrupo(g)}>✏️</button>
                <button className={styles.btnActionDanger} onClick={() => handleDelete(g)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && <ModalGrupo onClose={() => setShowModal(false)} onSave={handleCreate} />}
      {editGrupo && <ModalGrupo grupo={editGrupo} onClose={() => setEditGrupo(null)} onSave={handleEdit} />}
      {selectedGrupo && (
        <DetalleGrupo grupo={selectedGrupo} onClose={() => setSelectedGrupo(null)} onUpdated={loadGrupos} />
      )}
    </div>
  );
}