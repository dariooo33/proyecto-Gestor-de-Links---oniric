export interface Categoria {
  categoria_id: string;
  nombre: string;
  descripcion: string;
  created_at: string;
}

export interface Carpeta {
  carpeta_id: string;
  user_id: string;
  id_padre: string | null;
  nombre: string;
  created_at: string;
  publica: boolean;
}

export interface Recurso {
  recurso_id: string;
  created_at: string;
  user_id: string;
  carpeta_id: string;
  nombre: string;
  contenido: string;
}

export interface Permiso {
  permiso_id: string;
  carpeta_id: string;
  owner_id: string;
  user_id: string;
  nivel: "lectura" | "edicion";
  created_at: string;
  Usuario?: { nombre: string; email: string };
}

export interface UsuarioBusqueda {
  user_id: string;
  nombre: string;
  email: string;
}

export type TreeNode = Carpeta & { children: TreeNode[] };

export type NivelAcceso = "owner" | "edicion" | "lectura" | null;