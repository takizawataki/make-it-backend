import { Aws, Duration } from 'aws-cdk-lib';
import { AwsIntegration } from 'aws-cdk-lib/aws-apigateway';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { CodeSigningConfig, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Platform, SigningProfile } from 'aws-cdk-lib/aws-signer';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import { ApiGatewayRestApi } from '@/constructs/apigateway-rest-api';
import { IdBuilder } from '@/utils/naming';

type SendSummaryApiProps = {
  apiGatewayRestApi: ApiGatewayRestApi;
  sessionTableName: string;
  userTableName: string;
};

export class SendSummaryApi extends Construct {
  constructor(
    scope: Construct,
    id: string,
    idBuilder: IdBuilder,
    props: SendSummaryApiProps,
  ) {
    super(scope, id);

    // SQSキューの作成
    const sendSummaryQueue = new Queue(this, 'SendSummaryQueue', {
      visibilityTimeout: Duration.seconds(300),
      retentionPeriod: Duration.days(4),
      queueName: idBuilder.name('send-summary-queue'),
    });

    const apiGatewayRole = new Role(this, 'ApiGatewaySqsRole', {
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
      roleName: idBuilder.name('api-gateway-send-summary-sqs-role'),
    });
    apiGatewayRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('AmazonSQSFullAccess'),
    );

    // SQS統合の設定
    const sqsIntegration = new AwsIntegration({
      // NOTE:[こちら](https://docs.aws.amazon.com/ja_jp/prescriptive-guidance/latest/patterns/integrate-amazon-api-gateway-with-amazon-sqs-to-handle-asynchronous-rest-apis.html)のドキュメントの設定に従っている
      service: 'sqs',
      path: `${Aws.ACCOUNT_ID}/${sendSummaryQueue.queueName}`,
      region: 'ap-northeast-1',
      options: {
        credentialsRole: apiGatewayRole,
        // NOTE: SQSにメッセージを送信する際、リクエストのContent-Typeが application/x-www-form-urlencoded である必要がある。これをAPI GatewayからSQSに送信するリクエストのヘッダーに追加することで、SQSが受け付ける形式でデータが送信されるようにしている。
        requestParameters: {
          'integration.request.header.Content-Type':
            "'application/x-www-form-urlencoded'",
        },
        // NOTE: SQSにメッセージを送信するためのリクエストは、特定の形式（アクション名とメッセージ本文を指定する）で送信する必要があるため、API Gatewayがフロントエンドから受け取った JSON 形式のリクエストボディを、SQS が受け取れる形式に変換する
        requestTemplates: {
          'application/json':
            'Action=SendMessage&MessageBody=$util.urlEncode($input.body)',
        },
        integrationResponses: [
          {
            statusCode: '204',
          },
          {
            statusCode: '500',
            selectionPattern: '5\\d{2}',
            responseTemplates: {
              'application/json': '{"message": "Internal Server Error"}',
            },
          },
        ],
      },
    });

    // API GatewayにSQSへのPOSTメソッドを追加
    const sendSummaryResource =
      props.apiGatewayRestApi.apiResource.addResource('send-summary');
    sendSummaryResource.addMethod('POST', sqsIntegration, {
      authorizer: props.apiGatewayRestApi.authorizer,
      methodResponses: [{ statusCode: '204' }, { statusCode: '500' }],
    });

    const lambdaRole = new Role(this, 'SendSummaryRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonSESFullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName('AWSXrayFullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
      roleName: idBuilder.name('send-summary-role'),
    });

    // コード署名
    const signingProfile = new SigningProfile(
      this,
      'SendSummarySigningProfile',
      {
        platform: Platform.AWS_LAMBDA_SHA384_ECDSA,
      },
    );
    const codeSigningConfig = new CodeSigningConfig(
      this,
      'SendSummaryCodeSigningConfig',
      {
        signingProfiles: [signingProfile],
      },
    );

    const sendSummaryLambda = new NodejsFunction(
      this,
      'SendMailLambdaHandler',
      {
        codeSigningConfig,
        entry: 'lambda-ts/code/send-summary.ts',
        handler: 'handler',
        runtime: Runtime.NODEJS_20_X,
        timeout: Duration.seconds(120),
        role: lambdaRole,
        functionName: idBuilder.name('send-summary-lambda'),
        environment: {
          SESSION_TABLE_NAME: props.sessionTableName,
          USER_TABLE_NAME: props.userTableName,
        },
        logRetention: RetentionDays.ONE_MONTH,
        tracing: Tracing.ACTIVE,
      },
    );

    sendSummaryLambda.addEventSource(new SqsEventSource(sendSummaryQueue));
  }
}
