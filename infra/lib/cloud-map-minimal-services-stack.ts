import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import { RemovalPolicy } from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sd from "aws-cdk-lib/aws-servicediscovery";
import { Construct } from "constructs";

export class CloudMapMinimalServicesStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "LabVpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: "Public",
          subnetType: ec2.SubnetType.PUBLIC
        }
      ]
    });

    const cluster = new ecs.Cluster(this, "Cluster", {
      vpc,
      clusterName: "cloud-map-minimal-services"
    });

    cluster.addDefaultCloudMapNamespace({
      name: "internal.local",
      type: sd.NamespaceType.DNS_PRIVATE,
      useForServiceConnect: false
    });

    const usersTable = new dynamodb.Table(this, "UsersTable", {
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const ordersTable = new dynamodb.Table(this, "OrdersTable", {
      partitionKey: { name: "orderId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const userTaskDefinition = new ecs.FargateTaskDefinition(this, "UserTaskDefinition", {
      cpu: 256,
      memoryLimitMiB: 512
    });

    const userContainer = userTaskDefinition.addContainer("UserContainer", {
      image: ecs.ContainerImage.fromAsset(path.join(__dirname, "../../services/user-service")),
      environment: {
        PORT: "3000",
        USERS_TABLE: usersTable.tableName
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "user-service",
        logRetention: logs.RetentionDays.ONE_WEEK
      })
    });

    userContainer.addPortMappings({ containerPort: 3000 });
    usersTable.grantReadData(userTaskDefinition.taskRole);

    const userService = new ecs.FargateService(this, "UserService", {
      cluster,
      taskDefinition: userTaskDefinition,
      desiredCount: 1,
      assignPublicIp: true,
      serviceName: "user-service",
      cloudMapOptions: {
        name: "user-service"
      },
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC }
    });

    const orderService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, "OrderService", {
      cluster,
      publicLoadBalancer: true,
      assignPublicIp: true,
      desiredCount: 1,
      cpu: 256,
      memoryLimitMiB: 512,
      serviceName: "order-service",
      cloudMapOptions: {
        name: "order-service"
      },
      taskImageOptions: {
        containerName: "order-service",
        containerPort: 3000,
        image: ecs.ContainerImage.fromAsset(path.join(__dirname, "../../services/order-service")),
        environment: {
          PORT: "3000",
          ORDERS_TABLE: ordersTable.tableName,
          USER_SERVICE_URL: "http://user-service.internal.local:3000"
        },
        logDriver: ecs.LogDrivers.awsLogs({
          streamPrefix: "order-service",
          logRetention: logs.RetentionDays.ONE_WEEK
        })
      }
    });

    orderService.targetGroup.configureHealthCheck({
      path: "/health"
    });

    ordersTable.grantReadWriteData(orderService.taskDefinition.taskRole);
    userService.connections.allowFrom(orderService.service, ec2.Port.tcp(3000), "Allow order-service to reach user-service");

    new cdk.CfnOutput(this, "OrderServiceUrl", {
      value: `http://${orderService.loadBalancer.loadBalancerDnsName}`
    });

    new cdk.CfnOutput(this, "UserServiceDiscoveryName", {
      value: "http://user-service.internal.local:3000"
    });

    new cdk.CfnOutput(this, "UsersTableName", {
      value: usersTable.tableName
    });

    new cdk.CfnOutput(this, "OrdersTableName", {
      value: ordersTable.tableName
    });
  }
}