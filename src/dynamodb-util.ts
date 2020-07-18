import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import { DocumentClient, ScanInput, QueryInput } from 'aws-sdk/clients/dynamodb';
import {
  ScanQueryOptions,
  ScanOptions,
  DynamoDBUtilOptions,
  QueryOptions,
  KeyCondition,
  ConditionFunction
} from './dynamodb-util.interface';

/**
 * ตัวช่วยทำ operation ต่างๆ บน DynamoDB
 */
export class DynamodbUtil {

  private documentClient: DocumentClient;
  private readonly utilOptions: DynamoDBUtilOptions | undefined;
  private readonly table: string;

  constructor(table: string, utilOptions?: DynamoDBUtilOptions) {
    this.documentClient = new DocumentClient({
      apiVersion: 'latest',
      convertEmptyValues : true,
      // region: (utilOptions && utilOptions.region) ? utilOptions.region : undefined,
      region: (utilOptions && utilOptions.region) ? utilOptions.region : undefined,
      accessKeyId:  (utilOptions && utilOptions.accessKeyId) ? utilOptions.accessKeyId : undefined,
      secretAccessKey: (utilOptions && utilOptions.secretAccessKey) ? utilOptions.secretAccessKey : undefined,
    });
    this.table = table;
    this.utilOptions = utilOptions;
  }

  /**
   * เรียกข้อมูลแบบ get item จาก DynamoDB
   * @param {object<[key: string]: string>} keys key หลักในการเรียกข้อมูลจากตาราง partitionKey หรือ compositeKey
   */
  get(keys: {[key: string]: string}) {
    const params = {
      TableName: this.table,
      Key: keys,
    };
    return this.documentClient.get(params).promise().then(res => res.Item);
  }

  /**
   * เก็บข้อมูลแบบ put item จาก DynamoDB
   * @param {body} body เนื้อหาข้อมูลที่ต้อง save ลง database
   */
  put(body: any) {
    if (this.utilOptions && this.utilOptions.timestamp) {
      const time = new Date().getTime();
      body = {
        ...body,
        createdAt: body.createdAt || time,
        updatedAt: new Date().getTime(),
      };
    }
    const params = {
      TableName: this.table,
      Item: body,
    };
    return this.documentClient.put(params).promise()
      .then(() => body);
  }

  /**
   * เก็บข้อมูลแบบ update item จาก DynamoDB
   * @param {object<[key: string]: string>} keys key หลักในการเรียกข้อมูลจากตาราง partitionKey หรือ compositeKey
   * @param {body} body เนื้อหาข้อมูลที่ต้อง save ลง database
   */
  update(keys: {[key: string]: string}, body: any) {
    return this.get(keys).then(data => {
      const putBody = {
        ...data ,
        ...body,
        ...keys,
      };
      if (this.utilOptions && this.utilOptions.timestamp) {
        const time = new Date().getTime();
        body = {
          ...body,
          createdAt: (data && typeof data.createdAt === 'number') ? data.createdAt : time,
          updatedAt: time,
        };
      }
      const params = { TableName: this.table, Item: putBody };
      return this.documentClient.put(params).promise()
        .then(() => putBody);
    });
  }

  /**
   * ลบข้อมูล item จาก DynamoDB
   * @param {object<[key: string]: string>} keys key หลักในการเรียกข้อมูลจากตาราง partitionKey หรือ compositeKey
   */
  delete(keys: any): Promise<any> {
    const params = {
      TableName: this.table,
      Key: keys,
    };
    return this.documentClient.delete(params).promise()
      .then(res => {
        return keys;
      });
  }

  /**
   * Query Operation บน DynamoDB แบบรองรับ recursive รองรับได้เฉพาะ Attribute lv 1
   * @param {ScanOptions} options รายละเอียดของ Query Param
   */
  async query(options?: QueryOptions) {
    if (!options || !options.keyCondition) { throw new Error('keyCondition filtered is required'); }
    let names = this.convertExpressionNames(options.keyCondition);
    let values = this.convertExpressionValue(options.keyCondition);
    const keyCondition = this.createConditionExpression(options.keyCondition);
    let filterCondition;
    if(options.filter) {
      const filterNames = this.convertExpressionNames(options.filter);
      const filterValues = this.convertExpressionValue(options.filter);
      filterCondition = this.createConditionExpression(options.filter);
      names = Object.assign(names, filterNames);
      values = Object.assign(values, filterValues);
    }
    const param: DynamoDB.QueryInput = {
      IndexName: options.indexName,
      TableName: this.table,
      Limit: options.limit,
      ProjectionExpression: (options.attributes) ? options.attributes.join(', ') : undefined,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      KeyConditionExpression: keyCondition,
      FilterExpression: filterCondition || undefined,
    };
    console.log(param)
    return DynamodbUtil.recursiveOperation(this.documentClient.query(param), param, options)
      .catch(e => {
        console.log(e);
        throw new Error(e);
      });
  }

