import {
  PythonFunction,
  PythonLayerVersion,
} from '@aws-cdk/aws-lambda-python-alpha';
import { Duration } from 'aws-cdk-lib';
import { LambdaIntegration } from 'aws-cdk-lib/aws-apigateway';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { CodeSigningConfig, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Platform, SigningProfile } from 'aws-cdk-lib/aws-signer';
import { Construct } from 'constructs';
import { ApiGatewayRestApi } from '@/constructs/apigateway-rest-api';
import { IdBuilder } from '@/utils/naming';

type GenerateSessionTitleApiProps = {
  apiGatewayRestApi: ApiGatewayRestApi;
  lambdaLayer: PythonLayerVersion;
  sessionTableName: string;
};

export class GenerateSessionTitleApi extends Construct {
  constructor(
    scope: Construct,
    id: string,
    idBuilder: IdBuilder,
    props: GenerateSessionTitleApiProps,
  ) {
    super(scope, id);
    const lambdaRole = new Role(this, 'GenerateSessionTitleLambdaRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName('AWSXrayFullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
      roleName: idBuilder.name('generate-session-title-lambda-role'),
    });

    // コード署名
    const signingProfile = new SigningProfile(
      this,
      'GenerateSessionTitleSigningProfile',
      {
        platform: Platform.AWS_LAMBDA_SHA384_ECDSA,
      },
    );
    const codeSigningConfig = new CodeSigningConfig(
      this,
      'GenerateSessionTitleCodeSigningConfig',
      {
        signingProfiles: [signingProfile],
      },
    );

    const generateSessionTitleLambda = new PythonFunction(
      this,
      'GenerateSessionTitle',
      {
        codeSigningConfig,
        entry: 'lambda-py/code',
        index: 'generate_session_title.py',
        runtime: Runtime.PYTHON_3_12,
        handler: 'handler',
        description: idBuilder.name('generate-session-title-lambda'),
        functionName: idBuilder.name('generate-session-title-lambda'),
        role: lambdaRole,
        timeout: Duration.seconds(900),
        environment: {
          SESSION_TABLE_NAME: props.sessionTableName,
        },
        logRetention: RetentionDays.ONE_MONTH,
        layers: [props.lambdaLayer],
        tracing: Tracing.ACTIVE,
      },
    );

    const generateSessionTitleResource =
      props.apiGatewayRestApi.apiResource.addResource('generate-session-title');
    generateSessionTitleResource.addMethod(
      'POST',
      new LambdaIntegration(generateSessionTitleLambda, {
        proxy: true,
      }),
      {
        authorizer: props.apiGatewayRestApi.authorizer,
      },
    );
  }
}
