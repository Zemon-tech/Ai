"use client";

import { cn } from "@/lib/utils";
import { type ComponentProps, memo } from "react";
import { Streamdown } from "streamdown";

type ResponseProps = ComponentProps<typeof Streamdown>;

export const Response = memo(
  ({ className, ...props }: ResponseProps) => (
    <Streamdown
      className={cn(
        "size-full",
        // Typography and markdown spacing
        "prose prose-neutral dark:prose-invert max-w-none",
        // Headings spacing and sizes
        "prose-h1:mt-0 prose-h1:mb-3 prose-h1:text-3xl md:prose-h1:text-4xl prose-h1:font-semibold",
        "prose-h2:mt-6 prose-h2:mb-2 prose-h2:text-2xl md:prose-h2:text-3xl prose-h2:font-semibold",
        "prose-h3:mt-5 prose-h3:mb-2 prose-h3:text-xl md:prose-h3:text-2xl prose-h3:font-semibold",
        "prose-h4:mt-4 prose-h4:mb-2 prose-h4:text-lg md:prose-h4:text-xl prose-h4:font-semibold",
        // Lists and paragraphs
        "prose-p:my-3 prose-ul:my-3 prose-ol:my-3 prose-li:my-1",
        // Ensure list markers/indentation always visible even if global styles interfere
        "[&>ul]:list-disc [&>ul]:pl-6 [&_ul_ul]:list-disc [&_ul_ul]:pl-6",
        "[&>ol]:list-decimal [&>ol]:pl-6 [&_ol_ol]:list-decimal [&_ol_ol]:pl-6",
        // Task lists checkbox spacing
        "[&_input[type=checkbox]]:mr-2",
        // Code blocks and inline code
        "prose-pre:my-4 prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-code:px-1 prose-code:py-0.5",
        // Blockquotes
        "prose-blockquote:border-l-4 prose-blockquote:border-border prose-blockquote:pl-4 prose-blockquote:italic",
        // Horizontal rule
        "prose-hr:my-6 prose-hr:border-border",
        // Tables
        "prose-table:my-4 prose-th:font-semibold",
        // Remove extra margins on first/last child
        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Response.displayName = "Response";
