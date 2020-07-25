import {DynamodbUtil} from '../index';
import {DocumentClient} from 'aws-sdk/clients/dynamodb'

const docClient = new DocumentClient({
  region: 'ap-southeast-1'
});
const TABLE = 'Static-Table';
const dataModel = new DynamodbUtil('Static-Table', {
  region: 'ap-southeast-1'
});
beforeAll(() => initDatabase());
afterAll(() => clearDatabase());

// const dynamodb = new DynamodbUtil()

describe('DynamoDBUtil Test Suite', () => {
  describe('jest testing', () => {
    test('simple test', () => {
      expect(1).toBe(1);
    });
  });

  describe('query test', () => {
    test('query with function beginsWith', async () => {
      const result = await dataModel.query({
        keyCondition: {
          _pkey: 'Album1',
          _skey: {
            beginsWith: 'Album1#Araiva'
          }
        }
      });
      expect(result).toContain([
        expect.objectContaining({ _pkey: 'Album1', _skey: 'Album1#Araiva#Track1' }),
        expect.objectContaining({ _pkey: 'Album1', _skey: 'Album1#Araiva#Track2' }),
        expect.objectContaining({ _pkey: 'Album1', _skey: 'Album1#Araiva#Track3' })
      ]);
      expect(result).toHaveLength(3);
    });

    test('query with function beginsWith and filter', async () => {
      const result = await dataModel.query({
        keyCondition: {
          _pkey: 'Album1',
          _skey: {
            beginsWith: 'Album1#Araiva'
          }
        },
        filter: {
          ['song']: 'song theme 12'
        }
      });
      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({ _pkey: 'Album1',  _skey: 'Album1#Araiva#Track2' })
      ]));
      expect(result).toHaveLength(1);
    });
  });

  describe('scan', () => {
    test('query with function beginsWith and filter', async () => {
      const result = await dataModel.scan({
        filter: {
          ['artist']: 'Araiva',
          ['attribute.country']: 'Japan'
        }
      });
      expect(result).toEqual(expect.arrayContaining([
        expect.objectContaining({ _pkey: 'Album1',  _skey: 'Album1#Araiva#Track3' })
      ]));
      expect(result).toHaveLength(1);
    });
  })

  describe('update testing', () => {
    test('update add new body', async () => {
      const key = {_pkey: 'TestPopulation', _skey: 'TestPopulation-1'};
      const body = {
        man: 5000,
        woman: 1000
      };
      const result = await dataModel.update(key, body);
      // expected return
      expect(result).toMatchObject({ ...key, ...body });

      // expected database updated
      const data = await docClient.get({TableName: TABLE, Key: key}).promise();
      expect(data.Item).toMatchObject({ ...key, ...body });
      expect(data.Item).toHaveProperty('country');
      expect(data.Item).toHaveProperty('population');
    });
  });

  describe('patch testing', () => {
    test('patch nest attribute', async () => {
      const key = {_pkey: 'Album1', _skey: 'Album1#Virus#Track4'};
      const duration =  200;
      const result = await dataModel.patch(key, {
        'attribute.duration': duration
      });
      // expected return
      expect(result).toMatchObject({ ...key});

      // expected database updated
      const data = await docClient.get({TableName: TABLE, Key: key}).promise();
      // console.log('updated Data: ', data)
      expect(data.Item?.artist).toBe('Virus');
      expect(data.Item?.attribute.duration).toBe(200);
      expect(data.Item?.attribute.country).toBe('Thailand');
    });

    test('patch lv1 attribute', async () => {
      const key = {_pkey: 'Album2', _skey: 'Album2#Araiva#Track1'};
      const result = await dataModel.patch(key, {
        'artist': 'Virus'
      });
      // expected return
      expect(result).toMatchObject({ ...key});

      // expected database updated
      const data = await docClient.get({TableName: TABLE, Key: key}).promise();
      console.log('updated Data: ', data);
      expect(data.Item?.artist).toBe('Virus');
    });
  })
});

const mock = require('./payloads/mock.json');

function initDatabase() {
  const params = {
    RequestItems: {
      'Static-Table': mock.map((el: any) => ({
        PutRequest: { Item: el }
      }))
    }
  };
  return docClient.batchWrite(params).promise()
}

function clearDatabase() {
  const params = {
    RequestItems: {
      'Static-Table': mock.map((el: any) => ({
        DeleteRequest: {
          Key: {
            _pkey: el._pkey,
            _skey: el._skey
          }
        }
      }))
    }
  };
  return docClient.batchWrite(params).promise()

}
