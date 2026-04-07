"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import styles from "./page.module.css";

interface Usuario {
  user_id: string;
  nombre: string;
  email: string;
  rol: string;
  created_at: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default function AdminPage() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function init() {
      // 1. Verificar sesión
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }

      // 2. Verificar rol admin
      const { data: usuario } = await supabase
        .from("Usuario")
        .select("rol")
        .eq("user_id", session.user.id)
        .single();

      if (!usuario || usuario.rol !== "admin") {
        router.push("/");
        return;
      }

      // 3. Cargar todos los usuarios
      const { data } = await supabase
        .from("Usuario")
        .select("*")
        .order("created_at", { ascending: false });

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
        <div className={styles.loadingDots}>
          <span /><span /><span />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>⚙️</div>
          <div>
            <h1 className={styles.headerTitle}>Panel de Administración</h1>
            <p className={styles.headerSub}>{usuarios.length} usuarios registrados</p>
          </div>
        </div>
        <button className={styles.btnBack} onClick={() => router.push("/")}>
          ← Volver
        </button>
      </div>

      {/* Search */}
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

      {/* Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Correo</th>
              <th>Rol</th>
              <th>Registrado</th>
              <th>ID</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.user_id}>
                <td>
                  <div className={styles.userCell}>
                    <div className={styles.avatar}>
                      {u.nombre.charAt(0).toUpperCase()}
                    </div>
                    <span className={styles.userName}>{u.nombre}</span>
                  </div>
                </td>
                <td className={styles.emailCell}>{u.email}</td>
                <td>
                  <span className={styles.rolBadge} data-rol={u.rol}>
                    {u.rol}
                  </span>
                </td>
                <td className={styles.dateCell}>{fmtDate(u.created_at)}</td>
                <td className={styles.idCell}>{u.user_id.slice(0, 8)}…</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className={styles.emptyRow}>
                  Sin resultados para "{search}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}