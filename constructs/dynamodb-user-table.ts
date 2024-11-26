import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import {
  AttributeType,
  StreamViewType,
  TableV2,
} from 'aws-cdk-lib/aws-dynamodb';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { CfnDeliveryStream } from 'aws-cdk-lib/aws-kinesisfirehose';
import {
  CodeSigningConfig,
  Runtime,
  StartingPosition,
  Tracing,
} from 'aws-cdk-lib/aws-lambda';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Bucket, LifecycleRule } from 'aws-cdk-lib/aws-s3';
import { Platform, SigningProfile } from 'aws-cdk-lib/aws-signer';
import { Construct } from 'constructs';
import { IdBuilder } from '@/utils/naming';

export class DynamodbUserTable extends Construct {
  readonly tableName: string;

  constructor(scope: Construct, id: string, idBuilder: IdBuilder) {
    super(scope, id);

    const userTable = new TableV2(this, 'DynamoDBUserTable', {
      partitionKey: { name: 'UserId', type: AttributeType.STRING },
      tableName: idBuilder.name('user-table'),
      removalPolicy: RemovalPolicy.DESTROY,
      dynamoStream: StreamViewType.NEW_IMAGE,
      pointInTimeRecovery: true,
    });

    const userTableStreamsBucket = new Bucket(this, 'UserTableStreamsBucket', {
      bucketName: idBuilder.name('user-table-bucket'),
      removalPolicy: RemovalPolicy.DESTROY,
      lifecycleRules: [
        {
          expiration: Duration.days(60),
          enabled: true,
        } as LifecycleRule,
      ],
    });

    const firehoseRole = new Role(this, 'FirehoseRole', {
      roleName: idBuilder.name('user-firehose-role'),
      assumedBy: new ServicePrincipal('firehose.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
        ManagedPolicy.fromAwsManagedPolicyName('AWSXrayFullAccess'),
      ],
    });

    const logGroup = new LogGroup(this, 'FirehoseLogGroup', {
      logGroupName: idBuilder.name('user-firehose-log-group'),
      retention: RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const firehoseDeliveryStream = new CfnDeliveryStream(
      this,
      'DeliveryStream',
      {
        deliveryStreamType: 'DirectPut',
        deliveryStreamName: idBuilder.name('user-firehose'),
        extendedS3DestinationConfiguration: {
          bucketArn: userTableStreamsBucket.bucketArn,
          bufferingHints: {
            intervalInSeconds: 60,
            sizeInMBs: 5,
          },
          compressionFormat: 'GZIP',
          roleArn: firehoseRole.roleArn,
          cloudWatchLoggingOptions: {
            enabled: true,
            logGroupName: logGroup.logGroupName,
            logStreamName: idBuilder.name('user-firehose-log-stream'),
          },
        },
      },
    );

    const userTableStreamsFunctionRole = new Role(
      this,
      'UserTableStreamsFunctionRole',
      {
        assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
        managedPolicies: [
          ManagedPolicy.fromAwsManagedPolicyName('AmazonDynamoDBFullAccess'),
          ManagedPolicy.fromAwsManagedPolicyName('AWSXrayFullAccess'),
          ManagedPolicy.fromAwsManagedPolicyName(
            'AmazonKinesisFirehoseFullAccess',
          ),
          ManagedPolicy.fromAwsManagedPolicyName(
            'service-role/AWSLambdaBasicExecutionRole',
          ),
        ],
        roleName: idBuilder.name('user-table-streams-role'),
      },
    );

    const signingProfile = new SigningProfile(
      this,
      'UserTableStreamsSigningProfile',
      {
        platform: Platform.AWS_LAMBDA_SHA384_ECDSA,
      },
    );
    const codeSigningConfig = new CodeSigningConfig(
      this,
      'UserTableStreamsCodeSigningConfig',
      {
        signingProfiles: [signingProfile],
      },
    );

    const userTableStreamsLambda = new NodejsFunction(
      this,
      'UserTableStreamsLambdaHandler',
      {
        codeSigningConfig,
        entry: 'lambda-ts/code/send-user-table-streams-log.ts',
        handler: 'handler',
        runtime: Runtime.NODEJS_20_X,
        timeout: Duration.seconds(120),
        role: userTableStreamsFunctionRole,
        functionName: idBuilder.name('user-table-streams-lambda'),
        environment: {
          DELIVERY_STREAM_NAME: firehoseDeliveryStream.ref,
        },
        logRetention: RetentionDays.ONE_MONTH,
        tracing: Tracing.ACTIVE,
      },
    );

    userTableStreamsLambda.addEventSource(
      new DynamoEventSource(userTable, {
        startingPosition: StartingPosition.TRIM_HORIZON,
      }),
    );

    this.tableName = userTable.tableName;
  }
}
