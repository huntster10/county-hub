import { requireProfile } from "@/lib/auth/session";
import { getLayoutData } from "@/lib/data/layout";
import { getActiveShift } from "@/server/actions/shifts";
import { getServerSettings } from "@/lib/settings";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

/**
 * Shell for every signed-in page: fixed sidebar on the left, top bar, content.
 * Being a Server Component, it fetches the user's data once per request and
 * passes plain props to the interactive (client) pieces.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await requireProfile();
  const [{ departments, myDepartments, channels, unreadTotal }, activeShift, settings] = await Promise.all([
    getLayoutData(profile),
    getActiveShift(),
    getServerSettings(),
  ]);

  const sidebarProps = {
    role: profile.role,
    communityName: settings.community_name,
    departments: myDepartments,
    unreadTotal,
  };

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r lg:block">
        <Sidebar {...sidebarProps} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <Topbar
          profile={profile}
          activeShift={activeShift}
          departments={departments}
          channels={channels}
          sidebar={sidebarProps}
        />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
