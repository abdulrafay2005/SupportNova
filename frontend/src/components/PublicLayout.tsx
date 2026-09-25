import { Outlet } from "react-router-dom";
import { PublicFooter, PublicHeader } from "@/components/PublicHeader";

export function PublicLayout() {
  return (
    <div className="flex min-h-full flex-col bg-canvas">
      <PublicHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}
