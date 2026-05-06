"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Command as CommandPrimitive } from "cmdk";
import { SearchIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { cx } from "~/utils/cva";

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    className={cx(
      "flex size-full flex-col overflow-hidden rounded-2xl bg-card/90 text-foreground backdrop-blur",
      className
    )}
    ref={ref}
    {...props}
  />
));
Command.displayName = CommandPrimitive.displayName;

interface CommandDialogProps extends DialogPrimitive.DialogProps {
  shouldFilter?: boolean;
}

const CommandDialog = ({
  children,
  shouldFilter = true,
  ...props
}: CommandDialogProps) => {
  const t = useTranslations("CommandPalette");

  return (
    <DialogPrimitive.Root {...props}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 fixed inset-0 z-40 bg-background/70 backdrop-blur-sm data-[state=closed]:animate-out data-[state=open]:animate-in" />

        <DialogPrimitive.Content
          className="data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 fixed top-[16%] left-1/2 z-50 max-h-[75vh] w-[min(500px,calc(100%-1.5rem))] -translate-x-1/2 overflow-hidden rounded-xl border bg-background shadow-lg data-[state=closed]:animate-out data-[state=open]:animate-in sm:top-[10%] sm:max-h-none"
          onWheel={(e) => e.stopPropagation()}
        >
          <DialogPrimitive.Title className="sr-only">
            {t("srTitle")}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {t("srDescription")}
          </DialogPrimitive.Description>

          <Command className="grid gap-1" shouldFilter={shouldFilter}>
            {children}
          </Command>

          <DialogPrimitive.Close className="absolute top-3 right-3 grid place-items-center rounded-full border p-1 text-muted-foreground hover:text-foreground">
            <XIcon className="size-4" />
            <span className="sr-only">{t("close")}</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div
    className="relative flex items-center gap-2.5 border-b px-4 py-3"
    cmdk-input-wrapper=""
  >
    <SearchIcon className="size-4 shrink-0 text-muted-foreground" />

    <CommandPrimitive.Input
      className={cx(
        "flex h-6 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  </div>
));
CommandInput.displayName = CommandPrimitive.Input.displayName;

const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    className={cx(
      "max-h-[300px] overflow-y-auto px-2 pb-2 sm:max-h-[400px]",
      "touch-pan-y",
      className
    )}
    ref={ref}
    {...props}
  />
));
CommandList.displayName = CommandPrimitive.List.displayName;

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Empty
    className={cx("py-6 text-center text-muted-foreground text-sm", className)}
    ref={ref}
    {...props}
  />
));
CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    className={cx(
      "overflow-hidden p-1.5 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-[12px] [&_[cmdk-group-heading]]:text-muted-foreground",
      className
    )}
    ref={ref}
    {...props}
  />
));
CommandGroup.displayName = CommandPrimitive.Group.displayName;

const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    className={cx("-mx-1 my-1 h-px bg-border/70", className)}
    ref={ref}
    {...props}
  />
));
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    className={cx(
      "relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled='true']:pointer-events-none data-[disabled='true']:opacity-50",
      className
    )}
    ref={ref}
    {...props}
  />
));
CommandItem.displayName = CommandPrimitive.Item.displayName;

const CommandShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cx(
      "ml-auto text-[11px] text-muted-foreground tracking-wide",
      className
    )}
    {...props}
  />
);
CommandShortcut.displayName = "CommandShortcut";

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
};
