"use client";

import { Loader2Icon, UploadCloudIcon, XIcon } from "lucide-react";
import Image from "next/image";
import {
  type ChangeEvent,
  type DragEvent,
  useCallback,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { uploadAdImage } from "~/app/admin/ads/_lib/actions";
import { Button } from "~/components/web/ui/button";
import { cx } from "~/utils/cva";

interface ImageUploadProps {
  className?: string;
  disabled?: boolean;
  onChange: (value: string | null) => void;
  value?: string | null;
}

export const ImageUpload = ({
  value,
  onChange,
  disabled,
  className,
}: ImageUploadProps) => {
  const [isPending, startTransition] = useTransition();
  const [dragActive, setDragActive] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (disabled || isPending) {
        return;
      }

      // Validate file type
      if (!file.type.startsWith("image/")) {
        toast.error("Please upload an image file");
        return;
      }

      // Validate file size (e.g. 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB");
        return;
      }

      startTransition(async () => {
        try {
          const formData = new FormData();
          formData.append("file", file);
          const url = await uploadAdImage(formData);
          onChange(url);
          toast.success("Image uploaded");
        } catch (error) {
          console.error("Upload failed:", error);
          toast.error("Failed to upload image");
        }
      });
    },
    [disabled, isPending, onChange]
  );

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const onDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files?.[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
        handleFile(e.target.files[0]);
      }
    },
    [handleFile]
  );

  if (value) {
    return (
      <div
        className={cx(
          "relative aspect-video w-full max-w-xs overflow-hidden rounded-lg border bg-muted",
          className
        )}
      >
        <Image alt="Upload" className="object-cover" fill src={value} />
        <Button
          className="absolute top-2 right-2 h-8 w-8 p-0"
          disabled={disabled || isPending}
          onClick={() => onChange(null)}
          type="button"
          variant="secondary"
        >
          <XIcon className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      aria-label="Upload image by clicking or dragging and dropping"
      className={cx(
        "relative flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-6 transition-colors hover:bg-muted/50",
        dragActive && "border-primary bg-muted/50",
        disabled && "pointer-events-none opacity-60",
        className
      )}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      role="button"
      tabIndex={0}
    >
      <input
        accept="image/*"
        className="absolute inset-0 cursor-pointer opacity-0"
        disabled={disabled || isPending}
        onChange={handleChange}
        type="file"
      />
      <div className="flex flex-col items-center gap-2 text-center text-muted-foreground text-sm">
        {isPending ? (
          <Loader2Icon className="h-8 w-8 animate-spin" />
        ) : (
          <UploadCloudIcon className="h-8 w-8" />
        )}
        <div className="flex flex-col gap-1">
          <p className="font-medium">
            <span className="text-primary">Click to upload</span> or drag and
            drop
          </p>
          <p className="text-xs">SVG, PNG, JPG or WEBP (max. 5MB)</p>
        </div>
      </div>
    </div>
  );
};
