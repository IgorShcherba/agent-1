import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";

export function openStorage(databasePath: string) {
  return openNodeSqliteStorage(databasePath);
}
