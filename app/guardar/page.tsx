"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Carpeta, TreeNode } from "../types";
import { buildTree } from "../helpers";

// ── Selector de carpeta en árbol ──────────────────────────────────────────
function CarpetaTree({
  nodes,
  selectedId,
  onSelect,
  depth = 0,
}: {
  nodes: TreeNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {nodes.map((node) => (
        <li key={node.carpeta_id}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 8px",
              paddingLeft: 8 + depth * 16,
              borderRadius: 6,
              cursor: "pointer",
              background: selectedId === node.carpeta_id ? "var(--accent, #f59e0b)" : "transparent",
              color: selectedId === node.carpeta_id ? "#000" : "inherit",
              fontWeight: selectedId === node.carpeta_id ? 600 : 400,
            }}
            onClick={() => onSelect(node.carpeta_id)}
          >
            {node.children.length > 0 && (
              <span
                style={{ fontSize: 10, opacity: 0.6, userSelect: "none" }}
                onClick={(e) => { e.stopPropagation(); toggle(node.carpeta_id); }}
              >
                {expanded.has(node.carpeta_id) ? "▼" : "▶"}
              </span>
            )}
            <span>📁</span>
            <span style={{ fontSize: 14 }}>{node.nombre}</span>
          </div>
          {node.children.length > 0 && expanded.has(node.carpeta_id) && (
            <CarpetaTree
              nodes={node.children}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

// ── Contenido principal ───────────────────────────────────────────────────
function GuardarContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const urlParam = searchParams.get("url") ?? searchParams.get("text") ?? "";
  const titleParam = searchParams.get("title") ?? "";

  const [userId, setUserId] = useState<string | null>(null);
  const [carpetas, setCarpetas] = useState<Carpeta[]>([]);
  // "ROOT" es un valor especial que significa raíz (carpeta_id = null)
  const [selectedCarpetaId, setSelectedCarpetaId] = useState<string | null | "ROOT">("ROOT");
  const [nombre, setNombre] = useState(titleParam);
  const [url, setUrl] = useState(urlParam);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push(`/login?redirect=/guardar?url=${encodeURIComponent(urlParam)}&title=${encodeURIComponent(titleParam)}`);
        return;
      }
      setUserId(session.user.id);
    });
  }, [router, urlParam, titleParam]);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("Carpetas")
      .select("*")
      .eq("user_id", userId)
      .order("created_at")
      .then(({ data }) => setCarpetas((data as Carpeta[]) ?? []));
  }, [userId]);

  async function handleGuardar() {
    if (!userId || selectedCarpetaId === null || !nombre.trim()) return;
    setGuardando(true);
    setError(null);
    const carpetaIdFinal = selectedCarpetaId === "ROOT" ? null : selectedCarpetaId;
    const { error: err } = await supabase.from("Recursos").insert({
      user_id: userId,
      carpeta_id: carpetaIdFinal,
      nombre: nombre.trim(),
      url: url.trim() || null,
      contenido: "",
    });
    if (err) {
      setError(err.message);
      setGuardando(false);
    } else {
      setGuardado(true);
      setGuardando(false);
    }
  }

  const tree = buildTree(carpetas);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg, #0a0a0a)",
      color: "var(--fg, #f5f5f5)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "flex-start",
      padding: "24px 16px",
      fontFamily: "var(--font-geist-sans, sans-serif)",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 480,
        background: "var(--surface, #111)",
        border: "1px solid var(--border, #222)",
        borderRadius: 12,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>🔖</span>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Guardar recurso</h1>
        </div>

        {guardado ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <p style={{ fontSize: 16, fontWeight: 600, margin: "0 0 8px" }}>¡Guardado correctamente!</p>
            <p style={{ fontSize: 13, opacity: 0.6, margin: "0 0 20px" }}>{nombre}</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={() => router.push("/")} style={btnStyle("primary")}>
                Ir a Oniric
              </button>
              <button
                onClick={() => { setGuardado(false); setNombre(""); setUrl(""); setSelectedCarpetaId(null); }}
                style={btnStyle("secondary")}
              >
                Guardar otro
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13, opacity: 0.7, fontWeight: 500 }}>Nombre</label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre del recurso"
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13, opacity: 0.7, fontWeight: 500 }}>URL</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 13, opacity: 0.7, fontWeight: 500 }}>
                Carpeta destino {selectedCarpetaId !== null ? "✓" : <span style={{ color: "#ef4444" }}>*</span>}
              </label>
              <div style={{
                border: "1px solid var(--border, #333)",
                borderRadius: 8,
                maxHeight: 220,
                overflowY: "auto",
                padding: 8,
              }}>
                {/* Opción raíz */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 8px",
                    borderRadius: 6,
                    cursor: "pointer",
                    background: selectedCarpetaId === "ROOT" ? "var(--accent, #f59e0b)" : "transparent",
                    color: selectedCarpetaId === "ROOT" ? "#000" : "inherit",
                    fontWeight: selectedCarpetaId === "ROOT" ? 600 : 400,
                    marginBottom: 4,
                    borderBottom: "1px solid var(--border, #333)",
                    paddingBottom: 10,
                  }}
                  onClick={() => setSelectedCarpetaId("ROOT")}
                >
                  <span>🏠</span>
                  <span style={{ fontSize: 14 }}>Raíz (sin carpeta)</span>
                </div>
                {carpetas.length === 0 ? (
                  <p style={{ opacity: 0.5, fontSize: 13, padding: 8, margin: 0 }}>Cargando carpetas…</p>
                ) : (
                  <CarpetaTree nodes={tree} selectedId={typeof selectedCarpetaId === "string" && selectedCarpetaId !== "ROOT" ? selectedCarpetaId : null} onSelect={setSelectedCarpetaId} />
                )}
              </div>
            </div>

            {error && <p style={{ color: "#ef4444", fontSize: 13, margin: 0 }}>⚠ {error}</p>}

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleGuardar}
                disabled={guardando || selectedCarpetaId === null || !nombre.trim()}
                style={btnStyle("primary", guardando || selectedCarpetaId === null || !nombre.trim())}
              >
                {guardando ? "Guardando…" : "Guardar"}
              </button>
              <button onClick={() => router.push("/")} style={btnStyle("secondary")}>
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--input-bg, #1a1a1a)",
  border: "1px solid var(--border, #333)",
  borderRadius: 8,
  padding: "10px 12px",
  color: "inherit",
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
};

function btnStyle(variant: "primary" | "secondary", disabled = false): React.CSSProperties {
  return {
    flex: variant === "primary" ? 1 : undefined,
    padding: "10px 18px",
    borderRadius: 8,
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 600,
    fontSize: 14,
    opacity: disabled ? 0.5 : 1,
    background: variant === "primary" ? "var(--accent, #f59e0b)" : "var(--surface2, #222)",
    color: variant === "primary" ? "#000" : "inherit",
  };
}

export default function GuardarPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32, color: "#fff" }}>Cargando…</div>}>
      <GuardarContent />
    </Suspense>
  );
}