import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { UserTableItem } from '@/lambda-ts/types/dynamodb-types';
import { UserUpdateRequest } from '@/lambda-ts/types/generated/models/UserUpdateRequest';
import { UserUpdateResponse } from '@/lambda-ts/types/generated/models/UserUpdateResponse';

const dynamodbClient = new DynamoDBClient({
  region: 'ap-northeast-1',
});

const dynamodbDocClient = DynamoDBDocument.from(dynamodbClient);
const tableName = process.env.USER_TABLE_NAME || '';

/**
 * ユーザーデータの表示名を更新する
 * @param ユーザーID
 * @param 表示名
 * @returns 更新後のユーザーデータ
 */
const updateUserDisplayName = async (userId: string, displayName: string) => {
  // DynamoDBのテーブル名が設定されていない場合のエラーチェック
  if (!tableName) {
    throw new Error('DynamoDB table name is not configured.');
  }

  // DynamoDBに対してデータの更新を行う
  const response = await dynamodbDocClient.update({
    TableName: tableName,
    Key: { UserId: userId },
    UpdateExpression: 'SET DisplayName = :displayName',
    ExpressionAttributeValues: {
      ':displayName': displayName,
    },
    ReturnValues: 'ALL_NEW', // 更新後の全データを取得
  });

  console.log('DynamoDB Update Response:', response.Attributes);

  // 更新された属性をUserTableItem型として返す
  return response.Attributes as UserTableItem;
};

export const handler = async (event: APIGatewayProxyEvent) => {
  try {
    console.log('event:', event);

    // パスパラメータから userId を取得
    const userId = event.pathParameters?.userId;

    // userIdが存在しない場合、400エラーを返す
    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'userId is required' }),
      };
    }

    // テーブル名が空の場合、500エラーを返す
    if (!tableName) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: 'DynamoDB table name is not configured',
        }),
      };
    }

    // ボディから displayName を取得
    const body = JSON.parse(event.body || '{}') as UserUpdateRequest;
    const { displayName } = body;

    // displayNameが存在しない場合、400エラーを返す
    if (!displayName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'displayName is required' }),
      };
    }

    // displayNameを更新
    const updatedUser = await updateUserDisplayName(userId, displayName);

    // DynamoDBの応答が期待通りの構造であることを確認しながらレスポンスを作成
    const sessionIds = updatedUser.SessionIds
      ? [...updatedUser.SessionIds]
      : undefined;
    const escalatedSessionIds = updatedUser.EscalatedSessionIds
      ? [...updatedUser.EscalatedSessionIds]
      : undefined;

    const parsedUser: UserUpdateResponse = {
      userId: updatedUser.UserId,
      email: updatedUser.Email,
      displayName: updatedUser.DisplayName,
      sessionIds,
      escalatedSessionIds,
      inviter: updatedUser.Inviter,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(parsedUser),
    };
  } catch (error) {
    console.error('Error updating user:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Failed to update user',
        error: error,
      }),
    };
  }
};
