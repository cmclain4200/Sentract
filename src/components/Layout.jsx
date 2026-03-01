import { Outlet } from "react-router-dom";
import TopBar from "./TopBar";
import StatusBar from "./StatusBar";
import NotificationBanner from "./NotificationBanner";

export default function Layout() {
  return (
    <div className="h-full flex flex-col">
      <TopBar />
      <NotificationBanner />
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
      <StatusBar />
    </div>
  );
}
