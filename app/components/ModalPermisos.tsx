"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Carpeta, Permiso, UsuarioBusqueda } from "../types";
import { getAllDescendantIds } from "../helpers";
import styles from "../page.module.css";

export function ModalPermisos({ carpeta, userId, onClose }: {
  carpeta: Carpeta;
  userId: string;
  onClose: () => void;
}) {
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<UsuarioBusqueda[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nivelNuevo, setNivelNuevo] = useState<"lectura" | "edicion">("lectura");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const loadPermisos = useCallback(async () => {
    const { data } = await supabase
      .from("Permisos")
      .select("*, Usuario!Permisos_user_id_fkey(nombre, email)")
      .eq("carpeta_id", carpeta.carpeta_id)
      .neq("user_id", userId);
    setPermisos((data as Permiso[]) ?? []);
  }, [carpeta.carpeta_id, userId]);

  useEffect(() => { loadPermisos(); }, [loadPermisos]);

  // Búsqueda con debounce
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

  async function getDescendantIds(rootId: string): Promise<string[]> {
    const { data } = await supabase
      .from("Carpetas")
      .select("carpeta_id, id_padre, user_id");
    return getAllDescendantIds(rootId, (data ?? []) as Carpeta[]);
  }

  async function handleAdd(usuario: UsuarioBusqueda) {
    setSaving(true);
    setMsg(null);
    const ids = await getDescendantIds(carpeta.carpeta_id);
    const rows = ids.map((cid) => ({
      carpeta_id: cid, owner_id: userId, user_id: usuario.user_id, nivel: nivelNuevo,
    }));
    const { error } = await supabase.from("Permisos").upsert(rows, { onConflict: "carpeta_id,user_id" });
    if (error) setMsg({ type: "err", text: error.message });
    else { setMsg({ type: "ok", text: `Acceso concedido a ${usuario.nombre}` }); setQuery(""); setResultados([]); }
    await loadPermisos();
    setSaving(false);
  }

  async function handleChangeNivel(permiso: Permiso, nivel: "lectura" | "edicion") {
    const ids = await getDescendantIds(carpeta.carpeta_id);
    await supabase.from("Permisos")
      .update({ nivel })
      .eq("user_id", permiso.user_id)
      .in("carpeta_id", ids);
    await loadPermisos();
  }

  async function handleRevoke(permiso: Permiso) {
    const ids = await getDescendantIds(carpeta.carpeta_id);
    await supabase.from("Permisos").delete().eq("user_id", permiso.user_id).in("carpeta_id", ids);
    await loadPermisos();
  }

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ width: 480 }}>
        <div className={styles.modalTitle}>🔐 Permisos — {carpeta.nombre}</div>
        <p className={styles.permisosDesc}>El acceso se aplica a esta carpeta y todas sus subcarpetas.</p>

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
                  disabled={saving} onClick={() => handleAdd(u)}>
                  Dar acceso
                </button>
              </div>
            ))}
          </div>
        )}
        {query.length >= 2 && !searching && resultados.length === 0 && (
          <div className={styles.searchHint}>Sin resultados</div>
        )}

        {msg && (
          <div className={`${styles.permisosMsg} ${msg.type === "ok" ? styles.permisosMsgOk : styles.permisosMsgErr}`}>
            {msg.text}
          </div>
        )}

        {permisos.length > 0 && (
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
        )}
        {permisos.length === 0 && (
          <div className={styles.searchHint}>Nadie más tiene acceso a esta carpeta.</div>
        )}

        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}
