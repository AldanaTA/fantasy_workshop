import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { AccordionContent, AccordionItem, AccordionTrigger } from '../../ui/accordion';
import { Button } from '../../ui/button';

export function EditorSection({
  value,
  title,
  description,
  children,
}: {
  value: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <AccordionItem value={value} className="overflow-hidden rounded-2xl border border-border bg-background px-4 last:border-b sm:px-5">
      <AccordionTrigger className="py-4 text-left hover:no-underline">
        <div className="space-y-1">
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm font-normal text-muted-foreground">{description}</p>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-5">
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}

export function SectionHeader({
  description,
  actionLabel,
  onAction,
}: {
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">{description}</p>
      {actionLabel && onAction ? (
        <Button type="button" variant="outline" className="min-h-[44px] w-full sm:w-auto" onClick={onAction}>
          <Plus className="h-4 w-4" />
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function ReorderButtons({
  onMoveUp,
  onMoveDown,
  disableUp,
  disableDown,
}: {
  onMoveUp: () => void;
  onMoveDown: () => void;
  disableUp?: boolean;
  disableDown?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <Button type="button" variant="outline" onClick={onMoveUp} disabled={disableUp} aria-label="Move up">
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button type="button" variant="outline" onClick={onMoveDown} disabled={disableDown} aria-label="Move down">
        <ArrowDown className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function RemoveButton({
  onClick,
  label = 'Remove',
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <Button type="button" variant="outline" className="min-h-[44px] w-full md:w-auto" onClick={onClick}>
      <Trash2 className="h-4 w-4" />
      {label}
    </Button>
  );
}
