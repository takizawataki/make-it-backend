#!/usr/bin/env node
import 'source-map-support/register';
import { App, Tags } from 'aws-cdk-lib';
import { MakeItBackendStack } from '@/lib/make-it-backend-stack';
import { IdBuilder } from '@/utils/naming';

const app = new App();

const SERVICE_CODE = 'make-it';
const branch = app.node.tryGetContext('branch');
const idBuilder = new IdBuilder(SERVICE_CODE, branch);

new MakeItBackendStack(app, `MakeIt-${branch}`, idBuilder, {});

// コスト配分タグ
const buildTagVal = () => {
  switch (branch) {
    case 'staging':
    case 'production':
      return branch;
    default:
      return 'development';
  }
};
Tags.of(app).add('Application', buildTagVal());
