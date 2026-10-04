import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { ApplicationShell } from "./shell/ApplicationShell";
import { ErrorBoundary } from "./shell/ErrorBoundary";
import { Notifications } from "./shell/Notifications";
import { CodeWorkspacePage } from "./pages/CodeWorkspacePage";
import { SeoWorkspacePage } from "./pages/SeoWorkspacePage";
import { RunsPage } from "./pages/RunsPage";
import { SettingsPage } from "./pages/SettingsPage";

function Route() { const pathname = window.location.pathname; if (pathname === "/seo") return <SeoWorkspacePage />; if (pathname.startsWith("/runs/")) return <RunsPage />; if (pathname === "/settings") return <SettingsPage />; return pathname === "/code" || pathname === "/" ? <CodeWorkspacePage /> : <App />; }
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><ErrorBoundary><Notifications><ApplicationShell><Route /></ApplicationShell></Notifications></ErrorBoundary></React.StrictMode>);
