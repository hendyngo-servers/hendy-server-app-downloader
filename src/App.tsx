/**
 * Hostname-based router for local previews and single-origin development.
 * Production deploys use src/index.html and src/admin.html as separate entries,
 * routed by the Cloudflare Worker / Pages Function / Render host router.
 */
import React, { lazy, Suspense, useEffect, useState } from "react";
import { loadPublicDomainRoutes, routeFor } from "./client/shared/store.ts";
import "./index.css";
import "./client/portal/DownloadPortal.css";
import "./client/admin/AdminPanelPlus.css";

const DownloadPortal = lazy(() => import("./client/portal/DownloadPortal.tsx"));
const AdminPanelPlus = lazy(() => import("./client/admin/AdminPanelPlus.tsx"));

export default function App() {
  const [target, setTarget] = useState<"admin" | "downloads">("downloads");
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const resolveHost = async () => {
      try {
        const data = await loadPublicDomainRoutes();
        const admin = routeFor(data.routes, "admin");
        if (!cancelled && admin && admin.hostname.toLowerCase() === window.location.hostname.toLowerCase()) {
          setTarget("admin");
        }
      } catch {
        // Default to the public store if the routing API is unavailable.
      } finally {
        if (!cancelled) setResolving(false);
      }
    };
    void resolveHost();
    return () => { cancelled = true; };
  }, []);

  if (resolving) return <div className="min-h-screen bg-slate-950 p-8 text-sm text-slate-400">Đang phân giải hostname…</div>;
  return <Suspense fallback={<div className="min-h-screen bg-slate-950 p-8 text-sm text-slate-400">Đang tải giao diện…</div>}>
    {target === "admin" ? <AdminPanelPlus /> : <DownloadPortal />}
  </Suspense>;
}
