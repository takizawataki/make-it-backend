import json
import os

import boto3
from botocore.exceptions import ClientError
from langchain import hub
from langchain.agents import AgentExecutor, create_react_agent
from langchain.memory import ConversationBufferMemory
from langchain_aws import ChatBedrock
from langchain_community.agent_toolkits.load_tools import load_tools
from langchain_community.chat_message_histories import DynamoDBChatMessageHistory

SESSION_TABLE_NAME = os.getenv("SESSION_TABLE_NAME", "")
# TODO: Lambda の環境変数
USER_TABLE_NAME = os.getenv("USER_TABLE_NAME", "")

dynamodb = boto3.client("dynamodb")


def handler(event, _context=None):
    if type(event["body"]) is str:
        body = json.loads(event["body"])
    else:
        body = event["body"]

    # メッセージが空の場合はエラーを出す
    if body["message"] == "":
        return {"statusCode": 400, "body": json.dumps({"message": "Empty request body"})}

    if "userAgent" in body.keys():
        ai_msg = invoke_model(body["message"], body["sessionId"], body["userAgent"])
        # userTable の SessionIds に sessionId を追加
        add_session_id(body["sessionId"], body["userId"])
        # sessionTable の CreatedAt に時刻を追加
        set_created_date(body["sessionId"], body["dateTime"])
        set_updated_date(body["sessionId"], body["dateTime"])
    else:
        # メッセージがあれば LLM に送信
        ai_msg = invoke_model(body["message"], body["sessionId"])
        # sessionTable の UpdatedAt に時刻を追加
        set_updated_date(body["sessionId"], body["dateTime"])

    return {
        "statusCode": 200,
        "body": json.dumps({"message": ai_msg}, ensure_ascii=False),
        "headers": {"content-type": "application/json"},
        "isBase64Encoded": False,
    }


def invoke_model(input_text, session_id, user_agent=None):

    # LangChainのAPIキーを環境変数に保存
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    response = get_secret()
    os.environ["LANGCHAIN_API_KEY"] = json.loads(response)["LANGCHAIN_API_KEY"]

    # クラスのインスタンス化
    chat_history = DynamoDBChatMessageHistory(
        table_name=SESSION_TABLE_NAME,
        session_id=session_id,
    )

    # LLMモデルの定義
    chat = ChatBedrock(
        model_id="anthropic.claude-3-5-sonnet-20240620-v1:0",
        model_kwargs={"temperature": 0, "max_tokens": 8192},
        region_name="ap-northeast-1",
    )  # type: ignore

    # ツールの定義 LangChainで用意されているものを利用
    tools = load_tools(["ddg-search", "wikipedia"])

    # ReActエージェントのプロンプト　LangChain-hubより取得
    prompt = hub.pull("hwchase17/react")

    # memoryの定義
    # 会話履歴記憶用 Memory（ユーザーのInputとLLMのOutputのみを記録）
    memory = ConversationBufferMemory(memory_key="chat_history", chat_memory=chat_history, return_messages=True)
    # Agentがチェインを処理するときの途中経過を記録するAgentタスク用メモリ
    agent_task_memory = ConversationBufferMemory()

    # エージェントの定義
    agent = create_react_agent(chat, tools, prompt)
    # AgentのChainを定義
    agent_chain = AgentExecutor(
        agent=agent,  # type: ignore
        tools=tools,
        verbose=True,
        memory=agent_task_memory,
        handle_parsing_errors=True,
        max_iterations=10,  # agent のステップ数を制御する値
    )

    # プロンプトのひな型を定義
    user_prompt = """
# 指示
日本語で回答してください。
あなたはITに詳しいアシスタントです。
あなたは、ユーザーとの会話履歴を長期間保存する機能を有しています。
IT に関する質問が来た際には IT に詳しくない人でも理解しやすいように可能な限りIT用語を避けて説明します。
相手の質問に対して、100文字以内で1つの解決策を出力してください。
不足している情報があれば、ヒアリングしてください。
インターネット上の情報を参照した場合には下三行のフォーマットで参考にしたサイトのURLを出力してください。
## 参考になるサイト
- https://example.com
- https://wikipedia.com

# 過去の会話履歴
{chat_history}

# 新しいメッセージ
{user_input}
"""

    # userAgent があるか＝初回かどうか判定
    if user_agent is not None:
        # UA の情報を取り出し
        if type(user_agent) is str:
            user_agent = json.loads(user_agent)
        # 初回であればUAの情報を追加
        user_agent_information = """
# ユーザーの情報
OS: {os_name}
使用ブラウザ: {browser_name}
使用デバイス: {device_name}
""".format(
            os_name=user_agent["osName"], browser_name=user_agent["browserName"], device_name=user_agent["deviceName"]
        )
        user_prompt = user_prompt + user_agent_information

    # エージェントの実行
    response = agent_chain.invoke(
        {
            # ひな形にメモリとインプットテキストを埋め込んで LLM に送信
            "input": user_prompt.format(chat_history=memory.buffer_as_str, user_input=input_text),
        },
    )
    # LLM からの返答文を抽出
    output_text = response["output"]

    # userAgent があるか＝初回かどうか判定
    if user_agent is not None:
        # 会話履歴に追加
        memory.save_context({"input": user_agent_information + input_text}, {"output": output_text})
    else:
        memory.save_context({"input": input_text}, {"output": output_text})
    # Agentステップ数上限に達した場合はその旨返答
    if output_text == "Agent stopped due to iteration limit or time limit.":
        print("Agent stopped due to iteration limit or time limit.")
        return "エラーが発生しました、再度お試しください"
    return output_text


def get_secret():

    secret_name = "LANGCHAIN_API_KEY"
    region_name = "ap-northeast-1"

    # Create a Secrets Manager client
    session = boto3.Session()
    client = session.client(service_name="secretsmanager", region_name=region_name)

    try:
        get_secret_value_response = client.get_secret_value(SecretId=secret_name)
    except ClientError as e:
        # For a list of exceptions thrown, see
        # https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
        raise e

    return get_secret_value_response["SecretString"]


def add_session_id(session_id: str, user_id: str):
    dynamodb.update_item(
        TableName=USER_TABLE_NAME,
        Key={"UserId": {"S": user_id}},
        UpdateExpression="ADD SessionIds :s",
        ExpressionAttributeValues={":s": {"SS": [session_id]}},
        ReturnValues="ALL_NEW",
    )


def set_created_date(session_id: str, created_at: str):
    dynamodb.update_item(
        TableName=SESSION_TABLE_NAME,
        Key={"SessionId": {"S": session_id}},
        UpdateExpression="SET CreatedAt = :c",
        ExpressionAttributeValues={":c": {"S": created_at}},
        ReturnValues="ALL_NEW",
    )


def set_updated_date(session_id: str, updated_at: str):
    dynamodb.update_item(
        TableName=SESSION_TABLE_NAME,
        Key={"SessionId": {"S": session_id}},
        UpdateExpression="SET UpdatedAt = :u",
        ExpressionAttributeValues={":u": {"S": updated_at}},
        ReturnValues="ALL_NEW",
    )
