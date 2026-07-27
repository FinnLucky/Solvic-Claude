import type { ReactNode } from "react";

export const metadata = {
  title: "Solvic — Recovery Dashboard",
  description: "Missed-call recovery stats",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          background: "#0d1117",
          color: "#e6edf3",
          minHeight: "100vh",
        }}
      >
        {children}
      </body>
    </html>
  );
}
