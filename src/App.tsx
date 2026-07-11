import { useEffect, useState } from "react";
import { Dashboard } from "./screens/Dashboard";
import { NewProject } from "./screens/NewProject";
import { EditProject } from "./screens/EditProject";
import { Letter } from "./screens/Letter";
import { Ritual } from "./screens/Ritual";
import { Thread } from "./screens/Thread";

type Route =
  | { screen: "dashboard" }
  | { screen: "new" }
  | { screen: "project"; slug: string; briefingId?: string }
  | { screen: "ritual"; slug: string }
  | { screen: "edit"; slug: string }
  | { screen: "thread"; slug: string };

function parseRoute(): Route {
  const parts = window.location.hash
    .replace(/^#\/?/, "")
    .split("/")
    .filter(Boolean)
    .map(decodeURIComponent);

  if (parts[0] === "new") return { screen: "new" };
  if (parts[0] === "p" && parts[1]) {
    if (parts[2] === "leave") return { screen: "ritual", slug: parts[1] };
    if (parts[2] === "edit") return { screen: "edit", slug: parts[1] };
    if (parts[2] === "thread") return { screen: "thread", slug: parts[1] };
    if (parts[2] === "b" && parts[3])
      return { screen: "project", slug: parts[1], briefingId: parts[3] };
    return { screen: "project", slug: parts[1] };
  }
  return { screen: "dashboard" };
}

export function navigate(path: string) {
  window.location.hash = path;
}

type Theme = "light" | "dark";

function currentTheme(): Theme {
  const stored = localStorage.getItem("reentry-theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    localStorage.setItem("reentry-theme", next);
    setTheme(next);
  }

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      title={theme === "dark" ? "Lights on" : "Lights off"}
      aria-label="Toggle color theme"
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}

export function App() {
  const [route, setRoute] = useState<Route>(parseRoute);

  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  let screen;
  switch (route.screen) {
    case "new":
      screen = <NewProject />;
      break;
    case "project":
      screen = <Letter slug={route.slug} briefingId={route.briefingId} />;
      break;
    case "ritual":
      screen = <Ritual slug={route.slug} />;
      break;
    case "edit":
      screen = <EditProject slug={route.slug} />;
      break;
    case "thread":
      screen = <Thread slug={route.slug} />;
      break;
    default:
      screen = <Dashboard />;
  }

  return (
    <>
      <ThemeToggle />
      {screen}
    </>
  );
}
