import { GatherApp } from "@/components/gather-app";
import { publicConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function Page() {
  return <GatherApp config={publicConfig()} />;
}
