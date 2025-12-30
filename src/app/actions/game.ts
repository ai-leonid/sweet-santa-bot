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

export type AddOfflinePlayerResult = {
  success: boolean;
  participant?: Participant;
  error?: string;
};

export async function addOfflinePlayer(initData: string, gameId: string, name: string): Promise<AddOfflinePlayerResult> {
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
        return { success: false, error: 'Only creator can add offline players' };
    }

    if (game.status !== 'DRAFT') {
        return { success: false, error: 'Game already started' };
    }

    const participant = await prisma.participant.create({
      data: {
        gameId: game.id,
        name,
        isOffline: true
      }
    });

    return { success: true, participant };
  } catch (error) {
    console.error('Add offline player error:', error);
    return { success: false, error: 'Failed to add player' };
  }
}

export type GameDetailsResult = {
  success: boolean;
  game?: Game & { 
    participants: Participant[], 
    exclusions: any[] // We will type this properly later or let inference work
  };
  isCreator?: boolean;
  currentParticipant?: Participant;
  error?: string;
};

export async function getGameDetails(initData: string, gameId: string): Promise<GameDetailsResult> {
    const auth = await getCurrentUser(initData);
    if (!auth.success || !auth.user) {
      return { success: false, error: 'Unauthorized' };
    }
  
    try {
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: {
            participants: {
                include: {
                    user: true // maybe needed to show avatars
                }
            },
            exclusions: true
        }
      });
  
      if (!game) {
        return { success: false, error: 'Game not found' };
      }

      const isCreator = game.creatorId === auth.user.id;
      const currentParticipant = game.participants.find(p => p.userId === auth.user!.id);

      // If not creator and not participant, maybe shouldn't see details? 
      // Or maybe this is how they see "Join" screen?
      // Assuming this is for inside the game lobby.

      if (!isCreator && !currentParticipant) {
          // If accessing via link but not joined yet, we might return limited info?
          // For now, let's allow seeing basic info but maybe frontend handles the "Join" button.
          // But typically "getGameDetails" implies authorized access to full game data.
          // Let's return what we have.
      }
  
      return { success: true, game, isCreator, currentParticipant };
    } catch (error) {
      console.error('Get game details error:', error);
      return { success: false, error: 'Failed to fetch game details' };
    }
}
