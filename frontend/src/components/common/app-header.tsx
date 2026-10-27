import type { ReactNode } from "react";
import { cn } from "cn";
import { AppLogo } from "./app-logo";

export type AppHeaderProps = {
  roomNumber?: string;
  layout?: "default" | "centered";
  leading?: ReactNode;
  className?: string;
};

export function AppHeader({ roomNumber, layout = "default", leading, className }: AppHeaderProps) {
  const room = roomNumber?.trim();

  return (
    <header className={cn("meal-header", className)} data-layout={layout}>
      {layout === "centered" && <div className="meal-header-leading">{leading}</div>}
      <AppLogo compact />
      {layout === "centered" && <span aria-hidden="true" />}
      {room && <span className="meal-room-chip" aria-label={`ルーム番号 ${room}`}>Room #{room}</span>}
    </header>
  );
}