  /**
   * Scan Operation บน DynamoDB แบบรองรับ recursive
   * @param {string} options รายละเอียดของ Scan Param
   */
  async scan(options?: ScanOptions) {
    let param: DynamoDB.ScanInput = {
      TableName: this.table,
      Limit: (options && options.limit) ? options.limit : undefined,
      ProjectionExpression: (options && options.attributes) ? options.attributes.join(', ') : undefined,
    };
    if (options && options.filter) {
      const names = this.convertExpressionNames(options.filter);
      const values = this.convertExpressionValue(options.filter);
      const filterCondition = this.createConditionExpression(options.filter);
      param = {
        ...param,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        FilterExpression: filterCondition,
      };
    }
    // return param
    return DynamodbUtil.recursiveOperation(this.documentClient.scan(param), param, options)
      .catch(e => {
        console.log(e);
        throw new Error(e);
      });
  }

  public static convertScanQueryOptions(options: ScanQueryOptions): Partial<ScanOptions> {
    return {
      ...options,
      attributes: (options.attributes) ? options.attributes.replace(' ', '').split(',') : undefined,
    };
  }

  // === Private function is below == //

  /**
   * Recursive function for Scan and Query operation
   * @param optFn
   * @param param
   * @param {ScanOptions} options
   */
  private static async recursiveOperation(optFn: any, param: ScanInput | QueryInput, options?: ScanOptions)
    : Promise<any[]> {
    let result: any[] = [];
    let count = 1;
    while (true) {
      const data = await optFn.promise();
      result = [...result, ...data.Items];
      param = {...param, ExclusiveStartKey: data.LastEvaluatedKey};
      if (!options || !options.times) { return result; }
      if (options.times && count === +options.times) { break; }
      if (!data.LastEvaluatedKey) { break; }
      count++;
    }
    return result;
  }

  private createConditionExpression(filterCondition?: KeyCondition | any) {
    const keys = Object.keys(filterCondition);
    const conditions: any[] = [];
    keys.forEach(key => {
      const keyName = '#' + key.split('.').join('.#');
      const value = filterCondition[key];
      const valueKey = ':' + key.replace(/\./, '');
      let string = '';
      if(typeof value === 'string') {
        string = `${keyName} = ${valueKey}`;
      } else {
        const condition = Object.keys(filterCondition[key])[0];
        const valueKey = ':' + key.replace(/\./, '');
        string = this.mapConditionToString(condition, keyName, valueKey);
      }
      conditions.push(string)
    })
    return conditions.join(' and ');
  }

  private convertExpressionValue(filter: any) {
    if (typeof filter === 'string') {
      filter = JSON.parse(filter);
    } else if (typeof  filter !== 'object') {
      throw new Error('filter or keyCondition is not Object or JSON');
    }
    const result: any = {};
    Object.keys(filter).forEach(key => {
      const keyName = key.replace(/\./, '');
      const value = filter[key];
      if (typeof value === 'string') {
        result[`:${keyName}`] = value;
      } else {
        result[`:${keyName}`] = Object.values(value)[0];
      }
    });
    return result;
  }

  private convertExpressionNames(filter: any) {
    if (typeof filter === 'string') {
      filter = JSON.parse(filter);
    } else if (typeof  filter !== 'object') {
      throw new Error('filter or keyCondition is not Object or JSON');
    }
    const result: any = {};
    Object.keys(filter).forEach(key => {
      const keyNames = key.split('.');
      keyNames.forEach(key => {
        result[`#${key}`] = key;
      })
    });
    return result;
  }

  private mapConditionToString(condition: string, key: string, value: string) {
    console.log(condition)
    switch (condition) {
      case 'equal':
        return `${key} = conditionValue`;
      case 'beginsWith':
        return `begins_with(${key}, ${value})`;
      default:
        return `${key} = ${value}`;
    }
  }
}
