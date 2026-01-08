'use client';

import { useEffect, useState, useRef } from 'react';
import { useTelegram } from '@/components/providers/telegram-provider';
import { getUserGames, createGame, joinGame, GetGamesResult } from '@/app/actions/game';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, Plus, Users, Gift } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Home() {
  const { user, webApp, isLoading: isAuthLoading, startParam } = useTelegram();
  const [games, setGames] = useState<GetGamesResult['games']>([]);
  const [isLoadingGames, setIsLoadingGames] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newGameTitle, setNewGameTitle] = useState('');
  const [isJoinProcessing, setIsJoinProcessing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const router = useRouter();

  // Use a ref to track if we've already attempted to join with this startParam
  // to prevent double submissions in React Strict Mode or re-renders
  const hasAttemptedJoin = useRef(false);

  async function loadGames() {
    if (!webApp?.initData) return;
    setIsLoadingGames(true);
    try {
      const result = await getUserGames(webApp.initData);
      if (result.success && result.games) {
        setGames(result.games);
      } else {
        toast.error('Не удалось загрузить игры');
      }
    } catch {
      toast.error('Ошибка загрузки игр');
    } finally {
      setIsLoadingGames(false);
    }
  }

  async function handleJoinGame(inviteCode: string) {
    if (!webApp?.initData) return;
    setIsJoinProcessing(true);

    const toastId = toast.loading('Присоединение к игре...');

    try {
      const result = await joinGame(webApp.initData, inviteCode);
      if (result.success && result.game) {
        toast.success('Вы присоединились к игре!', { id: toastId });
        router.push(`/game/${result.game.id}`);
      } else {
        toast.error(result.error || 'Не удалось присоединиться к игре', { id: toastId });
      }
    } catch {
      toast.error('Ошибка присоединения к игре', { id: toastId });
    } finally {
      setIsJoinProcessing(false);
    }
  }

  useEffect(() => {
    if (user && webApp) {
      setTimeout(() => {
        loadGames();
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, webApp]);

  useEffect(() => {
    if (user && webApp && startParam && !isJoinProcessing && !hasAttemptedJoin.current) {
      hasAttemptedJoin.current = true;
      setTimeout(() => {
        handleJoinGame(startParam);
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, webApp, startParam, isJoinProcessing]);

  const handleCreateGame = async () => {
    if (!newGameTitle.trim() || !webApp?.initData) return;

    setIsCreating(true);
    const result = await createGame(webApp.initData, newGameTitle);
    setIsCreating(false);

    if (result.success && result.game) {
      toast.success('Игра создана!');
      setNewGameTitle('');
      setIsDialogOpen(false);
      // Refresh list
      loadGames();
      // Optionally navigate to game
      // router.push(`/game/${result.game.id}`);
    } else {
      toast.error(result.error || 'Не удалось создать игру');
    }
  };


  if (isAuthLoading || isJoinProcessing) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const statusLabel = (status: string) => {
    if (status === 'DRAFT') return 'Черновик';
    if (status === 'COMPLETED') return 'Завершена';
    return status;
  };

  return (
    <main className="container mx-auto p-4 max-w-md min-h-screen flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Мои игры</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Создать игру</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder="Название игры (например: Офисный праздник 2024)"
                value={newGameTitle}
                onChange={(e) => setNewGameTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateGame();
                }}
              />
            </div>
            <DialogFooter>
              <Button onClick={handleCreateGame} disabled={isCreating}>
                {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Создать
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </header>

      {isLoadingGames ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : games && games.length > 0 ? (
        <div className="grid gap-4">
          {games.map((game) => (
            <Link key={game.id} href={`/game/${game.id}`} className="block">
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg font-medium">
                    {game.title}
                  </CardTitle>
                  {game.status === 'COMPLETED' ? (
                    <Gift className="h-4 w-4 text-green-500" />
                  ) : (
                    <span className={`text-xs px-2 py-1 rounded-full ${game.status === 'DRAFT' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100' : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
                      }`}>
                      {statusLabel(game.status)}
                    </span>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Users className="mr-1 h-4 w-4" />
                    {game._count.participants} участников
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
          <Gift className="h-12 w-12 mb-4 opacity-20" />
          <p>Игр пока нет.</p>
          <p className="text-sm">Создайте игру, чтобы начать!</p>
        </div>
      )}
    </main>
  );
}
