import { Playground } from "@/components/playground";

export const dynamic = "force-dynamic";
export default function Page() {
  return <Playground configured={Boolean(process.env.JEV_API_KEY?.trim())} />;
}
