# Cloud Map Minimal Services

Det här är en minimal ECS-labb med två tjänster i TypeScript:

- `user-service` läser användare från DynamoDB
- `order-service` anropar `user-service` via Cloud Map och sparar en order i DynamoDB

Projektet deployar allt som behövs med AWS CDK:

- VPC
- ECS Cluster
- AWS Cloud Map namespace `internal.local`
- `user-service` som intern Fargate-tjänst
- `order-service` bakom en publik Application Load Balancer
- `UsersTable` och `OrdersTable` i DynamoDB

## Struktur

```text
cloud-map-minimal-services/
├── infra/
├── services/
│   ├── order-service/
│   └── user-service/
├── cdk.json
└── package.json
```

## Förutsättningar

- Docker installerat lokalt
- AWS CLI konfigurerat
- Node.js 20 eller senare
- En bootstrappad CDK-miljö i kontot/regionen

## Kom igång

Installera beroenden:

```bash
npm install
```

Bootstrapa CDK i konto/region om det inte redan är gjort:

```bash
npm run bootstrap
```

Deploya hela lösningen:

```bash
npm run deploy
```

CDK bygger då Docker-images från `services/user-service` och `services/order-service`, pushar dem och skapar infrastrukturen i AWS.

## Efter deploy

Stacken skriver ut:

- URL till `order-service`
- Cloud Map-namnet för `user-service`
- DynamoDB-tabellernas namn

Exempel på anrop till `order-service`:

```bash
curl -X POST http://<alb-url>/orders \
  -H 'content-type: application/json' \
  -d '{"userId":"u1","product":"AWS Book","quantity":1}'
```

## Seed-data

Lägg in en användare i `UsersTable` efter deploy:

```bash
npm run seed:user
```

Standardvärdet blir användaren `u1`. Du kan även skriva över värden med miljövariabler:

```bash
USER_ID=u2 USER_NAME="Bertil Berg" USER_EMAIL="bertil@example.com" npm run seed:user
```

Om du vill göra samma sak manuellt går det fortfarande bra:

```bash
aws dynamodb put-item \
  --table-name <UsersTableName> \
  --item '{
    "userId": {"S": "u1"},
    "name": {"S": "Anna Andersson"},
    "email": {"S": "anna@example.com"}
  }'
```

## Verifiera flödet

Skapa en order efter att du seedat användaren:

```bash
curl -X POST http://<alb-url>/orders \
  -H 'content-type: application/json' \
  -d '{"userId":"u1","product":"AWS Book","quantity":1}'
```

Ett lyckat svar visar att:

- `order-service` nås via ALB
- `order-service` hittar `user-service` via Cloud Map
- `user-service` läser användaren från DynamoDB
- `order-service` sparar ordern i `OrdersTable`

## Rensa upp

```bash
npm run destroy
```