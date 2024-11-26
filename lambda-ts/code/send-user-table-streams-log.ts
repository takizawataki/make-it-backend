import { EOL } from 'os';
import { AttributeValue as SDKAttributeValue } from '@aws-sdk/client-dynamodb';
import { FirehoseClient, PutRecordCommand } from '@aws-sdk/client-firehose';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { DynamoDBStreamEvent } from 'aws-lambda';

// Firehoseクライアントの作成
const firehoseClient = new FirehoseClient({});

export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
  const deliveryStreamName = process.env.DELIVERY_STREAM_NAME;

  if (!deliveryStreamName) {
    throw new Error('DELIVERY_STREAM_NAME environment variable is not set');
  }

  for (const record of event.Records) {
    const timestamp = record.dynamodb?.ApproximateCreationDateTime
      ? Math.floor(record.dynamodb.ApproximateCreationDateTime)
      : Date.now();

    const toFirehoseItem: FirehoseRecord = {
      action: record.eventName ?? '',
      keys: record.dynamodb?.Keys
        ? deserialize(
            record.dynamodb.Keys as { [key: string]: SDKAttributeValue },
          )
        : {},
      new_image: record.dynamodb?.NewImage
        ? deserialize(
            record.dynamodb.NewImage as { [key: string]: SDKAttributeValue },
          )
        : null,
      old_image: record.dynamodb?.OldImage
        ? deserialize(
            record.dynamodb.OldImage as { [key: string]: SDKAttributeValue },
          )
        : null,
      timestamp: timestamp,
      timestamp_utc: new Date(timestamp * 1000).toISOString(),
    };

    // Firehoseにデータを送信
    const command = new PutRecordCommand({
      DeliveryStreamName: deliveryStreamName,
      Record: {
        Data: Buffer.from(JSON.stringify(toFirehoseItem) + EOL),
      },
    });
    await firehoseClient.send(command);
  }
};

/**
 * DynamoDB のデータを解釈する関数
 */
function deserialize(item: {
  [key: string]: SDKAttributeValue;
}): Record<string, string | number | boolean | null> {
  return unmarshall(item) as Record<string, string | number | boolean | null>;
}

/**
 * Firehose に送るデータの型定義
 */
interface FirehoseRecord {
  action: string;
  keys: Record<string, string | number | boolean | null>;
  new_image: Record<string, string | number | boolean | null> | null;
  old_image: Record<string, string | number | boolean | null> | null;
  timestamp: number;
  timestamp_utc: string;
}
