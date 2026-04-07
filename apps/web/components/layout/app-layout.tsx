import { SidebarMenu } from "./sidebar-menu";
import { TopNavbar } from "./top-navbar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="portal-shell min-h-screen p-2.5">
      <div className="mx-auto flex min-h-[calc(100vh-1.25rem)] max-w-[1860px] flex-col gap-2.5">
        <div className="sticky top-0 z-50 space-y-2.5 pb-1">
          <TopNavbar />
          <SidebarMenu />
        </div>
        <main className="min-h-[calc(100vh-6.25rem)]">{children}</main>
      </div>
    </div>
  );
}
