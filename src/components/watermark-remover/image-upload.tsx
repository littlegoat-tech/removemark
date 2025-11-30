import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  onImageSelect: (file: File) => void;
  preview?: string | null;
  label: string;
  accept?: string;
}

export function ImageUpload({ onImageSelect, preview, label, accept = "image/*" }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    if (file.type.startsWith("image/")) {
      onImageSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={cn(
        "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
        isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
      )}
    >
      <input ref={fileInputRef} type="file" accept={accept} onChange={handleFileInputChange} className="hidden" />

      {preview ? (
        <div className="space-y-4">
          <img src={preview} alt="Preview" className="max-w-full max-h-64 mx-auto rounded-lg shadow-md" />
          <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
            Change Image
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-foreground/70">{label}</p>
          <Button variant="default" size="sm" onClick={() => fileInputRef.current?.click()}>
            Choose Image
          </Button>
        </div>
      )}
    </div>
  );
}
