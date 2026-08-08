/**
 * Inngest — Orquestrador de Eventos do CyberITSM (server-only).
 *
 * Client global utilizado tanto pelo publisher (/api/qa-engine) quanto pelos
 * workers registrados em /api/inngest. O id 'cyberitsm-qa' identifica o app
 * no dashboard do Inngest (Cloud ou Dev Server local via `npx inngest dev`).
 */
import { Inngest } from "inngest";

const isProd = process.env.NODE_ENV === "production" || !!process.env.VERCEL;

export const inngest = new Inngest({
  id: "cyberitsm-qa",
  eventKey: isProd ? (process.env.INNGEST_EVENT_KEY || "local_event_key") : undefined,
});
