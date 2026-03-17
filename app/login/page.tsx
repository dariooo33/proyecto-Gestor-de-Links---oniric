"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { supabase } from "@/lib/supabaseClient";
import styles from "./page.module.css";

type FormData = {
  correo: string;
  contrasena: string;
};

export default function Login() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    setServerError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: data.correo,
      password: data.contrasena,
    });

    setLoading(false);

    if (error) {
      // Mensaje en español según el error
      if (error.message === "Invalid login credentials") {
        setServerError("Correo o contraseña incorrectos");
      } else if (error.message === "Email not confirmed") {
        setServerError("Debes confirmar tu correo antes de iniciar sesión");
      } else {
        setServerError(error.message);
      }
      return;
    }

    router.push("/"); // redirige al inicio tras login exitoso
  };

  return (
    <main className={styles.main}>
      <h1>Login</h1>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>

        <label>Correo</label>
        <input
          type="email"
          {...register("correo", {
            required: "El correo es obligatorio",
            pattern: {
              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
              message: "Correo no válido",
            },
          })}
        />
        {errors.correo && <span className={styles.error}>{errors.correo.message}</span>}

        <label>Contraseña</label>
        <input
          type="password"
          {...register("contrasena", {
            required: "La contraseña es obligatoria",
          })}
        />
        {errors.contrasena && <span className={styles.error}>{errors.contrasena.message}</span>}

        {serverError && <span className={styles.error}>{serverError}</span>}

        <button type="submit" disabled={loading}>
          {loading ? "Iniciando sesión..." : "INICIAR SESIÓN"}
        </button>

        <div className={styles.funciones}>
          <div>
            <label>¿Has olvidado tu contraseña? - </label>
            <button type="button" onClick={() => router.push("/reset-password")}>
              Cambiar Contraseña
            </button>
          </div>
          <div>
            <label>¿No tienes cuenta? - </label>
            <button type="button" onClick={() => router.push("/register")}>
              Regístrate
            </button>
          </div>
        </div>

      </form>
    </main>
  );
}