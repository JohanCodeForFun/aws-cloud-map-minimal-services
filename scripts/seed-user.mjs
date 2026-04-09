import { CloudFormationClient, DescribeStacksCommand } from "@aws-sdk/client-cloudformation";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const stackName = process.env.STACK_NAME ?? "CloudMapMinimalServicesStack";
const userId = process.env.USER_ID ?? "u1";
const userName = process.env.USER_NAME ?? "Anna Andersson";
const userEmail = process.env.USER_EMAIL ?? "anna@example.com";

const cloudFormation = new CloudFormationClient({});
const dynamoDb = new DynamoDBClient({});

const stackResponse = await cloudFormation.send(
  new DescribeStacksCommand({ StackName: stackName })
);

const outputs = stackResponse.Stacks?.[0]?.Outputs ?? [];
const usersTableName = outputs.find((output) => output.OutputKey === "UsersTableName")?.OutputValue;

if (!usersTableName) {
  throw new Error(`Could not find UsersTableName output in stack ${stackName}`);
}

await dynamoDb.send(
  new PutItemCommand({
    TableName: usersTableName,
    Item: {
      userId: { S: userId },
      name: { S: userName },
      email: { S: userEmail }
    }
  })
);

console.log(`Seeded user ${userId} into table ${usersTableName}`);