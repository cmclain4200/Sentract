import { useState, useCallback, useRef } from "react";

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const showToast = useCallback((message) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, exiting: false }]);

    timers.current[id] = setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        delete timers.current[id];
      }, 300);
    }, 4000);
  }, []);

  function ToastContainer() {
    if (toasts.length === 0) return null;
    return (
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.exiting ? "toast-exit" : ""}`}>
            {t.message}
          </div>
        ))}
      </div>
    );
  }

  return { showToast, ToastContainer };
}
