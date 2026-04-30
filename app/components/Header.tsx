"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import styles from "./Header.module.css";

interface UsuarioSession {
  email: string;
  rol: string;
}

interface ResultadoBusqueda {
  tipo: "carpeta" | "recurso" | "categoria" | "usuario";
  id: string;
  titulo: string;
  subtitulo?: string;
}

// Tipos para resultados de Supabase
interface PermisoCarpetaId { carpeta_id: string; }
interface CarpetaBusqueda { carpeta_id: string; nombre: string; user_id: string; publica: boolean; }
interface RecursoBusqueda { recurso_id: string; nombre: string; carpeta_id: string; }
interface CategoriaBusqueda { categoria_id: string; nombre: string; descripcion: string; }
interface UsuarioBusqueda { user_id: string; nombre: string; email: string; }

const ICONO_TIPO: Record<string, string> = {
  carpeta: "📁", recurso: "📄", categoria: "🏷️", usuario: "👤",
};

export default function Header() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<undefined | null | UsuarioSession>(undefined);
  const [userId, setUserId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadUsuario(id: string, email: string) {
      const { data } = await supabase.from("Usuario").select("rol").eq("user_id", id).single();
      setUsuario({ email, rol: data?.rol ?? "user" });
      setUserId(id);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadUsuario(session.user.id, session.user.email!);
      else setUsuario(null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) loadUsuario(session.user.id, session.user.email!);
      else { setUsuario(null); setUserId(null); }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const buscar = useCallback(async (q: string) => {
    if (!q.trim() || !userId) { setResultados([]); return; }
    setSearching(true);

    const term = q.trim();
    const encontrados: ResultadoBusqueda[] = [];

    const { data: permisosData } = await supabase
      .from("Permisos")
      .select("carpeta_id")
      .eq("user_id", userId);
    const sharedIds = (permisosData ?? []).map((p: PermisoCarpetaId) => p.carpeta_id);

    let carpetasFilter = `user_id.eq.${userId},publica.eq.true`;
    if (sharedIds.length > 0) carpetasFilter += `,carpeta_id.in.(${sharedIds.join(",")})`;

    const [
      { data: carpetas },
      { data: recursos },
      { data: categorias },
      { data: usuarios },
    ] = await Promise.all([
      supabase.from("Carpetas")
        .select("carpeta_id, nombre, user_id, publica")
        .ilike("nombre", `%${term}%`)
        .or(carpetasFilter)
        .limit(5),
      supabase.from("Recursos")
        .select("recurso_id, nombre, carpeta_id")
        .eq("user_id", userId)
        .ilike("nombre", `%${term}%`)
        .limit(5),
      supabase.from("Categorias")
        .select("categoria_id, nombre, descripcion")
        .ilike("nombre", `%${term}%`)
        .limit(4),
      supabase.from("Usuario")
        .select("user_id, nombre, email")
        .neq("user_id", userId)
        .or(`nombre.ilike.%${term}%,email.ilike.%${term}%`)
        .limit(3),
    ]);

    (carpetas ?? []).forEach((c: CarpetaBusqueda) => {
      encontrados.push({
        tipo: "carpeta",
        id: c.carpeta_id,
        titulo: c.nombre,
        subtitulo: c.user_id === userId
          ? "Tu carpeta"
          : sharedIds.includes(c.carpeta_id)
            ? "Compartida contigo"
            : "Carpeta pública",
      });
    });

    (recursos ?? []).forEach((r: RecursoBusqueda) => {
      encontrados.push({ tipo: "recurso", id: r.recurso_id, titulo: r.nombre, subtitulo: "Recurso" });
    });

    (categorias ?? []).forEach((c: CategoriaBusqueda) => {
      encontrados.push({ tipo: "categoria", id: c.categoria_id, titulo: c.nombre, subtitulo: c.descripcion || "Categoría" });
    });

    (usuarios ?? []).forEach((u: UsuarioBusqueda) => {
      encontrados.push({ tipo: "usuario", id: u.user_id, titulo: u.nombre, subtitulo: u.email });
    });

    setResultados(encontrados);
    setSearching(false);
    setShowResults(true);
  }, [userId]);

  useEffect(() => {
    if (!query.trim()) { setResultados([]); setShowResults(false); return; }
    const timer = setTimeout(() => buscar(query), 300);
    return () => clearTimeout(timer);
  }, [query, buscar]);

  function handleClick(r: ResultadoBusqueda) {
    setShowResults(false);
    setQuery("");
    if (r.tipo === "usuario") router.push(`/usuario/${r.id}`);
    else router.push(`/?highlight=${r.id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && query.trim()) {
      setShowResults(false);
      router.push(`/buscar?q=${encodeURIComponent(query.trim())}`);
    }
  }

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

          {/* Buscador — oculto en móvil, visible en la fila inferior */}
          <div className={`${styles.centro} ${styles.centroDesktop}`} ref={searchRef}>
            <div className={styles.searchWrapper}>
              <input
                type="text"
                placeholder="Buscar carpetas, recursos, categorías, usuarios…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => resultados.length > 0 && setShowResults(true)}
                onKeyDown={handleKeyDown}
                className={styles.searchInput}
              />
              {searching && <span className={styles.searchSpinner}>⟳</span>}
              {showResults && resultados.length > 0 && (
                <div className={styles.searchDropdown}>
                  {resultados.map((r) => (
                    <div key={`${r.tipo}-${r.id}`} className={styles.searchResult}
                      onClick={() => handleClick(r)}>
                      <span className={styles.searchResultIcon}>{ICONO_TIPO[r.tipo]}</span>
                      <div className={styles.searchResultInfo}>
                        <span className={styles.searchResultTitulo}>{r.titulo}</span>
                        {r.subtitulo && <span className={styles.searchResultSub}>{r.subtitulo}</span>}
                      </div>
                      <span className={styles.searchResultTipo}>{r.tipo}</span>
                    </div>
                  ))}
                  <div className={styles.searchResult} style={{ justifyContent: "center", opacity: .6 }}
                    onClick={() => { setShowResults(false); router.push(`/buscar?q=${encodeURIComponent(query)}`); }}>
                    <span style={{ fontSize: 12 }}>Ver todos los resultados →</span>
                  </div>
                </div>
              )}
              {showResults && !searching && query.length >= 2 && resultados.length === 0 && (
                <div className={styles.searchDropdown}>
                  <div className={styles.searchEmpty}>Sin resultados para &quot;{query}&quot;</div>
                </div>
              )}
            </div>
          </div>

          {/* Links derecha — desktop */}
          <div className={`${styles.derecha} ${styles.derechaDesktop}`}>
            <li><a href="/">MENU</a></li>
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

        {/* ── Buscador móvil (siempre visible bajo el nav en móvil) ── */}
        <div className={styles.centroMobile} ref={searchRef}>
          <div className={styles.searchWrapper}>
            <input
              type="text"
              placeholder="Buscar…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => resultados.length > 0 && setShowResults(true)}
              onKeyDown={handleKeyDown}
              className={styles.searchInput}
            />
            {searching && <span className={styles.searchSpinner}>⟳</span>}
            {showResults && resultados.length > 0 && (
              <div className={styles.searchDropdown}>
                {resultados.map((r) => (
                  <div key={`${r.tipo}-${r.id}`} className={styles.searchResult}
                    onClick={() => handleClick(r)}>
                    <span className={styles.searchResultIcon}>{ICONO_TIPO[r.tipo]}</span>
                    <div className={styles.searchResultInfo}>
                      <span className={styles.searchResultTitulo}>{r.titulo}</span>
                      {r.subtitulo && <span className={styles.searchResultSub}>{r.subtitulo}</span>}
                    </div>
                    <span className={styles.searchResultTipo}>{r.tipo}</span>
                  </div>
                ))}
                <div className={styles.searchResult} style={{ justifyContent: "center", opacity: .6 }}
                  onClick={() => { setShowResults(false); router.push(`/buscar?q=${encodeURIComponent(query)}`); }}>
                  <span style={{ fontSize: 12 }}>Ver todos los resultados →</span>
                </div>
              </div>
            )}
            {showResults && !searching && query.length >= 2 && resultados.length === 0 && (
              <div className={styles.searchDropdown}>
                <div className={styles.searchEmpty}>Sin resultados para &quot;{query}&quot;</div>
              </div>
            )}
          </div>
        </div>

        {/* ── Menú móvil desplegable ── */}
        {menuOpen && (
          <div className={styles.mobileMenu}>
            <a href="/" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>MENU</a>
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
