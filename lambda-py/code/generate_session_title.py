# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0
"""
Shows how to generate a message with Anthropic Claude (on demand).
"""
import json
import os

import boto3
from botocore.exceptions import ClientError

SESSION_TABLE_NAME = os.getenv("SESSION_TABLE_NAME", "")

dynamodb = boto3.client("dynamodb")
bedrock_runtime = boto3.client(service_name="bedrock-runtime")

model_id = "anthropic.claude-3-5-sonnet-20240620-v1:0"
system_prompt = "12文字以内で、この質問に対するタイトルを生成してください。"
max_tokens = 1000


def generate_message(bedrock_runtime, model_id, system_prompt, messages, max_tokens):

    body = json.dumps(
        {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "system": system_prompt,
            "messages": messages,
        }
    )

    response = bedrock_runtime.invoke_model(body=body, modelId=model_id)
    response_body = json.loads(response.get("body").read())

    return response_body


def save_title_to_dynamodb(session_id: str, session_title: str) -> None:
    dynamodb.update_item(
        TableName=SESSION_TABLE_NAME,
        Key={"SessionId": {"S": session_id}},
        UpdateExpression="SET SessionTitle = :session_title",
        ExpressionAttributeValues={":session_title": {"S": session_title}},
        ReturnValues="ALL_NEW",
    )


def handler(event, _context):
    try:
        if type(event["body"]) is str:
            body = json.loads(event["body"])
        else:
            body = event["body"]

        session_id = body["sessionId"]
        session_history = body["sessionHistory"]

        user_message = {"role": "user", "content": json.dumps(session_history)}
        messages = [user_message]

        response = generate_message(bedrock_runtime, model_id, system_prompt, messages, max_tokens)

        session_title = response["content"][0]["text"]

        save_title_to_dynamodb(session_id, session_title)

        return {
            "statusCode": 200,
            "body": json.dumps({"sessionTitle": session_title}, ensure_ascii=False),
            "headers": {"content-type": "application/json"},
            "isBase64Encoded": False,
        }

    except ClientError as err:
        message = err.response["Error"]["Message"]
        print("A client error : " + format(message))
