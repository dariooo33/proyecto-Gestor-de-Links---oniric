"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import styles from "./Header.module.css";

export default function Header() {
  const router = useRouter();
  // undefined = cargando | null = sin sesión | objeto = con sesión
  const [usuario, setUsuario] = useState<undefined | null | { email: string }>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUsuario(session?.user ? { email: session.user.email! } : null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUsuario(session?.user ? { email: session.user.email! } : null);
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
        <ul>
          <div className={styles.izquierda}>
            <div className={styles.logo}>
              <img src="/logo.png" alt="logo" /> {/* Necesito un png - svg para el logo*/}
            </div>
            <h1>GESTOR DE LINKS - ONIRIC VIEW</h1>
          </div>

          <div className={styles.centro}>
            <input type="text" placeholder="Buscar" />
          </div>

          <div className={styles.derecha}>
            <li><a href="/">MENU</a></li>

            {usuario === undefined ? (
              // Cargando — no muestra nada para evitar el flash
              <li className={styles.cargando}>...</li>
            ) : usuario ? (
              // Con sesión
              <>
                <li className={styles.email}>{usuario.email}</li>
                <li>
                  <button onClick={cerrarSesion} className={styles.btnCerrar}>
                    Cerrar sesión
                  </button>
                </li>
              </>
            ) : (
              // Sin sesión
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