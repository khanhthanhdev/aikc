import type { ReactElement, ReactNode } from "react";
import { cloneElement, forwardRef, isValidElement } from "react";

export interface SlottableProps {
  asChild?: boolean;
  child?: ReactNode;
  children: (child: ReactNode) => ReactNode;
}

export const Slottable = forwardRef<HTMLElement, SlottableProps>(
  (props, ref) => {
    const { asChild, child, children, ...rest } = props;

    if (!asChild) {
      return children(child);
    }

    if (!isValidElement(child)) {
      return null;
    }

    // biome-ignore lint/suspicious/noExplicitAny: child needs to be cast to any to allow ref injection
    const element = child as ReactElement<any>;

    return cloneElement(
      element,
      { ref, ...rest },
      children(element.props?.children)
    );
  }
);

Slottable.displayName = "Slottable";
