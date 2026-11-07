import type { ReactNode } from "react";
import { cn } from "cn";
import { AppLogo } from "./app-logo";
import { SoundMenu } from "@/features/audio/sound-menu";

export type AppHeaderProps = {
  roomNumber?: string;
  layout?: "default" | "centered";
  leading?: ReactNode;
  className?: string;
  sticky?: boolean;
};

export function AppHeader({ roomNumber, layout = "default", leading, className, sticky = true }: AppHeaderProps) {
  const room = roomNumber?.trim();

  return (
    <header className={cn("meal-header", className)} data-layout={layout} data-sticky={sticky}>
      {layout === "centered" && <div className="meal-header-leading">{leading}</div>}
      <AppLogo compact />
      {room && <span className="meal-room-chip" aria-label={`ルーム番号 ${room}`}>Room #{room}</span>}
      <SoundMenu />
    </header>
  );
}
