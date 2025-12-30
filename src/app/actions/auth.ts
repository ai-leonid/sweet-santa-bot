'use server'

import { prisma } from '@/lib/prisma';
import { validateTelegramWebAppData } from '@/lib/telegram-auth';
import { User } from '@prisma/client';

export type AuthResult = {
  success: boolean;
  user?: User;
  error?: string;
};

export async function getCurrentUser(initData: string): Promise<AuthResult> {
  try {
    const validatedData = validateTelegramWebAppData(initData);

    if (!validatedData) {
      return { success: false, error: 'Invalid Telegram data' };
    }

    const { user: telegramUser } = validatedData;
    const telegramId = telegramUser.id.toString();

    let user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          telegramId,
          username: telegramUser.username,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name,
        },
      });
    } else {
        // Update user info if changed
        if (
            user.username !== telegramUser.username || 
            user.firstName !== telegramUser.first_name || 
            user.lastName !== telegramUser.last_name
        ) {
            user = await prisma.user.update({
                where: { id: user.id },
                data: {
                    username: telegramUser.username,
                    firstName: telegramUser.first_name,
                    lastName: telegramUser.last_name,
                }
            });
        }
    }

    return { success: true, user };
  } catch (error) {
    console.error('Auth error:', error);
    return { success: false, error: 'Internal server error' };
  }
}
