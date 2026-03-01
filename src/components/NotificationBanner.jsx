import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Crosshair, Activity, FileText, Zap, GitMerge, X } from "lucide-react";
import { useNotifications } from "../contexts/NotificationContext";

const ICONS = {
  recon_mirror: Crosshair,
  pattern_lens: Activity,
  extraction: FileText,
  enrichment: Zap,
  crosswire: GitMerge,
};

export default function NotificationBanner() {
  const { notifications, dismiss } = useNotifications();
  const navigate = useNavigate();

  if (notifications.length === 0) return null;

  return (
    <div className="notification-banner-container">
      {notifications.map((n) => (
        <NotificationItem key={n.id} notification={n} onDismiss={dismiss} onNavigate={navigate} />
      ))}
    </div>
  );
}

function NotificationItem({ notification, onDismiss, onNavigate }) {
  const [exiting, setExiting] = useState(false);
  const Icon = ICONS[notification.type] || Zap;

  function handleDismiss() {
    setExiting(true);
    setTimeout(() => onDismiss(notification.id), 250);
  }

  function handleView() {
    if (notification.link) {
      onNavigate(notification.link);
    }
    handleDismiss();
  }

  return (
    <div className={`notification-banner ${exiting ? "notification-exit" : ""}`}>
      <div className="notification-accent" />
      <Icon size={14} color="#09BC8A" className="notification-icon" />
      <div className="notification-content">
        <span className="notification-title">{notification.title}</span>
        {notification.message && (
          <span className="notification-message">{notification.message}</span>
        )}
      </div>
      {notification.link && (
        <button className="notification-view" onClick={handleView}>
          View
        </button>
      )}
      <button className="notification-close" onClick={handleDismiss}>
        <X size={12} />
      </button>
    </div>
  );
}
