import { ViewingPage } from "@/components/viewing-page";
import { publicConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ViewingPage config={publicConfig()} id={id} />;
}
