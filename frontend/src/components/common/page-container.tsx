import type { ReactNode } from "react";
import { cn } from "cn";
import { AppHeader } from "./app-header";

export type PageContainerProps = {
  children: ReactNode;
  header?: ReactNode;
  bottomAction?: ReactNode;
  className?: string;
};

export function PageContainer({ children, header = <AppHeader />, bottomAction, className }: PageContainerProps) {
  return (
    <div className={cn("meal-page", className)}>
      {header}
      <main className="meal-page-content">{children}</main>
      {bottomAction}
    </div>
  );
}
