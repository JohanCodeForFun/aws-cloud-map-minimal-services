#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { CloudMapMinimalServicesStack } from "../lib/cloud-map-minimal-services-stack";

const app = new cdk.App();

new CloudMapMinimalServicesStack(app, "CloudMapMinimalServicesStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  }
});