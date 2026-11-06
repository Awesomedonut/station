import { Kalam } from "next/font/google";
import { AgentWorld } from "@/modules/agentworld/ui";
const hand = Kalam({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-kalam",
  display: "swap",
});
export default function Page() {
  return (
    <main className={`${hand.variable} p-3`}>
      <header className="mb-3 flex items-baseline gap-3">
        <h1 className="text-2xl font-bold">Station</h1>
        <p className="text-sm">Your agent world</p>
      </header>
      <AgentWorld handFont={hand.style.fontFamily} />
    </main>
  );
}
