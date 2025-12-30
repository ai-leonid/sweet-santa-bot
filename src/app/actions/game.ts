'use server'

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from './auth';
import { Game, Participant, GameStatus } from '@prisma/client';
import { randomBytes } from 'crypto';

// Helper to generate a unique short invite code
function generateInviteCode(): string {
  return randomBytes(4).toString('hex').toUpperCase(); // 8 characters
}

export type CreateGameResult = {
  success: boolean;
  game?: Game;
  error?: string;
};

export async function createGame(initData: string, title: string): Promise<CreateGameResult> {
  const auth = await getCurrentUser(initData);
  if (!auth.success || !auth.user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const inviteCode = generateInviteCode();
    
    // Create game and add creator as participant automatically? 
    // Usually yes, the creator is also a participant.
    
    const game = await prisma.game.create({
      data: {
        title,
        creatorId: auth.user.id,
        inviteCode,
        status: 'DRAFT',
        participants: {
            create: {
                userId: auth.user.id,
                name: auth.user.firstName || auth.user.username || 'Anonymous', // Use real name
                isOffline: false
            }
        }
      },
    });

    return { success: true, game };
  } catch (error) {
    console.error('Create game error:', error);
    return { success: false, error: 'Failed to create game' };
  }
}

export type GetGamesResult = {
  success: boolean;
  games?: (Game & { _count: { participants: number } })[];
  error?: string;
};

export async function getUserGames(initData: string): Promise<GetGamesResult> {
  const auth = await getCurrentUser(initData);
  if (!auth.success || !auth.user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const games = await prisma.game.findMany({
      where: {
        participants: {
          some: {
            userId: auth.user.id
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        _count: {
          select: { participants: true }
        }
      }
    });

    return { success: true, games };
  } catch (error) {
    console.error('Get games error:', error);
    return { success: false, error: 'Failed to fetch games' };
  }
}

export type JoinGameResult = {
  success: boolean;
  game?: Game;
  participant?: Participant;
  error?: string;
};

export async function joinGame(initData: string, inviteCode: string): Promise<JoinGameResult> {
  const auth = await getCurrentUser(initData);
  if (!auth.success || !auth.user) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const game = await prisma.game.findUnique({
      where: { inviteCode },
      include: { participants: true }
    });

    if (!game) {
      return { success: false, error: 'Game not found' };
    }

    if (game.status !== 'DRAFT') {
        return { success: false, error: 'Game already started or completed' };
    }

    // Check if already joined
    const existingParticipant = game.participants.find(p => p.userId === auth.user!.id);
    if (existingParticipant) {
      return { success: true, game, participant: existingParticipant }; // Already joined, treat as success
    }

    const participant = await prisma.participant.create({
      data: {
        gameId: game.id,
        userId: auth.user.id,
        name: auth.user.firstName || auth.user.username || 'Player',
        isOffline: false
      }
    });

    return { success: true, game, participant };
  } catch (error) {
    console.error('Join game error:', error);
    return { success: false, error: 'Failed to join game' };
  }
}

export type GetGameDetailsResult = {
  success: boolean;
  game?: Game & { participants: Participant[] };
  error?: string;
  isCreator?: boolean;
};

export async function getGameDetails(initData: string, gameId: string): Promise<GetGameDetailsResult> {
    const auth = await getCurrentUser(initData);
    if (!auth.success || !auth.user) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        const game = await prisma.game.findUnique({
            where: { id: gameId },
            include: {
                participants: {
                    orderBy: {
                        name: 'asc'
                    }
                }
            }
        });

        if (!game) {
            return { success: false, error: 'Game not found' };
        }

        // Check if user is participant
        const isParticipant = game.participants.some(p => p.userId === auth.user!.id);
        if (!isParticipant) {
            return { success: false, error: 'You are not a participant of this game' };
        }

        return { 
            success: true, 
            game, 
            isCreator: game.creatorId === auth.user.id 
        };
    } catch (error) {
        console.error('Get game details error:', error);
        return { success: false, error: 'Failed to fetch game details' };
    }
}

export async function addOfflineParticipant(initData: string, gameId: string, name: string) {
    const auth = await getCurrentUser(initData);
    if (!auth.success || !auth.user) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        const game = await prisma.game.findUnique({
            where: { id: gameId },
        });

        if (!game) {
            return { success: false, error: 'Game not found' };
        }

        if (game.creatorId !== auth.user.id) {
            return { success: false, error: 'Only creator can add offline participants' };
        }

        if (game.status !== 'DRAFT') {
            return { success: false, error: 'Game already started' };
        }

        const participant = await prisma.participant.create({
            data: {
                gameId,
                name,
                isOffline: true,
                // userId is null for offline participants
            }
        });

        return { success: true, participant };
    } catch (error) {
         console.error('Add offline participant error:', error);
         return { success: false, error: 'Failed to add participant' };
    }
}
