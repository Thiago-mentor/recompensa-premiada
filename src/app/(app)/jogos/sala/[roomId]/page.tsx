import { SalaClient } from "./SalaClient";

export default async function SalaPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  return <SalaClient key={roomId} roomId={roomId} />;
}
