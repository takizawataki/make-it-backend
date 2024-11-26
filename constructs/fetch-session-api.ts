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

type FetchSessionApiProps = {
  apiGatewayRestApi: ApiGatewayRestApi;
  fetchSessionsResource: Resource;
  sessionTableName: string;
};
export class FetchSessionApi extends Construct {
  constructor(
    scope: Construct,
    id: string,
    idBuilder: IdBuilder,
    props: FetchSessionApiProps,
  ) {
    super(scope, id);
    const lambdaRole = new Role(this, 'FetchSessionLambdaRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName('AWSXrayFullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
      roleName: idBuilder.name('fetch-session-lambda-role'),
    });

    // コード署名
    const signingProfile = new SigningProfile(
      this,
      'FetchSessionSigningProfile',
      {
        platform: Platform.AWS_LAMBDA_SHA384_ECDSA,
      },
    );
    const codeSigningConfig = new CodeSigningConfig(
      this,
      'FetchSessionCodeSigningConfig',
      {
        signingProfiles: [signingProfile],
      },
    );

    const fetchSessionLambda = new NodejsFunction(
      this,
      'FetchSessionLambdaHandler',
      {
        codeSigningConfig,
        entry: 'lambda-ts/code/fetch-session.ts',
        handler: 'handler',
        runtime: Runtime.NODEJS_20_X,
        timeout: Duration.seconds(120),
        role: lambdaRole,
        functionName: idBuilder.name('fetch-session-lambda'),
        environment: {
          SESSION_TABLE_NAME: props.sessionTableName,
        },
        logRetention: RetentionDays.ONE_WEEK,
        tracing: Tracing.ACTIVE,
      },
    );

    const fetchSessionResource =
      props.fetchSessionsResource.addResource('{sessionId}');
    fetchSessionResource.addMethod(
      'GET',
      new LambdaIntegration(fetchSessionLambda, {
        proxy: true,
      }),
      {
        authorizer: props.apiGatewayRestApi.authorizer,
      },
    );
  }
}
