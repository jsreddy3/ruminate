"use client";

import { MathJaxContext } from "better-react-mathjax";

const config = {
  loader: { load: ["[tex]/html"] },
  tex: {
    packages: { "[+]": ["html"] },
    inlineMath: [["\\(", "\\)"]],
    displayMath: [["\\[", "\\]"]]
  },
  startup: {
    typeset: false
  }
};

export default function MathJaxProvider({ children }: { children: React.ReactNode }) {
  return (
    <MathJaxContext version={3} config={config}>
      {children}
    </MathJaxContext>
  );
}
