"use client";

import "./globals.css";
import { Providers } from "@/components/Providers";
import { useEffect } from "react";
import { Toaster } from "react-hot-toast";

import Updater from "@/components/Updater";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  useEffect(() => {
    if (window.location.protocol !== "tauri:") {
      return;
    }

    document.addEventListener("contextmenu", (e) => {
      const targetElement = e.target as Element;
      const targetIsInput = targetElement.tagName.toLowerCase() === "input";

      const hasSelection = window.getSelection
        ? window.getSelection()?.toString()
        : "";

      if (!targetIsInput && !hasSelection) {
        e.preventDefault();
        return false;
      }
    });
  }, []);
  return (
    <html lang="en" className="dark">
      <body>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              zIndex: 999,
              background: "#333",
              color: "#FFF",
              maxWidth: "80%",
              padding: "10px 15px",
              textWrap: "wrap",
              wordBreak: "break-all",
            },
          }}
        />
        <Updater className="fixed z-50 top-2 right-2 rounded p-2 bg-secondary" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
