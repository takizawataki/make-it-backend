import { Duration } from 'aws-cdk-lib';
import { LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { CodeSigningConfig, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Platform, SigningProfile } from 'aws-cdk-lib/aws-signer';
import { Construct } from 'constructs';
import { ApiGatewayRestApi } from '@/constructs/apigateway-rest-api';
import { IdBuilder } from '@/utils/naming';

type FetchUserApiProps = {
  apiGatewayRestApi: ApiGatewayRestApi;
  userTableName: string;
};

export class FetchUserApi extends Construct {
  constructor(
    scope: Construct,
    id: string,
    idBuilder: IdBuilder,
    props: FetchUserApiProps,
  ) {
    super(scope, id);
    const lambdaRole = new Role(this, 'FetchUserRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName('AWSXrayFullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
      roleName: idBuilder.name('fetch-user-role'),
    });

    // コード署名
    const signingProfile = new SigningProfile(this, 'FetchUserSigningProfile', {
      platform: Platform.AWS_LAMBDA_SHA384_ECDSA,
    });
    const codeSigningConfig = new CodeSigningConfig(
      this,
      'FetchUserCodeSigningConfig',
      {
        signingProfiles: [signingProfile],
      },
    );

    const fetchUserLambda = new NodejsFunction(this, 'FetchUserLambdaHandler', {
      codeSigningConfig,
      entry: 'lambda-ts/code/fetch-user.ts',
      handler: 'handler',
      runtime: Runtime.NODEJS_20_X,
      timeout: Duration.seconds(120),
      role: lambdaRole,
      functionName: idBuilder.name('fetch-user-lambda'),
      environment: {
        USER_TABLE_NAME: props.userTableName,
      },
      logRetention: RetentionDays.ONE_MONTH,
      tracing: Tracing.ACTIVE,
    });

    const fetchUsersResource =
      props.apiGatewayRestApi.apiResource.addResource('user');
    const fetchUserResource = fetchUsersResource.addResource('{userId}');
    fetchUserResource.addMethod(
      'GET',
      new LambdaIntegration(fetchUserLambda, {
        proxy: true,
      }),
      {
        authorizer: props.apiGatewayRestApi.authorizer,
      },
    );
  }
}
