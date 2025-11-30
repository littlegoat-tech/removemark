import { cn } from "@/lib/utils";

interface ProcessingStatusProps {
  isLoading: boolean;
  progress?: number;
  message?: string;
}

export function ProcessingStatus({ isLoading, progress, message = "Processing image..." }: ProcessingStatusProps) {
  if (!isLoading) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="size-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-foreground/70">{message}</p>
      </div>
      {progress !== undefined && (
        <div className="space-y-2">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-foreground/70 text-right">{progress}%</p>
        </div>
      )}
    </div>
  );
}
