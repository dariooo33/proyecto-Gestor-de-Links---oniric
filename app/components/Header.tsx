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

  useEffect(() => {
    async function loadUsuario(userId: string, email: string) {
      const { data } = await supabase
        .from("Usuario")
        .select("rol")
        .eq("user_id", userId)
        .single();
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
        <ul>
          <div className={styles.izquierda}>
            <div className={styles.logo}>
              <img src="/logo.png" alt="logo" />
            </div>
            <h1>GESTOR DE LINKS - ONIRIC VIEW</h1>
          </div>

          <div className={styles.centro}>
            <input type="text" placeholder="Buscar" />
          </div>

          <div className={styles.derecha}>
            <li><a href="/">MENU</a></li>

            {usuario === undefined ? (
              <li className={styles.cargando}>...</li>
            ) : usuario ? (
              <>
                {usuario.rol === "admin" && (
                  <li>
                    <a href="/admin" className={styles.btnAdmin}>Admin</a>
                  </li>
                )}
                <li className={styles.email}>{usuario.email}</li>
                <li>
                  <button onClick={cerrarSesion} className={styles.btnCerrar}>
                    Cerrar sesión
                  </button>
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