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

export default function Header() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<undefined | null | UsuarioSession>(undefined);
  const [userId, setUserId] = useState<string | null>(null);

  // Búsqueda global
  const [query, setQuery] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
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

  // Cerrar resultados al click fuera
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Búsqueda con debounce
  const buscar = useCallback(async (q: string) => {
    if (!q.trim() || !userId) { setResultados([]); return; }
    setSearching(true);

    const term = q.trim();
    const resultados: ResultadoBusqueda[] = [];

    // IDs de carpetas compartidas con el usuario
    const { data: permisosData } = await supabase
      .from("Permisos")
      .select("carpeta_id")
      .eq("user_id", userId);
    const sharedIds = (permisosData ?? []).map((p: any) => p.carpeta_id as string);

    // Carpetas propias + públicas + compartidas con el usuario
    let carpetasFilter = `user_id.eq.${userId},publica.eq.true`;
    if (sharedIds.length > 0) carpetasFilter += `,carpeta_id.in.(${sharedIds.join(",")})`;

    const { data: carpetas } = await supabase
      .from("Carpetas")
      .select("carpeta_id, nombre, user_id, publica")
      .ilike("nombre", `%${term}%`)
      .or(carpetasFilter)
      .limit(5);

    (carpetas ?? []).forEach((c: any) => {
      resultados.push({
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

    // Recursos propios
    const { data: recursos } = await supabase
      .from("Recursos")
      .select("recurso_id, nombre, carpeta_id")
      .eq("user_id", userId)
      .ilike("nombre", `%${term}%`)
      .limit(5);

    (recursos ?? []).forEach((r: any) => {
      resultados.push({ tipo: "recurso", id: r.recurso_id, titulo: r.nombre, subtitulo: "Recurso" });
    });

    // Categorías
    const { data: categorias } = await supabase
      .from("Categorias")
      .select("categoria_id, nombre, descripcion")
      .ilike("nombre", `%${term}%`)
      .limit(4);

    (categorias ?? []).forEach((c: any) => {
      resultados.push({ tipo: "categoria", id: c.categoria_id, titulo: c.nombre, subtitulo: c.descripcion || "Categoría" });
    });

    // Usuarios
    const { data: usuarios } = await supabase
      .from("Usuario")
      .select("user_id, nombre, email")
      .neq("user_id", userId)
      .or(`nombre.ilike.%${term}%,email.ilike.%${term}%`)
      .limit(3);

    (usuarios ?? []).forEach((u: any) => {
      resultados.push({ tipo: "usuario", id: u.user_id, titulo: u.nombre, subtitulo: u.email });
    });

    setResultados(resultados);
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

  const iconoTipo: Record<string, string> = {
    carpeta: "📁", recurso: "📄", categoria: "🏷️", usuario: "👤",
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        <ul>
          <div className={styles.izquierda}>
            <div className={styles.logo}>
              <img src="/logo.png" alt="logo" />
            </div>
            <h1>GESTOR DE LINKS - ONIRIC VIEW</h1>
          </div>

          {/* Búsqueda global */}
          <div className={styles.centro} ref={searchRef}>
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
                      <span className={styles.searchResultIcon}>{iconoTipo[r.tipo]}</span>
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
                  <div className={styles.searchEmpty}>Sin resultados para "{query}"</div>
                </div>
              )}
            </div>
          </div>

          <div className={styles.derecha}>
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
        </ul>
      </nav>
    </header>
  );
}