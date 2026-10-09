import GameApp from '@/components/GameApp';
export default function JoinPage({ params }: { params: { code: string } }) {
  return <GameApp joinCode={params.code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)} />;
}
