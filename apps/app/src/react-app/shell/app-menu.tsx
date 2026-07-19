/** @jsxImportSource react */
import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { settingsWindowOpen } from "@/app/lib/desktop";
import { isDesktopRuntime } from "@/app/lib/runtime-env";
import { useUpdateCheckRequestStore } from "../domains/settings/state/update-check-request";
import { useUiStateStore } from "./ui-state-store";

const NATIVE_MENU_OPEN_SETTINGS_EVENT = "legalwork:native-menu:open-settings";
const NATIVE_MENU_TOGGLE_SIDEBAR_EVENT = "legalwork:native-menu:toggle-sidebar";
const NATIVE_MENU_CHECK_UPDATES_EVENT = "legalwork:native-menu:check-updates";

export function AppMenuProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const toggleSidebar = useUiStateStore((state) => state.toggleSidebar);

  useEffect(() => {
    const openSettingsRoute = (route: string) => {
      if (isDesktopRuntime()) {
        void settingsWindowOpen(route).catch(() => navigate(route));
        return;
      }
      navigate(route);
    };
    const openSettings = () => openSettingsRoute("/settings/ai");
    const checkUpdates = () => {
      useUpdateCheckRequestStore.getState().requestUpdateCheck();
      openSettingsRoute("/settings/updates");
    };

    window.addEventListener(NATIVE_MENU_OPEN_SETTINGS_EVENT, openSettings);
    window.addEventListener(NATIVE_MENU_TOGGLE_SIDEBAR_EVENT, toggleSidebar);
    window.addEventListener(NATIVE_MENU_CHECK_UPDATES_EVENT, checkUpdates);
    return () => {
      window.removeEventListener(NATIVE_MENU_OPEN_SETTINGS_EVENT, openSettings);
      window.removeEventListener(NATIVE_MENU_TOGGLE_SIDEBAR_EVENT, toggleSidebar);
      window.removeEventListener(NATIVE_MENU_CHECK_UPDATES_EVENT, checkUpdates);
    };
  }, [navigate, toggleSidebar]);

  return <>{children}</>;
}
