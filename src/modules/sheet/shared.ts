import type { AgentSheetData } from "./agents";
export type SheetTicket = {
  state: "yours" | "agent" | "other" | "waiting" | "done";
  project: string;
  title: string;
  note: string;
  href: string;
};
export type SheetData = {
  agent: string;
  asOf: string;
  tickets: SheetTicket[];
  done: {
    title: string;
  }[];
  agents: AgentSheetData;
  sample?: boolean;
};
