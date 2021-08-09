import * as DynamoDB from 'aws-sdk/clients/dynamodb';
import {DocumentClient, ScanInput, QueryInput, Key} from 'aws-sdk/clients/dynamodb';
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
  public readonly raw: DocumentClient;

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
    this.raw = this.documentClient;
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

  patch(keys: {[key: string]: string}, body: any): Promise<any> {
    let names = this.convertExpressionNames(body);
    let values = this.convertExpressionValue(body, true);
    let expressions: string[] = [];
    Object.keys(body).forEach(key => {
      const keyName = this.createKeyName(key);
      const valueKey = this.createValueKey(key);
      const expressString = `${keyName} = ${valueKey}`;
      expressions.push(expressString);
    });
    const updateExpression = 'set ' + expressions.join(' ,');
    const param = {
      TableName: this.table,
      Key: keys,
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    };
    return this.documentClient.update(param).promise().then(() => this.get(keys))
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
      TableName: this.table,
      IndexName: options.indexName,
      Limit: options.limit,
      ProjectionExpression: (options.attributes) ? options.attributes.join(', ') : undefined,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      KeyConditionExpression: keyCondition,
      FilterExpression: filterCondition || undefined,
      ScanIndexForward: (options.sort === 'ASC') ? true : (options.sort === 'DESC') ? false : undefined,
      ExclusiveStartKey: options.lastKey ? options.lastKey as Key : undefined,
    };
    return this.recursiveOperation('QUERY', param, options)
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
      IndexName: (options && options.indexName) ?  options.indexName : undefined,
      Limit: (options && options.limit) ? options.limit : undefined,
      ProjectionExpression: (options && options.attributes) ? options.attributes.join(', ') : undefined,
      ExclusiveStartKey: (options && options.lastKey) ? options.lastKey as Key : undefined,
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
    return this.recursiveOperation('SCAN', param, options)
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
   * @param fnName
   * @param param
   * @param {ScanOptions} options
   */
  private async recursiveOperation(fnName: string, param: ScanInput | QueryInput, options?: ScanOptions)
    : Promise<any[]> {
    let result: any[] = [];
    let count = 1;
    let optFn;
    if (fnName === 'SCAN') {
      optFn = this.documentClient.scan(param)
    }
    if (fnName === 'QUERY') {
      optFn = this.documentClient.query(param)
    }
    if(!fnName || !optFn) { return []; }
    while (true) {
      const data = await optFn.promise();
      result = [...result, ...data.Items];
      param = {...param, ExclusiveStartKey: data.LastEvaluatedKey};
      if (!options || options.times === undefined || options.times === null) { return result; }
      if (!data.LastEvaluatedKey) { break; }
      if (options.times && count === +options.times) { break; }
      count++;
    }
    return result;
  }

  private createValueKey = (key: string) =>  ':' + key.replace(/\./, '');
  private createKeyName = (key: string) =>  '#' + key.split('.').join('.#');

  private createConditionExpression(filterCondition?: KeyCondition | any) {
    const conditions: any[] = [];
    Object.keys(filterCondition).forEach(key => {
      const keyName = this.createKeyName(key);
      const valueKey = this.createValueKey(key);
      const value = filterCondition[key];
      let string = '';
      if(typeof value === 'string') {
        string = DynamodbUtil.mapConditionToString('equal', keyName, valueKey);
      } else {
        const condition = Object.keys(filterCondition[key])[0];
        const valueKey = this.createValueKey(key);
        string = DynamodbUtil.mapConditionToString(condition, keyName, valueKey);
      }
      conditions.push(string)
    });
    return conditions.join(' and ');
  }

  private convertExpressionValue(filter: any, isnNestObject = false) {
    if (typeof filter === 'string') {
      filter = JSON.parse(filter);
    } else if (typeof  filter !== 'object') {
      throw new Error('filter or keyCondition is not Object or JSON');
    }
    const result: any = {};
    Object.keys(filter).forEach(key => {
      const keyName = key.replace(/\./, '');
      const value = filter[key];
      if (typeof value !== 'object' || isnNestObject) {
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

  private static mapConditionToString(condition: string, key: string, value: string | null) {
    switch (condition) {
      case 'equal':
        return `${key} = ${value}`;
      case 'greaterThan':
        return `${key} > ${value}`;
      case 'lessThan':
        return `${key} < ${value}`;
      case 'attributeExists':
        return `attribute_exists(${key})`;
      case 'attributeNotExists':
        return `attribute_not_exists(${key})`;
      case 'beginsWith':
        return `begins_with(${key}, ${value})`;
      case 'contains':
        return `contains(${key}, ${value})`;
      default:
        return `${key} = ${value}`;
    }
  }
}
