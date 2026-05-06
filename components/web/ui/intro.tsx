import type { ComponentProps, HTMLAttributes } from "react";
import { Heading, type HeadingProps } from "~/components/common/heading";
import { cva, cx, type VariantProps } from "~/utils/cva";

const introVariants = cva({
  base: "flex w-full max-w-md flex-col gap-y-4 sm:max-w-xl md:max-w-3xl",

  variants: {
    alignment: {
      start: "mr-auto items-start text-start",
      center: "mx-auto items-center text-center",
      end: "ml-auto items-end text-end",
    },
  },

  defaultVariants: {
    alignment: "center",
  },
});

type IntroProps = HTMLAttributes<HTMLElement> &
  VariantProps<typeof introVariants> & {
    headingProps?: HeadingProps;
  };

const Intro = ({ className, alignment, ...props }: IntroProps) => {
  return (
    <div className={cx(introVariants({ alignment, className }))} {...props} />
  );
};

const IntroTitle = ({
  size = "h1",
  ...props
}: ComponentProps<typeof Heading>) => {
  return <Heading size={size} {...props} />;
};

const IntroDescription = ({ className, ...props }: ComponentProps<"h2">) => {
  return (
    <h2
      className={cx(
        "w-full max-w-2xl text-base text-foreground/65 md:text-lg",
        className
      )}
      {...props}
    />
  );
};

export { Intro, IntroTitle, IntroDescription };
