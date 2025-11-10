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
        
        // --- Enhanced Headings for better hierarchy and visibility ---
        "prose-h1:mt-0 prose-h1:mb-4 prose-h1:text-3xl md:prose-h1:text-4xl prose-h1:font-extrabold prose-h1:border-b prose-h1:border-border/50 prose-h1:pb-2", // Added border-b
        "prose-h2:mt-8 prose-h2:mb-3 prose-h2:text-2xl md:prose-h2:text-3xl prose-h2:font-bold", // Stronger font
        "prose-h3:mt-6 prose-h3:mb-3 prose-h3:text-xl md:prose-h3:text-2xl prose-h3:font-semibold",
        "prose-h4:mt-5 prose-h4:mb-2 prose-h4:text-lg md:prose-h4:text-xl prose-h4:font-semibold",

        // Lists and paragraphs
        "prose-p:my-4 prose-ul:my-4 prose-ol:my-4 prose-li:my-2",
        // Ensure list markers/indentation always visible even if global styles interfere
        // Making list markers a stronger color if possible (default is current text color)
        "[&>ul]:list-disc [&>ul]:pl-6 [&_ul_ul]:list-disc [&_ul_ul]:pl-6",
        "[&>ol]:list-decimal [&>ol]:pl-6 [&_ol_ol]:list-decimal [&_ol_ol]:pl-6",
        // Task lists checkbox spacing
        "[&_input[type=checkbox]]:mr-2",
        
        // --- Enhanced Code Blocks and Inline Code for differentiation ---
        // Code blocks: Use a darker background, slight border, and padding
        "prose-pre:my-6 prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800 prose-pre:border prose-pre:border-gray-200 dark:prose-pre:border-gray-700 prose-pre:rounded-lg prose-pre:p-4",
        // Inline code: Use a distinct, muted background and rounded corners
        "prose-code:bg-gray-200 dark:prose-code:bg-gray-700 prose-code:text-foreground prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded",
        
        // --- Enhanced Blockquotes for high visibility ---
        // Thicker, darker border and distinct background
        "prose-blockquote:my-5 prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-primary/5 dark:prose-blockquote:bg-primary/10 prose-blockquote:pl-4 prose-blockquote:py-2 prose-blockquote:italic prose-blockquote:text-foreground/80",
        
        // Horizontal rule
        "prose-hr:my-8 prose-hr:border-0 prose-hr:h-px prose-hr:bg-border/70",
        
        // UI Separator component inside content
        "[&_[data-slot=separator]]:my-6",
        
        // --- Enhanced Tables for scannability ---
        // Added border-collapse and border for better structure
        "prose-table:my-5 prose-table:w-full prose-table:border prose-table:border-border/70 prose-table:rounded-lg prose-table:overflow-hidden",
        "prose-th:font-bold prose-th:bg-muted/50 prose-th:border-b prose-th:border-border/70", // Header differentiation
        "prose-td:border-b prose-td:border-border/70 prose-td:p-3", // Cell borders
        "prose-tr:even:bg-muted/20", // Zebra striping for row differentiation
        
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