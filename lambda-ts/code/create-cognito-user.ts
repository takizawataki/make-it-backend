import * as crypto from 'crypto';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { SQSRecord } from 'aws-lambda';
import { CreateCognitoUserRequest } from '@/lambda-ts/types/generated/models/CreateCognitoUserRequest';

const client = new CognitoIdentityProviderClient({ region: 'ap-northeast-1' });

const generatePassword = () => {
  // 小文字をランダムに 3 つ選択して配列に追加
  const lowercase = Array.from(crypto.randomFillSync(new Uint8Array(3)))
    .map((n) => String.fromCharCode(97 + (n % 26))) // 'a' (97) から 'z' までの文字を選ぶ
    .join('');

  // 大文字をランダムに 3 つ選択して配列に追加
  const uppercase = Array.from(crypto.randomFillSync(new Uint8Array(3)))
    .map((n) => String.fromCharCode(65 + (n % 26))) // 'A' (65) から 'Z' までの文字を選ぶ
    .join('');

  // 数字をランダムに 3 つ選択して配列に追加
  const digits = Array.from(crypto.randomFillSync(new Uint8Array(3)))
    .map((n) => (n % 10).toString()) // 0〜9 の数字を選ぶ
    .join('');

  // 記号をランダムに 2 つ選択して配列に追加
  const symbols = "!@#$%^&*()_+-=[]{}|'".split('');
  const randomSymbols = Array.from(crypto.randomFillSync(new Uint8Array(2)))
    .map((n) => symbols[n % symbols.length])
    .join('');

  // 文字列を結合してシャッフル
  const passwordArray = (lowercase + uppercase + digits + randomSymbols).split(
    '',
  );
  return passwordArray.sort(() => 0.5 - Math.random()).join('');
};

export const handler = async (event: { Records: SQSRecord[] }) => {
  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body) as CreateCognitoUserRequest;
      const { email, inviter } = body;

      const input = {
        ClientId: process.env.COGNITO_USER_POOL_CLIENT_ID || '',
        Username: email,
        Password: generatePassword(),
        UserAttributes: [
          {
            Name: 'custom:inviter',
            Value: inviter,
          },
        ],
      };
      const command = new SignUpCommand(input);
      await client.send(command);
      console.log(`Successfully created cognito user for ${email}`);
    } catch (error) {
      console.error(`Failed to create cognito user: ${error}`);
    }
  }
};
