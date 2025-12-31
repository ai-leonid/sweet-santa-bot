'use server'

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from './auth';
import { Exclusion } from '@/app/generated/prisma/client';

export type AddExclusionResult = {
  success: boolean;
  exclusion?: Exclusion;
  mutualExclusion?: Exclusion; // If mutual was requested
  error?: string;
};

export async function addExclusion(
  initData: string, 
  gameId: string, 
  whoId: string, 
  whomId: string, 
  mutual: boolean = false
): Promise<AddExclusionResult> {
  const auth = await getCurrentUser(initData);
  if (!auth.success || !auth.user) {
    return { success: false, error: 'Unauthorized' };
  }

  if (whoId === whomId) {
      return { success: false, error: 'Cannot exclude yourself' };
  }

  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: { participants: true }
    });

    if (!game) {
      return { success: false, error: 'Game not found' };
    }

    if (game.status !== 'DRAFT') {
        return { success: false, error: 'Game already started' };
    }

    // Verify participants exist in this game
    const who = game.participants.find(p => p.id === whoId);
    const whom = game.participants.find(p => p.id === whomId);

    if (!who || !whom) {
        return { success: false, error: 'Participants not found in this game' };
    }

    // Permission check:
    // User can add exclusion for themselves (who.userId === auth.user.id)
    // Creator can add exclusion for anyone (game.creatorId === auth.user.id)
    const isCreator = game.creatorId === auth.user.id;
    const isSelf = who.userId === auth.user.id;

    if (!isCreator && !isSelf) {
        return { success: false, error: 'Permission denied' };
    }

    // Check if exclusion already exists
    const existing = await prisma.exclusion.findFirst({
        where: {
            gameId,
            whoId,
            whomId
        }
    });

    if (existing) {
        return { success: false, error: 'Exclusion already exists' };
    }

    // Create exclusion
    const exclusion = await prisma.exclusion.create({
      data: {
        gameId,
        whoId,
        whomId
      }
    });

    let mutualExclusion: Exclusion | undefined;

    if (mutual) {
        // Check if reverse exists
        const reverseExisting = await prisma.exclusion.findFirst({
            where: {
                gameId,
                whoId: whomId,
                whomId: whoId
            }
        });

        if (!reverseExisting) {
            mutualExclusion = await prisma.exclusion.create({
                data: {
                    gameId,
                    whoId: whomId,
                    whomId: whoId
                }
            });
        }
    }

    return { success: true, exclusion, mutualExclusion };
  } catch (error) {
    console.error('Add exclusion error:', error);
    return { success: false, error: 'Failed to add exclusion' };
  }
}

export type RemoveExclusionResult = {
  success: boolean;
  error?: string;
};

export async function removeExclusion(initData: string, exclusionId: string): Promise<RemoveExclusionResult> {
    const auth = await getCurrentUser(initData);
    if (!auth.success || !auth.user) {
      return { success: false, error: 'Unauthorized' };
    }
  
    try {
      const exclusion = await prisma.exclusion.findUnique({
        where: { id: exclusionId },
        include: { game: true, who: true }
      });
  
      if (!exclusion) {
        return { success: false, error: 'Exclusion not found' };
      }

      if (exclusion.game.status !== 'DRAFT') {
        return { success: false, error: 'Game already started' };
    }
  
      const isCreator = exclusion.game.creatorId === auth.user.id;
      const isSelf = exclusion.who.userId === auth.user.id;
  
      if (!isCreator && !isSelf) {
          return { success: false, error: 'Permission denied' };
      }
  
      await prisma.exclusion.delete({
        where: { id: exclusionId }
      });
  
      return { success: true };
    } catch (error) {
      console.error('Remove exclusion error:', error);
      return { success: false, error: 'Failed to remove exclusion' };
    }
}

export type GetExclusionsResult = {
  success: boolean;
  exclusions?: (Exclusion & { whom: { name: string } })[];
  error?: string;
};

export async function getExclusions(initData: string, gameId: string, participantId: string): Promise<GetExclusionsResult> {
    const auth = await getCurrentUser(initData);
    if (!auth.success || !auth.user) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        const game = await prisma.game.findUnique({ where: { id: gameId } });
        if (!game) return { success: false, error: 'Game not found' };

        // Permission check: Creator or Self
        // We need to know if participantId belongs to auth.user
        const participant = await prisma.participant.findUnique({ where: { id: participantId } });
        if (!participant) return { success: false, error: 'Participant not found' };

        const isCreator = game.creatorId === auth.user.id;
        const isSelf = participant.userId === auth.user.id;

        if (!isCreator && !isSelf) {
            return { success: false, error: 'Permission denied' };
        }

        const exclusions = await prisma.exclusion.findMany({
            where: {
                gameId,
                whoId: participantId
            },
            include: {
                whom: {
                    select: { name: true }
                }
            }
        });

        return { success: true, exclusions };

    } catch (error) {
        console.error('Get exclusions error:', error);
        return { success: false, error: 'Failed to fetch exclusions' };
    }
}
