'use server'

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from './auth';
import { GameStatus } from '@/app/generated/prisma/client';

export type DrawResult = {
  success: boolean;
  error?: string;
};

// Helper to shuffle array (Fisher-Yates)
function shuffle<T>(array: T[]): T[] {
  let currentIndex = array.length,  randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex > 0) {

    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}

export async function runDraw(initData: string, gameId: string): Promise<DrawResult> {
  const auth = await getCurrentUser(initData);
  if (!auth.success || !auth.user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: { 
        participants: true,
        exclusions: true
      }
    });

    if (!game) {
      return { success: false, error: 'Game not found' };
    }

    if (game.creatorId !== auth.user.id) {
        return { success: false, error: 'Only creator can start the draw' };
    }

    if (game.status !== 'DRAFT') {
        return { success: false, error: 'Game is not in DRAFT status' };
    }

    const participants = game.participants;
    const exclusions = game.exclusions;

    if (participants.length < 3) {
        return { success: false, error: 'Need at least 3 participants to play' };
    }

    // Map exclusion lookups for O(1) access
    // key: whoId, value: Set<whomId>
    const exclusionMap = new Map<string, Set<string>>();
    exclusions.forEach(ex => {
        if (!exclusionMap.has(ex.whoId)) {
            exclusionMap.set(ex.whoId, new Set());
        }
        exclusionMap.get(ex.whoId)!.add(ex.whomId);
    });

    // Attempt to find a valid Hamiltonian cycle by random shuffling
    const MAX_RETRIES = 5000;
    let success = false;
    let resultChain: typeof participants = [];

    for (let i = 0; i < MAX_RETRIES; i++) {
        const shuffled = shuffle([...participants]);
        let valid = true;

        for (let j = 0; j < shuffled.length; j++) {
            const giver = shuffled[j];
            const receiver = shuffled[(j + 1) % shuffled.length]; // Cycle: last gives to first

            // Check exclusions
            if (exclusionMap.has(giver.id) && exclusionMap.get(giver.id)!.has(receiver.id)) {
                valid = false;
                break;
            }
            
            // Self-give check (impossible in cycle of length > 1, but good sanity check)
            if (giver.id === receiver.id) {
                valid = false;
                break;
            }
        }

        if (valid) {
            success = true;
            resultChain = shuffled;
            break;
        }
    }

    if (!success) {
        return { success: false, error: 'Could not find a valid assignment matching all exclusions. Try removing some restrictions.' };
    }

    // Save results in a transaction
    try {
        await prisma.$transaction(async (tx) => {
            for (let j = 0; j < resultChain.length; j++) {
                const giver = resultChain[j];
                const receiver = resultChain[(j + 1) % resultChain.length];
                
                await tx.participant.update({
                    where: { id: giver.id },
                    data: { receiverId: receiver.id }
                });
            }
            
            await tx.game.update({
                where: { id: gameId },
                data: { status: 'COMPLETED' }
            });
        });

        return { success: true };
    } catch (e) {
        console.error('Transaction failed', e);
        return { success: false, error: 'Failed to save results' };
    }
  } catch (error) {
    console.error('Draw error:', error);
    return { success: false, error: 'Failed to run draw' };
  }
}

export type GetResultResponse = {
  success: boolean;
  receiver?: { name: string };
  error?: string;
};

export async function getParticipantResult(initData: string, gameId: string, participantId: string): Promise<GetResultResponse> {
    const auth = await getCurrentUser(initData);
    if (!auth.success || !auth.user) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        const game = await prisma.game.findUnique({ where: { id: gameId } });
        if (!game) return { success: false, error: 'Game not found' };

        if (game.status !== 'COMPLETED') {
             return { success: false, error: 'Game not completed yet' };
        }

        const participant = await prisma.participant.findUnique({ 
            where: { id: participantId },
            include: { receiver: true }
        });

        if (!participant) return { success: false, error: 'Participant not found' };

        // Permission check
        const isCreator = game.creatorId === auth.user.id;
        const isSelf = participant.userId === auth.user.id;
        // Offline players results can be seen by creator
        const isOffline = participant.isOffline;

        if (isSelf) {
            // OK
        } else if (isCreator && isOffline) {
            // OK
        } else {
            return { success: false, error: 'Permission denied' };
        }

        if (!participant.receiver) {
             return { success: false, error: 'No giftee assigned (Error)' };
        }

        return { success: true, receiver: { name: participant.receiver.name } };

    } catch (error) {
        console.error('Get result error:', error);
        return { success: false, error: 'Failed to fetch result' };
    }
}
