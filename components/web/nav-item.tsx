"use client";

import { Slot } from "@radix-ui/react-slot";
import hotkeys from "hotkeys-js";
import { type ReactNode, useEffect } from "react";
import { DockItem } from "~/components/web/ui/dock";
import { Shortcut } from "~/components/web/ui/shortcut";
import { Tooltip } from "~/components/web/ui/tooltip";

export interface NavItemProps {
  hotkey?: string;
  icon: ReactNode;
  isActive?: boolean;
  isDisabled?: boolean;
  onClick?: () => void;
  shortcut?: string;
  tooltip: string;
}

export const NavItem = ({ ...props }: NavItemProps) => {
  const { icon, tooltip, shortcut, hotkey, isActive, isDisabled, onClick } =
    props;

  useEffect(() => {
    const key = hotkey || shortcut;

    if (key && !isDisabled && onClick) {
      hotkeys(key, () => onClick());
    }

    return () => {
      if (key) {
        hotkeys.unbind(key);
      }
    };
  }, [shortcut, onClick, hotkey, isDisabled]);

  return (
    <Tooltip
      sideOffset={0}
      tooltip={
        <>
          {tooltip} {shortcut && <Shortcut>{shortcut}</Shortcut>}
        </>
      }
    >
      <DockItem asChild isActive={isActive}>
        <button disabled={isDisabled} onClick={onClick} type="button">
          <Slot className="size-4">{icon}</Slot>
        </button>
      </DockItem>
    </Tooltip>
  );
};
