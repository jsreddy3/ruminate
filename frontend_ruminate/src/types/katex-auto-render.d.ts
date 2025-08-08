declare module 'katex/contrib/auto-render' {
  export interface RenderMathInElementOptions {
    delimiters?: Array<{ left: string; right: string; display: boolean }>;
    throwOnError?: boolean;
    errorColor?: string;
    macros?: Record<string, string>;
  }
  const renderMathInElement: (el: HTMLElement, options?: RenderMathInElementOptions) => void;
  export default renderMathInElement;
} 