import { Collection, Db, MongoClient, UpdateOptions } from 'mongodb';
import { DatabaseDriver, DatabaseOption, Encrypted, Index, Records } from '../typings';
import * as dbutils from './utils';

type _Document = {
  value: Encrypted;
  expiresAt?: Date;
  modifiedAt: string;
  indexes: string[];
};

class Mongo implements DatabaseDriver {
  private options: DatabaseOption;
  private client!: MongoClient;
  private collection!: Collection;
  private db!: Db;

  constructor(options: DatabaseOption) {
    this.options = options;
  }

  async init(): Promise<Mongo> {
    const dbUrl = this.options.url as string;
    this.client = new MongoClient(dbUrl);
    await this.client.connect();

    this.db = this.client.db();
    this.collection = this.db.collection('jacksonStore');

    await this.collection.createIndex({ indexes: 1 });
    await this.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 1 });

    return this;
  }

  async get(namespace: string, key: string): Promise<any> {
    const res = await this.collection.findOne({
      _id: dbutils.key(namespace, key) as any,
    });
    if (res && res.value) {
      return res.value;
    }

    return null;
  }

  async getAll(namespace: string, pageOffset?: number, pageLimit?: number, _?: string): Promise<Records> {
    const _namespaceMatch = new RegExp(`^${namespace}:.*`);
    const docs = await this.collection
      .find({ _id: _namespaceMatch }, { sort: { createdAt: -1 }, skip: pageOffset, limit: pageLimit })
      .toArray();

    if (docs) {
      return { data: docs.map(({ value }) => value) };
    }
    return { data: [] };
  }

  async getByIndex(
    namespace: string,
    idx: Index,
    offset?: number,
    limit?: number,
    _?: string
  ): Promise<Records> {
    const docs =
      dbutils.isNumeric(offset) && dbutils.isNumeric(limit)
        ? await this.collection
            .find(
              {
                indexes: dbutils.keyForIndex(namespace, idx),
              },
              { sort: { createdAt: -1 }, skip: offset, limit: limit }
            )
            .toArray()
        : await this.collection
            .find({
              indexes: dbutils.keyForIndex(namespace, idx),
            })
            .toArray();

    const ret: string[] = [];
    for (const doc of docs || []) {
      ret.push(doc.value);
    }

    return { data: ret };
  }

  async put(namespace: string, key: string, val: Encrypted, ttl = 0, ...indexes: any[]): Promise<void> {
    const doc = <_Document>{
      value: val,
    };

    if (ttl) {
      doc.expiresAt = new Date(Date.now() + ttl * 1000);
    }

    // no ttl support for secondary indexes
    for (const idx of indexes || []) {
      const idxKey = dbutils.keyForIndex(namespace, idx);

      if (!doc.indexes) {
        doc.indexes = [];
      }
      doc.indexes.push(idxKey);
    }

    doc.modifiedAt = new Date().toISOString();
    await this.collection.updateOne(
      { _id: dbutils.key(namespace, key) as any },
      {
        $set: doc,
        $setOnInsert: {
          createdAt: new Date().toISOString(),
        },
      },
      { upsert: true } as UpdateOptions
    );
  }

  async delete(namespace: string, key: string): Promise<any> {
    return await this.collection.deleteOne({
      _id: dbutils.key(namespace, key) as any,
    });
  }

  async deleteMany(namespace: string, keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }

    const dbKeys = keys.map((key) => dbutils.key(namespace, key)) as any[];

    await this.collection.deleteMany({
      _id: { $in: dbKeys },
    });
  }
}

export default {
  new: async (options: DatabaseOption): Promise<Mongo> => {
    return await new Mongo(options).init();
  },
};
