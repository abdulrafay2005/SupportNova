import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { UiProvider } from "@/context/UiContext";

export function AppLayout() {
  return (
    <UiProvider>
      <div className="flex h-full min-h-0 bg-canvas">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1280px] px-4 py-5 sm:px-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </UiProvider>
  );
}
