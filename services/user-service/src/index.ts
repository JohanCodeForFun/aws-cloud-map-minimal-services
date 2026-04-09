import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import express from "express";

const app = express();
const client = new DynamoDBClient({});
const doc = DynamoDBDocumentClient.from(client);
const port = Number(process.env.PORT ?? 3000);
const usersTable = process.env.USERS_TABLE ?? "UsersTable";

app.get("/health", (_request, response) => {
  response.json({ status: "ok", service: "user-service" });
});

app.get("/users/:id", async (request, response) => {
  try {
    const userId = request.params.id;

    const result = await doc.send(
      new GetCommand({
        TableName: usersTable,
        Key: { userId }
      })
    );

    if (!result.Item) {
      response.status(404).json({ message: "Användare hittades inte" });
      return;
    }

    response.json(result.Item);
  } catch (error) {
    console.error("Could not fetch user", error);
    response.status(500).json({ message: "Kunde inte hämta användare" });
  }
});

app.listen(port, () => {
  console.log(`user-service listening on port ${port}`);
});