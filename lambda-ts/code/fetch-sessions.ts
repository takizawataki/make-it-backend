import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent } from 'aws-lambda';
import {
  SessionTableItem,
  UserTableItem,
} from '@/lambda-ts/types/dynamodb-types';
import { SessionResponse } from '@/lambda-ts/types/generated/models/SessionResponse';
import { SessionResponseSessionsInner } from '@/lambda-ts/types/generated/models/SessionResponseSessionsInner';

const dynamodbClient = new DynamoDBClient({
  region: 'ap-northeast-1',
});

const dynamodbDocClient = DynamoDBDocument.from(dynamodbClient);

const userTableName = process.env.USER_TABLE_NAME || '';
const sessionTableName = process.env.SESSION_TABLE_NAME || '';

const fetchUser = async (userId: string) => {
  const response = await dynamodbDocClient.get({
    TableName: userTableName,
    Key: { UserId: userId },
  });

  return response.Item as UserTableItem;
};

const fetchSession = async (sessionId: string) => {
  const response = await dynamodbDocClient.get({
    TableName: sessionTableName,
    Key: { SessionId: sessionId },
  });

  return response.Item as SessionTableItem;
};

export const handler = async (event: APIGatewayProxyEvent) => {
  try {
    console.log('event:', event);

    const userId = event.queryStringParameters?.userId;

    if (!userId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'userId is required' }),
      };
    }
    const sessions: SessionResponse['sessions'] = [];
    const escalatedSessions: SessionResponse['escalatedSessions'] = [];

    const user = await fetchUser(userId);

    const fetchSessions = async () => {
      if (user.SessionIds) {
        const parsedSessionIds = [...user.SessionIds];
        const sessionPromises = parsedSessionIds.map(async (sessionId) => {
          console.log('sessionId:', sessionId);
          const res = await fetchSession(sessionId);
          const parsedRes: SessionResponseSessionsInner = {
            sessionId: res.SessionId,
            sessionTitle: res.SessionTitle ?? 'タイトルなし',
            isEscalated: res.IsEscalated ?? false,
            createdAt: res.CreatedAt ?? '2024-09-01T08:06:43.753Z',
            updatedAt: res.UpdatedAt ?? '2024-09-01T08:06:43.753Z',
          };
          sessions.push(parsedRes);
        });
        await Promise.all(sessionPromises);
      }
    };

    const fetchEscalatedSessions = async () => {
      if (user.EscalatedSessionIds) {
        const parsedEscalatedSessionIds = [...user.EscalatedSessionIds];
        const escalatedSessionPromises = parsedEscalatedSessionIds.map(
          async (sessionId) => {
            console.log('sessionId:', sessionId);
            const res = await fetchSession(sessionId);
            const parsedRes: SessionResponseSessionsInner = {
              sessionId: res.SessionId,
              sessionTitle: res.SessionTitle ?? 'タイトルなし',
              isEscalated: res.IsEscalated ?? true,
              createdAt: res.CreatedAt ?? '2024-09-01T08:06:43.753Z',
              updatedAt: res.UpdatedAt ?? '2024-09-01T08:06:43.753Z',
            };
            escalatedSessions.push(parsedRes);
          },
        );
        await Promise.all(escalatedSessionPromises);
      }
    };

    await Promise.all([fetchSessions(), fetchEscalatedSessions()]);

    const responseBody: SessionResponse = { sessions, escalatedSessions };
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
