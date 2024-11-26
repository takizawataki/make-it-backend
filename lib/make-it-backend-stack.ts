import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ApiGatewayRestApi } from '@/constructs/apigateway-rest-api';
import { CognitoAuth } from '@/constructs/cognito-auth';
import { CreateCognitoUserApi } from '@/constructs/create-cognito-user-api';
import { DynamodbSessionTable } from '@/constructs/dynamodb-session-table';
import { DynamodbUserTable } from '@/constructs/dynamodb-user-table';
import { FetchSessionApi } from '@/constructs/fetch-session-api';
import { FetchSessionsApi } from '@/constructs/fetch-sessions-api';
import { FetchUserApi } from '@/constructs/fetch-user-api';
import { GenerateSessionTitleApi } from '@/constructs/generate-session-title-api';
import { LambdaInvokeModel } from '@/constructs/lambda-invoke-model';
import { LambdaLayer } from '@/constructs/lambda-layer';
import { SendSummaryApi } from '@/constructs/send-summary-api';
import { GenerateSessionTitleStepFunction } from '@/constructs/sfn-generate-session-title';
import { SummarizeStepFunction } from '@/constructs/sfn-summarize';
import { SummarizeApi } from '@/constructs/summarize-api';
import { UpdateUserApi } from '@/constructs/update-user-api';
import { IdBuilder } from '@/utils/naming';

export class MakeItBackendStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    idBuilder: IdBuilder,
    props?: StackProps,
  ) {
    super(scope, id, props);

    // Storage
    const sessionTable = new DynamodbSessionTable(
      this,
      'DynamodbSessionTable',
      idBuilder,
    );
    const userTable = new DynamodbUserTable(
      this,
      'DynamodbUserTable',
      idBuilder,
    );

    // Auth
    const cognito = new CognitoAuth(this, 'CognitoAuth', idBuilder, {
      userTableName: userTable.tableName,
    });

    // SFn
    const summarizeStepFunction = new SummarizeStepFunction(
      this,
      'summarizeSfn',
      idBuilder,
    );
    new GenerateSessionTitleStepFunction(
      this,
      'generateSessionTitleSfn',
      idBuilder,
    );

    // GenerateResponse
    new LambdaInvokeModel(this, 'LambdaInvokeModel', idBuilder, {
      sessionTableName: sessionTable.tableName,
      userTableName: userTable.tableName,
    });

    // API
    const apiGatewayRestApi = new ApiGatewayRestApi(
      this,
      'ApiGatewayRestApi',
      idBuilder,
      { userPool: cognito.userPool },
    );
    // API > Python method
    const lambdaLayer = new LambdaLayer(this, 'LambdaLayer', idBuilder);
    new SummarizeApi(this, 'SummarizeApi', {
      apiGatewayRestApi,
      summarizeStepFunction,
    });
    new GenerateSessionTitleApi(this, 'GenerateSessionTitleApi', idBuilder, {
      apiGatewayRestApi,
      lambdaLayer: lambdaLayer.lambdaLayer,
      sessionTableName: sessionTable.tableName,
    });
    // API > Node.js method
    new SendSummaryApi(this, 'SendSummaryApi', idBuilder, {
      apiGatewayRestApi,
      sessionTableName: sessionTable.tableName,
      userTableName: userTable.tableName,
    });
    new CreateCognitoUserApi(this, 'CreateCognitoUserApi', idBuilder, {
      apiGatewayRestApi,
      userPoolClientId: cognito.userPoolClient.userPoolClientId,
    });
    new FetchUserApi(this, 'FetchUserApi', idBuilder, {
      apiGatewayRestApi,
      userTableName: userTable.tableName,
    });
    new UpdateUserApi(this, 'UpdateUserApi', idBuilder, {
      apiGatewayRestApi,
      userTableName: userTable.tableName,
    });
    const fetchSessionsApi = new FetchSessionsApi(
      this,
      'FetchSessionsApi',
      idBuilder,
      {
        apiGatewayRestApi,
        sessionTableName: sessionTable.tableName,
        userTableName: userTable.tableName,
      },
    );
    new FetchSessionApi(this, 'FetchSessionApi', idBuilder, {
      apiGatewayRestApi,
      fetchSessionsResource: fetchSessionsApi.fetchSessionsResource,
      sessionTableName: sessionTable.tableName,
    });
  }
}
