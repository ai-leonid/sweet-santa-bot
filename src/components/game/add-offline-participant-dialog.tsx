'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTelegram } from '@/components/providers/telegram-provider';
import { addOfflineParticipant } from '@/app/actions/game';
import { toast } from 'sonner';
import { UserPlus, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AddOfflineParticipantDialogProps {
  gameId: string;
  onSuccess?: () => void;
}

export function AddOfflineParticipantDialog({ gameId, onSuccess }: AddOfflineParticipantDialogProps) {
  const { webApp } = useTelegram();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webApp?.initData || !name.trim()) return;

    setIsLoading(true);
    const result = await addOfflineParticipant(webApp.initData, gameId, name.trim());
    
    if (result.success) {
      toast.success('Участник добавлен');
      setName('');
      setIsOpen(false);
      onSuccess?.();
      router.refresh();
    } else {
      toast.error(result.error || 'Не удалось добавить участника');
    }
    setIsLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <UserPlus className="mr-2 h-4 w-4" />
          Добавить оффлайн-участника
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Добавить оффлайн-участника</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Имя</Label>
            <Input
              id="name"
              placeholder="например: Бабушка"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading || !name.trim()}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Добавить участника
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
