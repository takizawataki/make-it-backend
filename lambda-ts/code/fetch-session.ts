import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';
import { SessionTableItem } from '@/lambda-ts/types/dynamodb-types';
import { SessionSessionResponse } from '@/lambda-ts/types/generated/models/SessionSessionResponse';

const dynamodbClient = new DynamoDBClient({
  region: 'ap-northeast-1',
});

const dynamodbDocClient = DynamoDBDocument.from(dynamodbClient);

const sessionTableName = process.env.SESSION_TABLE_NAME || '';

type OriginalFormat = {
  type: 'human' | 'ai';
  text: string;
};

const fetchSession = async (sessionId: string) => {
  const response = await dynamodbDocClient.get({
    TableName: sessionTableName,
    Key: { SessionId: sessionId },
  });

  console.log('response:', response.Item);
  return response.Item as SessionTableItem;
};

const convertHistory = (history: OriginalFormat[]) => {
  return history.map((item) => ({
    role: item.type,
    message: item.text,
  }));
};

export const handler = async (event: APIGatewayProxyEvent) => {
  try {
    console.log('event:', event);

    const sessionId = event.pathParameters?.sessionId;

    if (!sessionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'sessionId is required' }),
      };
    }
    const session = await fetchSession(sessionId);

    const responseBody: SessionSessionResponse = {
      sessionId: session.SessionId,
      sessionTitle: session.SessionTitle ?? 'タイトル未生成',
      sessionHistory: convertHistory(session.History as OriginalFormat[]),
      isEscalated: session.IsEscalated ?? false,
      createdAt: session.CreatedAt ?? '2024-09-01T08:06:43.753Z',
      updatedAt: session.UpdatedAt ?? '2024-09-01T08:06:43.753Z',
    };

    return {
      statusCode: 200,
      body: JSON.stringify(responseBody),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify(error),
    };
  }
};
