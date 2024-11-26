import {
  CognitoUserPoolsAuthorizer,
  Resource,
  RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { IdBuilder } from '@/utils/naming';

type ApiGatewayRestApiProps = {
  userPool: UserPool;
};

export class ApiGatewayRestApi extends Construct {
  public readonly restApi: RestApi;
  public readonly authorizer: CognitoUserPoolsAuthorizer;
  public readonly apiResource: Resource;

  constructor(
    scope: Construct,
    id: string,
    idBuilder: IdBuilder,
    props: ApiGatewayRestApiProps,
  ) {
    super(scope, id);

    this.authorizer = new CognitoUserPoolsAuthorizer(this, 'Authorizer', {
      cognitoUserPools: [props.userPool],
      authorizerName: idBuilder.name('cognito-authorizer'),
    });

    this.restApi = new RestApi(this, 'RestApi', {
      restApiName: idBuilder.name('rest-api'),
      description: 'API for make it application',
      deployOptions: {
        stageName: idBuilder.branchName,
        tracingEnabled: true,
      },
    });

    this.apiResource = this.restApi.root.addResource('api');
  }
}
