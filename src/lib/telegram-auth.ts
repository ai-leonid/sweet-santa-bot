import crypto from 'crypto';

interface UserData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

interface ValidatedData {
  user: UserData;
  auth_date: number;
  query_id?: string;
  hash: string;
  [key: string]: any;
}

export function validateTelegramWebAppData(initData: string): ValidatedData | null {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN is not set');
    return null;
  }

  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get('hash');
  
  if (!hash) {
    return null;
  }

  urlParams.delete('hash');

  const params: string[] = [];
  for (const [key, value] of urlParams.entries()) {
    params.push(`${key}=${value}`);
  }

  params.sort();

  const dataCheckString = params.join('\n');
  
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(process.env.TELEGRAM_BOT_TOKEN)
    .digest();

  const calculatedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  if (calculatedHash === hash) {
    const userStr = urlParams.get('user');
    const authDateStr = urlParams.get('auth_date');
    
    if (!userStr || !authDateStr) return null;

    try {
        const user = JSON.parse(userStr);
        return {
            ...Object.fromEntries(urlParams.entries()),
            user,
            auth_date: parseInt(authDateStr, 10),
            hash
        };
    } catch (e) {
        console.error('Error parsing user data', e);
        return null;
    }
  }

  return null;
}
