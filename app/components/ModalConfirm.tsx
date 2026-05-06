"use client";

import styles from "../page.module.css";

export function ModalConfirm({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className={styles.modalTitle}>⚠️ Confirmar</div>
        <p style={{ margin: "12px 0 20px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
          {message}
        </p>
        <div className={styles.modalActions}>
          <button type="button" className={styles.btnSecondary} onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className={`${styles.btnPrimary} ${styles.btnDanger}`} onClick={onConfirm}>
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}
