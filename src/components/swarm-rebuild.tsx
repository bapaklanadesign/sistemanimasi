import { useEffect, useRef } from "react";
import { useLocation } from "@tanstack/react-router";
import { SwarmRebuild, type SwarmConfig } from "@/lib/swarm/swarm-rebuild";

/** Global runner: plays the rebuild once per page path per session (auto mode). */
export function SwarmRebuildRunner(props: { config?: Partial<SwarmConfig> }) {
  const path = useLocation({ select: (l) => l.pathname });
  const cfgRef = useRef(props.config);
  useEffect(() => {
    window.SwarmRebuild = SwarmRebuild;
    if (cfgRef.current) SwarmRebuild.configure(cfgRef.current);
    return () => SwarmRebuild.stop();
  }, []);
  useEffect(() => {
    if (cfgRef.current?.auto === false) return;
    const key = "swarm-rebuild:" + path;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch { /* ignore */ }
    SwarmRebuild.stop();
    const id = window.setTimeout(() => SwarmRebuild.start(), 400);
    return () => { clearTimeout(id); SwarmRebuild.stop(); };
  }, [path]);
  return null;
}
