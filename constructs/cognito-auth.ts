import { Passwordless } from 'amazon-cognito-passwordless-auth/cdk';
import { Duration } from 'aws-cdk-lib';
import {
  AccountRecovery,
  StringAttribute,
  UserPool,
  UserPoolClient,
} from 'aws-cdk-lib/aws-cognito';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { CodeSigningConfig, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Platform, SigningProfile } from 'aws-cdk-lib/aws-signer';
import { Construct } from 'constructs';
import { IdBuilder } from '@/utils/naming';

type CognitoAuthProps = {
  userTableName: string;
};

export class CognitoAuth extends Construct {
  public readonly userPool: UserPool;
  public readonly userRegistrationLambda: NodejsFunction;
  public readonly userPoolClient: UserPoolClient;

  constructor(
    scope: Construct,
    id: string,
    idBuilder: IdBuilder,
    props: CognitoAuthProps,
  ) {
    super(scope, id);

    const lambdaRole = new Role(this, 'UserRegistrationRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName('AWSXrayFullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
      roleName: idBuilder.name('user-registration-role'),
    });

    // コード署名
    const signingProfile = new SigningProfile(
      this,
      'UserRegistrationSigningProfile',
      {
        platform: Platform.AWS_LAMBDA_SHA384_ECDSA,
      },
    );
    const codeSigningConfig = new CodeSigningConfig(
      this,
      'UserRegistrationCodeSigningConfig',
      {
        signingProfiles: [signingProfile],
      },
    );

    this.userRegistrationLambda = new NodejsFunction(
      this,
      'UserRegistrationLambdaHandler',
      {
        codeSigningConfig,
        entry: 'lambda-ts/code/user-registration.ts',
        handler: 'handler',
        runtime: Runtime.NODEJS_20_X,
        timeout: Duration.seconds(180),
        role: lambdaRole,
        functionName: idBuilder.name('user-registration-lambda'),
        environment: {
          USER_TABLE_NAME: props.userTableName,
        },
        logRetention: RetentionDays.ONE_MONTH,
        tracing: Tracing.ACTIVE,
      },
    );

    this.userPool = new UserPool(this, 'UserPool', {
      userPoolName: idBuilder.name('user-pool'),
      selfSignUpEnabled: true,
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
      },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      signInAliases: {
        email: true,
      },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 6,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      lambdaTriggers: {
        postConfirmation: this.userRegistrationLambda,
      },
      customAttributes: {
        inviter: new StringAttribute({ mutable: true }),
      },
    });

    this.userPoolClient = new UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      userPoolClientName: idBuilder.name('app-client'),
      generateSecret: false,
      authFlows: {
        adminUserPassword: false,
        custom: true,
        userPassword: false,
        userSrp: true,
      },
    });

    // magic link
    new Passwordless(this, 'Passwordless', {
      userPool: this.userPool,
      allowedOrigins: [`https://${idBuilder.branchName}.angel-make-it.com`],
      magicLink: {
        sesFromAddress: 'noreply@angel-make-it.com',
        autoConfirmUsers: true,
      },
      functionProps: {
        createAuthChallenge: {
          // Override entry, to point to your custom code:
          entry: 'lambda-ts/code/custom-magic-link-email.ts',
          bundling: {
            // https://github.com/aws-samples/amazon-cognito-passwordless-auth/issues/152
            format: OutputFormat.ESM,
            // Solves `Dynamic require of "stream" is not supported"` error:
            banner:
              "import{createRequire}from 'module';const require=createRequire(import.meta.url);",
          },
        },
      },
    });
  }
}
