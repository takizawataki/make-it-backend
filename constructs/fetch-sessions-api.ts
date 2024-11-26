import { Duration } from 'aws-cdk-lib';
import { LambdaIntegration, Resource } from 'aws-cdk-lib/aws-apigateway';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { CodeSigningConfig, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Platform, SigningProfile } from 'aws-cdk-lib/aws-signer';
import { Construct } from 'constructs';
import { ApiGatewayRestApi } from '@/constructs/apigateway-rest-api';
import { IdBuilder } from '@/utils/naming';

type FetchSessionsApiProps = {
  apiGatewayRestApi: ApiGatewayRestApi;
  sessionTableName: string;
  userTableName: string;
};
export class FetchSessionsApi extends Construct {
  // {sessionId} で取得できるように公開
  readonly fetchSessionsResource: Resource;

  constructor(
    scope: Construct,
    id: string,
    idBuilder: IdBuilder,
    props: FetchSessionsApiProps,
  ) {
    super(scope, id);
    const lambdaRole = new Role(this, 'FetchSessionsLambdaRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName('AWSXrayFullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
      roleName: idBuilder.name('fetch-sessions-lambda-role'),
    });

    // コード署名
    const signingProfile = new SigningProfile(
      this,
      'FetchSessionsSigningProfile',
      {
        platform: Platform.AWS_LAMBDA_SHA384_ECDSA,
      },
    );
    const codeSigningConfig = new CodeSigningConfig(
      this,
      'FetchSessionsCodeSigningConfig',
      {
        signingProfiles: [signingProfile],
      },
    );

    const fetchSessionsLambda = new NodejsFunction(
      this,
      'FetchSessionsLambdaHandler',
      {
        codeSigningConfig,
        entry: 'lambda-ts/code/fetch-sessions.ts',
        handler: 'handler',
        runtime: Runtime.NODEJS_20_X,
        timeout: Duration.seconds(120),
        role: lambdaRole,
        functionName: idBuilder.name('fetch-sessions-lambda'),
        environment: {
          SESSION_TABLE_NAME: props.sessionTableName,
          USER_TABLE_NAME: props.userTableName,
        },
        logRetention: RetentionDays.ONE_WEEK,
        tracing: Tracing.ACTIVE,
      },
    );

    this.fetchSessionsResource =
      props.apiGatewayRestApi.apiResource.addResource('session');
    this.fetchSessionsResource.addMethod(
      'GET',
      new LambdaIntegration(fetchSessionsLambda, {
        proxy: true,
      }),
      {
        authorizer: props.apiGatewayRestApi.authorizer,
      },
    );
  }
}
