import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

function buildDatabaseUrl() {
  const host = process.env.databaseHost;
  const port = process.env.databasePort;
  const user = process.env.databaseUser;
  const password = process.env.databasePassword;
  const database = process.env.databaseName;

  if (!host || !user || !database) {
    return null;
  }

  const encodedUser = encodeURIComponent(user);
  const encodedPassword = password ? encodeURIComponent(password) : "";
  const authSegment = encodedPassword ? `${encodedUser}:${encodedPassword}` : encodedUser;
  const portSegment = port ? `:${port}` : "";

  return `mysql://${authSegment}@${host}${portSegment}/${database}`;
}

const datasourceUrl = process.env.DATABASE_URL || buildDatabaseUrl();

export const prisma = new PrismaClient(
  datasourceUrl
    ? {
        datasources: {
          db: {
            url: datasourceUrl,
          },
        },
      }
    : undefined
);

prisma
  .$connect()
  .then(() => {
    console.info(`[DB] Prisma client connected successfully.`);
  })
  .catch((err) => {
    console.error(`[ERROR] [DB] There was an error connecting:\n ${err.stack}`);
  });

function normaliseQueryArgs(params, callback) {
  if (typeof params === "function") {
    return { params: [], callback: params };
  }

  return { params: Array.isArray(params) ? params : [], callback };
}

function query(sql, params, callback) {
  const { params: boundParams, callback: cb } = normaliseQueryArgs(params, callback);

  const execution = prisma.$queryRawUnsafe(sql, ...boundParams);

  if (cb) {
    execution
      .then((result) => cb(null, result))
      .catch((error) => cb(error));
  }

  return execution;
}

export default { query, prisma };
