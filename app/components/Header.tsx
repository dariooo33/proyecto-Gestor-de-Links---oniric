"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import styles from "./Header.module.css";

interface UsuarioSession {
  email: string;
  rol: string;
}

export default function Header() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<undefined | null | UsuarioSession>(undefined);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    async function loadUsuario(id: string, email: string) {
      const { data } = await supabase.from("Usuario").select("rol").eq("user_id", id).single();
      setUsuario({ email, rol: data?.rol ?? "user" });
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadUsuario(session.user.id, session.user.email!);
      else setUsuario(null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) loadUsuario(session.user.id, session.user.email!);
      else setUsuario(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        {/* ── Fila principal ── */}
        <div className={styles.navRow}>
          <div className={styles.izquierda}>
            <div className={styles.logo}>
              <a href="/"><img src="/logo.png" alt="logo" /></a>
            </div>
          </div>

          {/* Botón de búsqueda — centro desktop */}
          <div className={`${styles.centro} ${styles.centroDesktop}`}>
            <a href="/buscar" className={styles.searchBtn}>
              <span className={styles.searchBtnIcon}>🔍</span>
              <span className={styles.searchBtnText}>Buscar carpetas, recursos, categorías…</span>
              <span className={styles.searchBtnKbd}>⌘K</span>
            </a>
          </div>

          {/* Links derecha — desktop */}
          <div className={`${styles.derecha} ${styles.derechaDesktop}`}>
            <li><a href="/">MENU</a></li>
            <li><a href="/categorias">CATEGORÍAS</a></li>
            <li><a href="/etiquetas">ETIQUETAS</a></li>
            {usuario === undefined ? (
              <li className={styles.cargando}>...</li>
            ) : usuario ? (
              <>
                {usuario.rol === "admin" && (
                  <li><a href="/admin" className={styles.btnAdmin}>⚙️ Admin</a></li>
                )}
                <li className={styles.email}>{usuario.email}</li>
                <li>
                  <button onClick={cerrarSesion} className={styles.btnCerrar}>Cerrar sesión</button>
                </li>
              </>
            ) : (
              <>
                <li><a href="/register">Registro</a></li>
                <li><a href="/login">Login</a></li>
              </>
            )}
          </div>

          {/* Hamburguesa — solo móvil */}
          <button
            className={styles.hamburger}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menú"
          >
            <span className={menuOpen ? styles.hambLineTop + " " + styles.hambOpen : styles.hambLineTop}></span>
            <span className={menuOpen ? styles.hambLineMid + " " + styles.hambOpen : styles.hambLineMid}></span>
            <span className={menuOpen ? styles.hambLineBot + " " + styles.hambOpen : styles.hambLineBot}></span>
          </button>
        </div>

        {/* ── Botón de búsqueda móvil ── */}
        <div className={styles.centroMobile}>
          <a href="/buscar" className={styles.searchBtn}>
            <span className={styles.searchBtnIcon}>🔍</span>
            <span className={styles.searchBtnText}>Buscar…</span>
          </a>
        </div>

        {/* ── Menú móvil desplegable ── */}
        {menuOpen && (
          <div className={styles.mobileMenu}>
            <a href="/" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>MENU</a>
            <a href="/buscar" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>🔍 Buscar</a>
            <a href="/categorias" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>🏷️ Categorías</a>
            <a href="/etiquetas" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>🔖 Etiquetas</a>
            {usuario === undefined ? null : usuario ? (
              <>
                {usuario.rol === "admin" && (
                  <a href="/admin" className={`${styles.mobileLink} ${styles.btnAdmin}`} onClick={() => setMenuOpen(false)}>⚙️ Admin</a>
                )}
                <span className={styles.mobileEmail}>{usuario.email}</span>
                <button onClick={() => { cerrarSesion(); setMenuOpen(false); }} className={`${styles.mobileLink} ${styles.btnCerrar}`}>
                  Cerrar sesión
                </button>
              </>
            ) : (
              <>
                <a href="/register" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Registro</a>
                <a href="/login" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Login</a>
              </>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}
