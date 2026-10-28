import { cn } from "cn";

export type MealStep = "room" | "genre" | "shop" | "result";
export type StepProgressProps = {
  currentStep: MealStep;
  className?: string;
};

export const MEAL_STEPS: ReadonlyArray<{ id: MealStep; label: string }> = [
  { id: "room", label: "ルーム作成" },
  { id: "genre", label: "ジャンル" },
  { id: "shop", label: "お店" },
  { id: "result", label: "決定" },
];

export function StepProgress({ currentStep, className }: StepProgressProps) {
  const currentIndex = MEAL_STEPS.findIndex((step) => step.id === currentStep);

  return (
    <ol className={cn("meal-steps", className)} aria-label="食事選びの進捗">
      {MEAL_STEPS.map((step, index) => {
        const complete = index < currentIndex;
        const current = index === currentIndex;
        const state = complete ? "complete" : current ? "current" : "pending";

        return (
          <li key={step.id} className="meal-step" data-state={state} aria-current={current ? "step" : undefined}>
            <span className="meal-step-marker" aria-hidden="true">{complete ? "✓" : index + 1}</span>
            <span className="meal-step-label">{step.label}</span>
            <span className="sr-only">{complete ? "完了" : current ? "現在の段階" : "未到達"}</span>
          </li>
        );
      })}
    </ol>
  );
}
