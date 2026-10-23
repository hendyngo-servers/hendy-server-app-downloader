import { createRoot } from "react-dom/client";
import DownloadPortal from "./client/portal/DownloadPortal.tsx";
import "./index.css";
import "./client/portal/DownloadPortal.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element for Public Store.");
createRoot(root).render(<DownloadPortal />);
