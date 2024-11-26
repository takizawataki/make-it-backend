import { EOL } from 'os';
import { AttributeValue as SDKAttributeValue } from '@aws-sdk/client-dynamodb';
import { FirehoseClient, PutRecordCommand } from '@aws-sdk/client-firehose';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { DynamoDBStreamEvent } from 'aws-lambda';

// Firehoseクライアントの作成
const firehoseClient = new FirehoseClient({});

export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
  for (const record of event.Records) {
    const timestamp = record.dynamodb?.ApproximateCreationDateTime
      ? Math.floor(record.dynamodb.ApproximateCreationDateTime)
      : Date.now();

    const toFirehoseItem: FirehoseRecord = {
      action: record.eventName ?? '',
      // Keys と NewImage, OldImage を SDK の AttributeValue 型にキャスト
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

    // Firehoseにデータを送信 (DataはUint8Arrayとして送る必要がある)
    const command = new PutRecordCommand({
      DeliveryStreamName: process.env.DELIVERY_STREAM_NAME || '',
      Record: {
        Data: Buffer.from(JSON.stringify(toFirehoseItem) + EOL),
      },
    });
    await firehoseClient.send(command);
  }
};

/**
 * DynamoDB のデータを解釈する関数
 * DynamoDB Streams から取得したデータを JavaScript オブジェクトに変換します。
 *
 * @param {{ [key: string]: SDKAttributeValue }} item - DynamoDB の AttributeValue オブジェクト
 * @returns {Record<string, string | number | boolean | null>} - 変換された JavaScript オブジェクト
 */
function deserialize(item: {
  [key: string]: SDKAttributeValue;
}): Record<string, string | number | boolean | null> {
  return unmarshall(item) as Record<string, string | number | boolean | null>;
}

/**
 * Firehose に送るデータの型定義
 * @typedef {Object} FirehoseRecord
 * @property {string} action - イベントの種類 (INSERT, MODIFY, REMOVE など)
 * @property {Record<string, string | number | boolean | null>} keys - DynamoDB のキー
 * @property {Record<string, string | number | boolean | null> | null} new_image - 新しいデータ (INSERT または MODIFY の場合)
 * @property {Record<string, string | number | boolean | null> | null} old_image - 古いデータ (REMOVE または MODIFY の場合)
 * @property {number} timestamp - タイムスタンプ
 * @property {string} timestamp_utc - タイムスタンプの UTC 表記
 */
interface FirehoseRecord {
  action: string;
  keys: Record<string, string | number | boolean | null>;
  new_image: Record<string, string | number | boolean | null> | null;
  old_image: Record<string, string | number | boolean | null> | null;
  timestamp: number;
  timestamp_utc: string;
}
