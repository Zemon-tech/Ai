import * as React from "react";

type Props = React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode };

export function ScrollArea({ className, children, ...props }: Props) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}
