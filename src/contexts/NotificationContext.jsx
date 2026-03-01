import { createContext, useContext, useState, useCallback, useRef } from "react";

const NotificationContext = createContext({});

let nextId = 1;

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const timersRef = useRef({});

  const dismiss = useCallback((id) => {
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const notify = useCallback(({ type, title, message, link }) => {
    const id = nextId++;
    const notification = { id, type, title, message, link, timestamp: Date.now() };
    setNotifications((prev) => [notification, ...prev]);

    // Auto-dismiss after 8 seconds
    timersRef.current[id] = setTimeout(() => {
      dismiss(id);
    }, 8000);

    return id;
  }, [dismiss]);

  return (
    <NotificationContext.Provider value={{ notifications, notify, dismiss }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
