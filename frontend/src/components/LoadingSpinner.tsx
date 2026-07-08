import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  message?: string;
}

export default function LoadingSpinner({
  message = "Loading...",
}: LoadingSpinnerProps) {
  return (
    <div className="h-screen flex flex-col items-center justify-center gap-3 bg-background">
      <Loader2 className="size-8 animate-spin text-primary" />
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
    </div>
  );
}
