'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTelegram } from '@/components/providers/telegram-provider';
import { getGameDetails } from '@/app/actions/game';
import { runDraw } from '@/app/actions/draw';
import { Game, Participant } from '@/app/generated/prisma/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Share2, Shuffle, Users, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { AddOfflineParticipantDialog } from '@/components/game/add-offline-participant-dialog';
import { ExclusionModal } from '@/components/game/exclusion-modal';
import { ResultsView } from '@/components/game/results-view';

export default function GameLobbyPage() {
  const params = useParams();
  const router = useRouter();
  const { webApp, user: telegramUser } = useTelegram();

  const [game, setGame] = useState<Game & { participants: Participant[] } | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawLoading, setIsDrawLoading] = useState(false);

  const gameId = params.id as string;

  const loadGame = useCallback(async () => {
    if (!webApp?.initData || !gameId) return;

    try {
      const result = await getGameDetails(webApp.initData, gameId);
      if (result.success && result.game) {
        setGame(result.game);
        setIsCreator(!!result.isCreator);
      } else {
        toast.error(result.error || 'Не удалось загрузить игру');
      }
    } catch (error) {
      toast.error('Что-то пошло не так');
    } finally {
      setIsLoading(false);
    }
  }, [webApp, gameId]);

  useEffect(() => {
    if (webApp) {
        webApp.BackButton.show();
        webApp.BackButton.onClick(() => router.push('/'));
    }
    loadGame();

    return () => {
        if (webApp) {
            webApp.BackButton.hide();
            webApp.BackButton.offClick(() => router.push('/'));
        }
    }
  }, [webApp, loadGame, router]);

  const handleShare = () => {
    if (!game) return;
    const link = `https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || 'sweet_santa_bot'}?startapp=${game.inviteCode}`;

    if (webApp) {
        webApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(`Присоединяйся к моей игре «Тайный Санта»: ${game.title}!`)}`);
    } else {
        navigator.clipboard.writeText(link);
        toast.success('Ссылка скопирована в буфер обмена');
    }
  };

  const handleDraw = async () => {
    if (!webApp?.initData || !game) return;

    if (!confirm('Вы уверены, что хотите начать жеребьевку? Это действие нельзя отменить.')) return;

    setIsDrawLoading(true);
    const result = await runDraw(webApp.initData, game.id);

    if (result.success) {
      toast.success('Жеребьевка завершена! Всем назначены подопечные.');
      loadGame(); // Reload to show results view
    } else {
      toast.error(result.error || 'Не удалось запустить жеребьевку');
    }
    setIsDrawLoading(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <ShieldAlert className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold">Игра не найдена</h2>
        <p className="text-muted-foreground mt-2">Не удалось загрузить данные игры.</p>
        <Button onClick={() => router.push('/')} className="mt-4">На главную</Button>
      </div>
    );
  }

  const isDraft = game.status === 'DRAFT';
  const isCompleted = game.status === 'COMPLETED';
  const statusLabel = (status: string) => {
    if (status === 'DRAFT') return 'Черновик';
    if (status === 'COMPLETED') return 'Завершена';
    return status;
  };

  // Find current user's participant record
  const myParticipant = game.participants.find(p => p.userId === telegramUser?.id);

  return (
    <div className="container max-w-md mx-auto p-4 space-y-6 pb-20">
      <div className="flex flex-col items-center space-y-2">
        <h1 className="text-2xl font-bold text-center">{game.title}</h1>
        <Badge variant={isDraft ? "secondary" : "default"}>
          {statusLabel(game.status)}
        </Badge>
      </div>

      {isDraft && isCreator && (
        <Card>
          <CardContent className="pt-6 space-y-4">
             <Button className="w-full" onClick={handleShare} variant="outline">
               <Share2 className="mr-2 h-4 w-4" />
               Пригласить участников
             </Button>

             <AddOfflineParticipantDialog gameId={game.id} onSuccess={loadGame} />

             <Button
                className="w-full"
                onClick={handleDraw}
                disabled={game.participants.length < 3 || isDrawLoading}
                variant="default"
             >
               {isDrawLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shuffle className="mr-2 h-4 w-4" />}
               Начать жеребьевку
             </Button>
             {game.participants.length < 3 && (
                <p className="text-xs text-center text-muted-foreground">
                    Чтобы начать, нужно минимум 3 участника.
                </p>
             )}
          </CardContent>
        </Card>
      )}

      {isCompleted && myParticipant && (
         <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
                <CardTitle className="text-center">Ваш результат</CardTitle>
            </CardHeader>
            <CardContent>
                <ResultsView gameId={game.id} participant={myParticipant} />
            </CardContent>
         </Card>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center">
                <Users className="mr-2 h-5 w-5" />
                Участники ({game.participants.length})
            </h2>
        </div>

        <div className="space-y-2">
          {game.participants.map((participant) => (
            <Card key={participant.id} className="overflow-hidden">
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center space-x-3">
                  <Avatar>
                    <AvatarFallback>
                        {participant.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{participant.name}</p>
                    {participant.isOffline && (
                        <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">Оффлайн</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                    {/* Exclusions (Creator only, in DRAFT) */}
                    {isDraft && isCreator && (
                        <ExclusionModal
                            gameId={game.id}
                            participant={participant}
                            allParticipants={game.participants}
                        />
                    )}

                    {/* Offline Results (Creator only, in COMPLETED) */}
                    {isCompleted && isCreator && participant.isOffline && (
                         <ResultsView gameId={game.id} participant={participant} />
                    )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
