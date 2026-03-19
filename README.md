# Gestor de Enlaces para Oniric View

Aplicación web para organizar enlaces y recursos en carpetas anidadas, con autenticación de usuarios.

**Stack:** Next.js · TypeScript · Supabase · CSS Modules

---

## Requisitos previos

- [Node.js](https://nodejs.org/) v18 o superior
- Una cuenta en [Supabase](https://supabase.com/)
---

## Instalación

### 1. Clonar el repositorio

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto con las claves que encontraras en la memoria del proyecto:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<tu-proyecto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu-anon-key>
```

### 4. Arrancar el servidor de desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## Uso

1. **Regístrate** en `/register` con nombre, correo y contraseña.
2. Supabase enviará un **correo de confirmación** — debes confirmarlo antes de poder iniciar sesión.
3. Inicia sesión en `/login`.
4. Desde la pantalla principal puedes:
   - Crear **carpetas** (y sub-carpetas anidadas) desde la barra superior.
   - Seleccionar una carpeta en el árbol lateral para ver su contenido.
   - Añadir **recursos** (enlaces u otro contenido) dentro de cada carpeta.
   - Eliminar carpetas y recursos pasando el cursor sobre ellos.

---
