import { Button } from "@/components/ui/button";

interface ResultDisplayProps {
  resultUrl: string;
  onDownload: () => void;
}

export function ResultDisplay({ resultUrl, onDownload }: ResultDisplayProps) {
  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-hidden">
        <img src={resultUrl} alt="Processed result" className="max-w-full h-auto" />
      </div>
      <Button variant="default" size="lg" onClick={onDownload}>
        Download Result
      </Button>
    </div>
  );
}
