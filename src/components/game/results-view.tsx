'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Participant } from '@/app/generated/prisma/client';
import { getParticipantResult } from '@/app/actions/draw';
import { useTelegram } from '@/components/providers/telegram-provider';
import { Eye, EyeOff, Gift, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ResultsViewProps {
  gameId: string;
  participant: Participant;
}

export function ResultsView({ gameId, participant }: ResultsViewProps) {
  const { webApp } = useTelegram();
  const [receiverName, setReceiverName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);

  const handleReveal = async () => {
    if (receiverName) {
      setIsRevealed(!isRevealed);
      return;
    }

    if (!webApp?.initData) return;
    
    setIsLoading(true);
    const result = await getParticipantResult(webApp.initData, gameId, participant.id);
    
    if (result.success && result.receiver) {
      setReceiverName(result.receiver.name);
      setIsRevealed(true);
    } else {
      toast.error(result.error || 'Не удалось показать результат');
    }
    setIsLoading(false);
  };

  return (
    <div className="w-full">
        <Button 
            variant="outline" 
            className="w-full justify-between"
            onClick={handleReveal}
            disabled={isLoading}
        >
            <span className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-purple-500" />
                {participant.isOffline ? `Результат для ${participant.name}` : "Ваш результат"}
            </span>
            {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : isRevealed ? (
                <EyeOff className="h-4 w-4" />
            ) : (
                <Eye className="h-4 w-4" />
            )}
        </Button>
        
        {isRevealed && receiverName && (
            <div className="mt-2 p-4 bg-muted/50 rounded-lg text-center animate-in fade-in zoom-in duration-300 border border-purple-200 dark:border-purple-900">
                <p className="text-sm text-muted-foreground mb-1">
                   {participant.isOffline ? `${participant.name} дарит подарок:` : "Вы Тайный Санта для:"}
                </p>
                <p className="text-xl font-bold text-purple-600 dark:text-purple-400">{receiverName}</p>
            </div>
        )}
    </div>
  );
}
