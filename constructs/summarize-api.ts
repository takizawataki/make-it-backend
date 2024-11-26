import {
  StepFunctionsIntegration,
  StepFunctionsRestApi,
} from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import { SummarizeStepFunction } from './sfn-summarize';
import { ApiGatewayRestApi } from '@/constructs/apigateway-rest-api';

type SummarizeApiProps = {
  apiGatewayRestApi: ApiGatewayRestApi;
  summarizeStepFunction: SummarizeStepFunction;
};
export class SummarizeApi extends Construct {
  constructor(scope: Construct, id: string, props: SummarizeApiProps) {
    super(scope, id);

    new StepFunctionsRestApi(this, 'SummarizeRestApi', {
      stateMachine: props.summarizeStepFunction.stateMachine,
    });

    const summarizeResource =
      props.apiGatewayRestApi.apiResource.addResource('summarize');
    summarizeResource.addMethod(
      'POST',
      StepFunctionsIntegration.startExecution(
        props.summarizeStepFunction.stateMachine,
      ),
      {
        authorizer: props.apiGatewayRestApi.authorizer,
      },
    );
  }
}
