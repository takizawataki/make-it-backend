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

export class DynamodbSessionTable extends Construct {
  readonly tableName: string;

  constructor(scope: Construct, id: string, idBuilder: IdBuilder) {
    super(scope, id);

    const sessionTable = new TableV2(this, 'DynamoDBSessionTable', {
      partitionKey: { name: 'SessionId', type: AttributeType.STRING },
      tableName: idBuilder.name('session-table'),
      removalPolicy: RemovalPolicy.DESTROY,
      dynamoStream: StreamViewType.NEW_IMAGE,
      pointInTimeRecovery: true,
    });

    const sessionTableStreamsBucket = new Bucket(
      this,
      'SessionTableStreamsBucket',
      {
        bucketName: idBuilder.name('session-table-bucket'),
        removalPolicy: RemovalPolicy.DESTROY,
        lifecycleRules: [
          {
            expiration: Duration.days(60),
            enabled: true,
          } as LifecycleRule,
        ],
      },
    );

    const firehoseRole = new Role(this, 'FirehoseRole', {
      roleName: idBuilder.name('session-firehose-role'),
      assumedBy: new ServicePrincipal('firehose.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
      ],
    });

    const logGroup = new LogGroup(this, 'FirehoseLogGroup', {
      logGroupName: idBuilder.name('session-firehose-log-group'),
      retention: RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const firehoseDeliveryStream = new CfnDeliveryStream(
      this,
      'DeliveryStream',
      {
        deliveryStreamType: 'DirectPut',
        deliveryStreamName: idBuilder.name('session-firehose'),
        extendedS3DestinationConfiguration: {
          bucketArn: sessionTableStreamsBucket.bucketArn,
          bufferingHints: {
            intervalInSeconds: 60,
            sizeInMBs: 5,
          },
          compressionFormat: 'GZIP',
          roleArn: firehoseRole.roleArn,
          cloudWatchLoggingOptions: {
            enabled: true,
            logGroupName: logGroup.logGroupName,
            logStreamName: idBuilder.name('session-firehose-log-stream'),
          },
        },
      },
    );

    const sessionTableStreamsFunctionRole = new Role(
      this,
      'SessionTableStreamsFunctionRole',
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
        roleName: idBuilder.name('session-table-streams-role'),
      },
    );

    const signingProfile = new SigningProfile(
      this,
      'SessionTableStreamsSigningProfile',
      {
        platform: Platform.AWS_LAMBDA_SHA384_ECDSA,
      },
    );
    const codeSigningConfig = new CodeSigningConfig(
      this,
      'SessionTableStreamsCodeSigningConfig',
      {
        signingProfiles: [signingProfile],
      },
    );

    const sessionTableStreamsLambda = new NodejsFunction(
      this,
      'SessionTableStreamsLambdaHandler',
      {
        codeSigningConfig,
        entry: 'lambda-ts/code/send-session-table-streams-log.ts',
        handler: 'handler',
        runtime: Runtime.NODEJS_20_X,
        timeout: Duration.seconds(120),
        role: sessionTableStreamsFunctionRole,
        functionName: idBuilder.name('session-table-streams-lambda'),
        environment: {
          DELIVERY_STREAM_NAME: firehoseDeliveryStream.ref,
        },
        logRetention: RetentionDays.ONE_MONTH,
        tracing: Tracing.ACTIVE,
      },
    );

    sessionTableStreamsLambda.addEventSource(
      new DynamoEventSource(sessionTable, {
        startingPosition: StartingPosition.TRIM_HORIZON,
      }),
    );

    this.tableName = sessionTable.tableName;
  }
}
