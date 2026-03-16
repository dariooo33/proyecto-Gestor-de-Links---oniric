import styles from "./page.module.css";

export default function Register() {
  return (
    <main className={styles.main}>
      <h1>Register</h1>
      <form className={styles.form}>
        <label>Nombre</label>
        <input type="text" />
        <label>Correo</label>
        <input type="email" />
        <label>Contraseña</label>
        <input type="password" />
        <label>Confirmar contraseña</label>
        <input type="password" />
        <button>Registrarse</button>
      </form>

      <div className={styles.footer}>
        <label>¿Ya tienes cuenta?</label>
        <button><a href="/login">Iniciar Sesión</a></button>
      </div>
    </main>
  );
}