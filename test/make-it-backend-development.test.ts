import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { MakeItBackendStack } from '@/lib/make-it-backend-stack';
import { IdBuilder } from '@/utils/naming';

const app = new App();

const SERVICE_CODE = 'make-it';
const branch = 'development';
const idBuilder = new IdBuilder(SERVICE_CODE, branch);

test('Snapshot Test', () => {
  const stack = new MakeItBackendStack(app, 'MyTestStack', idBuilder, {});
  const template = Template.fromStack(stack);
  const sanitizedTemplate = template.toJSON();

  // Lambda Layer Versionの S3Key および Lambda Function の S3Key を削除
  Object.keys(sanitizedTemplate.Resources).forEach((resourceKey) => {
    const resource = sanitizedTemplate.Resources[resourceKey];

    try {
      // AWS::Lambda::Function の Code.S3Key を削除
      if (
        resource.Type === 'AWS::Lambda::Function' &&
        resource.Properties?.Code?.S3Key
      ) {
        delete resource.Properties.Code.S3Key;
      }

      // AWS::Lambda::LayerVersion の Content.S3Key を削除
      if (
        resource.Type === 'AWS::Lambda::LayerVersion' &&
        resource.Properties?.Content?.S3Key
      ) {
        delete resource.Properties.Content.S3Key;
      }
    } catch (error) {
      console.warn(`${resourceKey}が存在しないため削除処理をスキップ:`, error);
    }
  });

  expect(sanitizedTemplate).toMatchSnapshot();
});
