import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { DynamoDBChatMessageHistory } from '@langchain/community/stores/message/dynamodb';
import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { BufferMemory } from 'langchain/memory';
import { graph } from '@/lambda-ts/code/lang-graph';
import { GenerateAiReplyRequestUserAgent } from '@/lambda-ts/types/generated/models/GenerateAiReplyRequestUserAgent';
import { getSecretValue } from '@/lambda-ts/utils/secretsManager';

const dynamodbClient = new DynamoDBClient({
  region: 'ap-northeast-1',
});
const dynamodbDocClient = DynamoDBDocument.from(dynamodbClient);
const USER_TABLE_NAME = process.env.USER_TABLE_NAME || '';
const SESSION_TABLE_NAME = process.env.SESSION_TABLE_NAME || '';

type Message = {
  human?: string;
  ai?: string;
};

export const handler = awslambda.streamifyResponse(
  async (
    //https://stackoverflow.com/questions/76445727/aws-lambda-function-url-event-type
    event: APIGatewayProxyEvent,
    responseStream: NodeJS.WritableStream,
    _context: Context,
  ) => {
    console.log('event:', event);
    if (!event.body) {
      throw new Error('Bad Request');
    }
    const body = JSON.parse(event.body);
    if (!body.userId || !body.sessionId || !body.message || !body.dateTime) {
      throw new Error('Bad Request');
    }
    const { userId, sessionId, message, dateTime, userAgent } = body;

    const stream = await invokeModel(message, sessionId, userAgent);
    if (userAgent) {
      // userTable の SessionIds に sessionId を追加
      await addSessionId(userId, sessionId);
      // sessionTable の CreatedAt と UpdatedAt に時刻を追加
      await setCreatedData(sessionId, dateTime);
      await setUpdatedData(sessionId, dateTime);
    } else {
      // sessionTable の UpdatedAt に時刻を追加
      await setUpdatedData(sessionId, dateTime);
    }

    for await (const { event, tags, data } of stream) {
      if (!tags) continue;
      if (event === 'on_chat_model_stream' && tags.includes('final_node')) {
        if (data.chunk.content) {
          // Empty content in the context of OpenAI or Anthropic usually means
          // that the model is asking for a tool to be invoked.
          // So we only print non-empty content
          responseStream.write(data.chunk.content);
        }
      }
    }
    responseStream.end();
  },
);

/**
 * LangChain の SetUp
 * @see https://js.langchain.com/docs/integrations/chat/bedrock#credentials
 */
const setUpLangChain = async () => {
  const secret = await getSecretValue<{
    LANGCHAIN_API_KEY: string;
  }>('LANGCHAIN_API_KEY');
  process.env.LANGCHAIN_TRACING_V2 = 'true';
  process.env.LANGCHAIN_API_KEY = secret.LANGCHAIN_API_KEY;
};

const invokeModel = async (
  message: string,
  sessionId: string,
  userAgent: GenerateAiReplyRequestUserAgent | undefined,
) => {
  await setUpLangChain();
  // https://js.langchain.com/docs/integrations/memory/dynamodb/
  const chatHistory = new DynamoDBChatMessageHistory({
    tableName: SESSION_TABLE_NAME,
    partitionKey: 'SessionId',
    sessionId,
    messageAttributeName: 'History',
    config: {
      region: 'ap-northeast-1',
    },
  });

  // 会話履歴記憶用 Memory（ユーザーのInputとLLMのOutputのみを記録）
  const memory = new BufferMemory({
    memoryKey: 'chatHistory',
    chatHistory,
    returnMessages: true,
  });

  const messages = await memory.chatHistory.getMessages();
  const content: Message[] = [];
  messages.map((message, index) => {
    switch (index % 2) {
      case 0:
        content.push({ human: message.content as string });
        break;
      case 1:
        content.push({ ai: message.content as string });
        break;
    }
  });

  const input = buildPrompt(content, message, userAgent);

  return await graph(input, memory, message, userAgent);
};

const buildPrompt = (
  content: Message[],
  message: string,
  userAgent: GenerateAiReplyRequestUserAgent | undefined,
) => {
  const commonPrompt = `
# 指示
日本語で回答してください。
あなたはITに詳しいアシスタントです。
あなたは、ユーザーとの会話履歴を長期間保存する機能を有しています。
ITやスマートフォンの操作などの質問が来た際には詳しくない人でも理解しやすいよう難解な用語を避けて説明します。
具体的には以下のように言い換えて説明します。
スワイプ → なぞる
タップ → 触れる
相手の質問に対して、100文字以内で1つの解決策, もしくは不足している情報があればヒアリングしてください。
インターネット上の情報を参照した場合には下三行のフォーマットで参考にしたサイトのURLを出力してください。
## 参考になるサイト
- https://example.com
- https://wikipedia.com

# 過去の会話履歴
${JSON.stringify(content)}

# 新しいメッセージ
${message}`;

  if (userAgent) {
    const userAgentPrompt = `
# ユーザーエージェント情報
- OS: ${userAgent.osName}
- ブラウザ: ${userAgent.browserName}
- デバイス: ${userAgent.deviceName}`;
    return commonPrompt + userAgentPrompt;
  }
  return commonPrompt;
};

/**
 * ユーザーのセッション ID を追加する
 *
 * @param sessionId
 * @param userId
 */
export const addSessionId = async (userId: string, sessionId: string) => {
  await dynamodbDocClient.update({
    TableName: USER_TABLE_NAME,
    Key: { UserId: userId },
    UpdateExpression: 'ADD SessionIds :s',
    ExpressionAttributeValues: {
      ':s': new Set<string>([sessionId]),
    },
    ReturnValues: 'ALL_NEW',
  });
};

/**
 * セッションの作成日時を設定する
 *
 * @param sessionId
 * @param createdAt
 */
export const setCreatedData = async (sessionId: string, createdAt: string) => {
  await dynamodbDocClient.update({
    TableName: SESSION_TABLE_NAME,
    Key: { SessionId: sessionId },
    UpdateExpression: 'SET CreatedAt = :c',
    ExpressionAttributeValues: {
      ':c': createdAt,
    },
    ReturnValues: 'ALL_NEW',
  });
};

/**
 * セッションの更新日時を設定する
 *
 * @param sessionId
 * @param updatedAt
 */
export const setUpdatedData = async (sessionId: string, updatedAt: string) => {
  await dynamodbDocClient.update({
    TableName: SESSION_TABLE_NAME,
    Key: { SessionId: sessionId },
    UpdateExpression: 'SET UpdatedAt = :u',
    ExpressionAttributeValues: {
      ':u': updatedAt,
    },
    ReturnValues: 'ALL_NEW',
  });
};
