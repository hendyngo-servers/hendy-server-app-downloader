import { createRoot } from "react-dom/client";
import AdminPanelPlus from "./client/admin/AdminPanelPlus.tsx";
import "./index.css";
import "./client/admin/AdminPanelPlus.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element for Admin Control Center.");
createRoot(root).render(<AdminPanelPlus />);
