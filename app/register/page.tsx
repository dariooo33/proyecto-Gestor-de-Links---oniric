"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { supabase } from "@/lib/supabaseClient";
import styles from "./page.module.css";

type FormData = {  //declaramos el tipo de formulario
  nombre: string;
  correo: string;
  contrasena: string;
  confirmar: string;
};

export default function Register() {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>(); //crea un formulario con la estrucutra declarada den formDAta

  const onSubmit = async (data: FormData) => {
  setServerError("");
  setLoading(true);

  // 1. Crear usuario en Supabase Auth   // const { data: authData, error: authError }  sacan data y error de lo que devuelve supabase
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: data.correo,
    password: data.contrasena,
  });

  if (authError) {
    setServerError(authError.message);
    setLoading(false);
    return;
  }

  // 2. Insertar en tu tabla Usuario
  const { error: dbError } = await supabase  // 
    .from("Usuario")
    .insert({
      user_id: authData.user?.id,   // ID del usuario creado en Auth para relacionarlo
      nombre: data.nombre,
      email: data.correo,
      rol: "user",                  // valor por defecto
    });

  setLoading(false);

  if (dbError) {
    setServerError(dbError.message);
    return;
  }

  router.push("/");  //redirige al menu inicial
};

  return (
    <main className={styles.main}>
      <h1>Register</h1>

      <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>

        <label>Nombre</label>
        <input
          type="text"
          {...register("nombre", {
            required: "El nombre es obligatorio",
            minLength: { value: 2, message: "Mínimo 2 caracteres" },
          })}
        />
        {errors.nombre && <span className={styles.error}>{errors.nombre.message}</span>}

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
            minLength: { value: 6, message: "Mínimo 6 caracteres" },
          })}
        />
        {errors.contrasena && <span className={styles.error}>{errors.contrasena.message}</span>}

        <label>Confirmar contraseña</label>
        <input
          type="password"
          {...register("confirmar", {
            required: "Confirma tu contraseña",
            validate: (val) =>
              val === watch("contrasena") || "Las contraseñas no coinciden",
          })}
        />
        {errors.confirmar && <span className={styles.error}>{errors.confirmar.message}</span>}

        {serverError && <span className={styles.error}>{serverError}</span>}

        <button type="submit" disabled={loading}>
          {loading ? "Registrando..." : "Registrarse"}
        </button>
      </form>

      <div className={styles.footer}>
        <label>¿Ya tienes cuenta?</label>
        <button><a href="/login">Iniciar Sesión</a></button>
      </div>
    </main>
  );
}