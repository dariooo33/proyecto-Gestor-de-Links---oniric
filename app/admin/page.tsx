"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import styles from "./page.module.css";

// ─── Types ─────────────────────────────────────────────────────────────────

interface Usuario {
  user_id: string;
  nombre: string;
  email: string;
  rol: string;
  created_at: string;
}

interface Carpeta {
  carpeta_id: string;
  nombre: string;
  id_padre: string | null;
  created_at: string;
}

interface PermisoCompartido {
  carpeta_id: string;
  nivel: string;
  carpeta_nombre: string;
  contraparte_nombre: string;
  contraparte_email: string;
}

interface DetalleUsuario {
  carpetasPropias: Carpeta[];
  compartidasPorEl: PermisoCompartido[];   // carpetas suyas que ha compartido con otros
  compartidasConEl: PermisoCompartido[];   // carpetas de otros que le han compartido
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function Avatar({ nombre, size = 32 }: { nombre: string; size?: number }) {
  return (
    <div className={styles.avatar} style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {nombre.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── User Detail Panel ─────────────────────────────────────────────────────

function DetallePanel({ usuario, onClose }: { usuario: Usuario; onClose: () => void }) {
  const [detalle, setDetalle] = useState<DetalleUsuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"carpetas" | "compartidas" | "recibidas">("carpetas");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDeleteCarpeta(carpetaId: string, nombre: string) {
    if (!confirm(`¿Eliminar la carpeta "${nombre}" y todo su contenido? Esta acción no se puede deshacer.`)) return;
    setDeletingId(carpetaId);
    const { error } = await supabase.from("Carpetas").delete().eq("carpeta_id", carpetaId);
    if (error) { alert("Error al eliminar: " + error.message); setDeletingId(null); return; }

    // Eliminar del estado local la carpeta y todos sus descendientes
    setDetalle((prev) => {
      if (!prev) return prev;
      const toRemove = new Set<string>();
      function collectIds(id: string) {
        toRemove.add(id);
        prev!.carpetasPropias
          .filter((c) => c.id_padre === id)
          .forEach((c) => collectIds(c.carpeta_id));
      }
      collectIds(carpetaId);
      return {
        ...prev,
        carpetasPropias: prev.carpetasPropias.filter((c) => !toRemove.has(c.carpeta_id)),
      };
    });
    setDeletingId(null);
  }

  useEffect(() => {
    async function load() {
      setLoading(true);

      // 1. Carpetas propias
      const { data: propias } = await supabase
        .from("Carpetas")
        .select("carpeta_id, nombre, id_padre, created_at")
        .eq("user_id", usuario.user_id)
        .order("created_at", { ascending: false });

      // 2. Permisos que ÉL ha dado a otros (owner_id = él)
      const { data: dadosRaw } = await supabase
        .from("Permisos")
        .select("carpeta_id, nivel, Usuario!Permisos_user_id_fkey(nombre, email)")
        .eq("owner_id", usuario.user_id);

      // 3. Permisos que le han dado A ÉL (user_id = él)
      const { data: recibidosRaw } = await supabase
        .from("Permisos")
        .select("carpeta_id, nivel, Usuario!Permisos_owner_id_fkey(nombre, email)")
        .eq("user_id", usuario.user_id);

      // 4. Obtener nombres de carpetas por separado
      const todasCarpetaIds = [
        ...(dadosRaw ?? []).map((p: any) => p.carpeta_id),
        ...(recibidosRaw ?? []).map((p: any) => p.carpeta_id),
      ];

      const carpetaNombres: Record<string, string> = {};
      if (todasCarpetaIds.length > 0) {
        const { data: carpetasData } = await supabase
          .from("Carpetas")
          .select("carpeta_id, nombre")
          .in("carpeta_id", todasCarpetaIds);
        (carpetasData ?? []).forEach((c: any) => {
          carpetaNombres[c.carpeta_id] = c.nombre;
        });
      }

      const compartidasPorEl: PermisoCompartido[] = (dadosRaw ?? []).map((p: any) => ({
        carpeta_id: p.carpeta_id,
        nivel: p.nivel,
        carpeta_nombre: carpetaNombres[p.carpeta_id] ?? "—",
        contraparte_nombre: p.Usuario?.nombre ?? "—",
        contraparte_email: p.Usuario?.email ?? "—",
      }));

      const compartidasConEl: PermisoCompartido[] = (recibidosRaw ?? []).map((p: any) => ({
        carpeta_id: p.carpeta_id,
        nivel: p.nivel,
        carpeta_nombre: carpetaNombres[p.carpeta_id] ?? "—",
        contraparte_nombre: p.Usuario?.nombre ?? "—",
        contraparte_email: p.Usuario?.email ?? "—",
      }));

      setDetalle({
        carpetasPropias: (propias ?? []) as Carpeta[],
        compartidasPorEl,
        compartidasConEl,
      });
      setLoading(false);
    }
    load();
  }, [usuario.user_id]);

  return (
    <div className={styles.detailOverlay} onClick={onClose}>
      <div className={styles.detailPanel} onClick={(e) => e.stopPropagation()}>

        {/* Header del panel */}
        <div className={styles.detailHeader}>
          <div className={styles.detailHeaderLeft}>
            <Avatar nombre={usuario.nombre} size={44} />
            <div>
              <div className={styles.detailNombre}>{usuario.nombre}</div>
              <div className={styles.detailEmail}>{usuario.email}</div>
              <div className={styles.detailMeta}>
                <span className={styles.rolBadge} data-rol={usuario.rol}>{usuario.rol}</span>
                <span className={styles.detailFecha}>Registrado {fmtDate(usuario.created_at)}</span>
              </div>
            </div>
          </div>
          <button className={styles.detailClose} onClick={onClose}>×</button>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === "carpetas" ? styles.tabActive : ""}`}
            onClick={() => setTab("carpetas")}
          >
            📁 Carpetas propias
            {detalle && <span className={styles.tabCount}>{detalle.carpetasPropias.length}</span>}
          </button>
          <button
            className={`${styles.tab} ${tab === "compartidas" ? styles.tabActive : ""}`}
            onClick={() => setTab("compartidas")}
          >
            ↗ Ha compartido
            {detalle && <span className={styles.tabCount}>{detalle.compartidasPorEl.length}</span>}
          </button>
          <button
            className={`${styles.tab} ${tab === "recibidas" ? styles.tabActive : ""}`}
            onClick={() => setTab("recibidas")}
          >
            ↙ Compartidas con él
            {detalle && <span className={styles.tabCount}>{detalle.compartidasConEl.length}</span>}
          </button>
        </div>

        {/* Contenido */}
        <div className={styles.detailContent}>
          {loading ? (
            <div className={styles.detailLoading}>
              <div className={styles.loadingDots}><span /><span /><span /></div>
            </div>
          ) : tab === "carpetas" ? (
            detalle!.carpetasPropias.length === 0 ? (
              <div className={styles.detailEmpty}>Este usuario no tiene carpetas.</div>
            ) : (
              <div className={styles.carpetaList}>
                {detalle!.carpetasPropias.map((c) => (
                  <div key={c.carpeta_id} className={styles.carpetaRow}>
                    <span className={styles.carpetaIcon}>{c.id_padre ? "📂" : "📁"}</span>
                    <span className={styles.carpetaNombre}>{c.nombre}</span>
                    {c.id_padre && <span className={styles.subTag}>subcarpeta</span>}
                    <span className={styles.carpetaFecha}>{fmtDate(c.created_at)}</span>
                    <button
                      className={styles.btnDeleteCarpeta}
                      disabled={deletingId === c.carpeta_id}
                      onClick={() => handleDeleteCarpeta(c.carpeta_id, c.nombre)}
                      title="Eliminar carpeta"
                    >
                      {deletingId === c.carpeta_id ? "…" : "🗑"}
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : tab === "compartidas" ? (
            detalle!.compartidasPorEl.length === 0 ? (
              <div className={styles.detailEmpty}>No ha compartido ninguna carpeta.</div>
            ) : (
              <div className={styles.permisoList}>
                {detalle!.compartidasPorEl.map((p, i) => (
                  <div key={i} className={styles.permisoRow}>
                    <span className={styles.carpetaIcon}>📁</span>
                    <div className={styles.permisoInfo}>
                      <span className={styles.permisoNombreCarpeta}>{p.carpeta_nombre}</span>
                      <span className={styles.permisoContraparte}>
                        → {p.contraparte_nombre} <em>{p.contraparte_email}</em>
                      </span>
                    </div>
                    <span className={styles.nivelBadge} data-nivel={p.nivel}>
                      {p.nivel === "lectura" ? "👁 Lectura" : "✏️ Edición"}
                    </span>
                  </div>
                ))}
              </div>
            )
          ) : (
            detalle!.compartidasConEl.length === 0 ? (
              <div className={styles.detailEmpty}>Nadie le ha compartido carpetas.</div>
            ) : (
              <div className={styles.permisoList}>
                {detalle!.compartidasConEl.map((p, i) => (
                  <div key={i} className={styles.permisoRow}>
                    <span className={styles.carpetaIcon}>📁</span>
                    <div className={styles.permisoInfo}>
                      <span className={styles.permisoNombreCarpeta}>{p.carpeta_nombre}</span>
                      <span className={styles.permisoContraparte}>
                        ← {p.contraparte_nombre} <em>{p.contraparte_email}</em>
                      </span>
                    </div>
                    <span className={styles.nivelBadge} data-nivel={p.nivel}>
                      {p.nivel === "lectura" ? "👁 Lectura" : "✏️ Edición"}
                    </span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Usuario | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      const { data: u } = await supabase
        .from("Usuario").select("rol").eq("user_id", session.user.id).single();
      if (!u || u.rol !== "admin") { router.push("/"); return; }

      const { data } = await supabase
        .from("Usuario").select("*").order("created_at", { ascending: false });
      setUsuarios((data as Usuario[]) ?? []);
      setLoading(false);
    }
    init();
  }, [router]);

  const filtered = usuarios.filter((u) =>
    u.nombre.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.rol.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingDots}><span /><span /><span /></div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>⚙️</div>
          <div>
            <h1 className={styles.headerTitle}>Panel de Administración</h1>
            <p className={styles.headerSub}>{usuarios.length} usuarios registrados</p>
          </div>
        </div>
        <button className={styles.btnBack} onClick={() => router.push("/")}>← Volver</button>
      </div>

      <div className={styles.toolbar}>
        <input
          className={styles.searchInput}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, correo o rol…"
        />
        <span className={styles.resultCount}>
          {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Registrado</th>
              <th>ID</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.user_id} className={styles.tableRow}>
                <td>
                  <div className={styles.userCell}>
                    <Avatar nombre={u.nombre} />
                    <span className={styles.userName}>{u.nombre}</span>
                  </div>
                </td>
                <td className={styles.emailCell}>{u.email}</td>
                <td>
                  <span className={styles.rolBadge} data-rol={u.rol}>{u.rol}</span>
                </td>
                <td className={styles.dateCell}>{fmtDate(u.created_at)}</td>
                <td className={styles.idCell}>{u.user_id.slice(0, 8)}…</td>
                <td>
                  <button className={styles.btnDetalle} onClick={() => setSelected(u)}>
                    Ver detalle →
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className={styles.emptyRow}>
                  Sin resultados para "{search}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <DetallePanel usuario={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}