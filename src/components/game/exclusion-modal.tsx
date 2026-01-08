'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Participant, Exclusion } from '@/app/generated/prisma/client';
import { addExclusion, removeExclusion, getExclusions } from '@/app/actions/exclusion';
import { useTelegram } from '@/components/providers/telegram-provider';
import { toast } from 'sonner';
import { Trash2, Loader2, Plus, Ban } from 'lucide-react';

interface ExclusionModalProps {
  gameId: string;
  participant: Participant;
  allParticipants: Participant[];
  trigger?: React.ReactNode;
}

export function ExclusionModal({ gameId, participant, allParticipants, trigger }: ExclusionModalProps) {
  const { webApp } = useTelegram();
  const [isOpen, setIsOpen] = useState(false);
  const [exclusions, setExclusions] = useState<(Exclusion & { whom: { name: string } })[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string>('');
  const [isMutual, setIsMutual] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  function loadExclusions() {
    if (!webApp?.initData) return;
    setIsLoading(true);
    getExclusions(webApp.initData, gameId, participant.id).then((result) => {
      if (result.success && result.exclusions) {
        setExclusions(result.exclusions);
      }
      setIsLoading(false);
    });
  }

  useEffect(() => {}, []);

  const handleAdd = async () => {
    if (!webApp?.initData || !selectedParticipantId) return;
    
    setIsAdding(true);
    const result = await addExclusion(
      webApp.initData, 
      gameId, 
      participant.id, 
      selectedParticipantId, 
      isMutual
    );
    
    if (result.success) {
      toast.success('Исключение добавлено');
      setSelectedParticipantId('');
      setIsMutual(false);
      loadExclusions();
    } else {
      toast.error(result.error || 'Не удалось добавить исключение');
    }
    setIsAdding(false);
  };

  const handleRemove = async (id: string) => {
    if (!webApp?.initData) return;
    
    // Optimistic update
    setExclusions(prev => prev.filter(e => e.id !== id));
    
    const result = await removeExclusion(webApp.initData, id);
    if (!result.success) {
      toast.error(result.error || 'Не удалось удалить исключение');
      loadExclusions(); // Revert
    }
  };

  // Filter out self and already excluded
  const availableParticipants = allParticipants.filter(p => 
    p.id !== participant.id && 
    !exclusions.some(e => e.whomId === p.id)
  );

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (open && webApp?.initData) {
          loadExclusions();
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger || <Button variant="outline" size="sm"><Ban className="h-4 w-4" /></Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Стоп-лист для {participant.name}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
            <div className="space-y-2">
                <Label>Кому {participant.name} не должен дарить?</Label>
                <div className="flex gap-2">
                    <Select value={selectedParticipantId} onValueChange={setSelectedParticipantId}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Выберите участника" />
                        </SelectTrigger>
                        <SelectContent>
                            {availableParticipants.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={handleAdd} disabled={isAdding || !selectedParticipantId}>
                        {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    </Button>
                </div>
                <div className="flex items-center space-x-2 pt-2">
                    <Checkbox id="mutual" checked={isMutual} onCheckedChange={(c) => setIsMutual(!!c)} />
                    <Label htmlFor="mutual">Взаимное исключение (запретить дарить друг другу)</Label>
                </div>
            </div>

            <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-2">Текущие исключения</h4>
                {isLoading ? (
                    <div className="flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
                ) : exclusions.length > 0 ? (
                    <ul className="space-y-2">
                        {exclusions.map(ex => (
                            <li key={ex.id} className="flex items-center justify-between bg-muted p-2 rounded-md text-sm">
                                <span>Не может дарить: <strong>{ex.whom.name}</strong></span>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleRemove(ex.id)}>
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-sm text-muted-foreground">Стоп-лист пуст.</p>
                )}
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
