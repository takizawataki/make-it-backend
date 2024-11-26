import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  SESv2Client,
  SendEmailCommand,
  SendEmailCommandInput,
} from '@aws-sdk/client-sesv2';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { SQSRecord } from 'aws-lambda';
import {
  SessionTableItem,
  UserTableItem,
} from '@/lambda-ts/types/dynamodb-types';
import { SendSummaryRequest } from '@/lambda-ts/types/generated/models/SendSummaryRequest';

type SessionItem = Pick<SessionTableItem, 'SessionSummary'>;

type Inviter = Pick<UserTableItem, 'Inviter'>;
type Email = Pick<UserTableItem, 'Email'>;

const dynamodbClient = new DynamoDBClient({ region: 'ap-northeast-1' });
const dynamodbDocClient = DynamoDBDocument.from(dynamodbClient);

const SESSION_TABLE_NAME = process.env.SESSION_TABLE_NAME || '';
const USER_TABLE_NAME = process.env.USER_TABLE_NAME || '';

const sesClient = new SESv2Client({ region: 'ap-northeast-1' });

/**
 * SQSメッセージからメールを送信する処理を実行
 */
export const handler = async (event: { Records: SQSRecord[] }) => {
  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body) as SendSummaryRequest;
      const { sessionId, fromUserId, fromUserEmail, toUserId } = body;

      const inviterId = await fetchToUserId(fromUserId, toUserId);

      const [toUserEmail, sessionSummary] = await Promise.all([
        fetchUserEmail(inviterId),
        fetchSessionSummary(sessionId),
      ]);

      if (!sessionSummary) {
        console.error('Session summary not found');
        continue;
      }

      await sendEmail(fromUserEmail, toUserEmail, sessionSummary);

      await Promise.all([
        setIsEscalated(sessionId),
        setEscalatedSessionId(inviterId, sessionId),
      ]);
    } catch (error) {
      console.error('Error processing SQS message:', error);
    }
  }
};

/**
 * UserId から Email を取得する
 *
 * @param userId User ID
 * @returns User email
 */
const fetchUserEmail = async (userId: string) => {
  const fetchUserResponse = await dynamodbDocClient.get({
    TableName: USER_TABLE_NAME,
    Key: {
      UserId: userId,
    },
    ProjectionExpression: 'Email',
  });
  console.log('fetchUserResponse:', fetchUserResponse);

  if (!fetchUserResponse.Item) {
    throw new Error('User not found');
  }

  const item = fetchUserResponse.Item as Email;
  return item.Email;
};

/**
 * 送信先ユーザーIDを取得
 */
const fetchToUserId = async (fromUserId: string, toUserId?: string) => {
  if (toUserId) return toUserId;

  const fetchInviterIdResponse = await dynamodbDocClient.get({
    TableName: USER_TABLE_NAME,
    Key: {
      UserId: fromUserId,
    },
    ProjectionExpression: 'Inviter',
  });

  if (!fetchInviterIdResponse.Item) {
    throw new Error('User not found');
  }

  const toUserItem = fetchInviterIdResponse.Item as Inviter;

  if (!toUserItem.Inviter) {
    throw new Error('Inviter not found');
  }

  return toUserItem.Inviter;
};

/**
 * セッションのサマリーを取得する
 *
 * @param sessionId セッション ID
 * @returns セッションのサマリー
 */
const fetchSessionSummary = async (sessionId: string) => {
  const sessionResponse = await dynamodbDocClient.get({
    TableName: SESSION_TABLE_NAME,
    Key: {
      SessionId: sessionId,
    },
    ProjectionExpression: 'SessionSummary',
  });

  if (!sessionResponse.Item) {
    throw new Error('Session not found');
  }

  const sessionItem = sessionResponse.Item as SessionItem;
  return sessionItem.SessionSummary;
};

/**
 * メールを送信する
 *
 * @param fromAddress 送信元のメールアドレス
 * @param toAddress 送信先のメールアドレス
 * @param sessionSummary セッションのサマリー
 */
const sendEmail = async (
  fromAddress: string,
  toAddress: string,
  sessionSummary: string,
) => {
  const params: SendEmailCommandInput = {
    Destination: {
      ToAddresses: [toAddress],
    },
    Content: {
      Simple: {
        Body: {
          Text: { Data: sessionSummary || 'No summary available' },
        },
        Subject: { Data: `${fromAddress}さんからお困りごとが転送されました。` },
      },
    },
    FromEmailAddress: 'noreply@angel-make-it.com',
  };

  await sesClient.send(new SendEmailCommand(params));
};

/**
 * EscalatedSessionIds にセッション ID を追加する
 *
 * @param userId 送信先のユーザー ID
 * @param sessionId
 */
const setEscalatedSessionId = async (userId: string, sessionId: string) => {
  await dynamodbDocClient.update({
    TableName: USER_TABLE_NAME,
    Key: { UserId: userId },
    UpdateExpression: 'ADD EscalatedSessionIds :s',
    ExpressionAttributeValues: { ':s': new Set([sessionId]) },
  });
};

/**
 * IsEscalated を true にする
 *
 * @param sessionId
 */
const setIsEscalated = async (sessionId: string) => {
  await dynamodbDocClient.update({
    TableName: SESSION_TABLE_NAME,
    Key: { SessionId: sessionId },
    UpdateExpression: 'SET IsEscalated = :i',
    ExpressionAttributeValues: { ':i': true },
  });
};
