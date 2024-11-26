import * as cdk from 'aws-cdk-lib';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as sfnTasks from 'aws-cdk-lib/aws-stepfunctions-tasks'; // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_stepfunctions_tasks-readme.html
import { Construct } from 'constructs';
import { IdBuilder } from '@/utils/naming'; // IdBuilderクラスをインポート

export class SummarizeStepFunction extends Construct {
  public readonly stateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, idBuilder: IdBuilder) {
    super(scope, id);

    // DynamoDB Table
    const table = dynamodb.Table.fromTableArn(
      this,
      'SessionTable',
      `arn:aws:dynamodb:ap-northeast-1:471112963464:table/make-it-${idBuilder.branchName}-session-table`,
    );

    // Step 1: DynamoDB GetItem
    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_stepfunctions_tasks.DynamoGetItem.html
    const getItemTask = new sfnTasks.DynamoGetItem(this, 'DynamoDB GetItem', {
      table: table,
      key: {
        // FYI https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_stepfunctions_tasks.DynamoAttributeValue.html
        SessionId: sfnTasks.DynamoAttributeValue.fromString(
          sfn.JsonPath.stringAt('$.body.sessionId'),
        ),
      },
      resultPath: '$.getChatHistoryResult',
      resultSelector: {
        'chatHistory.$': '$.Item.History.L[0:]',
      },
    });

    // Step 2: Convert Array to String (Pass)
    const convertHistoryTask = new sfn.Pass(
      this,
      'Convert Chat History to String',
      {
        parameters: {
          'chatHistory.$':
            "States.Format('{}', $.getChatHistoryResult.chatHistory[0:])",
        },
        resultPath: '$.getChatHistoryResult',
      },
    );

    // Step 3: Incorporate Chat History into Prompt (Pass)
    const createPromptTask = new sfn.Pass(
      this,
      'Incorporate Chat History into Prompt',
      {
        parameters: {
          'prompt.$':
            "States.Format('\n\nHuman: # 指示\n日本語で回答してください。\n会話履歴に示した AI と 人間のやり取りを要約し、サマリーレポートを出力してください。\n質問者が何を理解していて、何を理解していないのかを整理してください。\n会話の中に質問者の使用している端末などの固有名詞が出現した場合には、箇条書きで出力してください。\n会話履歴内でやり取りされている問題に対して、解決策になり得ることがあれば出力してください。\n\n会話履歴内に出現した URL を以下3行のフォーマットに合わせて末尾に出力してください。\n## 参考になるサイト\n- https://example.com\n- https://wikipedia.com\n\n# 過去の会話履歴\n {} \n\nAssistant:', $.getChatHistoryResult.chatHistory)",
        },
        resultPath: '$.createPromptResult',
      },
    );

    // Define model.
    const model = bedrock.ProvisionedModel.fromProvisionedModelArn(
      this,
      'Model',
      'arn:aws:bedrock:ap-northeast-1::foundation-model/anthropic.claude-3-5-sonnet-20240620-v1:0',
    );

    // Step 4: Bedrock InvokeModel
    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_stepfunctions_tasks.BedrockInvokeModel.html
    const invokeModelTask = new sfnTasks.BedrockInvokeModel(
      this,
      'Prompt Model',
      {
        model: model,
        body: sfn.TaskInput.fromObject({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 4098,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  'text.$': '$.createPromptResult.prompt',
                },
              ],
            },
          ],
        }),
        resultPath: '$.bedrockSummarizeResult',
        resultSelector: {
          'summarizedText.$': '$.Body.content[0].text',
        },
      },
    );

    // Step 5: DynamoDB UpdateItem
    const updateItemTask = new sfnTasks.DynamoUpdateItem(
      this,
      'DynamoDB UpdateItem',
      {
        table: table,
        key: {
          SessionId: sfnTasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt('$.body.sessionId'),
          ),
        },
        updateExpression: 'SET SessionSummary = :session_summary',
        expressionAttributeValues: {
          ':session_summary': sfnTasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt('$.bedrockSummarizeResult.summarizedText'),
          ),
        },
        resultPath: '$.dynamodbUpdateItemResult',
        outputPath: '$.bedrockSummarizeResult',
      },
    );

    // Step Functions State Machine
    const definition = getItemTask
      .next(convertHistoryTask)
      .next(createPromptTask)
      .next(invokeModelTask)
      .next(updateItemTask);

    // ステートマシン名を生成
    const stateMachineName = idBuilder.name('summarize-sfn');

    this.stateMachine = new sfn.StateMachine(this, 'MyStateMachine', {
      definition,
      stateMachineName: stateMachineName,
      stateMachineType: sfn.StateMachineType.EXPRESS,
      timeout: cdk.Duration.minutes(5),
    });
  }
}
