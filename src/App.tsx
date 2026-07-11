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

  switch (route.screen) {
    case "new":
      return <NewProject />;
    case "project":
      return <Letter slug={route.slug} briefingId={route.briefingId} />;
    case "ritual":
      return <Ritual slug={route.slug} />;
    case "edit":
      return <EditProject slug={route.slug} />;
    case "thread":
      return <Thread slug={route.slug} />;
    default:
      return <Dashboard />;
  }
}
