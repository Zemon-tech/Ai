"use client";

import { cn } from "@/lib/utils";
import { type ComponentProps, memo } from "react";
import { Streamdown } from "streamdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import "katex/dist/katex.min.css";

type ResponseProps = ComponentProps<typeof Streamdown>;

export const Response = memo(
  ({ className, ...props }: ResponseProps) => (
    <Streamdown
      className={cn(
        "size-full",
        // Typography and markdown spacing
        "prose prose-neutral dark:prose-invert max-w-none [font-size:calc(1.5rem*var(--content-scale,1.5))]",
        
        // --- Normalized Headings for better hierarchy and readability (smaller, lighter) ---
        // H1
        "prose-h1:mt-0 prose-h1:mb-3 prose-h1:text-2xl md:prose-h1:text-3xl prose-h1:font-bold prose-h1:tracking-tight prose-h1:border-b prose-h1:border-border/50 prose-h1:pb-2", 
        // H2
        "prose-h2:mt-7 prose-h2:mb-2 prose-h2:text-xl md:prose-h2:text-2xl prose-h2:font-semibold prose-h2:tracking-tight", 
        // H3
        "prose-h3:mt-5 prose-h3:mb-2 prose-h3:text-lg md:prose-h3:text-xl prose-h3:font-medium",
        // H4
        "prose-h4:mt-4 prose-h4:mb-2 prose-h4:text-base md:prose-h4:text-lg prose-h4:font-medium",
        
        // Ensure headings update even if typography defaults win (smaller, lighter)
        "[&_h1]:mt-0 [&_h1]:mb-3 [&_h1]:text-2xl md:[&_h1]:text-3xl [&_h1]:tracking-tight [&_h1]:pb-2 [&_h1]:border-b [&_h1]:border-border/50 [&_h1]:[font-weight:var(--fw-h1,700)]",
        "[&_h2]:mt-7 [&_h2]:mb-2 [&_h2]:text-xl md:[&_h2]:text-2xl [&_h2]:tracking-tight [&_h2]:[font-weight:var(--fw-h2,600)]",
        "[&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-lg md:[&_h3]:text-xl [&_h3]:[font-weight:var(--fw-h3,500)]",
        "[&_h4]:mt-4 [&_h4]:mb-2 [&_h4]:text-base md:[&_h4]:text-lg [&_h4]:[font-weight:var(--fw-h4,500)]",
        
        // Lists and paragraphs
        "prose-p:my-4 prose-ul:my-4 prose-ol:my-4 prose-li:my-2",
        // Body text size and weight
        "[&_p]:text-sm md:[&_p]:text-base [&_p]:leading-normal [&_p]:[font-weight:var(--fw-body,400)]",
        "[&_ul]:space-y-2 [&_ol]:space-y-2",
        // List text size and weight
        "[&_li]:text-sm md:[&_li]:text-base [&_li]:leading-normal [&_li]:[font-weight:var(--fw-body,400)]",
        // Stronger list markers for visibility
        "[&_li::marker]:text-muted-foreground",
        // Ensure list markers/indentation always visible even if global styles interfere
        "[&>ul]:list-disc [&>ul]:pl-6 [&_ul_ul]:list-disc [&_ul_ul]:pl-6",
        "[&>ol]:list-decimal [&>ol]:pl-6 [&_ol_ol]:list-decimal [&_ol_ol]:pl-6",
        // Task lists checkbox spacing
        "[&_input[type=checkbox]]:mr-2",
        
        // --- Enhanced Code Blocks and Inline Code for differentiation (No change needed) ---
        // Code blocks: Use a darker background, slight border, and padding
        "prose-pre:my-6 prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800 prose-pre:border prose-pre:border-gray-200 dark:prose-pre:border-gray-700 prose-pre:rounded-lg prose-pre:p-4",
        // Inline code: Use a distinct, muted background and rounded corners
        "prose-code:bg-gray-200 dark:prose-code:bg-gray-700 prose-code:text-foreground prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded",
        
        // --- Enhanced Blockquotes for high visibility (No change needed) ---
        // Thicker, darker border and distinct background
        "prose-blockquote:my-5 prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-primary/5 dark:prose-blockquote:bg-primary/10 prose-blockquote:pl-4 prose-blockquote:py-2 prose-blockquote:italic prose-blockquote:text-foreground/80",
        
        // Horizontal rule
        "prose-hr:my-8 prose-hr:border-0 prose-hr:h-px prose-hr:bg-border/70",
        
        // UI Separator component inside content
        "[&_[data-slot=separator]]:my-6",
        
        // --- Enhanced Tables for scannability (No change needed) ---
        // Added border-collapse and border for better structure
        "prose-table:my-5 prose-table:w-full prose-table:border prose-table:border-border/70 prose-table:rounded-lg prose-table:overflow-hidden",
        "prose-th:font-bold prose-th:bg-muted/50 prose-th:border-b prose-th:border-border/70", // Header differentiation
        "prose-td:border-b prose-td:border-border/70 prose-td:p-3", // Cell borders
        "prose-tr:even:bg-muted/20", // Zebra striping for row differentiation
        
        // Remove extra margins on first/last child
        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
      // Explicitly configure remark plugins so inline single-dollar math parses
      remarkPlugins={[
        remarkGfm as any,
        [remarkMath as any, { singleDollarTextMath: true }] as any,
      ]}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Response.displayName = "Response";