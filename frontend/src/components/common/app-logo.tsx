import { cn } from "cn";

export type AppLogoProps = {
  compact?: boolean;
  className?: string;
};

export function AppLogo({ compact = false, className }: AppLogoProps) {
  return (
    <div className={cn("meal-logo", className)} data-compact={compact} role="img" aria-label="メシマッチ">
      <span className="meal-logo-mark" aria-hidden="true">M</span>
      <span aria-hidden="true">メシマッチ</span>
    </div>
  );
}
