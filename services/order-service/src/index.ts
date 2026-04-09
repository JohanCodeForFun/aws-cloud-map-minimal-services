import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import crypto from "node:crypto";
import express from "express";

type CreateOrderRequest = {
  userId?: string;
  product?: string;
  quantity?: number;
};

const app = express();
const client = new DynamoDBClient({});
const doc = DynamoDBDocumentClient.from(client);
const port = Number(process.env.PORT ?? 3000);
const ordersTable = process.env.ORDERS_TABLE ?? "OrdersTable";
const userServiceUrl = process.env.USER_SERVICE_URL ?? "http://user-service.internal.local:3000";

app.use(express.json());

app.get("/health", (_request, response) => {
  response.json({ status: "ok", service: "order-service" });
});

app.post("/orders", async (request, response) => {
  try {
    const { userId, product, quantity } = request.body as CreateOrderRequest;

    if (!userId || !product || !quantity || quantity < 1) {
      response.status(400).json({ message: "userId, product och quantity krävs" });
      return;
    }

    const userResponse = await fetch(`${userServiceUrl}/users/${userId}`);

    if (!userResponse.ok) {
      response.status(400).json({ message: "Ogiltig användare" });
      return;
    }

    const user = await userResponse.json();
    const order = {
      orderId: crypto.randomUUID(),
      userId,
      product,
      quantity,
      status: "created",
      createdAt: new Date().toISOString(),
      userName: user.name
    };

    await doc.send(
      new PutCommand({
        TableName: ordersTable,
        Item: order
      })
    );

    response.status(201).json(order);
  } catch (error) {
    console.error("Could not create order", error);
    response.status(500).json({ message: "Kunde inte skapa order" });
  }
});

app.listen(port, () => {
  console.log(`order-service listening on port ${port}`);
});