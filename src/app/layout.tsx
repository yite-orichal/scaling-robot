"use client";

import "./globals.css";
import { Providers } from "@/components/Providers";
import { useEffect } from "react";
import { Toaster } from "react-hot-toast";

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
      e.preventDefault();
      return false;
    });
  }, []);
  return (
    <html lang="en" className="dark">
      <body>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#333",
              color: "#FFF",
              maxWidth: "80%",
              padding: "10px 15px",
              textWrap: "wrap",
              wordBreak: "break-all",
            },
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
