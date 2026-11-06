import "./globals.css";
export const metadata = {
  title: "Station",
  description: "A donut world for your multi-agent system",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
