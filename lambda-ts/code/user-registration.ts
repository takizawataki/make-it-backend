import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { PostConfirmationConfirmSignUpTriggerEvent } from 'aws-lambda';

const client = new DynamoDBClient({
  region: 'ap-northeast-1',
});
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Lambda の環境変数から受け取ったテーブル名が、存在するかチェックする
 * @param tableName - チェックするテーブル名
 * @throws エラーメッセージをスローする
 * @return void - テーブル名が正しければ何も返さない
 */
const validateTableName = (tableName: string | undefined): void => {
  if (!tableName || tableName.trim() === '') {
    throw new Error(
      'TableName is undefined or empty. Please check the environment variable USER_TABLE_NAME.',
    );
  }
};

export const handler = async (
  event: PostConfirmationConfirmSignUpTriggerEvent,
) => {
  const tableName = process.env.USER_TABLE_NAME;

  validateTableName(tableName);

  const params = {
    TableName: tableName,
    Item: {
      UserId: event.request.userAttributes.sub,
      Email: event.request.userAttributes.email,
      Inviter: event.request.userAttributes['custom:inviter'],
    },
  };

  try {
    const command = new PutCommand(params);
    const result = await docClient.send(command);

    console.log(
      `cognito user link to dynamodb id=${event.request.userAttributes.sub} email=${event.request.userAttributes.email} result=${result}`,
    );

    return event;
  } catch (error) {
    console.error('DynamoDB putItem failed:', error);
    throw error;
  }
};
