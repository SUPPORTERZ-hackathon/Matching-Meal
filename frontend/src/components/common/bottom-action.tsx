import type { ReactNode } from "react";
import { cn } from "cn";

export type BottomActionProps = {
  children: ReactNode;
  note?: string;
  className?: string;
};

export function BottomAction({ children, note, className }: BottomActionProps) {
  return (
    <div className={cn("meal-bottom-action", className)}>
      {children}
      {note && <p className="meal-bottom-note">{note}</p>}
    </div>
  );
}
