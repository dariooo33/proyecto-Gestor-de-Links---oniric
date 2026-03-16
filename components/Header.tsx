import styles from "./Header.module.css";

export default function Header() {
  return (
    <header className={styles.header}>
      <nav className={styles.nav}>
        <ul>
          <div className={styles.izquierda}>
            <div className={styles.logo}><img src="" alt="logo" /></div>
            <h1>Nombre APP</h1>
          </div>
          <div className={styles.centro}>
            <input type="text" placeholder="Buscar"/>
          </div>
          <div className={styles.derecha}>
            <li><a href="/">MENU</a></li>
            <li><a href="/register">Registro</a></li>
            <li><a href="/login">Login</a></li>
          </div>
        </ul>
      </nav>
    </header>
  );
}