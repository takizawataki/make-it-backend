import * as cdk from 'aws-cdk-lib';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as sfnTasks from 'aws-cdk-lib/aws-stepfunctions-tasks'; // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_stepfunctions_tasks-readme.html
import { Construct } from 'constructs';
import { IdBuilder } from '@/utils/naming'; // IdBuilderクラスをインポート

export class GenerateSessionTitleStepFunction extends Construct {
  public readonly stateMachine: sfn.StateMachine;

  constructor(scope: Construct, id: string, idBuilder: IdBuilder) {
    super(scope, id);

    // DynamoDB Table
    const table = dynamodb.Table.fromTableArn(
      this,
      'SessionTable',
      `arn:aws:dynamodb:ap-northeast-1:471112963464:table/make-it-${idBuilder.branchName}-session-table`,
    );

    // Step 1: Convert Array to String (Pass)
    const convertHistoryTask = new sfn.Pass(
      this,
      'Convert Chat History to String',
      {
        parameters: {
          'sessionHistory.$': "States.Format('{}', $.body.sessionHistory[0:])",
        },
        resultPath: '$.passExchangeResult',
      },
    );

    // Define model.
    const model = bedrock.ProvisionedModel.fromProvisionedModelArn(
      this,
      'Model',
      'arn:aws:bedrock:ap-northeast-1::foundation-model/anthropic.claude-3-5-sonnet-20240620-v1:0',
    );

    // Step 2: Bedrock InvokeModel
    // https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_stepfunctions_tasks.BedrockInvokeModel.html
    const invokeModelTask = new sfnTasks.BedrockInvokeModel(
      this,
      'Prompt Model',
      {
        model: model,
        body: sfn.TaskInput.fromObject({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 200,
          system: '12文字以内で、この質問に対するタイトルを生成してください。',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  'text.$': '$.passExchangeResult.sessionHistory',
                },
              ],
            },
          ],
        }),
        resultPath: '$.bedrockResult',
      },
    );

    // Step 3: DynamoDB UpdateItem
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
        updateExpression: 'SET SessionTitle = :session_title',
        expressionAttributeValues: {
          ':session_title': sfnTasks.DynamoAttributeValue.fromString(
            sfn.JsonPath.stringAt('$.bedrockResult.Body.content[0].text'),
          ),
        },
        resultPath: '$.dynamodbUpdateItemResult',
        outputPath: '$.bedrockResult.Body.content[0].text',
      },
    );

    // Step Functions State Machine
    const definition = convertHistoryTask
      .next(invokeModelTask)
      .next(updateItemTask);

    // ステートマシン名を生成
    const stateMachineName = idBuilder.name('generate-session-title-sfn');

    this.stateMachine = new sfn.StateMachine(this, 'MyStateMachine', {
      definition,
      stateMachineName: stateMachineName,
      stateMachineType: sfn.StateMachineType.EXPRESS,
      timeout: cdk.Duration.minutes(5),
    });
  }
}
