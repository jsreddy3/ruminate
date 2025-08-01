import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ruminate - AI Reading Companion",
  description: "An intelligent AI reading companion that helps you understand complex documents in real-time. Upload any PDF and watch as our AI analyzes and explains content block-by-block, adapting to your learning objectives.",
  keywords: [
    "AI reading assistant",
    "PDF analysis",
    "document understanding",
    "intelligent annotations",
    "real-time AI",
    "technical document reader",
    "interactive PDF viewer",
    "context-aware chat",
    "document processing",
    "LaTeX support"
  ],
  authors: [{ name: "Ruminate Team" }],
  openGraph: {
    title: "Ruminate - Your AI Reading Companion",
    description: "Transform how you read complex documents with an AI that reads between the lines. Features real-time analysis, interactive annotations, and context-aware explanations.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Ruminate AI Reading Companion"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "Ruminate - AI Reading Companion",
    description: "Transform how you read complex documents with an AI that reads between the lines.",
    images: ["/twitter-image.png"]
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <OnboardingProvider>
            {children}
          </OnboardingProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
