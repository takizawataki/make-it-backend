import json
import os

import boto3
from langchain.memory import ConversationBufferMemory
from langchain.memory.chat_message_histories import DynamoDBChatMessageHistory
from langchain_aws import ChatBedrock

SESSION_TABLE_NAME = os.getenv("SESSION_TABLE_NAME", "")


dynamodb = boto3.client("dynamodb")


def handler(event, _context):
    if type(event["body"]) is str:
        body = json.loads(event["body"])
    else:
        body = event["body"]

    # summaryを生成
    ai_msg = summarize_chat_history(body["sessionId"])
    save_summary_to_dynamodb(body["sessionId"], ai_msg)

    return {
        "statusCode": 200,
        "body": json.dumps({"summarizedText": ai_msg}, ensure_ascii=False),
        "headers": {"content-type": "application/json"},
        "isBase64Encoded": False,
    }


def summarize_chat_history(session_id: str) -> str:

    # クラスのインスタンス化
    chat_history = DynamoDBChatMessageHistory(
        table_name=SESSION_TABLE_NAME,
        session_id=session_id,
    )

    # LLMモデルの定義
    chat = ChatBedrock(
        model_id="anthropic.claude-3-5-sonnet-20240620-v1:0",
        model_kwargs={"temperature": 0.1, "max_tokens": 4096},
        region_name="ap-northeast-1",
    )  # type: ignore

    # memoryの定義
    # 会話履歴記憶用 Memory（ユーザーのInputとLLMのOutputのみを記録）
    memory = ConversationBufferMemory(memory_key="chat_history", chat_memory=chat_history, return_messages=True)

    # プロンプトのひな型を定義
    user_prompt = """# 指示
日本語で回答してください。
会話履歴に示した AI と 人間のやり取りを要約し、サマリーレポートを出力してください。
質問者が何を理解していて、何を理解していないのかを整理してください。
会話の中に質問者の使用している端末などの固有名詞が出現した場合には、箇条書きで出力してください。
会話履歴内でやり取りされている問題に対して、解決策になり得ることがあれば出力してください。

会話履歴内に出現した URL を以下3行のフォーマットに合わせて末尾に出力してください。
## 参考になるサイト
- https://example.com
- https://wikipedia.com

# 過去の会話履歴
{}

"""

    # TODO LLMにメッセージを送信する処理を記述する
    response = chat.invoke(user_prompt.format(memory.buffer_as_str))
    # LLM からの返答文を抽出
    summarized_text = response.content

    return summarized_text  # type: ignore


def save_summary_to_dynamodb(session_id: str, summarized_text: str) -> None:
    dynamodb.update_item(
        TableName=SESSION_TABLE_NAME,
        Key={"SessionId": {"S": session_id}},
        UpdateExpression="SET SessionSummary = :session_summary",
        ExpressionAttributeValues={":session_summary": {"S": summarized_text}},
        ReturnValues="ALL_NEW",
    )
