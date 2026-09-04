import { getLiveMatch } from "@/db/queries";
import { LiveMatchView } from "@/components/LiveMatchView";

export const metadata = { title: "Live" };

export default async function LivePage() {
  const match = await getLiveMatch();
  return <LiveMatchView initialMatch={match} />;
}
