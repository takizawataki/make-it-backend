import { Duration } from 'aws-cdk-lib';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import {
  CodeSigningConfig,
  FunctionUrlAuthType,
  InvokeMode,
  Runtime,
  Tracing,
} from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Platform, SigningProfile } from 'aws-cdk-lib/aws-signer';
import { Construct } from 'constructs';
import { IdBuilder } from '@/utils/naming';

type LambdaInvokeModelProps = {
  sessionTableName: string;
  userTableName: string;
};
export class LambdaInvokeModel extends Construct {
  constructor(
    scope: Construct,
    id: string,
    idBuilder: IdBuilder,
    props: LambdaInvokeModelProps,
  ) {
    super(scope, id);

    const lambdaRole = new Role(this, 'InvokeModelRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonBedrockFullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName('SecretsManagerReadWrite'),
        ManagedPolicy.fromAwsManagedPolicyName('AWSXrayFullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
      roleName: idBuilder.name('invoke-model-role'),
    });

    // コード署名
    const signingProfile = new SigningProfile(
      this,
      'InvokeModelSigningProfile',
      {
        platform: Platform.AWS_LAMBDA_SHA384_ECDSA,
      },
    );
    const codeSigningConfig = new CodeSigningConfig(
      this,
      'InvokeModelCodeSigningConfig',
      {
        signingProfiles: [signingProfile],
      },
    );

    const invokeLambda = new NodejsFunction(this, 'LambdaFunction', {
      codeSigningConfig,
      entry: 'lambda-ts/code/invoke-model.ts',
      handler: 'handler',
      runtime: Runtime.NODEJS_20_X,
      timeout: Duration.seconds(900),
      role: lambdaRole,
      functionName: idBuilder.name('invoke-model-lambda'),
      environment: {
        SESSION_TABLE_NAME: props.sessionTableName,
        USER_TABLE_NAME: props.userTableName,
      },
      logRetention: RetentionDays.ONE_WEEK,
      tracing: Tracing.ACTIVE,
    });

    invokeLambda.addFunctionUrl({
      authType: FunctionUrlAuthType.AWS_IAM,
      invokeMode: InvokeMode.RESPONSE_STREAM,
    });

    // 各環境の CloudFront Distribution ID
    const distributionId = () => {
      switch (idBuilder.branchName) {
        case 'staging':
          return 'E18598BKEM3XZK';
        case 'production':
          return 'E3SQMU2GNRSO2Q';
        default:
          return 'E18598BKEM3XZK';
      }
    };

    invokeLambda.addPermission('AllowCloudFrontServicePrincipal', {
      principal: new ServicePrincipal('cloudfront.amazonaws.com'),
      action: 'lambda:InvokeFunctionUrl',
      sourceArn: `arn:aws:cloudfront::471112963464:distribution/${distributionId()}`,
    });
  }
}
