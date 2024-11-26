import { PythonLayerVersion } from '@aws-cdk/aws-lambda-python-alpha';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';
import { IdBuilder } from '@/utils/naming';

export class LambdaLayer extends Construct {
  public readonly lambdaLayer: PythonLayerVersion;

  constructor(scope: Construct, id: string, idBuilder: IdBuilder) {
    super(scope, id);

    this.lambdaLayer = new PythonLayerVersion(this, 'MyLayer', {
      entry: 'lambda-py',
      layerVersionName: idBuilder.name('lambda-layer'),
      compatibleRuntimes: [Runtime.PYTHON_3_12],
      bundling: {
        assetExcludes: ['.venv'],
      },
    });
  }
}
