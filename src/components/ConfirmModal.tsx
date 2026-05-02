import { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmBtnRef.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal confirm-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          {danger && <AlertTriangle size={14} style={{ color: "var(--danger, #e05252)" }} />}
          <span>{title}</span>
          <button className="icon-btn" onClick={onCancel} style={{ marginLeft: "auto" }}>
            <X size={14} />
          </button>
        </div>
        <div className="confirm-modal-body">
          <p>{message}</p>
          <div className="confirm-modal-actions">
            <button className="btn-secondary" onClick={onCancel}>
              {cancelLabel}
            </button>
            <button
              ref={confirmBtnRef}
              className={danger ? "btn-danger" : "btn-primary"}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
