import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { UserTableItem } from '@/lambda-ts/types/dynamodb-types';
import { UserUserResponse } from '@/lambda-ts/types/generated/models/UserUserResponse';

const dynamodbClient = new DynamoDBClient({
  region: 'ap-northeast-1',
});

const dynamodbDocClient = DynamoDBDocument.from(dynamodbClient);

const tableName = process.env.USER_TABLE_NAME || '';

const fetchUser = async (userId: string) => {
  const response = await dynamodbDocClient.get({
    TableName: tableName,
    Key: { UserId: userId },
  });

  return response.Item as UserTableItem;
};

export const handler = async (event: APIGatewayProxyEvent) => {
  try {
    console.log('event:', event);
    const userId = event.pathParameters?.userId;

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'userId is required' }),
      };
    }

    const user = await fetchUser(userId);

    const sessionIds = user.SessionIds ? [...user.SessionIds] : undefined;
    const escalatedSessionIds = user.EscalatedSessionIds
      ? [...user.EscalatedSessionIds]
      : undefined;

    const parsedUser: UserUserResponse = {
      userId: user.UserId,
      email: user.Email,
      displayName: user.DisplayName,
      sessionIds,
      escalatedSessionIds,
      inviter: user.Inviter,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(parsedUser),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify(error),
    };
  }
};
