import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';

// 現状、Secrets Manager にはシークレットを取得する処理しか必要ないためクラス化していない

/**
 * Secrets Managerからシークレットを取得する
 *
 * @param secretName シークレット名
 * @returns シークレット
 */
export const getSecretValue = async <T>(secretName: string) => {
  const client = new SecretsManagerClient();
  const response = await client.send(
    new GetSecretValueCommand({
      SecretId: secretName,
    }),
  );
  if (response.SecretString === undefined) {
    throw new Error('SecretString is undefined');
  }
  const parsedSecrets = JSON.parse(response.SecretString);
  return parsedSecrets as T;
};
