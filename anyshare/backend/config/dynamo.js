const { DynamoDBClient, CreateTableCommand, DescribeTableCommand } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLES = {
  USERS: process.env.DYNAMO_USERS_TABLE || "as_users",
  FILES: process.env.DYNAMO_FILES_TABLE || "as_files",
  SHARES: process.env.DYNAMO_SHARES_TABLE || "as_shares",
  LINK_SHARES: process.env.DYNAMO_LINK_SHARES_TABLE || "as_link_shares",
};

const tableDefinitions = [
  {
    TableName: TABLES.USERS,
    KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "userId", AttributeType: "S" },
      { AttributeName: "email", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "email-index",
        KeySchema: [{ AttributeName: "email", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: TABLES.FILES,
    KeySchema: [{ AttributeName: "fileId", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "fileId", AttributeType: "S" },
      { AttributeName: "ownerId", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "owner-index",
        KeySchema: [{ AttributeName: "ownerId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: TABLES.SHARES,
    KeySchema: [
      { AttributeName: "fileId", KeyType: "HASH" },
      { AttributeName: "granteeId", KeyType: "RANGE" },
    ],
    AttributeDefinitions: [
      { AttributeName: "fileId", AttributeType: "S" },
      { AttributeName: "granteeId", AttributeType: "S" },
      { AttributeName: "granteeEmail", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "grantee-index",
        KeySchema: [{ AttributeName: "granteeId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
      {
        IndexName: "granteeEmail-index",
        KeySchema: [{ AttributeName: "granteeEmail", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
  {
    TableName: TABLES.LINK_SHARES,
    KeySchema: [{ AttributeName: "linkId", KeyType: "HASH" }],
    AttributeDefinitions: [
      { AttributeName: "linkId", AttributeType: "S" },
      { AttributeName: "ownerId", AttributeType: "S" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "owner-links-index",
        KeySchema: [{ AttributeName: "ownerId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
  },
];

async function tableExists(tableName) {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    return true;
  } catch (err) {
    if (err.name === "ResourceNotFoundException") return false;
    throw err;
  }
}

async function initializeTables() {
  console.log("🔧 Initializing DynamoDB tables...");
  for (const def of tableDefinitions) {
    const exists = await tableExists(def.TableName);
    if (!exists) {
      await client.send(new CreateTableCommand(def));
      console.log("  Created table: " + def.TableName);
    } else {
      console.log("  Table exists: " + def.TableName);
    }
  }
  console.log("DynamoDB ready\n");
}

module.exports = { docClient, TABLES, initializeTables };
