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

type CreateCognitoUserApiProps = {
  apiGatewayRestApi: ApiGatewayRestApi;
  userPoolClientId: string;
};

export class CreateCognitoUserApi extends Construct {
  constructor(
    scope: Construct,
    id: string,
    idBuilder: IdBuilder,
    props: CreateCognitoUserApiProps,
  ) {
    super(scope, id);

    // SQSキューの作成
    const createCognitoUserQueue = new Queue(this, 'CreateCognitoUserQueue', {
      visibilityTimeout: Duration.seconds(300),
      retentionPeriod: Duration.days(4),
      queueName: idBuilder.name('create-cognito-user-queue'),
    });

    const apiGatewayRole = new Role(this, 'ApiGatewaySqsRole', {
      assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
      roleName: idBuilder.name('api-gateway-cognito-user-sqs-role'),
    });
    apiGatewayRole.addManagedPolicy(
      ManagedPolicy.fromAwsManagedPolicyName('AmazonSQSFullAccess'),
    );

    // SQS統合の設定
    const sqsIntegration = new AwsIntegration({
      service: 'sqs',
      path: `${Aws.ACCOUNT_ID}/${createCognitoUserQueue.queueName}`,
      region: 'ap-northeast-1',
      options: {
        credentialsRole: apiGatewayRole,
        requestParameters: {
          'integration.request.header.Content-Type':
            "'application/x-www-form-urlencoded'",
        },
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
    const createCognitoUserResource =
      props.apiGatewayRestApi.apiResource.addResource('create-cognito-user');
    createCognitoUserResource.addMethod('POST', sqsIntegration, {
      authorizer: props.apiGatewayRestApi.authorizer,
      methodResponses: [{ statusCode: '204' }, { statusCode: '500' }],
    });

    const lambdaRole = new Role(this, 'CreateCognitoUserRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonCognitoPowerUser'),
        ManagedPolicy.fromAwsManagedPolicyName('AWSXrayFullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
      roleName: idBuilder.name('create-cognito-user-role'),
    });

    // コード署名
    const signingProfile = new SigningProfile(
      this,
      'CreateCognitoUserSigningProfile',
      {
        platform: Platform.AWS_LAMBDA_SHA384_ECDSA,
      },
    );
    const codeSigningConfig = new CodeSigningConfig(
      this,
      'CreateCognitoUserCodeSigningConfig',
      {
        signingProfiles: [signingProfile],
      },
    );

    const createCognitoUserLambda = new NodejsFunction(
      this,
      'CreateCognitoUserLambdaHandler',
      {
        codeSigningConfig,
        entry: 'lambda-ts/code/create-cognito-user.ts',
        handler: 'handler',
        runtime: Runtime.NODEJS_20_X,
        timeout: Duration.seconds(120),
        role: lambdaRole,
        functionName: idBuilder.name('create-cognito-user-lambda'),
        environment: {
          COGNITO_USER_POOL_CLIENT_ID: props.userPoolClientId,
        },
        logRetention: RetentionDays.ONE_MONTH,
        tracing: Tracing.ACTIVE,
      },
    );

    createCognitoUserLambda.addEventSource(
      new SqsEventSource(createCognitoUserQueue),
    );
  }
}
