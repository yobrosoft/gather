import { GatherApp } from "@/components/gather-app";
import { publicConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <GatherApp config={publicConfig()} joinToken={token} />;
}
