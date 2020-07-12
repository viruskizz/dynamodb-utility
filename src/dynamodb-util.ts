import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import { DocumentClient, ScanInput, QueryInput } from 'aws-sdk/clients/dynamodb';
import {ScanQueryOptions, ScanOptions, DynamoDBUtilOptions} from './dynamodb-util.interface';

/**
 * ตัวช่วยทำ operation ต่างๆ บน DynamoDB
 */
export class DynamodbUtil {

  private documentClient: DocumentClient;
  private utilOptions: DynamoDBUtilOptions | undefined;
  private readonly table: string;

  constructor(table: string, utilOptions?: DynamoDBUtilOptions) {
    this.documentClient = new DocumentClient({
      apiVersion: 'latest',
      convertEmptyValues : true,
      region: (utilOptions && utilOptions.region) ? utilOptions.region : (process.env.AWS_REGION) ? process.env.AWS_REGION : 'ap-southeast-2',
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
    const time = new Date().getTime();
    return this.get(keys).then(data => {
      const putBody = {
        ...data ,
        ...body,
        ...keys,
        createdAt: (data && typeof data.createdAt === 'number') ? data.createdAt : time,
        updatedAt: time,
      };
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
  async query(options?: ScanOptions) {
    if (!options || !options.filter) { throw new Error('key filtered is required'); }
    const names = this.convertExpressionNames(options.filter);
    const values = this.convertExpressionValue(options.filter);
    const condition = this.createConditionExpression(names, values);
    const param: DynamoDB.QueryInput = {
      TableName: this.table,
      Limit: options.limit,
      ProjectionExpression: (options.attributes) ? options.attributes.join(', ') : undefined,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      KeyConditionExpression: condition,
    };
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
      const condition = this.createConditionExpression(names, values);
      param = {
        ...param,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        FilterExpression: condition,
      };
    }
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
  private createConditionExpression(names: string[], values: string[]) {
    const namesArray = Object.keys(names);
    const valuesArray = Object.keys(values);
    const conditions: string[] = [];
    namesArray.forEach((element, index) => {
      conditions.push(`${element} = ${valuesArray[index]}`);
    });
    return conditions.join(' and ');
  }
  private convertExpressionValue(filter: any) {
    if (typeof filter === 'string') {
      filter = JSON.parse(filter);
    } else if (typeof  filter !== 'object') {
      throw new Error('filter is not Object or JSON');
    }
    const result: any = {};
    Object.keys(filter).forEach(key => {
      result[`:${key}`] = filter[key];
    });
    return result;
  }

  private convertExpressionNames(filter: any) {
    if (typeof filter === 'string') {
      filter = JSON.parse(filter);
    } else if (typeof  filter !== 'object') {
      throw new Error('filter is not Object or JSON');
    }
    const result: any = {};
    Object.keys(filter).forEach(key => {
      result[`#${key}`] = key;
    });
    return result;
  }
}
