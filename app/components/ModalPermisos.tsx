"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Carpeta, Permiso, UsuarioBusqueda, Grupo, PermisoGrupo } from "../types";
import { getAllDescendantIds } from "../helpers";
import styles from "../page.module.css";

type Tab = "usuarios" | "grupos";

export function ModalPermisos({ carpeta, userId, onClose }: {
  carpeta: Carpeta;
  userId: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("usuarios");

  // Tab: Usuarios
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<UsuarioBusqueda[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nivelNuevo, setNivelNuevo] = useState<"lectura" | "edicion">("lectura");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Tab: Grupos
  const [permisosGrupo, setPermisosGrupo] = useState<PermisoGrupo[]>([]);
  const [queryGrupo, setQueryGrupo] = useState("");
  const [searchingGrupo, setSearchingGrupo] = useState(false);
  const [resultadosGrupo, setResultadosGrupo] = useState<Grupo[]>([]);
  const [nivelNuevoGrupo, setNivelNuevoGrupo] = useState<"lectura" | "edicion">("lectura");
  const [msgGrupo, setMsgGrupo] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function getDescendantIds(rootId: string): Promise<string[]> {
    const { data } = await supabase.from("Carpetas").select("carpeta_id, id_padre, user_id");
    return getAllDescendantIds(rootId, (data ?? []) as Carpeta[]);
  }

  const loadPermisos = useCallback(async () => {
    const { data } = await supabase
      .from("Permisos")
      .select("*, Usuario!Permisos_user_id_fkey(nombre, email)")
      .eq("carpeta_id", carpeta.carpeta_id)
      .neq("user_id", userId);
    setPermisos((data as Permiso[]) ?? []);
  }, [carpeta.carpeta_id, userId]);

  const loadPermisosGrupo = useCallback(async () => {
    const { data } = await supabase
      .from("PermisosGrupo")
      .select("*, Grupo!PermisosGrupo_grupo_id_fkey(nombre)")
      .eq("carpeta_id", carpeta.carpeta_id)
      .eq("owner_id", userId);
    setPermisosGrupo((data as PermisoGrupo[]) ?? []);
  }, [carpeta.carpeta_id, userId]);

  useEffect(() => { loadPermisos(); }, [loadPermisos]);
  useEffect(() => { loadPermisosGrupo(); }, [loadPermisosGrupo]);

  // Búsqueda usuario
  useEffect(() => {
    if (query.trim().length < 2) { setResultados([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("Usuario")
        .select("user_id, nombre, email")
        .neq("user_id", userId)
        .or(`nombre.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(6);
      setResultados((data as UsuarioBusqueda[]) ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, userId]);

  // Búsqueda grupo
  useEffect(() => {
    if (queryGrupo.trim().length < 1) { setResultadosGrupo([]); return; }
    const timer = setTimeout(async () => {
      setSearchingGrupo(true);
      const yaIds = permisosGrupo.map((pg) => pg.grupo_id);
      let q = supabase.from("Grupos").select("*").ilike("nombre", `%${queryGrupo}%`).limit(6);
      if (yaIds.length > 0) q = q.not("grupo_id", "in", `(${yaIds.join(",")})`);
      const { data } = await q;
      setResultadosGrupo((data as Grupo[]) ?? []);
      setSearchingGrupo(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [queryGrupo, permisosGrupo]);

  // Acciones usuario
  async function handleAdd(usuario: UsuarioBusqueda) {
    setSaving(true); setMsg(null);
    const ids = await getDescendantIds(carpeta.carpeta_id);
    const rows = ids.map((cid) => ({ carpeta_id: cid, owner_id: userId, user_id: usuario.user_id, nivel: nivelNuevo }));
    const { error } = await supabase.from("Permisos").upsert(rows, { onConflict: "carpeta_id,user_id" });
    if (error) setMsg({ type: "err", text: error.message });
    else { setMsg({ type: "ok", text: `Acceso concedido a ${usuario.nombre}` }); setQuery(""); setResultados([]); }
    await loadPermisos(); setSaving(false);
  }

  async function handleChangeNivel(permiso: Permiso, nivel: "lectura" | "edicion") {
    const ids = await getDescendantIds(carpeta.carpeta_id);
    await supabase.from("Permisos").update({ nivel }).eq("user_id", permiso.user_id).in("carpeta_id", ids);
    await loadPermisos();
  }

  async function handleRevoke(permiso: Permiso) {
    const ids = await getDescendantIds(carpeta.carpeta_id);
    await supabase.from("Permisos").delete().eq("user_id", permiso.user_id).in("carpeta_id", ids);
    await loadPermisos();
  }

  // Acciones grupo
  async function handleAddGrupo(grupo: Grupo) {
    setMsgGrupo(null);
    const ids = await getDescendantIds(carpeta.carpeta_id);
    const rows = ids.map((cid) => ({ carpeta_id: cid, grupo_id: grupo.grupo_id, owner_id: userId, nivel: nivelNuevoGrupo }));
    const { error } = await supabase.from("PermisosGrupo").upsert(rows, { onConflict: "carpeta_id,grupo_id" });
    if (error) { setMsgGrupo({ type: "err", text: error.message }); return; }

    // Propagar permisos individuales a miembros
    const { data: miembros } = await supabase.from("GrupoMiembros").select("user_id").eq("grupo_id", grupo.grupo_id);
    if (miembros && miembros.length > 0) {
      const permisoRows = ids.flatMap((cid) =>
        (miembros as { user_id: string }[]).map((m) => ({ carpeta_id: cid, owner_id: userId, user_id: m.user_id, nivel: nivelNuevoGrupo }))
      );
      await supabase.from("Permisos").upsert(permisoRows, { onConflict: "carpeta_id,user_id" });
    }

    setMsgGrupo({ type: "ok", text: `Grupo "${grupo.nombre}" con acceso concedido` });
    setQueryGrupo(""); setResultadosGrupo([]);
    await loadPermisosGrupo(); await loadPermisos();
  }

  async function handleChangeNivelGrupo(pg: PermisoGrupo, nivel: "lectura" | "edicion") {
    const ids = await getDescendantIds(carpeta.carpeta_id);
    await supabase.from("PermisosGrupo").update({ nivel }).eq("grupo_id", pg.grupo_id).in("carpeta_id", ids);
    const { data: miembros } = await supabase.from("GrupoMiembros").select("user_id").eq("grupo_id", pg.grupo_id);
    if (miembros && miembros.length > 0) {
      const userIds = (miembros as { user_id: string }[]).map((m) => m.user_id);
      await supabase.from("Permisos").update({ nivel }).in("user_id", userIds).in("carpeta_id", ids).eq("owner_id", userId);
    }
    await loadPermisosGrupo(); await loadPermisos();
  }

  async function handleRevokeGrupo(pg: PermisoGrupo) {
    const ids = await getDescendantIds(carpeta.carpeta_id);
    await supabase.from("PermisosGrupo").delete().eq("grupo_id", pg.grupo_id).in("carpeta_id", ids);
    const { data: miembros } = await supabase.from("GrupoMiembros").select("user_id").eq("grupo_id", pg.grupo_id);
    if (miembros && miembros.length > 0) {
      const userIds = (miembros as { user_id: string }[]).map((m) => m.user_id);
      await supabase.from("Permisos").delete().in("user_id", userIds).in("carpeta_id", ids).eq("owner_id", userId);
    }
    await loadPermisosGrupo(); await loadPermisos();
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ width: 500 }}>
        <div className={styles.modalTitle}>🔐 Permisos — {carpeta.nombre}</div>
        <p className={styles.permisosDesc}>El acceso se aplica a esta carpeta y todas sus subcarpetas.</p>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 16, borderBottom: "1px solid var(--border)" }}>
          {(["usuarios", "grupos"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: "none", border: "none",
              borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
              color: tab === t ? "var(--accent)" : "var(--text-dim)",
              fontSize: 13, fontFamily: "var(--font-body)", fontWeight: 500,
              padding: "6px 16px", cursor: "pointer", marginBottom: -1,
            }}>
              {t === "usuarios" ? "👤 Usuarios" : "👥 Grupos"}
            </button>
          ))}
        </div>

        {/* Tab Usuarios */}
        {tab === "usuarios" && (
          <>
            <div className={styles.modalLabel}>Añadir usuario por nombre o correo</div>
            <div className={styles.searchRow}>
              <input className={styles.modalInput} value={query}
                onChange={(e) => setQuery(e.target.value)} placeholder="Buscar usuario…" />
              <select className={styles.modalSelect} style={{ width: 130, flexShrink: 0 }}
                value={nivelNuevo} onChange={(e) => setNivelNuevo(e.target.value as "lectura" | "edicion")}>
                <option value="lectura">👁 Lectura</option>
                <option value="edicion">✏️ Edición</option>
              </select>
            </div>
            {searching && <div className={styles.searchHint}>Buscando…</div>}
            {resultados.length > 0 && (
              <div className={styles.searchResults}>
                {resultados.map((u) => (
                  <div key={u.user_id} className={styles.searchResult}>
                    <div className={styles.searchResultInfo}>
                      <span className={styles.searchResultName}>{u.nombre}</span>
                      <span className={styles.searchResultEmail}>{u.email}</span>
                    </div>
                    <button className={styles.btnPrimary} style={{ padding: "4px 10px", fontSize: 12 }}
                      disabled={saving} onClick={() => handleAdd(u)}>Dar acceso</button>
                  </div>
                ))}
              </div>
            )}
            {query.length >= 2 && !searching && resultados.length === 0 && <div className={styles.searchHint}>Sin resultados</div>}
            {msg && <div className={`${styles.permisosMsg} ${msg.type === "ok" ? styles.permisosMsgOk : styles.permisosMsgErr}`}>{msg.text}</div>}
            {permisos.length > 0 ? (
              <>
                <div className={styles.modalLabel} style={{ marginTop: 12 }}>Accesos activos</div>
                <div className={styles.permisosList}>
                  {permisos.map((p) => (
                    <div key={p.permiso_id} className={styles.permisosRow}>
                      <div className={styles.permisosUserInfo}>
                        <span className={styles.permisosNombre}>{p.Usuario?.nombre ?? "—"}</span>
                        <span className={styles.permisosEmail}>{p.Usuario?.email ?? ""}</span>
                      </div>
                      <select className={styles.nivelSelect} value={p.nivel}
                        onChange={(e) => handleChangeNivel(p, e.target.value as "lectura" | "edicion")}>
                        <option value="lectura">👁 Lectura</option>
                        <option value="edicion">✏️ Edición</option>
                      </select>
                      <button className={styles.btnIcon} title="Revocar acceso" onClick={() => handleRevoke(p)}>×</button>
                    </div>
                  ))}
                </div>
              </>
            ) : <div className={styles.searchHint}>Nadie más tiene acceso a esta carpeta.</div>}
          </>
        )}

        {/* Tab Grupos */}
        {tab === "grupos" && (
          <>
            <div className={styles.modalLabel}>Compartir con un grupo</div>
            <div className={styles.searchRow}>
              <input className={styles.modalInput} value={queryGrupo}
                onChange={(e) => setQueryGrupo(e.target.value)} placeholder="Buscar grupo…" />
              <select className={styles.modalSelect} style={{ width: 130, flexShrink: 0 }}
                value={nivelNuevoGrupo} onChange={(e) => setNivelNuevoGrupo(e.target.value as "lectura" | "edicion")}>
                <option value="lectura">👁 Lectura</option>
                <option value="edicion">✏️ Edición</option>
              </select>
            </div>
            {searchingGrupo && <div className={styles.searchHint}>Buscando…</div>}
            {resultadosGrupo.length > 0 && (
              <div className={styles.searchResults}>
                {resultadosGrupo.map((g) => (
                  <div key={g.grupo_id} className={styles.searchResult}>
                    <div className={styles.searchResultInfo}>
                      <span className={styles.searchResultName}>👥 {g.nombre}</span>
                      {g.descripcion && <span className={styles.searchResultEmail}>{g.descripcion}</span>}
                    </div>
                    <button className={styles.btnPrimary} style={{ padding: "4px 10px", fontSize: 12 }}
                      onClick={() => handleAddGrupo(g)}>Compartir</button>
                  </div>
                ))}
              </div>
            )}
            {queryGrupo.length >= 1 && !searchingGrupo && resultadosGrupo.length === 0 && <div className={styles.searchHint}>Sin grupos encontrados</div>}
            {msgGrupo && <div className={`${styles.permisosMsg} ${msgGrupo.type === "ok" ? styles.permisosMsgOk : styles.permisosMsgErr}`}>{msgGrupo.text}</div>}
            {permisosGrupo.length > 0 ? (
              <>
                <div className={styles.modalLabel} style={{ marginTop: 12 }}>Grupos con acceso</div>
                <div className={styles.permisosList}>
                  {permisosGrupo.map((pg) => (
                    <div key={pg.permiso_grupo_id} className={styles.permisosRow}>
                      <div className={styles.permisosUserInfo}>
                        <span className={styles.permisosNombre}>👥 {pg.Grupo?.nombre ?? "—"}</span>
                        <span className={styles.permisosEmail} style={{ fontSize: 11 }}>Todos los miembros del grupo</span>
                      </div>
                      <select className={styles.nivelSelect} value={pg.nivel}
                        onChange={(e) => handleChangeNivelGrupo(pg, e.target.value as "lectura" | "edicion")}>
                        <option value="lectura">👁 Lectura</option>
                        <option value="edicion">✏️ Edición</option>
                      </select>
                      <button className={styles.btnIcon} title="Revocar acceso del grupo" onClick={() => handleRevokeGrupo(pg)}>×</button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className={styles.searchHint}>
                Ningún grupo tiene acceso a esta carpeta.{queryGrupo.length === 0 && " Escribe para buscar grupos."}
              </div>
            )}
          </>
        )}

        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
