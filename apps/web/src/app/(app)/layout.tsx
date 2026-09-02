import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";
import { apiFetchJson } from "@/lib/api";
import { requireSession } from "@/lib/session";
import type { NotificationRecord } from "@/components/notification-list";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireSession();
  // Best-effort: a failure here can't take down the layout every page in
  // the portal renders through — worst case the bell opens empty until
  // the next successful navigation refetches it.
  const notifications = await apiFetchJson<NotificationRecord[]>("/notifications/mine").catch(
    () => [] as NotificationRecord[],
  );
  return (
    <AppShell user={user} notifications={notifications}>
      {children}
    </AppShell>
  );
}
