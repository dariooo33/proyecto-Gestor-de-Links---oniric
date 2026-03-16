import styles from "./page.module.css";

export default function Register() {
  return (
    <main className={styles.main}>
      <h1>Login</h1>
      <form className={styles.form}>
        <label>Nombre / Correo</label>
        <input type="text" />
        <label>Contraseña</label>
        <input type="password" />
        <button>INICIAR SESIÓN</button>

        <div className={styles.funciones}>
          <div>
            <label>¿Has olvidado tu contraseña? -  </label>
            <button> Cambiar Contraseña</button>
          </div>
          <div>
            <label>¿No tienes cuenta?  - </label>
            <button><a href="/register">Registrate</a></button>
          </div>
        </div>
      </form>
    </main>
  );
}