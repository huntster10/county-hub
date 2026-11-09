"use client";

import { GripVertical, EyeOff } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The card chrome around every dashboard widget. In "customize" mode it shows
 * a drag handle and a hide button.
 */
export function WidgetFrame({
  title,
  description,
  action,
  customizing,
  onHide,
  dragHandleProps,
  className,
  contentClassName,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  customizing?: boolean;
  onHide?: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("flex h-full flex-col", customizing && "ring-1 ring-primary/40", className)}>
      <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
        <div className="flex items-start gap-2">
          {customizing && (
            <button
              className="-ml-1 mt-px cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-accent active:cursor-grabbing"
              aria-label="Drag to reorder"
              {...dragHandleProps}
            >
              <GripVertical className="size-4" />
            </button>
          )}
          <div>
            <CardTitle>{title}</CardTitle>
            {description && <CardDescription className="mt-1">{description}</CardDescription>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!customizing && action}
          {customizing && onHide && (
            <Button variant="ghost" size="icon-sm" onClick={onHide} aria-label="Hide widget">
              <EyeOff className="size-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className={cn("flex-1", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
