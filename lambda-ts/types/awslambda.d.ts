// https://developer.mamezou-tech.com/blogs/2023/04/23/lambda-response-streaming-intro/
import { APIGatewayProxyEvent, Context, Handler } from 'aws-lambda';

declare global {
  namespace awslambda {
    function streamifyResponse(
      f: (
        event: APIGatewayProxyEvent,
        responseStream: NodeJS.WritableStream,
        context: Context,
      ) => Promise<void>,
    ): Handler;
  }
}
