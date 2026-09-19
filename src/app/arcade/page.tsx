import type { Metadata } from "next";
import { SpaceShooter } from "@/components/space-shooter";
import "./space.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Jev / Arcade — Autonomous space shooter",
  description:
    "Watch Jev pilot a ship through three waves using typed decisions from a text radar feed.",
};
export default function ArcadePage() {
  return <SpaceShooter configured={Boolean(process.env.JEV_API_KEY?.trim())} />;
}
